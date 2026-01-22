const { Client } = require('@notionhq/client');
const FirestoreService = require('./firestoreService');
const { fetchWithTimeout } = require('../utils/helpers');

// Notion 버전
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";

// actionKey → 내용 매핑
const ACTION_KEY_TO_CONTENT_MAP = {
  'comment': '댓글 작성',
  'routine_post': '한끗루틴 인증글 작성',
  'routine_review': '한끗루틴 후기',
  'gathering_review_media': '모임 후기 미디어',
  'tmi_review': 'TMI 후기',
  'store': '스토어',
  'additional_point': '추가 포인트',
  'expiration': '만료',
};

// 상태 매핑 (Firestore → Notion)
const STATUS_MAP = {
  'pending': '대기',
  'processing': '처리중',
  'completed': '성공',
  'failed': '실패',
};

/**
 * NotionPendingRewardService
 * 나다움 지급 실패 건을 Notion에 실시간 연동하는 서비스
 */
class NotionPendingRewardService {
  constructor() {
    const {
      NOTION_API_KEY,
      NOTION_PENDING_REWARDS_DB_ID,
      NOTION_USER_ACCOUNT_DB_ID,
    } = process.env;

    // 환경 변수 검증
    if (!NOTION_API_KEY) {
      console.warn('[NotionPendingRewardService] NOTION_API_KEY가 설정되지 않았습니다');
      this.isEnabled = false;
      return;
    }
    if (!NOTION_PENDING_REWARDS_DB_ID) {
      console.warn('[NotionPendingRewardService] NOTION_PENDING_REWARDS_DB_ID가 설정되지 않았습니다');
      this.isEnabled = false;
      return;
    }

    this.isEnabled = true;
    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    this.pendingRewardsDbId = NOTION_PENDING_REWARDS_DB_ID;
    this.userAccountDbId = NOTION_USER_ACCOUNT_DB_ID;
    this.notionApiKey = NOTION_API_KEY;
    this.userService = new FirestoreService('users');
    this.NOTION_API_TIMEOUT = 15000; // 15초
  }

  /**
   * Firestore userId로 Notion 회원 관리 DB에서 사용자 페이지 ID 조회
   * @param {string} userId - Firestore 사용자 ID
   * @returns {Promise<string|null>} Notion 페이지 ID
   */
  async findUserNotionPageId(userId) {
    if (!this.isEnabled || !this.userAccountDbId) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(
        `https://api.notion.com/v1/databases/${this.userAccountDbId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.notionApiKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              property: '사용자ID',
              rich_text: {
                equals: userId
              }
            },
            page_size: 1
          }),
        },
        this.NOTION_API_TIMEOUT,
        'Notion API 타임아웃'
      );

      if (!response.ok) {
        console.warn(`[NotionPendingRewardService] 사용자 조회 실패: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].id;
      }

      return null;
    } catch (error) {
      console.warn('[NotionPendingRewardService] 사용자 Notion 페이지 조회 오류:', error.message);
      return null;
    }
  }

  /**
   * Firestore에서 사용자 정보 조회
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object|null>} 사용자 정보 { name, nickname }
   */
  async getUserInfo(userId) {
    try {
      const userData = await this.userService.getById(userId);
      if (userData) {
        return {
          name: userData.name || '',
          nickname: userData.nickname || '',
        };
      }
      return null;
    } catch (error) {
      console.warn('[NotionPendingRewardService] 사용자 정보 조회 실패:', error.message);
      return null;
    }
  }

  /**
   * 실패한 리워드를 Notion에 페이지로 생성
   * @param {Object} pendingReward - pendingReward 데이터
   * @param {string} pendingReward.docId - Firestore 문서 ID
   * @param {string} pendingReward.userId - 사용자 ID
   * @param {string} pendingReward.actionKey - 액션 키
   * @param {string} pendingReward.targetId - 대상 ID
   * @param {string} pendingReward.lastError - 에러 메시지
   * @param {string} pendingReward.lastErrorCode - 에러 코드
   * @param {number} pendingReward.retryCount - 재시도 횟수
   * @returns {Promise<string|null>} Notion 페이지 ID
   */
  async createPendingRewardPage(pendingReward) {
    if (!this.isEnabled) {
      console.warn('[NotionPendingRewardService] Notion 연동이 비활성화되어 있습니다');
      return null;
    }

    try {
      const { docId, userId, actionKey, targetId, lastError, lastErrorCode, retryCount } = pendingReward;

      // 사용자 정보 조회
      const [userNotionPageId, userInfo] = await Promise.all([
        this.findUserNotionPageId(userId),
        this.getUserInfo(userId),
      ]);

      // 내용 텍스트 생성
      const contentText = ACTION_KEY_TO_CONTENT_MAP[actionKey] || actionKey;

      // Notion 페이지 속성 구성
      const properties = {
        '기본 닉네임': {
          title: [{ text: { content: userInfo?.nickname || '알 수 없음' } }]
        },
        '실패 ID': {
          rich_text: [{ text: { content: docId } }]
        },
        '선택': {
          checkbox: false
        },
        '상태': {
          select: { name: STATUS_MAP['pending'] || '대기' }
        },
        'Firestore 사용자 ID': {
          rich_text: [{ text: { content: userId || '' } }]
        },
        '내용': {
          rich_text: [{ text: { content: contentText } }]
        },
        '재시도 횟수': {
          number: retryCount || 0
        },
        '최초 실패 일시': {
          date: { start: new Date().toISOString() }
        },
        '마지막 시도 일시': {
          date: { start: new Date().toISOString() }
        },
      };

      // 회원 relation 추가 (사용자를 찾은 경우에만)
      if (userNotionPageId) {
        properties['회원'] = {
          relation: [{ id: userNotionPageId }]
        };
      }

      // 사용자 실명 추가
      if (userInfo) {
        properties['사용자 실명'] = {
          rich_text: [{ text: { content: userInfo.name || '' } }]
        };
      }

      // 대상 ID 추가
      if (targetId) {
        properties['대상 ID'] = {
          rich_text: [{ text: { content: targetId } }]
        };
      }

      // 에러 정보 추가
      if (lastError) {
        properties['에러 메시지'] = {
          rich_text: [{ text: { content: lastError.substring(0, 2000) } }] // Notion 제한
        };
      }
      if (lastErrorCode) {
        properties['에러 코드'] = {
          select: { name: lastErrorCode }
        };
      }

      // Notion 페이지 생성
      const response = await this.notion.pages.create({
        parent: { database_id: this.pendingRewardsDbId },
        properties,
      });

      console.log('[NotionPendingRewardService] Notion 페이지 생성 완료:', { docId, notionPageId: response.id });
      return response.id;

    } catch (error) {
      console.error('[NotionPendingRewardService] Notion 페이지 생성 실패:', error.message);
      // Notion 실패해도 메인 로직에 영향 없도록 null 반환
      return null;
    }
  }

  /**
   * Notion 페이지 상태 업데이트 (성공 시)
   * @param {string} notionPageId - Notion 페이지 ID
   * @param {number} grantedAmount - 부여된 나다움
   * @returns {Promise<boolean>} 성공 여부
   */
  async markAsCompleted(notionPageId, grantedAmount = 0) {
    if (!this.isEnabled || !notionPageId) {
      return false;
    }

    try {
      await this.notion.pages.update({
        page_id: notionPageId,
        properties: {
          '상태': {
            select: { name: STATUS_MAP['completed'] || '성공' }
          },
          '선택': {
            checkbox: false
          },
          '완료 일시': {
            date: { start: new Date().toISOString() }
          },
          '지급 완료된 나다움': {
            number: grantedAmount
          },
          '마지막 시도 일시': {
            date: { start: new Date().toISOString() }
          },
        },
      });

      console.log('[NotionPendingRewardService] Notion 상태 업데이트 (성공):', { notionPageId, grantedAmount });
      return true;
    } catch (error) {
      console.error('[NotionPendingRewardService] Notion 상태 업데이트 실패:', error.message);
      return false;
    }
  }

  /**
   * Notion 페이지 상태 업데이트 (최종 실패 시)
   * @param {string} notionPageId - Notion 페이지 ID
   * @param {string} error - 에러 메시지
   * @param {string} errorCode - 에러 코드
   * @param {number} retryCount - 재시도 횟수
   * @returns {Promise<boolean>} 성공 여부
   */
  async markAsFailed(notionPageId, error, errorCode, retryCount) {
    if (!this.isEnabled || !notionPageId) {
      return false;
    }

    try {
      const properties = {
        '상태': {
          select: { name: STATUS_MAP['failed'] || '실패' }
        },
        '완료 일시': {
          date: { start: new Date().toISOString() }
        },
        '마지막 시도 일시': {
          date: { start: new Date().toISOString() }
        },
        '재시도 횟수': {
          number: retryCount || 0
        },
      };

      if (error) {
        properties['에러 메시지'] = {
          rich_text: [{ text: { content: error.substring(0, 2000) } }]
        };
      }
      if (errorCode) {
        properties['에러 코드'] = {
          select: { name: errorCode }
        };
      }

      await this.notion.pages.update({
        page_id: notionPageId,
        properties,
      });

      console.log('[NotionPendingRewardService] Notion 상태 업데이트 (실패):', { notionPageId, errorCode });
      return true;
    } catch (updateError) {
      console.error('[NotionPendingRewardService] Notion 상태 업데이트 실패:', updateError.message);
      return false;
    }
  }

  /**
   * Notion 페이지 상태 업데이트 (재시도 대기)
   * @param {string} notionPageId - Notion 페이지 ID
   * @param {string} error - 에러 메시지
   * @param {string} errorCode - 에러 코드
   * @param {number} retryCount - 재시도 횟수
   * @returns {Promise<boolean>} 성공 여부
   */
  async markAsPending(notionPageId, error, errorCode, retryCount) {
    if (!this.isEnabled || !notionPageId) {
      return false;
    }

    try {
      const properties = {
        '상태': {
          select: { name: STATUS_MAP['pending'] || '대기' }
        },
        '마지막 시도 일시': {
          date: { start: new Date().toISOString() }
        },
        '재시도 횟수': {
          number: retryCount || 0
        },
      };

      if (error) {
        properties['에러 메시지'] = {
          rich_text: [{ text: { content: error.substring(0, 2000) } }]
        };
      }
      if (errorCode) {
        properties['에러 코드'] = {
          select: { name: errorCode }
        };
      }

      await this.notion.pages.update({
        page_id: notionPageId,
        properties,
      });

      console.log('[NotionPendingRewardService] Notion 상태 업데이트 (대기):', { notionPageId, retryCount });
      return true;
    } catch (updateError) {
      console.error('[NotionPendingRewardService] Notion 상태 업데이트 실패:', updateError.message);
      return false;
    }
  }

  /**
   * Notion에서 '선택' 체크박스가 true인 항목 조회
   * @returns {Promise<Array>} 선택된 항목 목록 [{ notionPageId, docId }]
   */
  async getSelectedPendingRewards() {
    if (!this.isEnabled) {
      return [];
    }

    try {
      const allPages = [];
      let hasMore = true;
      let startCursor = undefined;

      console.log('[NotionPendingRewardService] 선택된 항목 조회 시작...');

      while (hasMore) {
        const response = await fetchWithTimeout(
          `https://api.notion.com/v1/databases/${this.pendingRewardsDbId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.notionApiKey}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filter: {
                property: '선택',
                checkbox: {
                  equals: true
                }
              },
              page_size: 100,
              start_cursor: startCursor,
            }),
          },
          this.NOTION_API_TIMEOUT,
          'Notion API 타임아웃'
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[NotionPendingRewardService] Notion API 오류: ${response.status}`, errorText);
          throw new Error(`Notion API 호출 실패: ${response.status}`);
        }

        const data = await response.json();
        allPages.push(...data.results);
        hasMore = data.has_more;
        startCursor = data.next_cursor;

        console.log(`[NotionPendingRewardService] ${allPages.length}건 조회 중...`);

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }

      console.log(`[NotionPendingRewardService] 총 ${allPages.length}건 조회 완료`);

      // 필요한 정보 추출
      const selectedItems = [];
      for (const page of allPages) {
        try {
          const props = page.properties;
          const docId = props['실패 ID']?.rich_text?.[0]?.plain_text || null;

          if (docId) {
            selectedItems.push({
              notionPageId: page.id,
              docId,
            });
          }
        } catch (itemError) {
          console.warn(`[NotionPendingRewardService] 항목 파싱 오류 (pageId: ${page.id}):`, itemError.message);
        }
      }

      return selectedItems;

    } catch (error) {
      console.error('[NotionPendingRewardService] 선택된 항목 조회 실패:', error.message);
      throw error;
    }
  }

  /**
   * 선택 체크박스 해제
   * @param {string} notionPageId - Notion 페이지 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  async resetSelectionCheckbox(notionPageId) {
    if (!this.isEnabled || !notionPageId) {
      return false;
    }

    try {
      await this.notion.pages.update({
        page_id: notionPageId,
        properties: {
          '선택': {
            checkbox: false
          },
        },
      });
      return true;
    } catch (error) {
      console.warn('[NotionPendingRewardService] 체크박스 해제 실패:', error.message);
      return false;
    }
  }

  /**
   * 여러 항목의 선택 체크박스 일괄 해제
   * @param {Array<string>} notionPageIds - Notion 페이지 ID 배열
   * @returns {Promise<Object>} { successCount, failedCount }
   */
  async resetSelectionCheckboxes(notionPageIds) {
    const BATCH_SIZE = 5;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < notionPageIds.length; i += BATCH_SIZE) {
      const batch = notionPageIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(pageId => this.resetSelectionCheckbox(pageId))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          successCount++;
        } else {
          failedCount++;
        }
      });

      if (i + BATCH_SIZE < notionPageIds.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[NotionPendingRewardService] 체크박스 해제 완료 - 성공: ${successCount}건, 실패: ${failedCount}건`);
    return { successCount, failedCount };
  }
}

module.exports = new NotionPendingRewardService();
