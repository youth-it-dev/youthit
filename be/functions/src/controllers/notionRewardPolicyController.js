const rewardPolicySyncService = require('../services/rewardPolicySyncService');

/**
 * Notion Reward Policy Controller
 * Notion에서 Firestore로 리워드 정책 동기화 처리
 */
class NotionRewardPolicyController {
  /**
   * 리워드 정책 동기화 (Notion → Firestore)
   * POST /notionRewardPolicy/sync
   * 
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async syncRewardPolicy(req, res, next) {
    try {
      // 1. payload 정규화 및 검증
      const normalized = rewardPolicySyncService.normalizePayload(req.body);

      // 2. Firestore 업서트
      const result = await rewardPolicySyncService.upsertRewardPolicy(normalized);

      // 3. 성공 응답
      res.success({
        message: '리워드 정책 동기화 완료',
        actionKey: result.actionKey,
        points: result.points,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      console.error('[Controller Error] syncRewardPolicy:', error);
      next(error);
    }
  }

  /**
   * 특정 리워드 정책 조회
   * GET /notionRewardPolicy/:actionKey
   * 
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async getRewardPolicy(req, res, next) {
    try {
      const { actionKey } = req.params;

      if (!actionKey) {
        const error = new Error('actionKey가 필요합니다');
        error.code = 'BAD_REQUEST';
        throw error;
      }

      const policy = await rewardPolicySyncService.getRewardPolicy(actionKey);

      if (!policy) {
        const error = new Error(`리워드 정책을 찾을 수 없습니다: ${actionKey}`);
        error.code = 'NOT_FOUND';
        throw error;
      }

      res.success(policy);
    } catch (error) {
      console.error('[Controller Error] getRewardPolicy:', error);
      next(error);
    }
  }
}

module.exports = new NotionRewardPolicyController();
