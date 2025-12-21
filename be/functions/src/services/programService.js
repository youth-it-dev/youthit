const { Client } = require('@notionhq/client');
const { 
  getTextContent,
  getRichTextValue,
  getTitleValue,
  getSelectValue,
  getDateValue,
  getCheckboxValue,
  getUrlValue,
  getStatusValue,
  getFileUrls,
  getRelationValues,
  getRollupValues,
  formatNotionBlocks,
  nowKstIso,
  getCoverImageUrl,
  getNumberValue
} = require('../utils/notionHelper');
const faqService = require('./faqService');

// 상수 정의
const NOTION_VERSION = process.env.NOTION_VERSION || "2025-09-03";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

// page_size 검증 및 클램프 함수
function normalizePageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(num)));
}

// 에러 코드 정의
const ERROR_CODES = {
  MISSING_API_KEY: 'MISSING_NOTION_API_KEY',
  MISSING_DB_ID: 'MISSING_NOTION_DB_ID',
  NOTION_API_ERROR: 'NOTION_API_ERROR',
  PROGRAM_NOT_FOUND: 'PROGRAM_NOT_FOUND',
  INVALID_PAGE_SIZE: 'INVALID_PAGE_SIZE',
  SEARCH_ERROR: 'SEARCH_ERROR',
  NICKNAME_DUPLICATE: 'NICKNAME_DUPLICATE',
  DUPLICATE_APPLICATION: 'DUPLICATE_APPLICATION',
  NOT_FOUND: 'NOT_FOUND',
  RECRUITMENT_PERIOD_CLOSED: 'RECRUITMENT_PERIOD_CLOSED',
  FIRST_COME_DEADLINE_REACHED: 'FIRST_COME_DEADLINE_REACHED'
};

// Notion 필드명 상수
const NOTION_FIELDS = {
  PROGRAM_TITLE: "프로그램 제목",
  PROGRAM_NAME: "프로그램명",
  PROGRAM_DESCRIPTION: "프로그램 소개글",
  PROGRAM_TYPE: "프로그램 종류",
  RECRUITMENT_PERIOD: "모집 기간",
  ACTIVITY_PERIOD: "활동 기간",
  ORIENTATION_DATE: "오티 날짜",
  SHARE_MEETING_DATE: "공유회 날짜",
  TARGET_AUDIENCE: "참여 대상",
  THUMBNAIL: "썸네일",
  LINK_URL: "바로 보러 가기",
  IS_REVIEW_REGISTERED: "프로그램 후기 등록 여부",
  IS_BANNER_REGISTERED: "하단 배너 등록 여부",
  PARTICIPANTS_NAME: "참여자 별명",
  PARTICIPANTS_ID: "참여자 ID",
  NOTES: "참고 사항",
  FAQ: "FAQ",
  LAST_EDITED_TIME: "최근 수정 날짜",
  NOTION_PAGE_TITLE: "상세페이지(노션)",
  LEADER_USER_ID: "리더 사용자ID",
  LEADER_USER_NICKNAME: "리더 사용자 별명",
  LEADER_USER_REAL_NAME: "리더 사용자 실명",
  CERTIFICATION_METHOD: "인증 방법",
  FIRST_COME_DEADLINE_ENABLED: "선착순 마감 여부",
  FIRST_COME_CAPACITY: "선착순 인원 수"
};

const PROGRAM_TYPE_ALIASES = {
  ROUTINE: ["ROUTINE", "한끗루틴", "루틴"],
  GATHERING: ["GATHERING", "월간 소모임", "월간소모임", "소모임"],
  TMI: ["TMI", "티엠아이"],
};

const normalizeProgramTypeValue = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();

  for (const [programType, aliases] of Object.entries(PROGRAM_TYPE_ALIASES)) {
    if (aliases.some((alias) => {
      if (typeof alias !== "string") return false;
      const aliasTrimmed = alias.trim();
      return aliasTrimmed === trimmed || aliasTrimmed.toUpperCase() === upper;
    })) {
      return programType;
    }
  }

  return upper;
};

const toDateOrNull = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Notion 페이지 ID를 Firestore 문서 ID로 정규화
 * Notion 페이지 ID는 항상 하이픈이 포함된 UUID 형식이므로, 하이픈이 없으면 추가
 * 
 * @param {string} programId - 프로그램 ID (하이픈 포함/미포함 가능)
 * @returns {string|null} 정규화된 프로그램 ID (하이픈 포함), null이면 null 반환
 * 
 * @example
 * normalizeProgramIdForFirestore("2a445f52-4cd0-806e-b643-000b98ebe4ed")
 * // => "2a445f52-4cd0-806e-b643-000b98ebe4ed" (그대로 반환)
 * 
 * normalizeProgramIdForFirestore("2a445f524cd08089bab3e5268ab5a1bd")
 * // => "2a445f52-4cd0-8089-bab3-e5268ab5a1bd" (하이픈 추가)
 */
const normalizeProgramIdForFirestore = (programId) => {
  if (!programId) return null;
  
  // 이미 하이픈이 있으면 그대로 반환
  if (programId.includes('-')) {
    return programId;
  }
  
  // 하이픈이 없으면 UUID 형식으로 변환 (32자 → 8-4-4-4-12)
  // Notion 페이지 ID는 32자리 hex 문자열이므로 UUID 형식으로 변환
  // 예: 2a445f524cd08089bab3e5268ab5a1bd → 2a445f52-4cd0-8089-bab3-e5268ab5a1bd
  if (programId.length === 32) {
    return `${programId.slice(0, 8)}-${programId.slice(8, 12)}-${programId.slice(12, 16)}-${programId.slice(16, 20)}-${programId.slice(20)}`;
  }
  
  // 길이가 맞지 않으면 그대로 반환 (이미 정규화된 형태이거나 다른 형식일 수 있음)
  return programId;
};

/**
 * 모집 기간을 기반으로 모집 상태를 계산
 * @param {Object|null} period - { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * @returns {string} 모집 상태 ("모집 전", "모집 중", "모집 완료")
 */
const calculateRecruitmentStatus = (period) => {
  if (!period || !period.start) {
    return "모집 전";
  }
  
  // 현재 날짜 (KST 기준, YYYY-MM-DD 형식)
  const today = nowKstIso().split('T')[0];
  
  // 모집 시작 전
  if (today < period.start) {
    return "모집 전";
  }
  
  // 모집 종료 후
  if (period.end && today > period.end) {
    return "모집 완료";
  }
  
  // 모집 기간 중
  return "모집 중";
};

/**
 * 활동 기간을 기반으로 프로그램 상태를 계산
 * @param {Object|null} period - { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * @returns {string} 프로그램 상태 ("진행 전", "진행 중", "종료됨")
 */
const calculateProgramStatus = (period) => {
  if (!period || !period.start) {
    return "진행 전";
  }
  
  // 현재 날짜 (KST 기준, YYYY-MM-DD 형식)
  const today = nowKstIso().split('T')[0];
  
  // 활동 시작 전
  if (today < period.start) {
    return "진행 전";
  }
  
  // 활동 종료 후
  if (period.end && today > period.end) {
    return "종료됨";
  }
  
  // 활동 기간 중
  return "진행 중";
};


class ProgramService {
  constructor() {
    const {
      NOTION_API_KEY,
      NOTION_PROGRAM_DB_ID,
    } = process.env;

    // 환경 변수 검증
    if (!NOTION_API_KEY) {
      const error = new Error("NOTION_API_KEY가 필요합니다");
      error.code = ERROR_CODES.MISSING_API_KEY;
      throw error;
    }
    if (!NOTION_PROGRAM_DB_ID) {
      const error = new Error("NOTION_PROGRAM_DB_ID가 필요합니다");
      error.code = ERROR_CODES.MISSING_DB_ID;
      throw error;
    }

    // Notion 클라이언트 초기화
    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    this.programDataSource = NOTION_PROGRAM_DB_ID;
  }

  /**
   * 프로그램 목록 조회 (필터링 지원)
   * @param {Object} filters - 필터 조건
   * @param {string} [filters.recruitmentStatus] - 모집상태 (모집 전, 모집 중, 모집 완료)
   * @param {string} [filters.programStatus] - 프로그램 진행여부 (진행 전, 진행 중, 종료됨)
   * @param {string} [filters.programType] - 프로그램 종류 (ROUTINE, TMI, GATHERING)
   * @param {number} [pageSize=20] - 페이지 크기 (1-100)
   * @param {string} [startCursor] - 페이지네이션 커서
   * @returns {Promise<Object>} 프로그램 목록과 페이지네이션 정보
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   */
  async getPrograms(filters = {}, pageSize = DEFAULT_PAGE_SIZE, startCursor = null) {
    try {
      // 필터링으로 인한 데이터 부족을 방지하기 위해 더 많이 가져오기
      const fetchSize = Math.min(normalizePageSize(pageSize) * 3, MAX_PAGE_SIZE);

      const queryBody = {
        page_size: fetchSize,
        sorts: [
          {
            property: NOTION_FIELDS.LAST_EDITED_TIME,
            direction: "descending"
          }
        ]
      };

      // 프로그램 종류 필터 (Notion API에서 정확하게 처리 가능)
      if (filters.programType) {
        queryBody.filter = {
          property: NOTION_FIELDS.PROGRAM_TYPE,
          select: {
            equals: filters.programType
          }
        };
      }

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      // v5.3.0에서 databases.query가 제거되어 dataSources.query 사용
      const data = await this.notion.dataSources.query({
        data_source_id: this.programDataSource,
        ...queryBody
      });
      
      // 모든 프로그램 데이터 포맷팅 (상태 자동 계산 포함)
      let programs = data.results.map(page => this.formatProgramData(page));
      
      // 백엔드에서 상태 필터링 (정확한 날짜 기반 필터링)
      // recruitmentStatus 필터가 명시적으로 제공되지 않으면 기본적으로 '모집 중'만 표시
      if (filters.recruitmentStatus) {
        programs = programs.filter(p => p.recruitmentStatus === filters.recruitmentStatus);
      } else {
        // 기본값: 모집 중인 프로그램만 표시
        programs = programs.filter(p => p.recruitmentStatus === '모집 중');
      }
      
      if (filters.programStatus) {
        programs = programs.filter(p => p.programStatus === filters.programStatus);
      }
      
      // 요청한 페이지 크기만큼만 반환
      const paginatedPrograms = programs.slice(0, pageSize);
      
      return {
        programs: paginatedPrograms,
        // 필터링 후 결과가 요청보다 많으면 확실히 더 있고, 적으면 Notion 기준 판단
        hasMore: programs.length > pageSize ? true : data.has_more,
        nextCursor: data.next_cursor,
        totalCount: paginatedPrograms.length  // 실제 반환된 프로그램 개수
      };

    } catch (error) {
      console.error('[ProgramService] 프로그램 목록 조회 오류:', error.message);
      
      // Notion SDK 에러 처리
      if (error.code === 'object_not_found') {
        const notFoundError = new Error('프로그램 데이터 소스를 찾을 수 없습니다.');
        notFoundError.code = ERROR_CODES.MISSING_DB_ID;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      
      // Rate Limiting 처리
      if (error.code === 'rate_limited') {
        const rateLimitError = new Error('Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.');
        rateLimitError.code = 'RATE_LIMITED';
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }
      
      const serviceError = new Error(`프로그램 목록 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }


  /**
   * Notion 신청자 DB에서 승인된 멤버 수 조회
   * @param {string} programId - 프로그램 ID
   * @returns {Promise<number>} 승인된 멤버 수
   */
  async getApprovedMembersCount(programId) {
    try {
      // this.applicationDataSource는 constructor에서 이미 설정됨
      const response = await this.notion.dataSources.query({
        data_source_id: this.applicationDataSource,
        filter: {
          and: [
            {
              property: '프로그램명',
              relation: {
                contains: programId
              }
            },
            {
              property: '승인여부',
              select: {
                equals: '승인'
              }
            }
          ]
        }
      });
      
      return response.results.length;
    } catch (error) {
      console.warn('[ProgramService] Notion 신청자 수 조회 실패:', error.message);
      return 0;
    }
  }

  /**
   * 선착순을 고려한 모집 상태 계산
   * @param {string} currentStatus - 현재 모집 상태
   * @param {boolean} isFirstComeEnabled - 선착순 마감 여부
   * @param {number} firstComeCapacity - 선착순 인원 수
   * @param {number} approvedCount - 승인된 멤버 수
   * @returns {string} 계산된 모집 상태
   */
  calculateRecruitmentStatusWithFirstCome(
    currentStatus,
    isFirstComeEnabled,
    firstComeCapacity,
    approvedCount
  ) {
    // 우선순위: 모집 기간 먼저 체크
    // "모집 전" 또는 기간 종료로 인한 "모집 완료"는 그대로 유지
    if (currentStatus === "모집 전" || currentStatus === "모집 완료") {
      return currentStatus;
    }
    
    // "모집 중"일 때만 선착순 체크
    if (currentStatus === "모집 중") {
      if (isFirstComeEnabled && firstComeCapacity && approvedCount >= firstComeCapacity) {
        return "선착순 마감";  // 선착순으로 마감된 경우
      }
    }
    
    return currentStatus;
  }

  /**
   * 프로그램 상세 조회 (FAQ 포함)
   * @param {string} programId - 프로그램 ID
   * @returns {Promise<Object>} 프로그램 상세 정보 (FAQ 포함)
   * @throws {Error} PROGRAM_NOT_FOUND - 프로그램을 찾을 수 없음
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   */
  async getProgramById(programId) {
    try {
      // Notion SDK 사용으로 통일
      const page = await this.notion.pages.retrieve({
        page_id: programId
      });
      const programData = this.formatProgramData(page, true);

      // 승인된 멤버 수 조회
      const approvedCount = await this.getApprovedMembersCount(programId);
      programData.approvedMembersCount = approvedCount;

      // recruitmentStatus 재계산 (선착순 고려)
      programData.recruitmentStatus = this.calculateRecruitmentStatusWithFirstCome(
        programData.recruitmentStatus,
        programData.isFirstComeDeadlineEnabled,
        programData.firstComeCapacity,
        approvedCount
      );

      // 프로그램 페이지 블록 내용 조회
      const pageBlocks = await this.getProgramPageBlocks(programId);
      programData.pageContent = pageBlocks;

      // FAQ ID 목록만 추가 (상세 내용은 별도 API로 조회)
      programData.faqList = this.getFaqListForProgram(programData.faqRelation);

      return programData;

    } catch (error) {
      console.error('[ProgramService] 프로그램 상세 조회 오류:', error.message);
      
      // Notion SDK 에러 처리
      if (error.code === 'object_not_found') {
        const notFoundError = new Error('해당 프로그램을 찾을 수 없습니다.');
        notFoundError.code = ERROR_CODES.PROGRAM_NOT_FOUND;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      
      // Rate Limiting 처리
      if (error.code === 'rate_limited') {
        const rateLimitError = new Error('Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.');
        rateLimitError.code = 'RATE_LIMITED';
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }
      
      const serviceError = new Error(`프로그램 상세 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 프로그램 페이지 블록 내용 조회
   * @param {string} programId - 프로그램 ID
   * @returns {Promise<Array>} 페이지 블록 내용
   */
  async getProgramPageBlocks(programId) {
    try {
      // Notion SDK 사용으로 통일
      const data = await this.notion.blocks.children.list({
        block_id: programId
      });
      
      return this.formatProgramBlocks(data.results);
    } catch (error) {
      console.warn('[ProgramService] 프로그램 페이지 블록 조회 오류:', error.message);
      return [];
    }
  }

  /**
   * FAQ 관계를 통한 FAQ 목록 조회 (ID만)
   * @param {Object} faqRelation - FAQ 관계 객체
   * @returns {Promise<Array>} FAQ ID 목록
   */
  async getFaqListForProgram(faqRelation) {
    if (!faqRelation || !faqRelation.relations || faqRelation.relations.length === 0) {
      return [];
    }

    try {
      // FAQ ID 목록만 반환 (상세 내용은 별도 API로 조회)
      return faqRelation.relations.map(relation => ({
        id: relation.id
      }));
    } catch (error) {
      console.warn('[ProgramService] FAQ 목록 조회 오류:', error.message);
      return [];
    }
  }

  /**
   * 프로그램 페이지 블록 포맷팅
   * @param {Array} blocks - Notion 블록 배열
   * @returns {Array} 포맷팅된 페이지 내용
   */
  formatProgramBlocks(blocks) {
    return formatNotionBlocks(blocks, { 
      includeRichText: true, 
      includeMetadata: true 
    });
  }

  /**
   * FAQ ID 목록으로 FAQ 상세 정보 조회 (병렬 처리)
   * @param {Array<string>} faqIds - FAQ ID 배열
   * @returns {Promise<Array>} FAQ 목록
   */
  async getFaqListByIds(faqIds) {
    try {
      // 병렬로 FAQ 정보 조회
      const faqPromises = faqIds.map(faqId => this.getFaqById(faqId));
      const faqResults = await Promise.allSettled(faqPromises);
      
      // 성공한 결과만 필터링
      const faqList = faqResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
      
      return faqList;
    } catch (error) {
      console.error('[ProgramService] FAQ ID 목록 조회 오류:', error.message);
      return [];
    }
  }

  /**
   * 개별 FAQ 상세 정보 조회
   * @param {string} faqId - FAQ ID
   * @returns {Promise<Object|null>} FAQ 상세 정보
   */
  async getFaqById(faqId) {
    try {
      // FAQ 페이지 정보와 블록 내용을 병렬로 조회
      const [pageResponse, blocksResponse] = await Promise.allSettled([
        this.notion.pages.retrieve({
          page_id: faqId
        }),
        faqService.getPageBlocks({ pageId: faqId })
      ]);

      // 페이지 정보 조회 실패 시 null 반환
      if (pageResponse.status !== 'fulfilled') {
        return null;
      }

      const pageData = pageResponse.value;
      
      // 블록 내용 조회 실패 시 빈 배열로 처리
      let blocks = [];
      if (blocksResponse.status === 'fulfilled') {
        blocks = blocksResponse.value.results || [];
      }
      
      // faqService의 formatFaqData 재사용
      return faqService.formatFaqData(pageData, blocks);
    } catch (error) {
      console.warn(`[ProgramService] FAQ ${faqId} 조회 실패:`, error.message);
      return null;
    }
  }


  /**
   * 프로그램 데이터 포맷팅 (실제 Notion DB 구조에 맞춤)
   * @param {Object} page - Notion 페이지 객체
   * @param {boolean} includeDetails - 상세 정보 포함 여부
   */
  formatProgramData(page, includeDetails = false) {
    const props = page.properties;
    
    // 리더 사용자 정보 추출 (rollup 타입)
    // 리더 사용자 별명: rollup에서 첫 번째 항목의 name 추출
    const leaderNicknameRollup = getRollupValues(props[NOTION_FIELDS.LEADER_USER_NICKNAME]);
    const leaderNickname = leaderNicknameRollup?.value?.[0]?.name || null;
    
    // 리더 사용자 실명: rollup에서 첫 번째 항목의 name 추출
    const leaderRealNameRollup = getRollupValues(props[NOTION_FIELDS.LEADER_USER_REAL_NAME]);
    const leaderRealName = leaderRealNameRollup?.value?.[0]?.name || null;
    
    // 날짜 기간 추출 (Date Range)
    const recruitmentPeriod = getDateValue(props[NOTION_FIELDS.RECRUITMENT_PERIOD], true);
    const activityPeriod = getDateValue(props[NOTION_FIELDS.ACTIVITY_PERIOD], true);
    
    // 상태 자동 계산
    const recruitmentStatus = calculateRecruitmentStatus(recruitmentPeriod);
    const programStatus = calculateProgramStatus(activityPeriod);
    
    const baseData = {
      id: page.id,
      title: getTextContent(props[NOTION_FIELDS.PROGRAM_TITLE]),
      programName: getTextContent(props[NOTION_FIELDS.PROGRAM_NAME]),
      description: getTextContent(props[NOTION_FIELDS.PROGRAM_DESCRIPTION]),
      programType: getSelectValue(props[NOTION_FIELDS.PROGRAM_TYPE]),
      recruitmentStatus: recruitmentStatus,
      programStatus: programStatus,
      recruitmentStartDate: recruitmentPeriod?.start || null,
      recruitmentEndDate: recruitmentPeriod?.end || null,
      startDate: activityPeriod?.start || null,
      endDate: activityPeriod?.end || null,
      targetAudience: getTextContent(props[NOTION_FIELDS.TARGET_AUDIENCE]),
      thumbnail: getFileUrls(props[NOTION_FIELDS.THUMBNAIL]),
      coverImage: getCoverImageUrl(page),
      linkUrl: getUrlValue(props[NOTION_FIELDS.LINK_URL]),
      isReviewRegistered: getCheckboxValue(props[NOTION_FIELDS.IS_REVIEW_REGISTERED]),
      isBannerRegistered: getCheckboxValue(props[NOTION_FIELDS.IS_BANNER_REGISTERED]),
      participants: this.getParticipantsData(props[NOTION_FIELDS.PARTICIPANTS_NAME], props[NOTION_FIELDS.PARTICIPANTS_ID]),
      notes: getTextContent(props[NOTION_FIELDS.NOTES]),
      faqRelation: getRelationValues(props[NOTION_FIELDS.FAQ]),
      orientationDate: getDateValue(props[NOTION_FIELDS.ORIENTATION_DATE]),
      shareMeetingDate: getDateValue(props[NOTION_FIELDS.SHARE_MEETING_DATE]),
      leaderNickname: leaderNickname,
      leaderRealName: leaderRealName,
      certificationMethod: getRichTextValue(props[NOTION_FIELDS.CERTIFICATION_METHOD]),
      isFirstComeDeadlineEnabled: getCheckboxValue(props[NOTION_FIELDS.FIRST_COME_DEADLINE_ENABLED]),
      firstComeCapacity: getNumberValue(props[NOTION_FIELDS.FIRST_COME_CAPACITY]),
      createdAt: page.last_edited_time || getDateValue(props[NOTION_FIELDS.LAST_EDITED_TIME]) || null,
      updatedAt: page.last_edited_time || getDateValue(props[NOTION_FIELDS.LAST_EDITED_TIME]) || null,
      notionPageTitle: getTitleValue(props[NOTION_FIELDS.NOTION_PAGE_TITLE])
    };


    return baseData;
  }

  /**
   * 프로그램 검색 (제목, 설명 기반)
   * @param {string} searchTerm - 검색어
   * @param {Object} filters - 필터 조건
   * @param {string} [filters.recruitmentStatus] - 모집상태
   * @param {string} [filters.programStatus] - 프로그램 진행여부
   * @param {string} [filters.programType] - 프로그램 종류 (ROUTINE, TMI, GATHERING)
   * @param {number} pageSize - 페이지 크기
   * @param {string} startCursor - 페이지네이션 커서
   */
  async searchPrograms(searchTerm, filters = {}, pageSize = DEFAULT_PAGE_SIZE, startCursor = null) {
    try {
      // 필터링으로 인한 데이터 부족을 방지하기 위해 더 많이 가져오기
      const fetchSize = Math.min(normalizePageSize(pageSize) * 3, MAX_PAGE_SIZE);

      // 검색 조건 (OR)
      const searchFilter = {
        or: [
          {
            property: NOTION_FIELDS.PROGRAM_TITLE,
            rich_text: {
              contains: searchTerm
            }
          },
          {
            property: NOTION_FIELDS.PROGRAM_DESCRIPTION,
            rich_text: {
              contains: searchTerm
            }
          },
          {
            property: NOTION_FIELDS.PROGRAM_NAME,
            rich_text: {
              contains: searchTerm
            }
          }
        ]
      };

      // 검색 필터 적용
      const queryBody = {
        page_size: fetchSize,
        sorts: [
          {
            property: NOTION_FIELDS.LAST_EDITED_TIME,
            direction: "descending"
          }
        ],
        filter: searchFilter
      };

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      // 프로그램 종류 필터 (Notion API에서 정확하게 처리 가능)
      if (filters.programType) {
        queryBody.filter = {
          and: [
            searchFilter,
            {
              property: NOTION_FIELDS.PROGRAM_TYPE,
              select: {
                equals: filters.programType
              }
            }
          ]
        };
      }

      // v5.3.0에서 databases.query가 제거되어 dataSources.query 사용
      const data = await this.notion.dataSources.query({
        data_source_id: this.programDataSource,
        ...queryBody
      });
      
      // 모든 프로그램 데이터 포맷팅 (상태 자동 계산 포함)
      let programs = data.results.map(page => this.formatProgramData(page));
      
      // 백엔드에서 상태 필터링 (정확한 날짜 기반 필터링)
      // recruitmentStatus 필터가 명시적으로 제공되지 않으면 기본적으로 '모집 중'만 표시
      if (filters.recruitmentStatus) {
        programs = programs.filter(p => p.recruitmentStatus === filters.recruitmentStatus);
      } else {
        // 기본값: 모집 중인 프로그램만 표시
        programs = programs.filter(p => p.recruitmentStatus === '모집 중');
      }
      
      if (filters.programStatus) {
        programs = programs.filter(p => p.programStatus === filters.programStatus);
      }
      
      // 요청한 페이지 크기만큼만 반환
      const paginatedPrograms = programs.slice(0, pageSize);
      
      return {
        programs: paginatedPrograms,
        // 필터링 후 결과가 요청보다 많으면 확실히 더 있고, 적으면 Notion 기준 판단
        hasMore: programs.length > pageSize ? true : data.has_more,
        nextCursor: data.next_cursor,
        totalCount: paginatedPrograms.length  // 실제 반환된 프로그램 개수
      };

    } catch (error) {
      console.error('[ProgramService] 프로그램 검색 오류:', error.message);
      
      // Notion SDK 에러 처리
      if (error.code === 'object_not_found') {
        const notFoundError = new Error('프로그램 데이터 소스를 찾을 수 없습니다.');
        notFoundError.code = ERROR_CODES.MISSING_DB_ID;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      
      // Rate Limiting 처리
      if (error.code === 'rate_limited') {
        const rateLimitError = new Error('Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.');
        rateLimitError.code = 'RATE_LIMITED';
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }
      
      const serviceError = new Error(`프로그램 검색 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.SEARCH_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }


  getParticipantsData(namesProperty, idsProperty) {
    // 참여자 이름 추출 (rollup 타입)
    const namesData = getRollupValues(namesProperty);
    // 참여자 ID 추출 (rollup 타입)
    const idsData = getRollupValues(idsProperty);
    
    // rollup 데이터에서 실제 배열 추출
    const names = namesData.value || [];
    const ids = idsData.value || [];
    
    // 이름과 ID를 매칭하여 결합
    const participants = [];
    const maxLength = Math.max(names.length, ids.length);
    
    for (let i = 0; i < maxLength; i++) {
      const name = names[i]?.name || '';
      const id = ids[i]?.name || null; // name 필드에서 ID 추출
      
      if (name || id) {
        participants.push({
          name,
          id
        });
      }
    }
    
    return participants;
  }




}

// 싱글톤 인스턴스 생성
const programServiceInstance = new ProgramService();

// 싱글톤 인스턴스 export (기본)
module.exports = programServiceInstance;

// 공통 유틸 함수 export (named exports)
module.exports.normalizeProgramIdForFirestore = normalizeProgramIdForFirestore;
module.exports.normalizeProgramTypeValue = normalizeProgramTypeValue;
module.exports.toDateOrNull = toDateOrNull;
module.exports.calculateRecruitmentStatus = calculateRecruitmentStatus;
module.exports.calculateProgramStatus = calculateProgramStatus;
module.exports.calculateRecruitmentStatusWithFirstCome = programServiceInstance.calculateRecruitmentStatusWithFirstCome.bind(programServiceInstance);
module.exports.ERROR_CODES = ERROR_CODES;
module.exports.NOTION_FIELDS = NOTION_FIELDS;
