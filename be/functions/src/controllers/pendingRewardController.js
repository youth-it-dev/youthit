const PendingRewardService = require('../services/pendingRewardService');
const notionPendingRewardService = require('../services/notionPendingRewardService');

/**
 * Pending Reward Controller
 * 나다움 부여 실패 건 관리 API
 */
class PendingRewardController {
  /**
   * 실패/대기 중인 나다움 목록 조회
   * GET /pendingRewards/list
   */
  async getList(req, res, next) {
    try {
      const { status = 'all', limit = 100 } = req.query;
      const pendingRewardService = new PendingRewardService();

      let result;
      if (status === 'failed') {
        result = await pendingRewardService.getFailedRewards(parseInt(limit));
      } else if (status === 'pending') {
        result = await pendingRewardService.getPendingRewards(parseInt(limit));
      } else {
        // 전체 조회 (failed + pending)
        const [failed, pending] = await Promise.all([
          pendingRewardService.getFailedRewards(parseInt(limit)),
          pendingRewardService.getPendingRewards(parseInt(limit)),
        ]);
        result = { failed, pending };
      }

      res.success(result, '나다움 재시도 목록 조회 성공');
    } catch (error) {
      console.error('[PendingRewardController] getList 오류:', error.message);
      next(error);
    }
  }

  /**
   * 통계 조회
   * GET /pendingRewards/stats
   */
  async getStats(req, res, next) {
    try {
      const pendingRewardService = new PendingRewardService();
      const stats = await pendingRewardService.getStats();

      res.success(stats, '나다움 재시도 통계 조회 성공');
    } catch (error) {
      console.error('[PendingRewardController] getStats 오류:', error.message);
      next(error);
    }
  }

  /**
   * 전체 실패 건 일괄 재시도 (노션 버튼용)
   * POST /pendingRewards/retry-all
   */
  async retryAll(req, res, next) {
    try {
      console.log('[PendingRewardController] 전체 재시도 요청');

      const pendingRewardService = new PendingRewardService();
      
      // 실패 + 대기 중인 건 모두 조회
      const [failedList, pendingList] = await Promise.all([
        pendingRewardService.getFailedRewards(100),
        pendingRewardService.getPendingRewards(100),
      ]);

      const allItems = [...failedList, ...pendingList];

      if (allItems.length === 0) {
        return res.success({
          totalProcessed: 0,
          successCount: 0,
          failCount: 0,
          message: '재시도할 항목이 없습니다',
        }, '재시도할 항목 없음');
      }

      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (const item of allItems) {
        const result = await pendingRewardService.executeManualRetry(item.id);
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        results.push({
          id: item.id,
          userId: item.userId,
          actionKey: item.actionKey,
          success: result.success,
          amount: result.amount,
          error: result.error,
        });

        // Rate limit 방지
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      res.success({
        totalProcessed: allItems.length,
        successCount,
        failCount,
        results,
      }, '나다움 일괄 재시도 완료');
    } catch (error) {
      console.error('[PendingRewardController] retryAll 오류:', error.message);
      next(error);
    }
  }

  /**
   * Notion에서 선택된 항목 일괄 재시도 (노션 체크박스 선택용)
   * POST /pendingRewards/retry-selected
   */
  async retrySelected(req, res, next) {
    try {
      console.log('[PendingRewardController] Notion 선택된 항목 재시도 요청');

      // 1. Notion에서 선택된 항목 조회
      const selectedItems = await notionPendingRewardService.getSelectedPendingRewards();

      if (selectedItems.length === 0) {
        return res.success({
          totalProcessed: 0,
          successCount: 0,
          failCount: 0,
          message: '선택된 항목이 없습니다',
        }, '선택된 항목 없음');
      }

      console.log(`[PendingRewardController] 선택된 항목 ${selectedItems.length}건 재시도 시작`);

      const pendingRewardService = new PendingRewardService();
      let successCount = 0;
      let failCount = 0;
      const results = [];
      const successNotionPageIds = [];

      // 2. 각 항목 재시도
      for (const item of selectedItems) {
        try {
          const result = await pendingRewardService.executeManualRetry(item.docId);
          
          if (result.success) {
            successCount++;
            successNotionPageIds.push(item.notionPageId);
          } else {
            failCount++;
          }

          results.push({
            docId: item.docId,
            notionPageId: item.notionPageId,
            success: result.success,
            amount: result.amount,
            error: result.error,
          });

          // Rate limit 방지
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (itemError) {
          failCount++;
          results.push({
            docId: item.docId,
            notionPageId: item.notionPageId,
            success: false,
            error: itemError.message,
          });
        }
      }

      // 3. 성공한 항목의 Notion 체크박스 해제
      // (markAsCompleted에서 이미 처리되지만, 혹시 누락된 경우를 위해)
      if (successNotionPageIds.length > 0) {
        await notionPendingRewardService.resetSelectionCheckboxes(successNotionPageIds);
      }

      console.log(`[PendingRewardController] Notion 선택 항목 재시도 완료 - 성공: ${successCount}, 실패: ${failCount}`);

      res.success({
        totalProcessed: selectedItems.length,
        successCount,
        failCount,
        results,
      }, 'Notion 선택 항목 일괄 재시도 완료');
    } catch (error) {
      console.error('[PendingRewardController] retrySelected 오류:', error.message);
      next(error);
    }
  }
}

module.exports = new PendingRewardController();
