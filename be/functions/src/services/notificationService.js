const { Client } = require('@notionhq/client');
// fcmHelper는 순환 참조 방지를 위해 lazy require로 변경
// const fcmHelper = require('../utils/fcmHelper');
const { getRelationValues, getTitleValue, getTextContent, getSelectValue, getNumberValue, getDateValue, getCheckboxValue } = require('../utils/notionHelper');
const FirestoreService = require('./firestoreService');
const RewardService = require('./rewardService');
const {FieldValue} = require('../config/database');

// 에러 코드 정의
const ERROR_CODES = {
  MISSING_API_KEY: 'MISSING_NOTION_API_KEY',
  MISSING_DB_ID: 'MISSING_NOTION_NOTIFICATION_DB_ID',
  NOTION_API_ERROR: 'NOTION_API_ERROR',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  NO_USERS_SELECTED: 'NO_USERS_SELECTED',
  NO_VALID_USER_IDS: 'NO_VALID_USER_IDS',
  INVALID_NOTIFICATION_DATA: 'INVALID_NOTIFICATION_DATA',
  FCM_SEND_FAILED: 'FCM_SEND_FAILED',
  REWARD_FAILED: 'REWARD_FAILED',
  STATUS_UPDATE_FAILED: 'STATUS_UPDATE_FAILED',
};

// Notion 필드명 상수
const NOTION_FIELDS = {
  TITLE: '이름',
  CONTENT: '알림 내용',
  MEMBER_MANAGEMENT: '회원 관리',
  SEND_STATUS: '전송 상태',
  USER_ID: '사용자ID',
  LAST_PAYMENT_DATE: '전송 일시',
  PAYMENT_RESULT: '지급 결과',
  EXPIRATION_DATE: '만료 기한',
  SELECTED: '선택',
  FAILED_MEMBERS: '전송 실패 회원',
  PAYMENT_FAILED_MEMBERS: '지급 실패 회원',
  MARKETING_NOTIFICATION: '이벤트∙홍보',
};

// 상황별 알림 내용 템플릿 필드명 상수
const TEMPLATE_FIELDS = {
  PROGRAM_TYPE: '프로그램 유형',
  NOTIFICATION_CONTENT: '전송할 알림 문구',
  NADUM_AMOUNT: '지급할 나다움',
};

// 전송 상태 값 상수
const SEND_STATUS = {
  PENDING: '전송 대기',
  COMPLETED: '전송 완료',
  PARTIAL: '부분 완료',
  FAILED: '전송 실패',
};

// 지급 결과 값 상수
const PAYMENT_RESULT = {
  BEFORE: '지급 전',
  COMPLETED: '지급 완료',
  PARTIAL: '부분 완료',
  FAILED: '지급 실패',
};

// 배치 처리 상수
const BATCH_SIZE = 100; // 배치 사이즈
const DELAY_MS = 1200; // 배치 사이 지연 시간 (ms)

class NotificationService {
  constructor() {
    const {
      NOTION_API_KEY,
      NOTION_NOTIFICATION_DB_ID,
      NOTION_NOTIFICATION_TEMPLATE_DB_ID,
      NOTION_VERSION,
    } = process.env;

    // 환경 변수 검증
    if (!NOTION_API_KEY) {
      const error = new Error("NOTION_API_KEY가 필요합니다");
      error.code = ERROR_CODES.MISSING_API_KEY;
      throw error;
    }
    if (!NOTION_NOTIFICATION_DB_ID) {
      const error = new Error("NOTION_NOTIFICATION_DB_ID가 필요합니다");
      error.code = ERROR_CODES.MISSING_DB_ID;
      throw error;
    }

    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    this.notificationDatabaseId = NOTION_NOTIFICATION_DB_ID;
    this.templateDatabaseId = NOTION_NOTIFICATION_TEMPLATE_DB_ID;
    this.firestoreService = new FirestoreService("users");
    this.rewardService = new RewardService();
    this.notificationFirestoreService = new FirestoreService("notifications");
  }

  /**
   * 템플릿 페이지 ID로 알림 내용 템플릿 조회
   * @param {string} templatePageId - 템플릿 페이지 ID
   * @return {Promise<Object|null>} 템플릿 데이터 {content, nadumAmount} 또는 null
   */
  async getNotificationTemplateByPageId(templatePageId) {
    try {
      if (!templatePageId) {
        return null;
      }

      const templatePage = await this.notion.pages.retrieve({ page_id: templatePageId });
      const props = templatePage.properties;
      const notificationContent = getTextContent(props[TEMPLATE_FIELDS.NOTIFICATION_CONTENT]) || '';
      const nadumAmount = getNumberValue(props[TEMPLATE_FIELDS.NADUM_AMOUNT]) || 0;

      return {
        content: notificationContent,
        nadumAmount,
      };
    } catch (error) {
      console.error(`[NotificationService] 템플릿 페이지 조회 실패 (pageId: ${templatePageId}):`, error.message);
      return null;
    }
  }

  /**
   * 프로그램 유형별 알림 내용 템플릿 조회
   * @param {string} programType - 프로그램 유형 (예: "한끗루틴", "TMI 프로젝트" 등)
   * @return {Promise<string>} 알림 내용 템플릿
   */
  async getNotificationTemplateByType(programType) {
    try {
      if (!this.templateDatabaseId) {
        return null;
      }

      if (!programType) {
        return null;
      }

      let databaseId = this.templateDatabaseId;
      if (databaseId && !databaseId.includes('-')) {
        if (databaseId.length === 32) {
          databaseId = `${databaseId.slice(0, 8)}-${databaseId.slice(8, 12)}-${databaseId.slice(12, 16)}-${databaseId.slice(16, 20)}-${databaseId.slice(20)}`;
        }
      }

      let allResults = [];
      let hasMore = true;
      let startCursor = undefined;
      
      while (hasMore) {
        try {
          const queryParams = {
            database_id: databaseId,
            page_size: 100
          };
          
          if (startCursor) {
            queryParams.start_cursor = startCursor;
          }

          const response = await this.notion.databases.query(queryParams);
          
          if (response.results) {
            allResults = allResults.concat(response.results);
          }
          
          hasMore = response.has_more || false;
          startCursor = response.next_cursor;
          
          if (!hasMore) break;
        } catch (queryError) {
          try {
            const fetchUrl = `https://api.notion.com/v1/databases/${databaseId}/query`;
            const fetchResponse = await fetch(fetchUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                page_size: 100,
                start_cursor: startCursor
              })
            });

            if (!fetchResponse.ok) {
              break;
            }

            const fetchData = await fetchResponse.json();
            if (fetchData.results) {
              allResults = allResults.concat(fetchData.results);
            }
            hasMore = fetchData.has_more || false;
            startCursor = fetchData.next_cursor;
          } catch (fetchError) {
            break;
          }
        }
      }
      
      const results = allResults.filter(page => {
        const props = page.properties || {};
        const programTypeField = props[TEMPLATE_FIELDS.PROGRAM_TYPE];
        
        if (!programTypeField) return false;
        
        if (programTypeField.select && programTypeField.select.name === programType) {
          return true;
        }
        
        if (programTypeField.title && programTypeField.title.length > 0) {
          const titleText = programTypeField.title.map(t => t.plain_text).join('');
          return titleText === programType;
        }
        
        return false;
      });

      if (results.length === 0) {
        return null;
      }

      const templatePage = results[0];
      const props = templatePage.properties;
      const notificationContent = getTextContent(props[TEMPLATE_FIELDS.NOTIFICATION_CONTENT]) || '';
      const nadumAmount = getNumberValue(props[TEMPLATE_FIELDS.NADUM_AMOUNT]) || 0;

      return {
        content: notificationContent,
        nadumAmount,
      };
    } catch (error) {
      console.error(`템플릿 조회 실패:`, error.message);
      return null;
    }
  }

  /**
   * Notion 알림 페이지에서 데이터 추출
   * @param {string} pageId - Notion 알림 페이지 ID
   * @return {Promise<Object>} 알림 데이터 (title, content, userIds, programType)
   */
  async getNotificationData(pageId) {
    try {
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const props = page.properties;

      let expiresAt = null;
      const expirationDateValue = getDateValue(props[NOTION_FIELDS.EXPIRATION_DATE]);
      if (expirationDateValue) {
        const parsedExpiration = new Date(expirationDateValue);
        if (!Number.isNaN(parsedExpiration.getTime())) {
          expiresAt = parsedExpiration;
        }
      }

      let title = getTitleValue(props[NOTION_FIELDS.TITLE]);
      if (!title) {
        title = getTextContent(props[NOTION_FIELDS.TITLE]) || 
          props[NOTION_FIELDS.TITLE]?.title?.[0]?.plain_text ||
          props[NOTION_FIELDS.TITLE]?.rich_text?.[0]?.plain_text || '';
      }

      const contentField = props[NOTION_FIELDS.CONTENT];
      
      let content = '';
      let nadumAmount = 0;
      
      // 관계형 필드로 템플릿이 연결된 경우
      if (contentField && contentField.type === 'relation' && contentField.relation?.length > 0) {
        const templatePageId = contentField.relation[0].id;
        const templateData = await this.getNotificationTemplateByPageId(templatePageId);
        if (templateData) {
          content = templateData.content || '';
          nadumAmount = typeof templateData.nadumAmount === 'number' ? templateData.nadumAmount : 0;
        }
      }
      
      // 관계형 필드가 없거나 템플릿 조회 실패한 경우: 기존 문자열 파싱 로직 사용 (폴백)
      if (!content && contentField) {
        let programTypeName = '';
        
        if (contentField.type === 'rich_text' && contentField.rich_text) {
          programTypeName = contentField.rich_text.map(text => text.plain_text).join('').trim();
        } else if (contentField.type === 'title' && contentField.title) {
          programTypeName = contentField.title.map(text => text.plain_text).join('').trim();
        } else if (contentField.type === 'select' && contentField.select) {
          programTypeName = contentField.select.name || '';
        } else if (contentField.type === 'text' && contentField.text) {
          programTypeName = contentField.text.map(text => text.plain_text).join('').trim();
        } else {
          programTypeName = getTextContent(contentField) || '';
          if (!programTypeName) {
            programTypeName = (contentField.rich_text || []).map(text => text.plain_text).join('').trim() ||
              (contentField.title || []).map(text => text.plain_text).join('').trim() || '';
          }
        }

        if (programTypeName && programTypeName.trim()) {
          const templateData = await this.getNotificationTemplateByType(programTypeName.trim());
          if (templateData) {
            content = templateData.content || '';
            nadumAmount = typeof templateData.nadumAmount === 'number' ? templateData.nadumAmount : 0;
          }
        }

        if (!content) {
          content = getTextContent(contentField) || '';
        }
      }

      const userRelations = props[NOTION_FIELDS.MEMBER_MANAGEMENT]?.relation || [];
      const relationPageIds = userRelations.map(relation => relation.id);

      if (relationPageIds.length === 0) {
        const error = new Error("선택된 사용자가 없습니다.");
        error.code = ERROR_CODES.NO_USERS_SELECTED;
        error.statusCode = 400;
        throw error;
      }

      const userIds = await this.extractUserIdsFromRelation(relationPageIds);

      if (userIds.length === 0) {
        const error = new Error("유효한 사용자 ID를 찾을 수 없습니다.");
        error.code = ERROR_CODES.NO_VALID_USER_IDS;
        error.statusCode = 400;
        throw error;
      }

      // 이벤트∙홍보 체크박스 필드 읽기
      const isMarketingNotification = getCheckboxValue(props[NOTION_FIELDS.MARKETING_NOTIFICATION]) || false;

      return {
        title,
        content,
        userIds,
        pageId,
        nadumAmount,
        expiresAt,
        isMarketingNotification,
      };
    } catch (error) {
      console.error("알림 데이터 추출 실패:", error.message);

      if (error.code) {
        throw error;
      }

      // Notion API 에러 처리
      if (error.code === 'object_not_found') {
        const notFoundError = new Error('알림 페이지를 찾을 수 없습니다.');
        notFoundError.code = ERROR_CODES.NOTIFICATION_NOT_FOUND;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      const serviceError = new Error(`알림 데이터를 가져오는데 실패했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * Relation 페이지 ID들에서 Firebase User ID 추출 및 검증
   * @param {Array<string>} relationPageIds - Notion 사용자 페이지 ID 배열
   * @return {Promise<Array<string>>} Firestore users 컬렉션에 존재하는 유효한 User ID 배열
   */
  async extractUserIdsFromRelation(relationPageIds) {
    try {
      // Notion 페이지 병렬 조회
      const userPages = await Promise.all(
        relationPageIds.map(pageId => 
          this.notion.pages.retrieve({ page_id: pageId })
            .catch(error => {
              console.error(`사용자 페이지 ${pageId} 조회 실패:`, error.message);
              return null;
            })
        )
      );

      const extractedUserIds = [];
      for (const userPage of userPages) {
        if (!userPage) continue;

        const userProps = userPage.properties;
        let firebaseUserId = getTitleValue(userProps[NOTION_FIELDS.USER_ID]);
        
        if (!firebaseUserId) {
          firebaseUserId = getTextContent(userProps[NOTION_FIELDS.USER_ID]) || 
            userProps[NOTION_FIELDS.USER_ID]?.rich_text?.[0]?.plain_text ||
            userProps[NOTION_FIELDS.USER_ID]?.title?.[0]?.plain_text;
        }

        if (firebaseUserId && firebaseUserId.trim()) {
          extractedUserIds.push(firebaseUserId.trim());
        }
      }

      const userValidationPromises = extractedUserIds.map(async (userId) => {
        try {
          const user = await this.firestoreService.getDocument("users", userId);
          return { userId, isValid: !!user };
        } catch (firestoreError) {
          console.error(`[검증 에러] 사용자 ${userId} Firestore 조회 중 오류:`, firestoreError.message);
          return { userId, isValid: false };
        }
      });

      const validationResults = await Promise.all(userValidationPromises);
      const validUserIds = [];
      const invalidUserIds = [];

      for (const result of validationResults) {
        if (result.isValid) {
          validUserIds.push(result.userId);
        } else {
          invalidUserIds.push(result.userId);
          console.warn(`[검증 실패] Firestore에 존재하지 않는 사용자 ID: ${result.userId}`);
        }
      }

      if (invalidUserIds.length > 0) {
        console.warn(`[사용자 ID 검증] 총 ${extractedUserIds.length}개 중 ${invalidUserIds.length}개가 Firestore에 존재하지 않음`);
      }

      if (validUserIds.length === 0) {
        const error = new Error("Firestore에 존재하는 유효한 사용자가 없습니다.");
        error.code = ERROR_CODES.NO_VALID_USER_IDS;
        error.statusCode = 400;
        throw error;
      }

      return validUserIds;
    } catch (error) {
      console.error("사용자 ID 추출 실패:", error.message);

      if (error.code) {
        throw error;
      }

      const serviceError = new Error(`사용자 ID를 추출하는데 실패했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.statusCode = 500;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 알림 전송 및 상태 업데이트
   * @param {string} pageId - Notion 알림 페이지 ID
   * @return {Promise<Object>} 전송 결과
   */
  async sendNotification(pageId) {
    let finalStatus = null;
    let shouldUpdateLastPaymentDate = false;
    let rewardFailed = false;
    let fcmFailed = false;
    let paymentResult = null;
    let successfulUserIds = [];
    let failedUserIds = [];
    let rewardFailedUserIds = [];

    try {
      const { title, content, userIds, nadumAmount, expiresAt, isMarketingNotification } = await this.getNotificationData(pageId);

      if (!title || !content) {
        const error = new Error("알림 제목과 내용은 필수입니다.");
        error.code = ERROR_CODES.INVALID_NOTIFICATION_DATA;
        error.statusCode = 400;
        throw error;
      }

      // 이벤트∙홍보 알림인 경우 marketingTermsAgreed가 true인 사용자만 필터링
      let filteredUserIds = userIds;
      let marketingFilteredFailedUserIds = []; // 마케팅 동의하지 않은 사용자들
      if (isMarketingNotification) {
        try {
          // 사용자 정보를 조회하여 marketingTermsAgreed가 true인 사용자만 필터링
          const chunks = [];
          for (let i = 0; i < userIds.length; i += 10) {
            chunks.push(userIds.slice(i, i + 10));
          }

          const userResults = await Promise.all(
            chunks.map((chunk) =>
              this.firestoreService.getCollectionWhereIn("users", "__name__", chunk)
            )
          );

          const users = userResults.flat();
          const approvedUsers = users.filter((user) => user?.marketingTermsAgreed === true);
          const rejectedUsers = users.filter((user) => user?.marketingTermsAgreed !== true);
          
          filteredUserIds = approvedUsers.map((user) => user.id);
          marketingFilteredFailedUserIds = rejectedUsers.map((user) => user.id);

          console.log(`[알림 필터링] 이벤트∙홍보 알림: 전체 ${userIds.length}명 중 ${filteredUserIds.length}명에게 전송, ${marketingFilteredFailedUserIds.length}명 마케팅 동의 없음`);
          
          if (marketingFilteredFailedUserIds.length > 0) {
            failedUserIds = failedUserIds.concat(marketingFilteredFailedUserIds);
            console.log(`[알림 필터링] 마케팅 동의하지 않은 사용자 ${marketingFilteredFailedUserIds.length}명을 실패 회원으로 추가`);
          }
        } catch (filterError) {
          console.error("[알림 필터링] marketingTermsAgreed 필터링 실패:", filterError.message);
          // 필터링 실패 시 원본 userIds 사용
          filteredUserIds = userIds;
          marketingFilteredFailedUserIds = [];
        }
      }

      // 필터링된 사용자가 없으면 에러
      if (filteredUserIds.length === 0) {
        const error = new Error("마케팅 동의 사용자가 없습니다.");
        error.code = ERROR_CODES.NO_VALID_USER_IDS;
        error.statusCode = 400;
        throw error;
      }

      // 필터링된 사용자 ID로 교체
      const finalUserIds = filteredUserIds;

      let rewardResults = [];
      let rewardedUserIds = [];

      // 나다움 지급 (배치 처리 + 부분 성공 허용)
      if (nadumAmount > 0) {
        try {
          let totalRewardSuccessCount = 0;
          let totalRewardFailureCount = 0;

          // 배치 처리로 나다움 지급
          for (let i = 0; i < finalUserIds.length; i += BATCH_SIZE) {
            const batch = finalUserIds.slice(i, i + BATCH_SIZE);
            console.log(`[나다움 지급 배치] ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(finalUserIds.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, finalUserIds.length)}번째)`);

            const batchPromises = batch.map(async (userId) => {
              const historyId = `additional_point_${pageId}_${userId}`;
              try {
                const rewardOptions = expiresAt ? { expiresAt } : undefined;
                const { isDuplicate } = await this.rewardService.addRewardToUser(
                  userId,
                  nadumAmount,
                  'additional_point',
                  historyId,
                  null,  // actionTimestamp: 서버 시간 사용
                  true,
                  null,
                  rewardOptions
                );
                
                if (isDuplicate) {
                  console.log(`[나다움 중복 지급 방지] userId=${userId}, pageId=${pageId}`);
                  return { userId, success: true, duplicate: true };
                }
                
                return { userId, success: true };
              } catch (error) {
                console.error(`[나다움 지급 실패] userId=${userId}:`, error.message);
                return { userId, success: false, error: error.message };
              }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            const batchRewardedUserIds = batchResults
              .filter(result => result.status === 'fulfilled' && result.value.success && !result.value.duplicate)
              .map(result => result.value.userId);

            totalRewardSuccessCount += batchRewardedUserIds.length;
            totalRewardFailureCount += batch.length - batchRewardedUserIds.length;
            rewardedUserIds = rewardedUserIds.concat(batchRewardedUserIds);

            console.log(`[나다움 지급 배치 완료] 성공=${batchRewardedUserIds.length}, 실패=${batch.length - batchRewardedUserIds.length} (총 진행률: ${totalRewardSuccessCount + totalRewardFailureCount}/${finalUserIds.length})`);

            // 마지막 배치가 아니면 지연
            if (i + BATCH_SIZE < finalUserIds.length) {
              console.log(`[나다움 지급] ${DELAY_MS/1000}초 대기 중...`);
              await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
          }

          console.log(`[나다움 지급 완료] pageId=${pageId}, amount=${nadumAmount}, 성공=${totalRewardSuccessCount}, 실패=${totalRewardFailureCount}`);

          // 지급 실패한 유저 ID 계산
          rewardFailedUserIds = finalUserIds.filter(userId => !rewardedUserIds.includes(userId));

          // 지급 결과 결정
          if (totalRewardSuccessCount === 0) {
            paymentResult = PAYMENT_RESULT.FAILED;
            rewardFailed = true;
            // 지급 실패한 유저는 모든 유저
            rewardFailedUserIds = finalUserIds;
            const error = new Error("모든 사용자에게 나다움 지급에 실패했습니다.");
            error.code = ERROR_CODES.REWARD_FAILED;
            error.statusCode = 500;
            throw error;
          } else if (totalRewardSuccessCount === finalUserIds.length) {
            paymentResult = PAYMENT_RESULT.COMPLETED;
          } else {
            paymentResult = PAYMENT_RESULT.PARTIAL;
          }
        } catch (rewardError) {
          paymentResult = PAYMENT_RESULT.FAILED;
          rewardFailed = true;
          // 에러 발생 시 지급 실패한 유저는 모든 유저 (rewardedUserIds가 비어있거나 부분 성공)
          if (rewardFailedUserIds.length === 0) {
            rewardFailedUserIds = finalUserIds.filter(userId => !rewardedUserIds.includes(userId));
          }
          console.error("나다움 지급 처리 실패:", rewardError.message);
          if (!rewardError.code) {
            rewardError.code = ERROR_CODES.REWARD_FAILED;
            rewardError.statusCode = 500;
          }
          throw rewardError;
        }
      } else if (nadumAmount < 0) {
        try {
          let totalRewardSuccessCount = 0;
          let totalRewardFailureCount = 0;

          // 배치 처리로 나다움 차감
          for (let i = 0; i < finalUserIds.length; i += BATCH_SIZE) {
            const batch = finalUserIds.slice(i, i + BATCH_SIZE);
            console.log(`[나다움 차감 배치] ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(finalUserIds.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, finalUserIds.length)}번째)`);

            const batchPromises = batch.map(async (userId) => {
              const historyId = `additional_point_${pageId}_${userId}`;
              try {
                const { isDuplicate, deducted } = await this.rewardService.deductRewardFromUser(
                  userId,
                  Math.abs(nadumAmount),
                  'additional_point',
                  historyId,
                  null,  // actionTimestamp: 서버 시간 사용
                  true,
                  null
                );
                
                if (isDuplicate) {
                  console.log(`[나다움 중복 차감 방지] userId=${userId}, pageId=${pageId}`);
                  return { userId, success: true, duplicate: true, deducted: 0 };
                }
                
                return { userId, success: true, deducted };
              } catch (error) {
                console.error(`[나다움 차감 실패] userId=${userId}:`, error.message);
                return { userId, success: false, error: error.message };
              }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            const batchRewardedUserIds = batchResults
              .filter(result => result.status === 'fulfilled' && result.value.success && !result.value.duplicate)
              .map(result => result.value.userId);

            totalRewardSuccessCount += batchRewardedUserIds.length;
            totalRewardFailureCount += batch.length - batchRewardedUserIds.length;
            rewardedUserIds = rewardedUserIds.concat(batchRewardedUserIds);

            console.log(`[나다움 차감 배치 완료] 성공=${batchRewardedUserIds.length}, 실패=${batch.length - batchRewardedUserIds.length} (총 진행률: ${totalRewardSuccessCount + totalRewardFailureCount}/${finalUserIds.length})`);

            // 마지막 배치가 아니면 지연
            if (i + BATCH_SIZE < finalUserIds.length) {
              console.log(`[나다움 차감] ${DELAY_MS/1000}초 대기 중...`);
              await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
          }

          console.log(`[나다움 차감 완료] pageId=${pageId}, amount=${nadumAmount}, 성공=${totalRewardSuccessCount}, 실패=${totalRewardFailureCount}`);

          // 지급 실패한 유저 ID 계산
          rewardFailedUserIds = finalUserIds.filter(userId => !rewardedUserIds.includes(userId));

          // 차감은 실패해도 알림 자체는 진행 가능하게 유지(정책에 따라 조정)
          if (totalRewardSuccessCount === 0) {
            paymentResult = PAYMENT_RESULT.FAILED;
          } else if (totalRewardSuccessCount === finalUserIds.length) {
            paymentResult = PAYMENT_RESULT.COMPLETED;
          } else {
            paymentResult = PAYMENT_RESULT.PARTIAL;
          }
        } catch (rewardError) {
          paymentResult = PAYMENT_RESULT.FAILED;
          rewardFailed = true;
          console.error("나다움 차감 처리 실패:", rewardError.message);
          if (!rewardError.code) {
            rewardError.code = ERROR_CODES.REWARD_FAILED;
            rewardError.statusCode = 500;
          }
          throw rewardError;
        }
      } else {
        rewardedUserIds = finalUserIds;
        rewardFailedUserIds = []; // 나다움 지급이 없으면 지급 실패 없음
        // 나다움 지급이 없으면 지급 결과 업데이트 불필요
      }

      // 지급 실패한 유저는 알림 전송도 실패한 것으로 처리
      failedUserIds = failedUserIds.concat(rewardFailedUserIds);

      // 알림 전송 (나다움 지급 성공한 사용자에게만, 배치 처리)
      let totalSuccessCount = 0;
      let totalFailureCount = 0;
      let sendResult = { successCount: 0, failureCount: 0 };

      try {
        // 순환 참조 방지를 위해 lazy require
        const fcmHelper = require('../utils/fcmHelper');

        // 배치 처리로 알림 전송
        for (let i = 0; i < rewardedUserIds.length; i += BATCH_SIZE) {
          const batch = rewardedUserIds.slice(i, i + BATCH_SIZE);
          console.log(`[알림 전송 배치] ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rewardedUserIds.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, rewardedUserIds.length)}번째)`);

          try {
            const batchResult = await fcmHelper.sendNotificationToUsers(
              batch,
              title,
              content,
              "announcement",
              "",
              ""
            );

            const batchSuccessCount = batchResult?.successCount || batchResult?.sentCount || 0;
            const batchFailureCount = batchResult?.failureCount || batchResult?.failedCount || 0;
            const batchSuccessfulUserIds = batchResult?.successfulUserIds || [];

            totalSuccessCount += batchSuccessCount;
            totalFailureCount += batchFailureCount;
            successfulUserIds = successfulUserIds.concat(batchSuccessfulUserIds);

            const batchFailedUserIds = batch.filter(userId => !batchSuccessfulUserIds.includes(userId));
            failedUserIds = failedUserIds.concat(batchFailedUserIds);

            console.log(`[알림 전송 배치 완료] 성공=${batchSuccessCount}, 실패=${batchFailureCount} (총 진행률: ${totalSuccessCount + totalFailureCount}/${rewardedUserIds.length})`);

            // 마지막 배치가 아니면 지연
            if (i + BATCH_SIZE < rewardedUserIds.length) {
              console.log(`[알림 전송] ${DELAY_MS/1000}초 대기 중...`);
              await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
          } catch (batchError) {
            console.error(`[알림 전송 배치 실패] 배치 ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError.message);
            totalFailureCount += batch.length;
            failedUserIds = failedUserIds.concat(batch);
            // 배치 실패해도 다음 배치 계속 진행
          }
        }

        sendResult = {
          successCount: totalSuccessCount,
          failureCount: totalFailureCount,
        };
      } catch (notificationError) {
        fcmFailed = true;
        const fcmError = new Error(`알림 전송에 실패했습니다: ${notificationError.message}`);
        fcmError.code = ERROR_CODES.FCM_SEND_FAILED;
        fcmError.statusCode = 500;
        fcmError.originalError = notificationError;
        throw fcmError;
      }

      const successCount = totalSuccessCount;
      const failureCount = totalFailureCount;
      // 전체 사용자 수는 원본 userIds.length (마케팅 동의하지 않은 사용자 포함)
      const totalCount = userIds.length;
      const rewardFailureCount = nadumAmount > 0 ? finalUserIds.length - rewardedUserIds.length : 0;


      const successfulUserCount = successfulUserIds.length;
      const totalUserCount = rewardedUserIds.length;

      // 마케팅 동의하지 않은 사용자도 실패로 처리
      const totalFailureCountWithMarketing = failureCount + marketingFilteredFailedUserIds.length;

      // 전송 상태 결정 (전체 사용자 기준)
      // - 마케팅 동의하지 않은 사용자가 있으면 무조건 부분 완료 또는 실패
      if (marketingFilteredFailedUserIds.length > 0 && successfulUserCount > 0) {
        // 일부는 전송 성공, 일부는 마케팅 동의 없음 → 부분 완료
        finalStatus = SEND_STATUS.PARTIAL;
        shouldUpdateLastPaymentDate = true;
      } else if (successfulUserCount === totalUserCount && successfulUserCount > 0) {
        // 모든 필터링된 사용자에게 전송 성공
        finalStatus = SEND_STATUS.COMPLETED;
        shouldUpdateLastPaymentDate = true;
      } else if (successfulUserCount > 0) {
        // 일부만 전송 성공
        finalStatus = SEND_STATUS.PARTIAL;
        shouldUpdateLastPaymentDate = true;
      } else {
        // 전송 실패
        finalStatus = SEND_STATUS.FAILED;
        fcmFailed = true;
      }

      return {
        success: true,
        notificationId: pageId,
        title,
        totalUsers: totalCount,
        successCount,
        failureCount: totalFailureCountWithMarketing,
        rewardFailureCount,
        rewardedUsers: rewardedUserIds.length,
        failedUserIds: failedUserIds, // 실패한 유저 ID 배열 (마케팅 동의하지 않은 사용자 포함)
        sendResult,
      };
    } catch (error) {
      console.error("알림 전송 실패:", error.message);

      // 에러 발생 시 최종 상태 결정
      if (!finalStatus) {
        finalStatus = SEND_STATUS.FAILED;
      }
      // 나다움 지급 실패 시 지급 결과 설정
      if (rewardFailed && !paymentResult) {
        paymentResult = PAYMENT_RESULT.FAILED;
      }

      if (error.code) {
        throw error;
      }

      const serviceError = new Error(`알림 전송에 실패했습니다: ${error.message}`);
      serviceError.code = fcmFailed ? ERROR_CODES.FCM_SEND_FAILED : (rewardFailed ? ERROR_CODES.REWARD_FAILED : ERROR_CODES.FCM_SEND_FAILED);
      serviceError.statusCode = 500;
      serviceError.originalError = error;
      throw serviceError;
    } finally {
      // Notion 필드 배치 업데이트 (한 번의 API 호출로 처리)
      try {
        await this.updateNotionFieldsBatch(pageId, {
          finalStatus,
          shouldUpdateLastPaymentDate,
          paymentResult,
          clearSelected: true, // 전송 후 "선택" 체크박스 해제
          failedUserIds: failedUserIds || [],
          rewardFailedUserIds: rewardFailedUserIds || [],
        });
      } catch (updateError) {
        console.warn("Notion 필드 업데이트 실패:", updateError.message);
      }
    }
  }

  /**
   * "전송 대기" 상태인 모든 알림 조회
   * @return {Promise<Array<Object>>} 대기 상태 알림 목록
   */
  async getPendingNotifications() {
    try {
      let databaseId = this.notificationDatabaseId;
      if (databaseId && !databaseId.includes('-') && databaseId.length === 32) {
        databaseId = `${databaseId.slice(0, 8)}-${databaseId.slice(8, 12)}-${databaseId.slice(12, 16)}-${databaseId.slice(16, 20)}-${databaseId.slice(20)}`;
      }
      
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filter: {
            and: [
              {
                property: NOTION_FIELDS.SEND_STATUS,
                status: {
                  equals: SEND_STATUS.PENDING
                }
              },
              {
                property: NOTION_FIELDS.SELECTED,
                checkbox: {
                  equals: true
                }
              }
            ]
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const apiError = new Error(`Notion API 호출 실패: ${response.status} - ${errorText}`);
        apiError.code = ERROR_CODES.NOTION_API_ERROR;
        apiError.statusCode = response.status;
        throw apiError;
      }

      const data = await response.json();

      // "선택" 체크박스가 체크되어 있는 것만 필터링 (추가 안전장치)
      return (data.results || []).filter(page => {
        const selected = page.properties[NOTION_FIELDS.SELECTED]?.checkbox || false;
        return selected;
      }).map(page => ({
        pageId: page.id,
        properties: page.properties
      }));
    } catch (error) {
      console.error("대기 상태 알림 조회 실패:", error.message);

      if (error.code) {
        throw error;
      }

      const serviceError = new Error(`대기 상태 알림을 조회하는데 실패했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 모든 "전송 대기" 상태 알림 전송
   * @return {Promise<Object>} 전송 결과
   */
  async sendAllPendingNotifications() {
    try {
      const pendingNotifications = await this.getPendingNotifications();

      if (pendingNotifications.length === 0) {
        return {
          success: true,
          message: "알림을 선택하지 않으셨거나, 전송 대기인 알림이 없습니다.",
          total: 0,
          successCount: 0,
          errorCount: 0,
          results: []
        };
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const notification of pendingNotifications) {
        try {
          const result = await this.sendNotification(notification.pageId);
          results.push({
            pageId: notification.pageId,
            success: true,
            ...result
          });
          successCount++;
        } catch (error) {
          console.error(`알림 ${notification.pageId} 전송 실패:`, error.message);
          results.push({
            pageId: notification.pageId,
            success: false,
            error: error.message
          });
          errorCount++;

          try {
            await this.updateNotionStatus(notification.pageId, SEND_STATUS.FAILED);
          } catch (statusError) {
            console.warn(`상태 업데이트 실패 (${notification.pageId}):`, statusError.message);
          }
        }
      }

      return {
        success: true,
        message: `총 ${pendingNotifications.length}개의 알림을 처리했습니다.`,
        total: pendingNotifications.length,
        successCount,
        errorCount,
        results
      };
    } catch (error) {
      console.error("대기 상태 알림 일괄 전송 실패:", error.message);
      throw error;
    }
  }

  /**
   * Notion 알림 페이지 상태 업데이트
   * @param {string} pageId - Notion 페이지 ID
   * @param {string} status - 상태 값 (SEND_STATUS 상수 사용)
   * @return {Promise<void>}
   */
  async updateNotionStatus(pageId, status) {
    try {
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          [NOTION_FIELDS.SEND_STATUS]: {
            status: {
              name: status,
            },
          },
        },
      });
    } catch (error) {
      console.error("Notion 상태 업데이트 실패:", error.message);

      // Notion API 에러 처리
      if (error.code === 'validation_error') {
        const validationError = new Error(`상태 옵션이 유효하지 않습니다: ${status}`);
        validationError.code = ERROR_CODES.STATUS_UPDATE_FAILED;
        validationError.statusCode = 400;
        throw validationError;
      }

      const serviceError = new Error(`상태 업데이트에 실패했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.STATUS_UPDATE_FAILED;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * "전송 일시" 필드 업데이트
   * @param {string} pageId - Notion 페이지 ID
   * @return {Promise<void>}
   */
  async updateLastPaymentDate(pageId) {
    try {
      const now = new Date().toISOString();
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          [NOTION_FIELDS.LAST_PAYMENT_DATE]: {
            date: {
              start: now,
            },
          },
        },
      });
    } catch (error) {
      console.error("전송 일시 업데이트 실패:", error.message);
    }
  }

  /**
   * "지급 결과" 필드 업데이트
   * @param {string} pageId - Notion 페이지 ID
   * @param {string} result - 지급 결과 (PAYMENT_RESULT 상수)
   * @return {Promise<void>}
   */
  async updatePaymentResult(pageId, result) {
    try {
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          [NOTION_FIELDS.PAYMENT_RESULT]: {
            status: {
              name: result,
            },
          },
        },
      });
    } catch (error) {
      console.error("지급 결과 업데이트 실패:", error.message);
      
      if (error.code === 'validation_error') {
        const validationError = new Error(`지급 결과 옵션이 유효하지 않습니다: ${result}`);
        validationError.code = ERROR_CODES.STATUS_UPDATE_FAILED;
        validationError.statusCode = 400;
        throw validationError;
      }

      const serviceError = new Error(`지급 결과 업데이트에 실패했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.STATUS_UPDATE_FAILED;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * Firebase UID로 Notion "회원 관리" DB에서 사용자 페이지 찾기
   * @param {string} firebaseUid - Firebase UID
   * @returns {Promise<string|null>} Notion 페이지 ID 또는 null
   */
  async findUserNotionPageId(firebaseUid) {
    try {
      const userDbId = process.env.NOTION_USER_ACCOUNT_DB_ID2;
      if (!userDbId) {
        console.warn('[NotificationService] NOTION_USER_ACCOUNT_DB_ID2 환경변수가 설정되지 않음');
        return null;
      }

      // Notion "회원 관리" DB에서 사용자ID로 검색
      const response = await this.notion.dataSources.query({
        data_source_id: userDbId,
        filter: {
          property: '사용자ID',
          rich_text: {
            equals: firebaseUid
          }
        },
        page_size: 1
      });

      if (response.results && response.results.length > 0) {
        return response.results[0].id;
      }

      console.warn(`[NotificationService] Notion "회원 관리"에서 사용자를 찾을 수 없음: ${firebaseUid}`);
      return null;
    } catch (error) {
      console.error('[NotificationService] Notion 사용자 검색 오류:', error.message);
      return null;
    }
  }

  /**
   * Notion 필드 배치 업데이트 (한 번의 API 호출로 여러 필드 업데이트)
   * @param {string} pageId - Notion 페이지 ID
   * @param {Object} options - 업데이트 옵션
   * @param {string} options.finalStatus - 전송 상태
   * @param {boolean} options.shouldUpdateLastPaymentDate - 최근 지급 일시 업데이트 여부
   * @param {string} options.paymentResult - 지급 결과
   * @param {boolean} options.clearSelected - "선택" 체크박스 해제 여부
   * @param {Array<string>} options.failedUserIds - 전송 실패한 유저 ID 배열
   * @param {Array<string>} options.rewardFailedUserIds - 지급 실패한 유저 ID 배열
   * @return {Promise<void>}
   */
  async updateNotionFieldsBatch(pageId, { finalStatus, shouldUpdateLastPaymentDate, paymentResult, clearSelected = false, failedUserIds = [], rewardFailedUserIds = [] }) {
    try {
      const properties = {};

      if (finalStatus) {
        properties[NOTION_FIELDS.SEND_STATUS] = {
          status: {
            name: finalStatus,
          },
        };
      }

      if (shouldUpdateLastPaymentDate) {
        properties[NOTION_FIELDS.LAST_PAYMENT_DATE] = {
          date: {
            start: new Date().toISOString(),
          },
        };
      }

      if (paymentResult) {
        properties[NOTION_FIELDS.PAYMENT_RESULT] = {
          status: {
            name: paymentResult,
          },
        };
      }

      if (clearSelected) {
        properties[NOTION_FIELDS.SELECTED] = {
          checkbox: false,
        };
      }

      // 전송 실패한 회원들을 Notion 관계형 필드에 추가
      if (failedUserIds && failedUserIds.length > 0) {
        try {
          // 각 유저 ID로 회원 관리 DB에서 Notion 페이지 ID 조회 (병렬 처리)
          const notionPageIdPromises = failedUserIds.map(userId => 
            this.findUserNotionPageId(userId)
          );
          const notionPageIds = await Promise.all(notionPageIdPromises);
          
          // null이 아닌 페이지 ID만 필터링
          const validNotionPageIds = notionPageIds.filter(pageId => pageId !== null);
          
          if (validNotionPageIds.length > 0) {
            properties[NOTION_FIELDS.FAILED_MEMBERS] = {
              relation: validNotionPageIds.map(pageId => ({ id: pageId })),
            };
          }
        } catch (relationError) {
          console.error('[NotificationService] 전송 실패 회원 관계형 필드 업데이트 실패:', relationError.message);
          // 관계형 필드 업데이트 실패해도 다른 필드는 업데이트 진행
        }
      }

      // 지급 실패한 회원들을 Notion 관계형 필드에 추가
      if (rewardFailedUserIds && rewardFailedUserIds.length > 0) {
        try {
          // 각 유저 ID로 회원 관리 DB에서 Notion 페이지 ID 조회 (병렬 처리)
          const notionPageIdPromises = rewardFailedUserIds.map(userId => 
            this.findUserNotionPageId(userId)
          );
          const notionPageIds = await Promise.all(notionPageIdPromises);
          
          // null이 아닌 페이지 ID만 필터링
          const validNotionPageIds = notionPageIds.filter(pageId => pageId !== null);
          
          if (validNotionPageIds.length > 0) {
            properties[NOTION_FIELDS.PAYMENT_FAILED_MEMBERS] = {
              relation: validNotionPageIds.map(pageId => ({ id: pageId })),
            };
          }
        } catch (relationError) {
          console.error('[NotificationService] 지급 실패 회원 관계형 필드 업데이트 실패:', relationError.message);
          // 관계형 필드 업데이트 실패해도 다른 필드는 업데이트 진행
        }
      }

      if (Object.keys(properties).length === 0) {
        return;
      }

      await this.notion.pages.update({
        page_id: pageId,
        properties,
      });
    } catch (error) {
      console.error("Notion 필드 배치 업데이트 실패:", error.message);

      if (error.code === 'validation_error') {
        const validationError = new Error(`필드 업데이트 옵션이 유효하지 않습니다: ${error.message}`);
        validationError.code = ERROR_CODES.STATUS_UPDATE_FAILED;
        validationError.statusCode = 400;
        throw validationError;
      }

      const serviceError = new Error(`Notion 필드 배치 업데이트에 실패했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.STATUS_UPDATE_FAILED;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 알림 저장 (FCM 전송 시 호출)
   * @param {string} userId - 알림을 받는 사용자 ID
   * @param {Object} notificationData - 알림 데이터
   * @param {string} notificationData.title - 알림 제목
   * @param {string} notificationData.message - 알림 내용
   * @param {string} notificationData.type - 알림 타입 (POST_LIKE, COMMENT_LIKE, COMMENT 등)
   * @param {string} notificationData.postId - 게시글 ID
   * @param {string} notificationData.communityId - 커뮤니티 ID (선택)
   * @return {Promise<string>} 저장된 알림 문서 ID
   */
  async saveNotification(userId, notificationData) {
    try {
      const {title, message, type, postId, communityId, commentId} = notificationData;

      if (!userId || !title || !message || !type) {
        const error = new Error("필수 알림 데이터가 누락되었습니다");
        error.code = "INVALID_NOTIFICATION_DATA";
        throw error;
      }

      const notification = {
        userId,
        title,
        message,
        type,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // 타입별 필드 추가
      const isPostRelated = type === "POST_LIKE" || type === "COMMENT_LIKE" || type === "COMMENT";
      const isCommentRelated = type === "COMMENT_LIKE" || type === "COMMENT";

      if (isPostRelated) {
        // 게시글 관련 알림은 postId 필수
        if (!postId || postId === "") {
          return null;
        }
        notification.postId = postId;
        
        if (communityId) {
          notification.communityId = communityId;
        }
        
        // 댓글 관련 알림은 commentId 추가
        if (isCommentRelated && commentId && commentId !== "") {
          notification.commentId = commentId;
        }
      }
      // announcement 타입은 기본 필드만 저장 (추가 필드 없음)

      const docRef = await this.notificationFirestoreService.create(notification);
      return docRef.id;
    } catch (error) {
      console.error("알림 저장 실패:", error);
      // 알림 저장 실패해도 FCM 전송은 계속 진행
      return null;
    }
  }

  /**
   * 알림 목록 조회 (읽지 않은 개수 포함)
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 조회 옵션
   * @param {number} options.page - 페이지 번호 (기본값: 0)
   * @param {number} options.size - 페이지 크기 (기본값: 20)
   * @return {Promise<Object>} 알림 목록 및 읽지 않은 개수
   */
  async getNotifications(userId, options = {}) {
    try {
      const {page = 0, size = 20} = options;

      // 알림 목록 조회 (페이지네이션)
      const notificationsResult = await this.notificationFirestoreService.getWithPagination({
        where: [
          {field: "userId", operator: "==", value: userId}
        ],
        orderBy: "createdAt",
        orderDirection: "desc",
        page: parseInt(page),
        size: parseInt(size),
      });

      const notifications = notificationsResult?.content || [];
      const pageable = notificationsResult?.pageable || {};
      
      // userId 필드 제거
      const notificationsWithoutUserId = notifications.map(({userId, ...rest}) => rest);
      
      // 페이지네이션 정보 변환 (pageable -> pagination)
      const pagination = {
        page: pageable.pageNumber ?? parseInt(page),
        size: pageable.pageSize ?? parseInt(size),
        total: pageable.totalElements ?? 0,
        totalPages: pageable.totalPages ?? 0,
        hasNext: pageable.hasNext ?? false,
      };

      // 읽지 않은 알림 개수 조회 (전체 개수)
      const unreadNotifications = await this.notificationFirestoreService.getCollectionWhereMultiple(
        "notifications",
        [
          {field: "userId", operator: "==", value: userId},
          {field: "isRead", operator: "==", value: false}
        ]
      );
      const unreadCount = unreadNotifications?.length || 0;

      return {
        notifications: notificationsWithoutUserId,
        pagination,
        unreadCount,
      };
    } catch (error) {
      console.error("알림 목록 조회 실패:", error);
      const serviceError = new Error("알림 목록 조회에 실패했습니다");
      serviceError.code = "NOTIFICATION_GET_FAILED";
      serviceError.statusCode = 500;
      throw serviceError;
    }
  }

  /**
   * 전체 읽음 처리
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>} 업데이트된 알림 개수
   */
  async markAllAsRead(userId) {
    try {
      // 읽지 않은 알림 조회
      const unreadNotifications = await this.notificationFirestoreService.getCollectionWhereMultiple(
        "notifications",
        [
          {field: "userId", operator: "==", value: userId},
          {field: "isRead", operator: "==", value: false}
        ]
      );

      if (!unreadNotifications || unreadNotifications.length === 0) {
        return { updatedCount: 0 };
      }

      // 각 알림을 개별적으로 업데이트
      const updatePromises = unreadNotifications.map(notification =>
        this.notificationFirestoreService.update(notification.id, {
          isRead: true,
          updatedAt: FieldValue.serverTimestamp()
        })
      );

      await Promise.all(updatePromises);
      const updatedCount = unreadNotifications.length;

      return { updatedCount };
    } catch (error) {
      console.error("전체 읽음 처리 실패:", error);
      const serviceError = new Error("전체 읽음 처리에 실패했습니다");
      serviceError.code = "NOTIFICATION_MARK_ALL_READ_FAILED";
      serviceError.statusCode = 500;
      throw serviceError;
    }
  }

  /**
   * 개별 알림 읽음 처리
   * @param {string} userId - 사용자 ID
   * @param {string} notificationId - 알림 ID
   * @return {Promise<Object>} 업데이트 결과
   */
  async markAsRead(userId, notificationId) {
    try {
      if (!notificationId) {
        const error = new Error("알림 ID가 필요합니다");
        error.code = "INVALID_NOTIFICATION_ID";
        error.statusCode = 400;
        throw error;
      }

      // 알림 조회
      const notification = await this.notificationFirestoreService.getById(notificationId);

      if (!notification) {
        const error = new Error("알림을 찾을 수 없습니다");
        error.code = "NOTIFICATION_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }

      // 사용자 소유 확인
      if (notification.userId !== userId) {
        const error = new Error("권한이 없습니다");
        error.code = "NOTIFICATION_UNAUTHORIZED";
        error.statusCode = 403;
        throw error;
      }

      // 이미 읽은 알림인지 확인
      if (notification.isRead === true) {
        return { message: "이미 읽음 처리된 알림입니다", updated: false };
      }

      // 읽음 처리
      await this.notificationFirestoreService.update(notificationId, {
        isRead: true,
        updatedAt: FieldValue.serverTimestamp()
      });

      return { message: "알림이 읽음 처리되었습니다", updated: true };
    } catch (error) {
      console.error("개별 읽음 처리 실패:", error);
      if (error.code && error.statusCode) {
        throw error;
      }
      const serviceError = new Error("개별 읽음 처리에 실패했습니다");
      serviceError.code = "NOTIFICATION_MARK_READ_FAILED";
      serviceError.statusCode = 500;
      throw serviceError;
    }
  }
}

module.exports = NotificationService;