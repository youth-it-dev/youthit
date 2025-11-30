const programService = require("../services/programService");
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

      const result = await programService.applyToProgram(programId, applicationData);

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

      const result = await programService.approveApplication(programId, applicationId);

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

      const result = await programService.rejectApplication(programId, applicationId);

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

}

module.exports = new ProgramController();
