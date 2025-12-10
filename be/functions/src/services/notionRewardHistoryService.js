const { Client } = require('@notionhq/client');
const { db, FieldValue } = require("../config/database");
const { ADMIN_LOG_ACTIONS } = require("../constants/adminLogActions");

// 배치 처리 설정 (notionUserService와 동일)
const DELAY_MS = 1200; // 지연시간
const BATCH_SIZE = 500; // 배치 사이즈

// changeType → 지급 타입 매핑
const CHANGE_TYPE_TO_PAYMENT_TYPE_MAP = {
  'add': '지급',
  'deduct': '차감',
};

// 대상 액션 키 목록
const TARGET_ACTION_KEYS = [
  'additional_point',
  'comment',
  'routine_post',
  'routine_review',
  'gathering_review_text',
  'gathering_review_media',
  'tmi_review',
  'store',
  'expiration',
];

class NotionRewardHistoryService {
  constructor() {
    const {
      NOTION_API_KEY,
      NOTION_REWARD_HISTORY_DB_ID,
      NOTION_USER_ACCOUNT_DB_ID,
      NOTION_REWARD_POLICY_DB_ID,
    } = process.env;

    // 환경 변수 검증
    if (!NOTION_API_KEY) {
      const error = new Error("NOTION_API_KEY 환경변수가 설정되지 않았습니다");
      error.code = "INTERNAL_ERROR";
      throw error;
    }
    if (!NOTION_REWARD_HISTORY_DB_ID) {
      const error = new Error("NOTION_REWARD_HISTORY_DB_ID 환경변수가 설정되지 않았습니다");
      error.code = "INTERNAL_ERROR";
      throw error;
    }
    if (!NOTION_USER_ACCOUNT_DB_ID) {
      const error = new Error("NOTION_USER_ACCOUNT_DB_ID 환경변수가 설정되지 않았습니다");
      error.code = "INTERNAL_ERROR";
      throw error;
    }

    this.notion = new Client({
      auth: NOTION_API_KEY,
    });

    this.notionRewardHistoryDB = NOTION_REWARD_HISTORY_DB_ID;
    this.notionUserAccountDB = NOTION_USER_ACCOUNT_DB_ID;
    this.notionRewardPolicyDB = NOTION_REWARD_POLICY_DB_ID;
  }


  /**
   * Notion 리워드 정책 DB에서 actionKey → 사용자 행동 매핑 조회
   * @return {Promise<Object>} {actionKey: 사용자 행동} 매핑
   */
  async getRewardPolicyMapping() {
    try {
      if (!this.notionRewardPolicyDB) {
        console.warn('[WARN] NOTION_REWARD_POLICY_DB_ID가 설정되지 않아 정책 매핑을 조회할 수 없습니다.');
        return {};
      }

      let results = [];
      let hasMore = true;
      let startCursor;

      while (hasMore) {
        const res = await fetch(`https://api.notion.com/v1/databases/${this.notionRewardPolicyDB}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page_size: 100,
            start_cursor: startCursor,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[Notion 정책 API Error] Status: ${res.status}, Response: ${errorText}`);
          return {};
        }

        const data = await res.json();

        if (data.error) {
          console.error(`[Notion 정책 API Error]`, data.error);
          return {};
        }

        results = results.concat(data.results);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }

      const policyMap = {};
      for (const page of results) {
        const props = page.properties;
        const actionKey = props["__DEV_ONLY__"]?.rich_text?.[0]?.plain_text || null;
        const userAction = props["사용자 행동"]?.title?.[0]?.plain_text || null;
        
        if (actionKey && userAction) {
          policyMap[actionKey] = {
            userAction: userAction,
            pageId: page.id
          };
        }
      }

      console.log(`[정책 매핑] ${Object.keys(policyMap).length}개의 정책을 조회했습니다.`);
      return policyMap;
    } catch (error) {
      console.error('[정책 매핑 조회 실패]:', error.message);
      return {};
    }
  }

  /**
   * 전체 사용자의 리워드 히스토리를 Notion에 동기화
   * @return {Promise<{syncedCount: number, failedCount: number, total: number}>}
   */
  async syncRewardHistoryToNotion() {
    try {
      console.log('=== 리워드 히스토리 동기화 시작 ===');

      // 0. Notion 리워드 정책 DB에서 actionKey → 사용자 행동 매핑 조회
      const rewardPolicyMap = await this.getRewardPolicyMapping();

      // 1. Firestore에서 전체 rewardsHistory 조회 (collectionGroup 쿼리)
      const rewardsHistorySnapshot = await db
        .collectionGroup('rewardsHistory')
        .where('actionKey', 'in', TARGET_ACTION_KEYS)
        .where('changeType', 'in', ['add', 'deduct'])
        .orderBy('createdAt', 'desc')
        .get();

      console.log(`Firestore에서 ${rewardsHistorySnapshot.docs.length}개의 리워드 히스토리를 가져왔습니다.`);

      if (rewardsHistorySnapshot.docs.length === 0) {
        console.log('동기화할 리워드 히스토리가 없습니다.');
        return { syncedCount: 0, failedCount: 0, total: 0 };
      }

      // 2. Notion에 있는 기존 리워드 히스토리 목록 가져오기 (중복 체크용)
      const notionRewardHistories = await this.getNotionRewardHistories(this.notionRewardHistoryDB);

      // 3. Notion 회원 관리 DB에서 전체 사용자 정보 미리 조회 (성능 개선)
      let notionUsersMap = {};
      try {
        const userDbId = this.notionUserAccountDB;
        let userResults = [];
        let hasMoreUsers = true;
        let userStartCursor;

        while (hasMoreUsers) {
          const res = await fetch(`https://api.notion.com/v1/databases/${userDbId}/query`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              page_size: 100,
              start_cursor: userStartCursor,
            }),
          });

          // HTTP 응답 상태 확인
          if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Notion 사용자 API Error] Status: ${res.status}, Response: ${errorText}`);
            throw new Error(`Notion API 요청 실패: ${res.status} - ${errorText}`);
          }

          const data = await res.json();

          // Notion API 에러 응답 확인
          if (data.error) {
            console.error(`[Notion 사용자 API Error]`, data.error);
            throw new Error(`Notion API 에러: ${data.error.message || JSON.stringify(data.error)}`);
          }

          if (data.results) {
            userResults = userResults.concat(data.results);
            hasMoreUsers = data.has_more;
            userStartCursor = data.next_cursor;
          } else {
            hasMoreUsers = false;
          }
        }

        // userId → pageId 매핑 생성
        for (const page of userResults) {
          const props = page.properties;
          const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text || null;
          if (userId) {
            notionUsersMap[userId] = { pageId: page.id };
          }
        }
        console.log(`[성능 개선] ${Object.keys(notionUsersMap).length}명의 사용자 정보를 미리 조회했습니다.`);
      } catch (error) {
        console.warn(`[WARN] 사용자 정보 미리 조회 실패:`, error.message);
      }

      let syncedCount = 0;
      let failedCount = 0;
      const syncedHistoryIds = [];
      const failedHistoryIds = [];

      // 4. 배치 처리로 Notion에 동기화
      for (let i = 0; i < rewardsHistorySnapshot.docs.length; i += BATCH_SIZE) {
        const batch = rewardsHistorySnapshot.docs.slice(i, i + BATCH_SIZE);
        console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rewardsHistorySnapshot.docs.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, rewardsHistorySnapshot.docs.length)}번째)`);

        // 배치 내에서 병렬 처리
        const batchPromises = batch.map(async (doc) => {
          try {
            const historyData = doc.data();
            const historyId = doc.id;
            
            // userId 추출
            const pathParts = doc.ref.path.split('/');
            const userId = pathParts[1];

            if (!userId) {
              console.warn(`[WARN] userId를 추출할 수 없습니다: ${doc.ref.path}`);
              failedCount++;
              failedHistoryIds.push(historyId);
              return { success: false, historyId, error: 'userId_not_found' };
            }

            // Notion 회원 관리 DB에서 사용자 pageId 조회
            const notionUser = notionUsersMap[userId] || null;

            // 리워드 타입 결정
            let rewardTypeRelation = [];
            if (rewardPolicyMap[historyData.actionKey]) {
              const policyInfo = rewardPolicyMap[historyData.actionKey];
              rewardTypeRelation = [{ id: policyInfo.pageId }];
            }
            
            const paymentType = CHANGE_TYPE_TO_PAYMENT_TYPE_MAP[historyData.changeType] || '지급';
            const content = historyData.reason || '';
            const amount = historyData.amount || 0;

            // 적립/차감 날짜
            let rewardDate = null;
            if (historyData.createdAt) {
              if (historyData.createdAt.toDate) {
                rewardDate = historyData.createdAt.toDate().toISOString();
              } else if (historyData.createdAt instanceof Date) {
                rewardDate = historyData.createdAt.toISOString();
              } else if (typeof historyData.createdAt === 'string') {
                rewardDate = new Date(historyData.createdAt).toISOString();
              }
            }

            // 만료 날짜
            let expiryDate = null;
            if (historyData.expiresAt) {
              try {
                if (historyData.expiresAt.toDate) {
                  expiryDate = historyData.expiresAt.toDate().toISOString();
                } else if (historyData.expiresAt instanceof Date) {
                  expiryDate = historyData.expiresAt.toISOString();
                } else if (typeof historyData.expiresAt === 'string') {
                  expiryDate = new Date(historyData.expiresAt).toISOString();
                }
              } catch (error) {
                // 파싱 실패 시 무시
              }
            }

            // Notion 페이지 데이터 구성
            const notionPage = {
              '나다움 ID': { 
                title: [{ 
                  text: { 
                    content: historyId
                  } 
                }] 
              },
            };

            // 회원 relation 필드 추가
            if (notionUser && notionUser.pageId) {
              notionPage['회원'] = {
                relation: [{ id: notionUser.pageId }]
              };
            }

            // 나머지 필드 추가
            notionPage['리워드 타입'] = {
              relation: rewardTypeRelation
            };
            notionPage['나다움 포인트'] = {
              number: amount
            };
            notionPage['내용'] = {
              rich_text: content ? [{ text: { content: content } }] : []
            };
            notionPage['지급 타입'] = {
              select: {
                name: paymentType
              }
            };
            notionPage['적립/차감 날짜'] = rewardDate ? {
              date: { start: rewardDate }
            } : { date: null };
            
            // 만료 날짜 필드 추가 (expiresAt이 있는 경우)
            if (expiryDate) {
              notionPage['만료 날짜'] = {
                date: { start: expiryDate }
              };
            }

            // 중복 체크 및 재생성
            const uniqueKey = historyId;
            if (notionRewardHistories[uniqueKey]) {
              await this.archiveNotionPageWithRetry(notionRewardHistories[uniqueKey].pageId);
            }
            await this.createNotionPageWithRetry(notionPage);

            syncedCount++;
            syncedHistoryIds.push(historyId);
            return { success: true, historyId };
          } catch (error) {
            failedCount++;
            const historyId = doc.id;
            failedHistoryIds.push(historyId);
            console.error(`[동기화 실패] 리워드 히스토리 ${historyId}:`, error.message || error);
            return { success: false, historyId, error: error.message };
          }
        });

        // 배치 결과 처리
        const batchResults = await Promise.all(batchPromises);
        const batchSuccess = batchResults.filter(r => r.success).length;
        const batchFailed = batchResults.filter(r => !r.success).length;

        console.log(`배치 완료: 성공 ${batchSuccess}개, 실패 ${batchFailed}개 (총 진행률: ${syncedCount + failedCount}/${rewardsHistorySnapshot.docs.length})`);

        // 마지막 배치가 아니면 지연
        if (i + BATCH_SIZE < rewardsHistorySnapshot.docs.length) {
          console.log(`${DELAY_MS/1000}초 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      console.log(`=== 리워드 히스토리 동기화 완료 ===`);
      console.log(`총 ${syncedCount}개 동기화, 실패: ${failedCount}개`);

      // adminLogs에 동기화 결과 저장
      try {
        const logRef = db.collection("adminLogs").doc();
        await logRef.set({
          adminId: "Notion 관리자",
          action: ADMIN_LOG_ACTIONS.REWARD_SYNCED,
          targetId: "",
          timestamp: new Date(),
          metadata: {
            syncedCount: syncedCount,
            failedCount: failedCount,
            total: rewardsHistorySnapshot.docs.length,
            syncedHistoryIds: syncedHistoryIds,
            failedHistoryIds: failedHistoryIds,
          }
        });
        console.log(`[adminLogs] 리워드 히스토리 동기화 이력 저장 완료`);
      } catch (logError) {
        console.error("[adminLogs] 로그 저장 실패:", logError);
      }

      return { 
        syncedCount, 
        failedCount, 
        total: rewardsHistorySnapshot.docs.length 
      };
    } catch (error) {
      console.error('syncRewardHistoryToNotion 전체 오류:', error);
      throw error;
    }
  }

  /**
   * Notion 리워드 히스토리 DB에서 모든 페이지 조회
   * @param {string} databaseId - Notion 데이터베이스 ID
   * @return {Promise<Object>} {uniqueKey: {pageId, ...}}
   */
  async getNotionRewardHistories(databaseId) {
    let results = [];
    let hasMore = true;
    let startCursor;

    while (hasMore) {
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: startCursor,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Notion API Error] Status: ${res.status}, Response: ${errorText}`);
        const err = new Error(`Notion API 요청 실패: ${res.status} - ${errorText}`);
        err.code = "INTERNAL_ERROR";
        throw err;
      }

      const data = await res.json();

      if (data.error) {
        console.error(`[Notion API Error]`, data.error);
        const err = new Error(`Notion API 에러: ${data.error.message || JSON.stringify(data.error)}`);
        err.code = "INTERNAL_ERROR";
        throw err;
      }

      results = results.concat(data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    const historyMap = {};
    for (const page of results) {
      const props = page.properties;
      const title = props["나다움 ID"]?.title?.[0]?.plain_text || null;
      if (title) {
        historyMap[title] = { pageId: page.id };
      }
    }
    return historyMap;
  }

  /**
   * 재시도 로직이 포함된 Notion 페이지 아카이브 (삭제)
   * @param {string} pageId - Notion 페이지 ID
   * @param {number} maxRetries - 최대 재시도 횟수
   */
  async archiveNotionPageWithRetry(pageId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ archived: true }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[Notion API Error] Status: ${res.status}, Response: ${errorText}`);
          const err = new Error(`Notion API 요청 실패: ${res.status} - ${errorText}`);
          err.code = "INTERNAL_ERROR";
          throw err;
        }

        return; // 성공하면 종료
      } catch (error) {
        console.warn(`Notion 페이지 아카이브 시도 ${attempt}/${maxRetries} 실패 (pageId: ${pageId}):`, error.message);
        
        if (attempt === maxRetries) {
          const finalError = new Error(`Notion 페이지 아카이브 최종 실패 (pageId: ${pageId}): ${error.message}`);
          finalError.code = error.code || "INTERNAL_ERROR";
          throw finalError;
        }
        
        // 지수 백오프: 1초, 2초, 4초...
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * 재시도 로직이 포함된 Notion 페이지 생성
   * @param {Object} notionPage - Notion 페이지 속성
   * @param {number} maxRetries - 최대 재시도 횟수
   * @param {string} databaseId - Notion 데이터베이스 ID
   */
  async createNotionPageWithRetry(notionPage, maxRetries = 3, databaseId = null) {
    const targetDatabaseId = databaseId || this.notionRewardHistoryDB;
    
    let properties, parent;
    if (notionPage.parent && notionPage.properties) {
      parent = notionPage.parent;
      properties = notionPage.properties;
    } else {
      parent = { database_id: targetDatabaseId };
      properties = notionPage;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.notion.pages.create({
          parent: parent,
          properties: properties,
        });
        return; // 성공하면 종료
      } catch (error) {
        console.warn(`Notion 페이지 생성 시도 ${attempt}/${maxRetries} 실패:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Notion 페이지 생성 최종 실패: ${error.message}`);
        }
        
        // 지수 백오프: 1초, 2초, 4초...
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

module.exports = new NotionRewardHistoryService();

