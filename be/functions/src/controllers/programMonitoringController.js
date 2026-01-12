const programMonitoringService = require('../services/programMonitoringService');
const excelGenerator = require('../utils/excelGenerator');

/**
 * 파일명에서 안전하지 않은 문자 제거
 * @param {string} fileName - 파일명
 * @returns {string} 안전한 파일명
 */
function sanitizeFileName(fileName) {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')  // 파일명에 사용할 수 없는 문자 제거
    .replace(/\s+/g, '_')            // 공백을 언더스코어로
    .replace(/_+/g, '_')             // 연속된 언더스코어 정리
    .substring(0, 200);              // 최대 길이 제한
}

/**
 * Program Monitoring Controller
 * 프로그램 모니터링 엑셀 다운로드 API 컨트롤러
 */
class ProgramMonitoringController {
  /**
   * 프로그램 모니터링 데이터 엑셀 다운로드
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   * 
   * Request Body:
   * - programId: 프로그램 ID (필수)
   * - month: 조회 월 YYYY-MM 형식 (선택)
   */
  async exportProgramMonitoring(req, res, next) {
    try {
      const { programId, month } = req.body;

      // 파라미터 검증: programId 또는 month 중 하나는 필수
      if (!programId && !month) {
        const error = new Error('programId 또는 month 파라미터 중 하나 이상이 필요합니다.');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      // month 형식 검증 (선택적)
      if (month && !/^\d{4}-\d{2}$/.test(month)) {
        const error = new Error('month 파라미터는 YYYY-MM 형식이어야 합니다. (예: 2024-10)');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      console.log(`[ProgramMonitoringController] 모니터링 데이터 조회 시작: programId=${programId || '전체'}, month=${month || '전체'}`);

      // 모니터링 데이터 생성
      const monitoringData = await programMonitoringService.generateMonitoringData({
        programId,
        month
      });

      const totalParticipants = monitoringData.programGroups.reduce((sum, group) => sum + group.participants.length, 0);
      console.log(`[ProgramMonitoringController] 데이터 조회 완료: ${monitoringData.programGroups.length}개 프로그램, 총 참가자 ${totalParticipants}명`);

      // 엑셀 생성
      const workbook = excelGenerator.createWorkbook();
      excelGenerator.addMonitoringSheet(workbook, monitoringData, {
        month
      });
      const buffer = await excelGenerator.exportToBuffer(workbook);

      // 파일명 생성: ({month}월) {프로그램명} 모니터링 시트.xlsx
      let fileName = '';
      
      // month 부분
      if (month) {
        const monthNum = month.split('-')[1]; // '2024-10' -> '10'
        fileName += `(${monthNum}월) `;
      }
      
      // 프로그램명 부분 (단일 프로그램일 때만)
      if (programId && monitoringData.programGroups.length === 1) {
        const programName = monitoringData.programGroups[0].programName;
        fileName += `${programName} `;
      }
      
      fileName += '모니터링 시트.xlsx';
      
      const safeFileName = sanitizeFileName(fileName);

      // 응답 헤더 설정
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
      res.setHeader('Content-Length', buffer.length);

      console.log(`[ProgramMonitoringController] 엑셀 파일 생성 완료: ${safeFileName} (${buffer.length} bytes)`);

      res.send(buffer);

    } catch (error) {
      console.error('[ProgramMonitoringController] 모니터링 엑셀 생성 오류:', error.message);
      
      // 에러 코드에 따른 상태 코드 설정
      if (!error.statusCode) {
        if (error.code === 'MISSING_REQUIRED_PARAMS') {
          error.statusCode = 400;
        } else if (error.code === 'MISSING_FIRESTORE_INDEX') {
          error.statusCode = 500;
        }
      }
      
      return next(error);
    }
  }
}

module.exports = new ProgramMonitoringController();
