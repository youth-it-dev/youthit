const FCMService = require("../services/fcmService");

class FCMController {
  constructor() {
    this.fcmService = new FCMService();
  }

  async saveToken(req, res) {
    try {
      const {token, deviceType = "pwa"} = req.body;
      const userId = req.user.uid;

      if (!token) {
        return res.error(400, "FCM 토큰이 필요합니다.");
      }

      const result = await this.fcmService.saveToken(userId, token, deviceType);
      if (!result) {
        return res.error(500, "토큰 저장에 실패했습니다.");
      }
      return res.success(result);
    } catch (error) {
      console.error("FCM 토큰 저장 실패:", error);
      return res.error(500, error.message);
    }
  }

  async getUserTokens(req, res) {
    try {
      const userId = req.user.uid;

      const tokens = await this.fcmService.getUserTokens(userId);
      if (!tokens) {
        return res.error(500, "토큰 조회에 실패했습니다.");
      }
      return res.success({tokens});
    } catch (error) {
      console.error("FCM 토큰 조회 실패:", error);
      return res.error(500, error.message);
    }
  }

  async deleteToken(req, res) {
    try {
      const {deviceId} = req.params;
      const userId = req.user.uid;

      if (!deviceId) {
        return res.error(400, "디바이스 ID가 필요합니다.");
      }

      await this.fcmService.deleteToken(userId, deviceId);
      return res.success({message: "토큰이 삭제되었습니다."});
    } catch (error) {
      console.error("FCM 토큰 삭제 실패:", error);
      return res.error(500, error.message);
    }
  }
}

module.exports = new FCMController();
