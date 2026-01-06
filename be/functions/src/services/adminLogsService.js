const { Client } = require('@notionhq/client');
const { db, FieldValue } = require("../config/database");
const { ADMIN_LOG_ACTIONS } = require("../constants/adminLogActions");


// Notion API rate limit 방지를 위한 배치 처리 설정
const DELAY_MS = 1200; // 지연시간 (밀리초)
const BATCH_SIZE = 500; // 배치 사이즈

class AdminLogsService {

    constructor() {
        this.notion = new Client({
          auth: process.env.NOTION_API_KEY,
        });
    
        this.notionAdminLogDB = process.env.NOTION_ADMIN_LOG_DB_ID;
    }


  //   /**
  //  * Firebase의 adminLogs 컬렉션에서 데이터 조회 후
  //  * Notion 데이터베이스에 동기화
  //  * - 관리자ID(컬렉션 ID)를 기준으로 노션에서 해당 페이지를 찾아 업데이트
  //  * - 노션에 없으면 새로 생성
  //  */
  async syncAdminLogs() {
    try {
      console.log('=== 관리자 로그 동기화 시작 ===');
      
      // 1. Firebase adminLogs 컬렉션 전체 조회
      const snapshot = await db.collection("adminLogs").get();
      console.log(`Firebase에서 ${snapshot.docs.length}건의 관리자 로그를 가져왔습니다.`);
  
      // 2. 노션 데이터베이스에서 기존 데이터 조회 (관리자ID 기준)
      const notionAdminLogs = await this.getNotionAdminLogs(this.notionAdminLogDB);
  
      let successCount = 0;
      let failedCount = 0;
      const successLogIds = [];
      const failedLogIds = [];
  
      // 3. 각 adminLog 데이터를 배치로 처리
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = snapshot.docs.slice(i, i + BATCH_SIZE);
        console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(snapshot.docs.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, snapshot.docs.length)}번째)`);
  
        // 배치 내에서 병렬 처리 (배포 환경에서 메모리 문제 발생)
        const batchPromises = batch.map(async (doc) => {
        try {
            const adminLogId = doc.id;
            const adminLog = doc.data();
  
            // 노션 데이터 구성
            //const notionPage = this.buildNotionAdminLogPage(adminLog, adminLogId);
            
            // syncAdminLogs 메서드 내부
            const notionPage = await this.buildNotionAdminLogPage(adminLog, adminLogId);
  
            // 노션에 기존 페이지가 있으면 업데이트, 없으면 생성
            if (notionAdminLogs[adminLogId]) {
              // 기존 페이지 업데이트 (retry 로직 사용)
              await this.updateNotionPageWithRetry(
                notionAdminLogs[adminLogId].pageId, 
                notionPage
              );
              console.log(`[업데이트] 관리자 로그 ${adminLogId} 노션 동기화 완료`);
            } else {
              // 새 페이지 생성 (retry 로직 사용)
              await this.createNotionPageWithRetry(notionPage);
              console.log(`[생성] 관리자 로그 ${adminLogId} 노션 동기화 완료`);
            }
  
            successCount++;
            successLogIds.push(adminLogId);
  
            return { success: true, adminLogId, action: notionAdminLogs[adminLogId] ? 'update' : 'create' };
          } catch (error) {
            failedCount++;
            failedLogIds.push(doc.id);
            console.error(`[동기화 실패] 관리자 로그 ${doc.id}:`, error.message || error);
            return { success: false, adminLogId: doc.id, error: error.message };
          }
        });
  
        // 배치 결과 처리
        const batchResults = await Promise.all(batchPromises);
        const batchSuccess = batchResults.filter(r => r.success).length;
        const batchFailed = batchResults.filter(r => !r.success).length;
  
        console.log(`배치 완료: 성공 ${batchSuccess}건, 실패 ${batchFailed}건 (총 진행률: ${successCount + failedCount}/${snapshot.docs.length})`);
  
        // 마지막 배치가 아니면 지연
        if (i + BATCH_SIZE < snapshot.docs.length) {
          console.log(`${DELAY_MS/1000}초 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        
      }
  
      console.log(`=== 관리자 로그 동기화 완료 ===`);
      console.log(`성공: ${successCount}건, 실패: ${failedCount}건`);
  
      return { successCount, failedCount };
  
    } catch (error) {
      console.error('syncAdminLogs 전체 오류:', error);
      throw error;
    }
  }


  /**
   * 재시도 로직이 포함된 Notion 페이지 업데이트
   */
  async updateNotionPageWithRetry(pageId, notionPage, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.notion.pages.update({
          page_id: pageId,
          properties: notionPage,
        });
        return; // 성공하면 종료
      } catch (error) {
        // conflict_error인 경우에만 재시도
        const isConflictError = error.code === 'conflict_error' || 
                                error.message?.includes('Conflict') ||
                                error.message?.includes('conflict');
        
        if (!isConflictError || attempt === maxRetries) {
          throw new Error(`Notion 페이지 업데이트 최종 실패 (pageId: ${pageId}): ${error.message}`);
        }
        
        console.warn(`Notion 페이지 업데이트 시도 ${attempt}/${maxRetries} 실패 (pageId: ${pageId}):`, error.message);
        
        // 지수 백오프: 1초, 2초, 4초...
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`${delay/1000}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }


  /**
   * 재시도 로직이 포함된 Notion 페이지 생성
   */
  async createNotionPageWithRetry(notionPage, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.notion.pages.create({
          parent: { database_id: this.notionAdminLogDB },
          properties: notionPage,
        });
        return; // 성공하면 종료
      } catch (error) {
        // conflict_error인 경우에만 재시도
        const isConflictError = error.code === 'conflict_error' || 
                                error.message?.includes('Conflict') ||
                                error.message?.includes('conflict');
        
        if (!isConflictError || attempt === maxRetries) {
          throw new Error(`Notion 페이지 생성 최종 실패: ${error.message}`);
        }
        
        console.warn(`Notion 페이지 생성 시도 ${attempt}/${maxRetries} 실패:`, error.message);
        
        // 지수 백오프: 1초, 2초, 4초...
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`${delay/1000}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }



   /**
   * 사용자 ID 배열을 노션 페이지 ID 배열로 변환
   * @param {Array<string>} userIds - 사용자 ID 배열
   * @returns {Promise<Array<string>>} 노션 페이지 ID 배열
   */
  //  async convertUserIdsToNotionPageIds(userIds) {
  //   if (!userIds || userIds.length === 0) {
  //     return [];
  //   }

  //   try {
  //     const notionUserAccountDB = process.env.NOTION_USER_ACCOUNT_DB_ID;
  //     if (!notionUserAccountDB) {
  //       console.warn('[adminLogsService] NOTION_USER_ACCOUNT_DB_ID 환경변수가 설정되지 않음');
  //       return [];
  //     }

  //     const pageIds = [];
      
  //     // 배치로 사용자 조회 (한 번에 여러 사용자 조회)
  //     for (let i = 0; i < userIds.length; i += 100) {
  //       const batch = userIds.slice(i, i + 100);
        
  //       // 각 사용자 ID에 대해 노션 페이지 조회
  //       const batchPromises = batch.map(async (userId) => {
  //         try {
  //           const response = await fetch(`https://api.notion.com/v1/databases/${notionUserAccountDB}/query`, {
  //             method: 'POST',
  //             headers: {
  //               'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  //               'Notion-Version': '2022-06-28',
  //               'Content-Type': 'application/json',
  //             },
  //             body: JSON.stringify({
  //               filter: {
  //                 property: '사용자ID',
  //                 rich_text: { equals: userId }
  //               },
  //               page_size: 1
  //             })
  //           });

  //           const data = await response.json();
  //           if (data.results && data.results.length > 0) {
  //             return data.results[0].id;
  //           }
  //           return null;
  //         } catch (error) {
  //           console.warn(`[adminLogsService] 사용자 ${userId}의 노션 페이지 조회 실패:`, error.message);
  //           return null;
  //         }
  //       });

  //       const batchResults = await Promise.all(batchPromises);
  //       pageIds.push(...batchResults.filter(id => id !== null));
        
  //       // 배치 사이 지연 (Notion API rate limit 방지)
  //       if (i + 100 < userIds.length) {
  //         await new Promise(resolve => setTimeout(resolve, 300));
  //       }
  //     }

  //     return pageIds;
  //   } catch (error) {
  //     console.error('[adminLogsService] 사용자 ID를 노션 페이지 ID로 변환 실패:', error);
  //     return [];
  //   }
  // }


  /**
   * adminLog 데이터를 노션 페이지 형식으로 변환
   */
  async buildNotionAdminLogPage(adminLog, adminLogId) {
    // 상태 계산: SUCCESS, PARTIAL, FAILURE
    const metadata = adminLog.metadata || {};
    //const syncedCount = metadata.syncedCount || 0;
    const successCount = metadata.successCount ?? 0; // nullish coalescing 사용
    const failedCount = metadata.failedCount ?? 0; // nullish coalescing 사용
    const total = metadata.total ?? 0;
    //const syncedUserIds = metadata.syncedUserIds || [];
    const successUserIds = metadata.successUserIds || [];
    const failedUserIds = metadata.failedUserIds || [];
    const errorLogs = metadata.errorLogs || []; // 에러 로그 배열

    // 에러 메시지가 있는지 확인 (빈 배열이 아니고, 실제로 값이 있는 경우)
    const hasErrorMessage = errorLogs && errorLogs.length > 0 && errorLogs.some(log => log && log.trim().length > 0);

    let status = "SUCCESS";
    // 에러 메시지가 있으면 FAILURE로 설정 (최우선)
    if (hasErrorMessage) {
      status = "FAILURE";
    }else if (failedCount > 0 && successCount === 0) {
      status = "FAILURE";
    } else if (successCount > 0 && failedCount > 0) {
      status = "PARTIAL";
    } else if (total > 1 && failedCount > 0) {
      status = "PARTIAL";
    }

    // 날짜 처리
    const timestampDate = safeDateToIso(adminLog.timestamp);

    // 노션 페이지 속성 구성
    const notionPage = {
      "관리자ID": {
        rich_text: [{ text: { content: adminLogId } }]
      },
      "행위자": {
        title: [{ text: { content: adminLog.adminId || "" } }]
      },
      "행위명": {
        select : { name: adminLog.action || "" }
      },
      "대상ID": {
        rich_text: [{ text: { content: adminLog.targetId || "" } }]
      },
      "상태": {
        select: { name: status }
      },
      "전체 건수": {
        number: total
      },
      "성공": {
        number: successCount
      },
      "실패": {
        number: failedCount
      },
      "동기화 시간": { date: { start: new Date().toISOString() } }
    };

    // 발생일시 추가
    if (timestampDate) {
      notionPage["발생일시"] = {
        date: { start: timestampDate }
      };
    }

    // 에러 메시지 필드 추가 (errorLogs 배열을 쉼표로 구분된 문자열로 변환)
    if (errorLogs && errorLogs.length > 0) {
      // 배열을 쉼표로 구분된 문자열로 변환
      const errorMessage = errorLogs.join(", ");
      
      // Notion rich_text 타입은 최대 2,000자까지 저장 가능하므로 초과 시 잘라내기
      const maxLength = 2000;
      const truncatedMessage = errorMessage.length > maxLength 
        ? errorMessage.substring(0, maxLength - 3) + "..." 
        : errorMessage;
      
      notionPage["에러 메시지"] = {
        rich_text: [{ text: { content: truncatedMessage } }]
      };
    } else {
      // 빈 배열인 경우에도 필드를 설정하여 기존 값 초기화
      notionPage["에러 메시지"] = {
        rich_text: []
      };
    }

    /*
    - 동기화된 사용자 ID 목록 (텍스트 타입 - 쉼표로 구분) 해당 타입으로 수정하려고 하였으나,
      노션에서 텍스트 타입에는 최대 2,000자 까지 저장이 가능하여 동기화된 사용자가 많을 경우 오류가 발생
      따라서 다중성택 타입으로 저장하는 방법을 유지함
      [참고]
      + rich_text(텍스트) : 블록당 최대 2,000자
      + multi_select(다중선택) : 각 옵션 이름 최대 100자, 옵션 개수 제한 없음
      + title(제목) : 최대 2,000자
      + url : 제한없음
      + relation(관계) : 다른 페이지와 관계 연결 
    */
    // 동기화된 사용자 ID 목록 (다중선택 타입)
    if (successUserIds && successUserIds.length > 0) {
        notionPage["성공한 사용자ID"] = {
        multi_select: successUserIds.map(userId => ({ name: userId }))
      };
    } else {
      // 빈 배열인 경우에도 필드를 설정하여 기존 값 초기화
      notionPage["성공한 사용자ID"] = {
        multi_select: []
      };
    }

    // 동기화 실패한 사용자 ID 목록 (다중선택 타입)
    if (failedUserIds.length > 0) {
      notionPage["실패한 사용자ID"] = {
        multi_select: failedUserIds.map(userId => ({ name: userId }))
      };
    } else {
      // 빈 배열인 경우에도 필드를 설정하여 기존 값 초기화
      notionPage["실패한 사용자ID"] = {
        multi_select: []
      };
    }

    //[==보류==] : 관계형을 사용하는 경우 배포혼경에서 메모리 부족 문제가 발생해서 보류
    // // 성공한 사용자 관계형 필드 변환
    // let successNotionPageIds = [];
    // if (successUserIds && successUserIds.length > 0) {
    //   successNotionPageIds = await this.convertUserIdsToNotionPageIds(successUserIds);
    // }
    
    // notionPage["성공한 사용자"] = {
    //   relation: successNotionPageIds.map(pageId => ({ id: pageId }))
    // };

    // // 실패한 사용자 관계형 필드 변환
    // let failedNotionPageIds = [];
    // if (failedUserIds && failedUserIds.length > 0) {
    //   failedNotionPageIds = await this.convertUserIdsToNotionPageIds(failedUserIds);
    // }

    // // console.log(`[adminLogsService] 성공한 사용자 ID 목록: ${successUserIds}`);
    // // console.log(`[adminLogsService] 실패한 사용자 Notion 페이지 ID 목록: ${failedNotionPageIds}`);

    // notionPage["실패한 사용자"] = {
    //   relation: failedNotionPageIds.map(pageId => ({ id: pageId }))
    // };
    //[==보류==] : 관계형을 사용하는 경우 배포혼경에서 메모리 부족 문제가 발생해서 보류

    return notionPage;
  }


  /**
   * 노션 데이터베이스에서 모든 관리자 로그 조회 (관리자ID 기준)
   */
  async getNotionAdminLogs(databaseId) {
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

      // 응답 상태 확인
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Notion API Error] Status: ${res.status}, Response: ${errorText}`);
        const err = new Error(`Notion API 요청 실패: ${res.status} - ${errorText}`);
        err.code = "INTERNAL_ERROR";
        throw err;
      }

      const data = await res.json();

      // 에러 응답 확인
      if (data.error) {
        console.error(`[Notion API Error]`, data.error);
        const err = new Error(`Notion API 에러: ${data.error.message || JSON.stringify(data.error)}`);
        err.code = "INTERNAL_ERROR";
        throw err;
      }

      // results가 배열인지 확인
      if (!Array.isArray(data.results)) {
        console.error(`[Notion API Error] 예상치 못한 응답 구조:`, data);
        const err = new Error(`Notion API 응답 형식 오류: results가 배열이 아닙니다.`);
        err.code = "INTERNAL_ERROR";
        throw err;
      }


      results = results.concat(data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    const logMap = {};
    for (const page of results) {
      const props = page.properties;
      // 관리자ID 필드에서 컬렉션 ID 추출
      const adminLogId = props["관리자ID"]?.rich_text?.[0]?.plain_text || null;
      if (adminLogId) {
        logMap[adminLogId] = { pageId: page.id };
      }
    }
    return logMap;
  }


  /**
   * 관리자 로그를 adminLogs 컬렉션에 저장
   * @param {Object} options - 저장 옵션
   * @param {string} options.action - 액션 타입 (ADMIN_LOG_ACTIONS)
   * @param {Object} options.metadata - 저장할 metadata 객체
   * @param {string} [options.adminId="Notion 관리자"] - 관리자 ID
   * @param {string} [options.targetId=""] - 대상 ID
   * @param {Date} [options.timestamp] - 타임스탬프 (기본값: new Date())
   * @param {string} [options.logMessage] - 로그 메시지 (선택적)
   * @returns {Promise<void>}
   */
  async saveAdminLog({
    action,
    metadata,
    adminId = "Notion 관리자",
    targetId = "",
    timestamp = null,
    logMessage = null
  }) {
    try {

      const logRef = db.collection("adminLogs").doc();
      await logRef.set({
        adminId: adminId,
        action: action,
        targetId: targetId,
        timestamp: timestamp || new Date(),
        metadata: metadata || {}
      });
      
      const successCount = metadata?.successCount || 0;
      const failedCount = metadata?.failedCount || 0;
      console.log(`[adminLogs] 관리자 로그 저장 완료: ${action} (성공: ${successCount}개, 실패: ${failedCount}개)`);
      if (logMessage && logMessage.trim() !== "") {
        console.log(`[adminLogs] 관리자 로그 메시지: ${logMessage}`);
      }

    } catch (logError) {
      console.error("[adminLogs] 로그 저장 실패:", logError);
      // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러를 throw하지 않음
    }
  }





}


function safeDateToIso(dateValue) {
    if (!dateValue) return null;
  
    let date;
    if (typeof dateValue === "object" && dateValue.seconds) {
      // Firestore Timestamp 객체 처리
      date = new Date(dateValue.seconds * 1000);
    } else {
      // 문자열 혹은 숫자형 처리
      date = new Date(dateValue);
    }
  
    if (isNaN(date.getTime())) {
      console.warn("잘못된 날짜 값:", dateValue);
      return null;
    }
  
    return date.toISOString();
  }


module.exports = new AdminLogsService();