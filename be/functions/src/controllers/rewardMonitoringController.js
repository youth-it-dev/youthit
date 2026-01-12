const rewardMonitoringService = require('../services/rewardMonitoringService');
const excelGenerator = require('../utils/excelGenerator');

/**
 * 파일명에서 안전하지 않은 문자 제거
 * @param {string} fileName - 파일명
 * @returns {string} 안전한 파일명
 */
function sanitizeFileName(fileName) {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200);
}

/**
 * Reward Monitoring Controller
 * 나다움 포인트 관련 모니터링 엑셀 다운로드 API 컨트롤러
 */
class RewardMonitoringController {
  /**
   * API 1: 월별 나다움 스토어 구매 명단 다운로드
   * POST /rewardMonitoring/export/store-purchases
   * Request Body: { "month": "2024-10" }
   */
  async exportStorePurchases(req, res, next) {
    try {
      const { month } = req.body;

      // 파라미터 검증
      if (!month) {
        const error = new Error('month 파라미터가 필요합니다. (예: 2024-10)');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      if (!/^\d{4}-\d{2}$/.test(month)) {
        const error = new Error('month 파라미터는 YYYY-MM 형식이어야 합니다. (예: 2024-10)');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      console.log(`[RewardMonitoringController] 스토어 구매 명단 조회 시작: month=${month}`);

      // 데이터 조회
      const purchaseList = await rewardMonitoringService.getStorePurchaseList(month);

      console.log(`[RewardMonitoringController] 스토어 구매 명단 조회 완료: ${purchaseList.length}건`);

      // 엑셀 생성
      const workbook = excelGenerator.createWorkbook();
      excelGenerator.addStorePurchaseSheet(workbook, purchaseList, { month });
      const buffer = await excelGenerator.exportToBuffer(workbook);

      // 파일명 생성
      const monthNum = month.split('-')[1];
      const fileName = sanitizeFileName(`(${monthNum}월)_스토어_구매명단.xlsx`);

      // 응답 헤더 설정
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', buffer.length);

      console.log(`[RewardMonitoringController] 엑셀 파일 생성 완료: ${fileName} (${buffer.length} bytes)`);

      res.send(buffer);

    } catch (error) {
      console.error('[RewardMonitoringController] 스토어 구매 명단 다운로드 오류:', error.message);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      return next(error);
    }
  }

  /**
   * API 2: 월별 참여자 나다움 적립/차감 명단 다운로드
   * POST /rewardMonitoring/export/monthly-summary
   * Request Body: { "months": "2024-09,2024-10" }
   */
  async exportMonthlySummary(req, res, next) {
    try {
      const { months } = req.body;

      // 파라미터 검증
      if (!months) {
        const error = new Error('months 파라미터가 필요합니다. (예: 2024-09,2024-10)');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const monthList = months.split(',').map(m => m.trim());

      // 각 월 형식 검증
      for (const month of monthList) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          const error = new Error(`month "${month}"는 YYYY-MM 형식이어야 합니다.`);
          error.code = 'BAD_REQUEST';
          error.statusCode = 400;
          return next(error);
        }
      }

      console.log(`[RewardMonitoringController] 월별 적립/차감 명단 조회 시작: months=${months}`);

      // 데이터 조회
      const summaryData = await rewardMonitoringService.getMonthlySummary(monthList);

      console.log(`[RewardMonitoringController] 월별 적립/차감 명단 조회 완료: ${summaryData.users.length}명`);

      // 엑셀 생성
      const workbook = excelGenerator.createWorkbook();
      excelGenerator.addMonthlySummarySheet(workbook, summaryData, {});
      const buffer = await excelGenerator.exportToBuffer(workbook);

      // 파일명 생성
      const fileName = sanitizeFileName(`월별_나다움_적립차감_명단.xlsx`);

      // 응답 헤더 설정
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', buffer.length);

      console.log(`[RewardMonitoringController] 엑셀 파일 생성 완료: ${fileName} (${buffer.length} bytes)`);

      res.send(buffer);

    } catch (error) {
      console.error('[RewardMonitoringController] 월별 적립/차감 명단 다운로드 오류:', error.message);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      return next(error);
    }
  }

  /**
   * API 3: 나다움 적립/차감 내역 다운로드
   * POST /rewardMonitoring/export/history
   * Request Body: { "month": "2024-10" }
   */
  async exportRewardHistory(req, res, next) {
    try {
      const { month } = req.body;

      // 파라미터 검증
      if (!month) {
        const error = new Error('month 파라미터가 필요합니다. (예: 2024-10)');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      if (!/^\d{4}-\d{2}$/.test(month)) {
        const error = new Error('month 파라미터는 YYYY-MM 형식이어야 합니다. (예: 2024-10)');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      console.log(`[RewardMonitoringController] 적립/차감 내역 조회 시작: month=${month}`);

      // 데이터 조회
      const historyList = await rewardMonitoringService.getRewardHistory(month);

      console.log(`[RewardMonitoringController] 적립/차감 내역 조회 완료: ${historyList.length}건`);

      // 엑셀 생성
      const workbook = excelGenerator.createWorkbook();
      excelGenerator.addRewardHistorySheet(workbook, historyList, { month });
      const buffer = await excelGenerator.exportToBuffer(workbook);

      // 파일명 생성
      const monthNum = month.split('-')[1];
      const fileName = sanitizeFileName(`(${monthNum}월)_나다움_적립차감_내역.xlsx`);

      // 응답 헤더 설정
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', buffer.length);

      console.log(`[RewardMonitoringController] 엑셀 파일 생성 완료: ${fileName} (${buffer.length} bytes)`);

      res.send(buffer);

    } catch (error) {
      console.error('[RewardMonitoringController] 적립/차감 내역 다운로드 오류:', error.message);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      return next(error);
    }
  }
}

module.exports = new RewardMonitoringController();

