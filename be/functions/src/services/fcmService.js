const admin = require("firebase-admin");
const crypto = require("crypto");
const FirestoreService = require("./firestoreService");
const {FieldValue} = require("../config/database");
const NotificationService = require("./notificationService");

let fcmAdmin = admin;
if (!admin.apps.find((app) => app.name === "fcm-app")) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      fcmAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      }, "fcm-app");
    } catch (error) {
      console.error("Firebase 서비스 계정 키 파싱 실패:", error);
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT environment variable");
    }
  } else {
    fcmAdmin = admin;
  }
}

class FCMService {
  constructor() {
    this.firestoreService = new FirestoreService("users");
    this.maxTokensPerUser = 5;
    this.notificationService = new NotificationService();
  }

  /**
   * FCM 토큰 저장/업데이트
   * @param {string} userId - 사용자 ID
   * @param {string} token - FCM 토큰 (문서 ID로 사용)
   * @param {string} deviceType - 디바이스 타입 (pwa, mobile, web)
   * @return {Promise<Object>} 저장 결과
   */
  async saveToken(userId, token, deviceType = "pwa") {
    try {
      // 토큰을 문서 ID로 사용
      const deviceId = token;

      const existingTokens = await this.getUserTokens(userId);

      const existingDeviceDoc = existingTokens.find((t) => t.id === deviceId);
      
      if (existingDeviceDoc) {
        // 같은 토큰 문서가 있으면 업데이트 (pushTermsAgreed 등 기존 설정 유지)
        const updateData = {
          token,
          deviceType,
          lastUsed: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        
        await this.firestoreService.updateDocument(
          `users/${userId}/fcmTokens`,
          deviceId,
          updateData
        );
        
        return {deviceId, message: "토큰 업데이트 완료"};
      }

      if (existingTokens.length >= this.maxTokensPerUser) {
        const sortedTokens = [...existingTokens].sort((a, b) => {
          const dateA = a.lastUsed?.toDate ? a.lastUsed.toDate() : new Date(a.lastUsed);
          const dateB = b.lastUsed?.toDate ? b.lastUsed.toDate() : new Date(b.lastUsed);
          return dateA - dateB;
        });
        const oldestToken = sortedTokens[0];
        await this.deleteToken(userId, oldestToken.id);
      }

      // 새 문서 생성 (해당 토큰에서 처음 저장하는 경우 pushTermsAgreed: true)
      const tokenData = {
        token,
        deviceType,
        pushTermsAgreed: true,
        lastUsed: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      };

      await this.firestoreService.setDocument(
          `users/${userId}/fcmTokens`,
          deviceId,
          tokenData,
      );

      return {deviceId, message: "토큰 저장 완료"};
    } catch (error) {
      console.error("FCM 토큰 저장 실패:", error);
      const errorMessage = error.message || "토큰 저장에 실패했습니다.";
      const fcmError = new Error(errorMessage);
      fcmError.code = "FCM_TOKEN_SAVE_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * 사용자의 모든 FCM 토큰 조회
   * @param {string} userId - 사용자 ID
   * @return {Promise<Array>} 토큰 목록
   */
  async getUserTokens(userId) {
    try {
      return await this.firestoreService.getCollection(`users/${userId}/fcmTokens`);
    } catch (error) {
      console.error("FCM 토큰 조회 실패:", error);
      const fcmError = new Error("토큰 조회에 실패했습니다.");
      fcmError.code = "FCM_TOKEN_GET_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * 특정 토큰의 pushTermsAgreed 조회
   * @param {string} userId - 사용자 ID
   * @param {string} token - FCM 토큰
   * @return {Promise<boolean|null>} pushTermsAgreed 값 (문서가 없으면 null)
   */
  async getDevicePushTermsAgreed(userId, token) {
    try {
      // 토큰을 문서 ID로 사용
      const deviceId = token;
      const tokenDoc = await this.firestoreService.getDocument(
        `users/${userId}/fcmTokens`,
        deviceId
      );
      
      if (!tokenDoc) {
        return null;
      }
      
      return tokenDoc.pushTermsAgreed === true;
    } catch (error) {
      console.error("토큰별 pushTermsAgreed 조회 실패:", error);
      const fcmError = new Error("알림 설정 조회에 실패했습니다.");
      fcmError.code = "FCM_PUSH_TERMS_GET_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * 특정 토큰의 pushTermsAgreed 토글
   * @param {string} userId - 사용자 ID
   * @param {string} token - FCM 토큰
   * @return {Promise<boolean>} 변경된 pushTermsAgreed 값
   */
  async toggleDevicePushTermsAgreed(userId, token) {
    try {
      // 토큰을 문서 ID로 사용
      const deviceId = token;
      const tokenDoc = await this.firestoreService.getDocument(
        `users/${userId}/fcmTokens`,
        deviceId
      );
      
      if (!tokenDoc) {
        const e = new Error("해당 FCM 토큰을 찾을 수 없습니다");
        e.code = "NOT_FOUND";
        throw e;
      }

      const currentValue = tokenDoc.pushTermsAgreed === true;
      const newValue = !currentValue;

      await this.firestoreService.updateDocument(
        `users/${userId}/fcmTokens`,
        deviceId,
        {
          pushTermsAgreed: newValue,
          updatedAt: FieldValue.serverTimestamp(),
        }
      );

      return newValue;
    } catch (error) {
      console.error("토큰별 pushTermsAgreed 토글 실패:", error);
      if (error.code) {
        throw error;
      }
      const fcmError = new Error("알림 설정을 변경할 수 없습니다");
      fcmError.code = "FCM_PUSH_TERMS_TOGGLE_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * 특정 토큰 삭제
   * @param {string} userId - 사용자 ID
   * @param {string} deviceId - 디바이스 ID
   * @return {Promise<void>}
   */
  async deleteToken(userId, deviceId) {
    try {
      await this.firestoreService.deleteDocument(`users/${userId}/fcmTokens`, deviceId);
    } catch (error) {
      console.error("FCM 토큰 삭제 실패:", error);
      const fcmError = new Error("토큰 삭제에 실패했습니다.");
      fcmError.code = "FCM_TOKEN_DELETE_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * 토큰의 lastUsed 업데이트
   * @param {string} userId - 사용자 ID
   * @param {string} deviceId - 디바이스 ID
   * @return {Promise<void>}
   */
  async updateTokenLastUsed(userId, deviceId) {
    try {
      await this.firestoreService.updateDocument(
          `users/${userId}/fcmTokens`,
          deviceId,
          {lastUsed: FieldValue.serverTimestamp()},
      );
    } catch (error) {
      console.error("토큰 lastUsed 업데이트 실패:", error);
    }
  }

  /**
   * 단일 사용자에게 푸시 알림 전송
   * @param {string} userId - 사용자 ID
   * @param {Object} notification - 알림 데이터
   * @return {Promise<Object>} 전송 결과
   */
  async sendToUser(userId, notification, options = {}) {
    try {
      const { skipPushTermsFilter = false } = options;
      
      const tokens = await this.getUserTokens(userId);
      
      // pushTermsAgreed 필터링: fcmTokens 서브컬렉션에서 확인
      if (!skipPushTermsFilter) {
        // pushTermsAgreed가 true인 토큰만 필터링
        const approvedTokens = tokens.filter((t) => t.pushTermsAgreed === true);
        if (approvedTokens.length === 0) {
          return {sentCount: 0, failedCount: 0, filteredOut: true};
        }
      }
      this.notificationService.saveNotification(userId, {
        title: notification.title,
        message: notification.message,
        type: notification.type || "general",
        postId: notification.postId || undefined,
        communityId: notification.communityId || undefined,
        commentId: notification.commentId && notification.commentId !== "" ? notification.commentId : undefined,
      }).catch(err => {
        console.error("알림 저장 실패:", err);
      });

      // pushTermsAgreed 필터링된 토큰 사용
      let approvedTokens = tokens;
      if (!skipPushTermsFilter) {
        approvedTokens = tokens.filter((t) => t.pushTermsAgreed === true);
      }

      if (approvedTokens.length === 0) {
        return {sentCount: 0, failedCount: 0};
      }

      const tokenList = approvedTokens.map((t) => t.token);
      const result = await this.sendToTokens(tokenList, notification);

      return {
        sentCount: result.successCount,
        failedCount: result.failureCount,
      };
    } catch (error) {
      console.error("사용자 알림 전송 실패:", error);
      const fcmError = new Error("알림 전송에 실패했습니다.");
      fcmError.code = "FCM_SEND_USER_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * 여러 사용자에게 푸시 알림 전송
   * @param {Array<string>} userIds - 사용자 ID 배열
   * @param {Object} notification - 알림 데이터
   * @return {Promise<Object>} 전송 결과 { sentCount, failedCount, successfulUserIds }
   */
  async sendToUsers(userIds, notification, options = {}) {
    const { skipPushTermsFilter = false } = options;
    try {
      // 사용자 ID 중복 제거
      const uniqueUserIds = Array.from(new Set(userIds));
      const filteredOutUserIds = [];

      if (uniqueUserIds.length > 0) {
        const saveAllPromises = uniqueUserIds.map((userId) =>
          this.notificationService.saveNotification(userId, {
            title: notification.title,
            message: notification.message,
            type: notification.type || "general",
            postId: notification.postId || undefined,
            communityId: notification.communityId || undefined,
            commentId:
              notification.commentId && notification.commentId !== ""
                ? notification.commentId
                : undefined,
          }).catch((err) => {
            console.error(`알림 저장 실패 (userId: ${userId}):`, err);
          })
        );
        Promise.all(saveAllPromises).catch((err) => {
          console.error("다중 사용자 알림 저장 중 오류:", err);
        });
      }
      
      // pushTermsAgreed가 true인 사용자만 필터링 (fcmTokens 서브컬렉션에서 확인)
      const approvedUserIds = [];
      const userTokenMap = new Map(); // 유저 ID -> 토큰 배열 매핑
      const tokenToUserMap = new Map(); // 토큰 -> 유저 ID 매핑
      const allTokens = [];
      
      if (uniqueUserIds.length > 0) {
        // 모든 사용자의 토큰을 한 번에 가져오기
        const tokenPromises = uniqueUserIds.map(async (userId) => {
          const tokens = await this.getUserTokens(userId);
          return { userId, tokens };
        });
        
        const tokenResults = await Promise.all(tokenPromises);
        
        tokenResults.forEach(({ userId, tokens }) => {
          if (skipPushTermsFilter) {
            // 필터링 스킵 시 모든 토큰 사용
            const tokenList = tokens.map((t) => t.token);
            userTokenMap.set(userId, tokenList);
            tokenList.forEach(token => {
              allTokens.push(token);
              tokenToUserMap.set(token, userId);
            });
            approvedUserIds.push(userId);
          } else {
            // pushTermsAgreed가 true인 토큰만 필터링
            const approvedTokens = tokens.filter((t) => t.pushTermsAgreed === true);
            if (approvedTokens.length > 0) {
              const tokenList = approvedTokens.map((t) => t.token);
              userTokenMap.set(userId, tokenList);
              tokenList.forEach(token => {
                allTokens.push(token);
                tokenToUserMap.set(token, userId);
              });
              approvedUserIds.push(userId);
            } else {
              filteredOutUserIds.push(userId); // 푸시 미동의 사용자
            }
          }
        });
      }

      if (approvedUserIds.length === 0) {
        return {sentCount: 0, failedCount: 0, successfulUserIds: [], filteredOutUserIds};
      }

      if (allTokens.length === 0) {
        return {sentCount: 0, failedCount: 0, successfulUserIds: []};
      }

      const result = await this.sendToTokens(allTokens, notification);

      // FCM 응답에서 성공한 토큰들을 확인하여 유저별 성공 여부 판단
      const successfulUserIdsSet = new Set();
      if (result.responses && Array.isArray(result.responses)) {
        result.responses.forEach((response, index) => {
          if (response.success) {
            const token = allTokens[index];
            const userId = tokenToUserMap.get(token);
            if (userId) {
              successfulUserIdsSet.add(userId);
            }
          }
        });
      }

      const successfulUserIds = Array.from(successfulUserIdsSet);

      return {
        sentCount: result.successCount,
        failedCount: result.failureCount,
        successfulUserIds: successfulUserIds,
        filteredOutUserIds,
      };
    } catch (error) {
      console.error("다중 사용자 알림 전송 실패:", error);
      const fcmError = new Error("다중 사용자 알림 전송에 실패했습니다.");
      fcmError.code = "FCM_SEND_USERS_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * FCM 토큰 배열에 직접 알림 전송
   * @param {Array<string>} tokens - FCM 토큰 배열
   * @param {Object} notification - 알림 데이터
   * @return {Promise<Object>} 전송 결과
   */
  async sendToTokens(tokens, notification) {
    try {
      if (!tokens || tokens.length === 0) {
        return {successCount: 0, failureCount: 0};
      }

      // notification 필드 제거, 모든 정보를 data 필드에 포함 (중복 알림 방지)
      const message = {
        data: {
          title: notification.title || "",
          body: notification.message || "",
          type: notification.type || "general",
          postId: notification.postId || "",
          commentId: notification.commentId || "",
          communityId: notification.communityId || "",
          link: notification.link || "",
        },
        tokens: tokens,
      };

      const response = await fcmAdmin.messaging().sendEachForMulticast(message);

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses};
    } catch (error) {
      console.error("FCM 메시지 전송 실패:", error);
      const fcmError = new Error("FCM 메시지 전송에 실패했습니다.");
      fcmError.code = "FCM_SEND_TOKENS_FAILED";
      fcmError.statusCode = 500;
      throw fcmError;
    }
  }

  /**
   * deviceInfo를 기반으로 deviceId 생성
   * @param {string} deviceInfo - 브라우저/디바이스 정보
   * @return {string} deviceId
   */
  generateDeviceId(deviceInfo) {
    const hash = crypto
        .createHash("sha256")
        .update(deviceInfo)
        .digest("hex");
    return hash.substring(0, 20);
  }
}

module.exports = FCMService;
