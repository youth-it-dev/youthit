const FCMService = require("../services/fcmService");


class FCMHelper {
  constructor() {
    this.fcmService = new FCMService();
  }

  /**
   * 단일 사용자 알림 전송
   * @param {string} userId - 사용자 ID
   * @param {string} title - 알림 제목
   * @param {string} message - 알림 내용
   * @param {string} type - 알림 타입 (POST_LIKE, COMMENT_LIKE, COMMENT 등)
   * @param {string} postId - 게시글 ID
   * @param {string} communityId - 커뮤니티 ID (선택)
   * @param {string} link - 링크 (선택)
   * @param {string} commentId - 댓글 ID (COMMENT_LIKE 타입일 때 사용)
   * @return {Promise<Object>} 전송 결과
   */
  async sendNotification(userId, title, message, type = "general", postId = "", communityId = "", link = "", commentId = "") {
    try {
      const notification = {
        title,
        message,
        type,
        postId,
        communityId,
        link,
        commentId,
      };

      return await this.fcmService.sendToUser(userId, notification);
    } catch (error) {
      console.error("알림 전송 실패:", error);
      return null; // 에러 시 null 반환
    }
  }

  /**
   * 다중 사용자 알림 전송
   * @param {Array<string>} userIds - 사용자 ID 배열
   * @param {string} title - 알림 제목
   * @param {string} message - 알림 내용
   * @param {string} type - 알림 타입 (POST_LIKE, COMMENT_LIKE, COMMENT 등)
   * @param {string} postId - 게시글 ID
   * @param {string} communityId - 커뮤니티 ID (선택)
   * @param {string} link - 링크 (선택)
   * @param {string} commentId - 댓글 ID (COMMENT_LIKE 타입일 때 사용)
   * @return {Promise<Object>} 전송 결과
   */
  async sendNotificationToUsers(userIds, title, message, type = "general", postId = "", communityId = "", link = "", commentId = "", options = {}) {
    try {
      const notification = {
        title,
        message,
        type,
        postId,
        communityId,
        link,
        commentId,
      };

      return await this.fcmService.sendToUsers(userIds, notification, options);
    } catch (error) {
      console.error("다중 사용자 알림 전송 실패:", error);
      return null; // 에러 시 null 반환
    }
  }
}

module.exports = new FCMHelper();
