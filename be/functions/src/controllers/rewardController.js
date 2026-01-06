const RewardService = require("../services/rewardService");

const rewardService = new RewardService();

class RewardController {
  /**
   * 나다움 리워드 정책 조회
   * - Notion 리워드 정책 DB에서 "정책 적용 상태"가 "적용 완료"인 항목 중
   *   댓글/루틴/소모임/TMI 관련 정책만 조회
   * - 사용자 행동 이름과 포인트만 반환
   */
  async getRewardPolicies(req, res, next) {
    try {
      const result = await rewardService.getRewardPoliciesForDisplay();
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new RewardController();

