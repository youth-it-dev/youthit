const programService = require("../services/programService");
const programApplicationService = require("../services/programApplicationService");
const { successResponse } = require("../utils/helpers");

// 상수 정의
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

// 상태 매핑 상수
const STATUS_MAPPINGS = {
  recruitment: {
    'before': '모집 전',
    'ongoing': '모집 중',
    'completed': '모집 완료'
  },
  program: {
    'before': '진행 전',
    'ongoing': '진행 중',
    'completed': '종료됨'
  }
};


class ProgramController {
  /**
   * 프로그램 목록 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async getPrograms(req, res, next) {
    try {
      const {
        recruitmentStatus,
        programStatus,
        programType,
        pageSize = DEFAULT_PAGE_SIZE,
        cursor
      } = req.query;

      // 필터 조건 구성
      const filters = {};
      if (recruitmentStatus) {
        const koreanStatus = STATUS_MAPPINGS.recruitment[recruitmentStatus];
        if (!koreanStatus) {
          const error = new Error(`유효하지 않은 모집상태입니다: ${recruitmentStatus}`);
          error.code = 'BAD_REQUEST';
          error.statusCode = 400;
          return next(error);
        }
        filters.recruitmentStatus = koreanStatus;
      }
      if (programStatus) {
        const koreanStatus = STATUS_MAPPINGS.program[programStatus];
        if (!koreanStatus) {
          const error = new Error(`유효하지 않은 프로그램 상태입니다: ${programStatus}`);
          error.code = 'BAD_REQUEST';
          error.statusCode = 400;
          return next(error);
        }
        filters.programStatus = koreanStatus;
      }
      if (programType) {
        // 프로그램 종류는 직접 사용 (ROUTINE, TMI, GATHERING)
        filters.programType = programType;
      }

      // 페이지 크기 검증
      const pageSizeNum = parseInt(pageSize);
      if (isNaN(pageSizeNum) || pageSizeNum < MIN_PAGE_SIZE || pageSizeNum > MAX_PAGE_SIZE) {
        const error = new Error("페이지 크기는 1-100 사이의 숫자여야 합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const result = await programService.getPrograms(filters, pageSizeNum, cursor);

      res.success({
        message: "프로그램 목록을 성공적으로 조회했습니다.",
        programs: result.programs,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          totalCount: result.totalCount
        }
      });

    } catch (error) {
      console.error("[ProgramController] 프로그램 목록 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 프로그램 상세 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async getProgramById(req, res, next) {
    try {
      const { programId } = req.params;

      if (!programId) {
        const error = new Error("프로그램 ID가 필요합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const program = await programService.getProgramById(programId);

      res.success({
        message: "프로그램 상세 정보를 성공적으로 조회했습니다.",
        program
      });

    } catch (error) {
      console.error("[ProgramController] 프로그램 상세 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 프로그램 검색
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async searchPrograms(req, res, next) {
    try {
      const {
        q,
        recruitmentStatus,
        programStatus,
        programType,
        pageSize = DEFAULT_PAGE_SIZE,
        cursor
      } = req.query;

      if (!q || q.trim() === '') {
        const error = new Error("검색어가 필요합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      // 필터 조건 구성
      const filters = {};
      if (recruitmentStatus) {
        const koreanStatus = STATUS_MAPPINGS.recruitment[recruitmentStatus];
        if (!koreanStatus) {
          const error = new Error(`유효하지 않은 모집상태입니다: ${recruitmentStatus}`);
          error.code = 'BAD_REQUEST';
          error.statusCode = 400;
          return next(error);
        }
        filters.recruitmentStatus = koreanStatus;
      }
      if (programStatus) {
        const koreanStatus = STATUS_MAPPINGS.program[programStatus];
        if (!koreanStatus) {
          const error = new Error(`유효하지 않은 프로그램 상태입니다: ${programStatus}`);
          error.code = 'BAD_REQUEST';
          error.statusCode = 400;
          return next(error);
        }
        filters.programStatus = koreanStatus;
      }
      if (programType) {
        // 프로그램 종류는 직접 사용 (ROUTINE, TMI, GATHERING)
        filters.programType = programType;
      }

      // 페이지 크기 검증
      const pageSizeNum = parseInt(pageSize);
      if (isNaN(pageSizeNum) || pageSizeNum < MIN_PAGE_SIZE || pageSizeNum > MAX_PAGE_SIZE) {
        const error = new Error("페이지 크기는 1-100 사이의 숫자여야 합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const result = await programService.searchPrograms(q.trim(), filters, pageSizeNum, cursor);

      res.success({
        message: `'${q}'에 대한 검색 결과를 성공적으로 조회했습니다.`,
        programs: result.programs,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          totalCount: result.totalCount
        },
        searchTerm: q
      });

    } catch (error) {
      console.error("[ProgramController] 프로그램 검색 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 프로그램 신청
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async applyToProgram(req, res, next) {
    try {
      const { programId } = req.params;
      const { 
        applicantId, 
        activityNickname,
        activityPhoneNumber,
        email,
        region,
        currentSituation,
        applicationSource,
        applicationMotivation,
        canAttendEvents
      } = req.body;

      if (!programId) {
        const error = new Error("프로그램 ID가 필요합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      // 필수 필드 검증
      if (!applicantId || !activityNickname) {
        const error = new Error("신청자 ID와 참여용 닉네임은 필수 입력 항목입니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      // 닉네임 길이 검증
      if (activityNickname.length < 1 || activityNickname.length > 50) {
        const error = new Error("닉네임은 1-50자 사이여야 합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const applicationData = {
        applicantId,
        nickname: activityNickname,
        phoneNumber: activityPhoneNumber,
        email,
        region,
        currentSituation,
        applicationSource,
        applicationMotivation,
        canAttendEvents
      };

      const result = await programApplicationService.applyToProgram(programId, applicationData);

      res.success({
        message: "프로그램 신청이 완료되었습니다.",
        data: result
      }, 201);

    } catch (error) {
      console.error("[ProgramController] 프로그램 신청 오류:", error.message);
      
      // 특정 에러 코드에 대한 상태 코드 설정 (이미 설정된 경우는 유지)
      if (!error.statusCode) {
      if (error.code === 'NICKNAME_DUPLICATE') {
        error.statusCode = 409;
      } else if (error.code === 'DUPLICATE_APPLICATION') {
        error.statusCode = 409;
      } else if (error.code === 'PROGRAM_NOT_FOUND') {
        error.statusCode = 404;
        } else if (error.code === 'BAD_REQUEST') {
          error.statusCode = 400;
        }
      }
      
      return next(error);
    }
  }

  /**
   * 프로그램 신청 승인
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async approveApplication(req, res, next) {
    try {
      const { programId, applicationId } = req.params;

      if (!programId || !applicationId) {
        const error = new Error("프로그램 ID와 신청 ID가 필요합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const result = await programApplicationService.approveApplication(programId, applicationId);

      res.success({
        message: "프로그램 신청이 승인되었습니다.",
        data: result
      });

    } catch (error) {
      console.error("[ProgramController] 신청 승인 오류:", error.message);
      
      if (error.code === 'NOT_FOUND') {
        error.statusCode = 404;
      }
      
      return next(error);
    }
  }

  /**
   * 프로그램 신청 거부
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async rejectApplication(req, res, next) {
    try {
      const { programId, applicationId } = req.params;

      if (!programId || !applicationId) {
        const error = new Error("프로그램 ID와 신청 ID가 필요합니다.");
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        return next(error);
      }

      const result = await programApplicationService.rejectApplication(programId, applicationId);

      res.success({
        message: "프로그램 신청이 거부되었습니다.",
        data: result
      });

    } catch (error) {
      console.error("[ProgramController] 신청 거부 오류:", error.message);
      
      if (error.code === 'NOT_FOUND') {
        error.statusCode = 404;
      }
      
      return next(error);
    }
  }

  /**
   * 선택된 신청자 일괄 승인
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async bulkApproveApplications(req, res, next) {
    try {
      console.log('[ProgramController] 일괄 승인 요청 시작');
      
      const result = await programApplicationService.bulkApproveApplications();

      // 프로그램별 통계 포맷팅
      const programStatsText = Object.entries(result.programStats)
        .map(([name, count]) => `${name} (${count}건)`)
        .join(', ');

      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>일괄 승인 완료</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: ${result.successCount > 0 ? '#22c55e' : '#ef4444'};
              margin-top: 0;
            }
            .stats {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .stats p {
              margin: 8px 0;
              color: #374151;
            }
            .success {
              color: #16a34a;
              font-weight: bold;
            }
            .failed {
              color: #dc2626;
              font-weight: bold;
            }
            .note {
              color: #6b7280;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ 일괄 승인 ${result.successCount > 0 ? '완료' : '실패'}</h1>
            <div class="stats">
              <p>총 <strong>${result.totalCount}건</strong> 처리</p>
              <p class="success">성공: ${result.successCount}건</p>
              ${result.failedCount > 0 ? `<p class="failed">실패: ${result.failedCount}건</p>` : ''}
              ${programStatsText ? `<p>처리된 프로그램: ${programStatsText}</p>` : ''}
            </div>
            <p class="note">이 창을 닫으셔도 됩니다.</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error) {
      console.error('[ProgramController] 일괄 승인 오류:', error.message);
      
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>오류 발생</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              background: #fee;
              border: 1px solid #fcc;
              padding: 20px;
              border-radius: 8px;
            }
            h1 {
              color: #c00;
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ 오류 발생</h1>
            <p>${error.message || '일괄 승인 처리 중 오류가 발생했습니다.'}</p>
          </div>
        </body>
        </html>
      `;
      
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
    }
  }

  /**
   * 선택된 신청자 일괄 거절
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async bulkRejectApplications(req, res, next) {
    try {
      console.log('[ProgramController] 일괄 거절 요청 시작');
      
      const result = await programApplicationService.bulkRejectApplications();

      // 프로그램별 통계 포맷팅
      const programStatsText = Object.entries(result.programStats)
        .map(([name, count]) => `${name} (${count}건)`)
        .join(', ');

      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>일괄 거절 완료</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: ${result.successCount > 0 ? '#f59e0b' : '#ef4444'};
              margin-top: 0;
            }
            .stats {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .stats p {
              margin: 8px 0;
              color: #374151;
            }
            .success {
              color: #16a34a;
              font-weight: bold;
            }
            .failed {
              color: #dc2626;
              font-weight: bold;
            }
            .note {
              color: #6b7280;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚫 일괄 거절 ${result.successCount > 0 ? '완료' : '실패'}</h1>
            <div class="stats">
              <p>총 <strong>${result.totalCount}건</strong> 처리</p>
              <p class="success">성공: ${result.successCount}건</p>
              ${result.failedCount > 0 ? `<p class="failed">실패: ${result.failedCount}건</p>` : ''}
              ${programStatsText ? `<p>처리된 프로그램: ${programStatsText}</p>` : ''}
            </div>
            <p class="note">이 창을 닫으셔도 됩니다.</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error) {
      console.error('[ProgramController] 일괄 거절 오류:', error.message);
      
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>오류 발생</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              background: #fee;
              border: 1px solid #fcc;
              padding: 20px;
              border-radius: 8px;
            }
            h1 {
              color: #c00;
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ 오류 발생</h1>
            <p>${error.message || '일괄 거절 처리 중 오류가 발생했습니다.'}</p>
          </div>
        </body>
        </html>
      `;
      
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
    }
  }

  /**
   * 선택된 신청자 일괄 대기 상태 변경
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async bulkPendingApplications(req, res, next) {
    try {
      console.log('[ProgramController] 일괄 대기 처리 요청 시작');
      
      const result = await programApplicationService.bulkPendingApplications();

      // 프로그램별 통계 포맷팅
      const programStatsText = Object.entries(result.programStats)
        .map(([name, count]) => `${name} (${count}건)`)
        .join(', ');

      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>일괄 대기 처리 완료</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: ${result.successCount > 0 ? '#3b82f6' : '#ef4444'};
              margin-top: 0;
            }
            .stats {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .stats p {
              margin: 8px 0;
              color: #374151;
            }
            .success {
              color: #16a34a;
              font-weight: bold;
            }
            .failed {
              color: #dc2626;
              font-weight: bold;
            }
            .note {
              color: #6b7280;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⏸️ 일괄 대기 처리 ${result.successCount > 0 ? '완료' : '실패'}</h1>
            <div class="stats">
              <p>총 <strong>${result.totalCount}건</strong> 처리</p>
              <p class="success">성공: ${result.successCount}건</p>
              ${result.failedCount > 0 ? `<p class="failed">실패: ${result.failedCount}건</p>` : ''}
              ${programStatsText ? `<p>처리된 프로그램: ${programStatsText}</p>` : ''}
            </div>
            <p class="note">이 창을 닫으셔도 됩니다.</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error) {
      console.error('[ProgramController] 일괄 대기 처리 오류:', error.message);
      
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>오류 발생</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              background: #fee;
              border: 1px solid #fcc;
              padding: 20px;
              border-radius: 8px;
            }
            h1 {
              color: #c00;
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ 오류 발생</h1>
            <p>${error.message || '일괄 대기 처리 중 오류가 발생했습니다.'}</p>
          </div>
        </body>
        </html>
      `;
      
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
    }
  }

}

module.exports = new ProgramController();
