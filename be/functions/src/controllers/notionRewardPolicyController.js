const rewardPolicySyncService = require('../services/rewardPolicySyncService');

/**
 * Notion Reward Policy Controller
 * Notion에서 Firestore로 리워드 정책 동기화 처리
 */
class NotionRewardPolicyController {
  /**
   * 선택된 리워드 정책 동기화 (Notion → Firestore)
   * POST /notionRewardPolicy/sync
   * 
   * Notion 리워드 정책 DB에서 '선택' 체크박스가 체크된 정책만 Firestore에 동기화
   * 성공한 항목은 '선택' 체크박스 자동 해제
   * 
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async syncRewardPolicy(req, res, next) {
    try {
      console.log('[NotionRewardPolicyController] 리워드 정책 동기화 요청 시작');

      const result = await rewardPolicySyncService.syncSelectedPolicies();

      const syncedPolicies = result.results
        .filter(r => r.success)
        .map(r => r.actionKey);

      res.success({
        message: '리워드 정책 동기화 완료',
        totalCount: result.totalCount,
        successCount: result.successCount,
        failedCount: result.failedCount,
        syncedPolicies,
      });
    } catch (error) {
      console.error('[NotionRewardPolicyController] 동기화 오류:', error.message);
      error.code = error.code || 'NOTION_SYNC_FAILED';
      next(error);
    }
  }
}

module.exports = new NotionRewardPolicyController();
