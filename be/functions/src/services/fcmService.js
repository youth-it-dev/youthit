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
   * @param {string} token - FCM 토큰
   * @param {string} deviceInfo - 디바이스 정보 (PWA: userAgent, 모바일: deviceId, 웹: userAgent)
   * @param {string} deviceType - 디바이스 타입 (pwa, mobile, web)
   * @return {Promise<Object>} 저장 결과
   */
  async saveToken(userId, token, deviceInfo, deviceType = "pwa") {
    try {
      const deviceId = deviceInfo;

      const existingTokens = await this.getUserTokens(userId);

      const existingDeviceDoc = existingTokens.find((t) => t.id === deviceId);
      
      if (existingDeviceDoc) {
        const updateData = {
          token,
          deviceType,
          deviceInfo,
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

      const tokenData = {
        token,
        deviceType,
        deviceInfo,
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
      if (!skipPushTermsFilter) {
        const userDoc = await this.firestoreService.getById(userId);
        if (!userDoc || userDoc.pushTermsAgreed !== true) {
          return {sentCount: 0, failedCount: 0, filteredOut: true};
        }
      }

      const tokens = await this.getUserTokens(userId);
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

      if (tokens.length === 0) {
        return {sentCount: 0, failedCount: 0};
      }

      const tokenList = tokens.map((t) => t.token);
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
      
      // pushTermsAgreed가 true인 사용자만 필터링
      const approvedUserIds = [];
      if (uniqueUserIds.length > 0) {
        // Firestore 'in' 쿼리는 최대 10개만 지원하므로 청크로 나누어 처리
        const chunks = [];
        for (let i = 0; i < uniqueUserIds.length; i += 10) {
          chunks.push(uniqueUserIds.slice(i, i + 10));
        }

        const userResults = await Promise.all(
          chunks.map((chunk) =>
            this.firestoreService.getCollectionWhereIn("users", "__name__", chunk)
          )
        );

        if (skipPushTermsFilter) {
          userResults.flat().forEach((user) => {
            if (user?.id) {
              approvedUserIds.push(user.id);
            }
          });
        } else {
          const users = userResults.flat();
          users.forEach((user) => {
            if (user?.pushTermsAgreed === true) {
              approvedUserIds.push(user.id);
            } else if (user?.id) {
              filteredOutUserIds.push(user.id); // 푸시 미동의 사용자
            }
          });
        }
      }

      if (approvedUserIds.length === 0) {
        return {sentCount: 0, failedCount: 0, successfulUserIds: [], filteredOutUserIds};
      }

      const tokenPromises = approvedUserIds.map((userId) => this.getUserTokens(userId));
      const tokenResults = await Promise.all(tokenPromises);
      
      // 유저별 토큰 매핑 생성 (유저 ID -> 토큰 배열)
      const userTokenMap = new Map();
      const allTokens = [];
      const tokenToUserMap = new Map(); // 토큰 -> 유저 ID 매핑
      
      approvedUserIds.forEach((userId, index) => {
        const tokens = tokenResults[index] || [];
        const tokenList = tokens.map((t) => t.token);
        userTokenMap.set(userId, tokenList);
        tokenList.forEach(token => {
          allTokens.push(token);
          tokenToUserMap.set(token, userId);
        });
      });

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
