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

      // text/plain 응답 (Notion 버튼 호출 시 결과 확인용)
      const syncedPolicies = result.results
        .filter(r => r.success)
        .map(r => r.actionKey)
        .join(', ');

      const message = `[리워드 정책 동기화 완료]\n총 ${result.totalCount}건 처리\n성공: ${result.successCount}건\n실패: ${result.failedCount}건${syncedPolicies ? `\n동기화된 정책: ${syncedPolicies}` : ''}`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(message);
    } catch (error) {
      console.error('[NotionRewardPolicyController] 동기화 오류:', error.message);
      res.status(500)
        .setHeader('Content-Type', 'text/plain; charset=utf-8')
        .send(`[오류 발생]\n${error.message || '리워드 정책 동기화 중 오류가 발생했습니다.'}`);
    }
  }
}

module.exports = new NotionRewardPolicyController();
