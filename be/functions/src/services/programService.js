const { Client } = require('@notionhq/client');
const { 
  getTextContent,
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
  getCoverImageUrl
} = require('../utils/notionHelper');
const faqService = require('./faqService');
const FirestoreService = require('./firestoreService');
const CommunityService = require('./communityService');
const { db, FieldValue } = require('../config/database');
const { validateNicknameOrThrow } = require('../utils/nicknameValidator');
const fcmHelper = require('../utils/fcmHelper');

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
  RECRUITMENT_PERIOD_CLOSED: 'RECRUITMENT_PERIOD_CLOSED'
};

// Notion 필드명 상수
const NOTION_FIELDS = {
  PROGRAM_TITLE: "프로그램 제목",
  PROGRAM_NAME: "프로그램명",
  PROGRAM_DESCRIPTION: "프로그램 소개글",
  PROGRAM_TYPE: "프로그램 종류",
  RECRUITMENT_PERIOD: "모집 기간",
  ACTIVITY_PERIOD: "활동 기간",
  DISPLAY_START_DATE: "표시 시작일자",
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
  LEADER_USER_REAL_NAME: "리더 사용자 실명"
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
      NOTION_PROGRAM_APPLICATION_DB_ID,
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
    if (!NOTION_PROGRAM_APPLICATION_DB_ID) {
      const error = new Error("NOTION_PROGRAM_APPLICATION_DB_ID가 필요합니다");
      error.code = ERROR_CODES.MISSING_DB_ID;
      throw error;
    }

    // Notion 클라이언트 초기화
    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    this.programDataSource = NOTION_PROGRAM_DB_ID;
    this.applicationDataSource = NOTION_PROGRAM_APPLICATION_DB_ID;
    this.firestoreService = new FirestoreService('communities');
    this.communityService = new CommunityService();
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
      // 오늘 날짜를 KST 기준 ISO 형식으로 변환 (YYYY-MM-DD)
      const todayISO = nowKstIso().split('T')[0];

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

      // 기본 필터 조건 (표시 시작일자만)
      queryBody.filter = {
        and: [
          // 표시 시작일자가 설정되어 있어야 함
          {
            property: NOTION_FIELDS.DISPLAY_START_DATE,
            date: {
              is_not_empty: true
            }
          },
          // 표시 시작일자가 현재 날짜 이하여야 함
          {
            property: NOTION_FIELDS.DISPLAY_START_DATE,
            date: {
              on_or_before: todayISO
            }
          }
        ]
      };

      // 프로그램 종류 필터 (Notion API에서 정확하게 처리 가능)
      if (filters.programType) {
        queryBody.filter.and.push({
          property: NOTION_FIELDS.PROGRAM_TYPE,
          select: {
            equals: filters.programType
          }
        });
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
      if (filters.recruitmentStatus) {
        programs = programs.filter(p => p.recruitmentStatus === filters.recruitmentStatus);
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
      displayStartDate: getDateValue(props[NOTION_FIELDS.DISPLAY_START_DATE]),
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
      // 오늘 날짜를 KST 기준 ISO 형식으로 변환 (YYYY-MM-DD)
      const todayISO = nowKstIso().split('T')[0];

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

      // 항상 표시 시작일자 필터 적용 + 검색 필터
      const queryBody = {
        page_size: fetchSize,
        sorts: [
          {
            property: NOTION_FIELDS.LAST_EDITED_TIME,
            direction: "descending"
          }
        ],
        filter: {
          and: [
            searchFilter,
            // 표시 시작일자가 설정되어 있어야 함
            {
              property: NOTION_FIELDS.DISPLAY_START_DATE,
              date: {
                is_not_empty: true
              }
            },
            // 표시 시작일자가 현재 날짜 이하여야 함
            {
              property: NOTION_FIELDS.DISPLAY_START_DATE,
              date: {
                on_or_before: todayISO
              }
            }
          ]
        }
      };

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      // 프로그램 종류 필터 (Notion API에서 정확하게 처리 가능)
      if (filters.programType) {
        queryBody.filter.and.push({
          property: NOTION_FIELDS.PROGRAM_TYPE,
          select: {
            equals: filters.programType
          }
        });
      }

      // v5.3.0에서 databases.query가 제거되어 dataSources.query 사용
      const data = await this.notion.dataSources.query({
        data_source_id: this.programDataSource,
        ...queryBody
      });
      
      // 모든 프로그램 데이터 포맷팅 (상태 자동 계산 포함)
      let programs = data.results.map(page => this.formatProgramData(page));
      
      // 백엔드에서 상태 필터링 (정확한 날짜 기반 필터링)
      if (filters.recruitmentStatus) {
        programs = programs.filter(p => p.recruitmentStatus === filters.recruitmentStatus);
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

  /**
   * 프로그램 신청 처리
   * @param {string} programId - 프로그램 ID
   * @param {Object} applicationData - 신청 데이터 { applicantId, nickname }
   * @returns {Promise<Object>} 신청 결과
   * @throws {Error} NICKNAME_DUPLICATE - 닉네임 중복
   * @throws {Error} PROGRAM_NOT_FOUND - 프로그램을 찾을 수 없음
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   */
  async applyToProgram(programId, applicationData) {
    try {
      const { applicantId, nickname } = applicationData;
      
      // 1. 프로그램 존재 확인 (간단하게)
      let program;
      try {
        const page = await this.notion.pages.retrieve({
          page_id: programId
        });
        program = this.formatProgramData(page);
      } catch (error) {
        if (error.code === 'object_not_found') {
          const notFoundError = new Error('해당 프로그램을 찾을 수 없습니다.');
          notFoundError.code = ERROR_CODES.PROGRAM_NOT_FOUND;
          notFoundError.statusCode = 404;
          throw notFoundError;
        }
        throw error;
      }

      // 1-1. 모집 기간 체크
      if (program.recruitmentStatus !== '모집 중') {
        const periodError = new Error('현재 모집 기간이 아닙니다.');
        periodError.code = ERROR_CODES.RECRUITMENT_PERIOD_CLOSED;
        periodError.statusCode = 400;
        throw periodError;
      }

      // 2. Community 존재 확인 및 생성 (Firestore용 ID로 정규화)
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      let community = await this.communityService.getCommunityMapping(normalizedProgramId);
      if (!community) {
        // Community가 없으면 프로그램 정보로 생성
        community = await this.createCommunityFromProgram(normalizedProgramId, program);
      } else {
        // Community가 존재하는 경우 Notion 데이터와 동기화
        await this.syncCommunityWithNotion(normalizedProgramId, program);
      }

      validateNicknameOrThrow(nickname);
      
      // 3. 중복 신청 체크 (먼저 확인하여 Notion 중복 저장 방지)
      const membersService = new FirestoreService(`communities/${normalizedProgramId}/members`);
      const existingMember = await membersService.getById(applicantId);
      if (existingMember) {
        const duplicateError = new Error('같은 프로그램은 또 신청할 수 없습니다.');
        duplicateError.code = ERROR_CODES.DUPLICATE_APPLICATION;
        duplicateError.statusCode = 409;
        throw duplicateError;
      }
      
      // 4. 닉네임 중복 체크
      const isNicknameAvailable = await this.communityService.checkNicknameAvailability(normalizedProgramId, nickname);
      if (!isNicknameAvailable) {
        const error = new Error("이미 사용 중인 닉네임입니다");
        error.code = ERROR_CODES.NICKNAME_DUPLICATE;
        error.statusCode = 409;
        throw error;
      }

      // 5. 멤버 추가 (Firestore) - Notion 저장 전에 먼저 처리
      let memberResult;
      try {
        memberResult = await this.communityService.addMemberToCommunity(
          normalizedProgramId, 
          applicantId, 
          nickname
        );
      } catch (memberError) {
        if (memberError.code === 'CONFLICT') {
          const duplicateError = new Error('같은 프로그램은 또 신청할 수 없습니다.');
          duplicateError.code = ERROR_CODES.DUPLICATE_APPLICATION;
          duplicateError.statusCode = 409;
          throw duplicateError;
        }
        if (memberError.code === ERROR_CODES.NICKNAME_DUPLICATE) {
          const error = new Error("이미 사용 중인 닉네임입니다");
          error.code = ERROR_CODES.NICKNAME_DUPLICATE;
          error.statusCode = 409;
          throw error;
        }
        throw memberError;
      }

      // 6. Notion 프로그램신청자DB에 저장 (Firestore 성공 후)
      const applicantsPageId = await this.saveToNotionApplication(programId, applicationData, program);
      
      // 7. Notion 페이지 ID를 Firestore 멤버에 업데이트
      try {
        await membersService.update(applicantId, {
          applicantsPageId: applicantsPageId
        });
      } catch (updateError) {
        console.warn('[ProgramService] Notion 페이지 ID 업데이트 실패:', updateError.message);
        // 업데이트 실패해도 신청은 완료된 것으로 처리
      }

      return {
        applicationId: memberResult.id,
        programId,
        applicantId,
        nickname,
        appliedAt: new Date().toISOString(),
        applicantsPageId
      };

    } catch (error) {
      console.error('[ProgramService] 프로그램 신청 오류:', error.message);
      
      // 클라이언트 에러(4xx)는 그대로 전달
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      // 특정 에러 코드는 그대로 전달
      if (error.code === ERROR_CODES.NICKNAME_DUPLICATE || 
          error.code === ERROR_CODES.DUPLICATE_APPLICATION ||
          error.code === ERROR_CODES.PROGRAM_NOT_FOUND ||
          error.code === 'BAD_REQUEST') {
        throw error;
      }
      
      const serviceError = new Error(`프로그램 신청 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }



  /**
   * Firebase UID로 Notion "회원 관리" DB에서 사용자 페이지 찾기
   * @param {string} firebaseUid - Firebase UID
   * @returns {Promise<string|null>} Notion 페이지 ID 또는 null
   */
  async findUserNotionPageId(firebaseUid) {
    try {
      const userDbId = process.env.NOTION_USER_ACCOUNT_DB_ID2;
      if (!userDbId) {
        console.warn('[ProgramService] NOTION_USER_ACCOUNT_DB_ID2 환경변수가 설정되지 않음');
        return null;
      }

      // Notion "회원 관리" DB에서 사용자ID로 검색
      const response = await this.notion.dataSources.query({
        data_source_id: userDbId,
        filter: {
          property: '사용자ID',
          rich_text: {
            equals: firebaseUid
          }
        },
        page_size: 1
      });

      if (response.results && response.results.length > 0) {
        return response.results[0].id;
      }

      console.warn(`[ProgramService] Notion "회원 관리"에서 사용자를 찾을 수 없음: ${firebaseUid}`);
      return null;
    } catch (error) {
      console.error('[ProgramService] Notion 사용자 검색 오류:', error.message);
      return null;
    }
  }


  /**
   * Notion 프로그램신청자DB에 저장
   * @param {string} programId - 프로그램 ID (Notion 페이지 ID)
   * @param {Object} applicationData - 신청 데이터
   * @param {string} applicationData.applicantId - Firebase UID
   * @param {string} applicationData.nickname - 참여용 닉네임
   * @param {string} [applicationData.phoneNumber] - 참여용 전화번호
   * @param {string} [applicationData.email] - 신청자 이메일
   * @param {Object} [applicationData.region] - 거주 지역 { city, district }
   * @param {string} [applicationData.currentSituation] - 현재 상황
   * @param {string} [applicationData.applicationSource] - 신청 경로
   * @param {string} [applicationData.applicationMotivation] - 참여 동기
   * @param {boolean} [applicationData.canAttendEvents] - 필참 일정 확인 여부
   * @param {Object} program - 프로그램 정보
   * @returns {Promise<string>} Notion 페이지 ID
   */
  async saveToNotionApplication(programId, applicationData, program) {
    try {
      const { 
        applicantId, 
        nickname, 
        phoneNumber, 
        email,
        region,
        currentSituation,
        applicationSource,
        applicationMotivation,
        canAttendEvents
      } = applicationData;
      
      // 거주 지역 포맷팅
      let regionText = '';
      if (region) {
        if (region.city && region.district) {
          regionText = `${region.city} ${region.district}`;
        } else if (region.city) {
          regionText = region.city;
        } else if (region.district) {
          regionText = region.district;
        }
      }


      // "회원 관리" DB에서 사용자 찾기
      const userNotionPageId = await this.findUserNotionPageId(applicantId);

      const properties = {
        '이름': {
          title: [
            {
              text: {
                content: nickname || '익명'
              }
            }
          ]
        },
        '참여용 닉네임': {
          rich_text: [
            {
              text: {
                content: nickname || ''
              }
            }
          ]
        },
        '프로그램명': {
          relation: [
            {
              id: programId
            }
          ]
        },
        '서비스 이용약관 동의여부': {
          checkbox: true
        },
        '필참 일정 확인 여부': {
          checkbox: canAttendEvents || false
        },
        '승인여부': {
          select: {
            name: '승인대기'
          }
        }
      };

      // "신청자 페이지" relation 추가 (사용자를 찾은 경우에만)
      if (userNotionPageId) {
        properties['신청자 페이지'] = {
          relation: [
            {
              id: userNotionPageId
            }
          ]
        };
      } else {
        console.warn(`[ProgramService] "신청자 페이지" relation 연결 실패: 사용자를 찾을 수 없음 (UID: ${applicantId})`);
      }

      // 선택적 필드 추가
      if (phoneNumber) {
        properties['참여용 전화번호'] = {
          phone_number: phoneNumber
        };
      }

      if (email) {
        properties['신청자 이메일'] = {
          email: email
        };
      }

      if (regionText) {
        properties['거주 지역'] = {
          rich_text: [
            {
              text: {
                content: regionText
              }
            }
          ]
        };
      }

      if (currentSituation) {
        properties['현재 상황'] = {
          rich_text: [
            {
              text: {
                content: currentSituation
              }
            }
          ]
        };
      }

      if (applicationSource) {
        properties['신청 경로'] = {
          rich_text: [
            {
              text: {
                content: applicationSource
              }
            }
          ]
        };
      }

      if (applicationMotivation) {
        properties['참여 동기'] = {
          rich_text: [
            {
              text: {
                content: applicationMotivation
              }
            }
          ]
        };
      }

      const notionData = {
        parent: {
          data_source_id: this.applicationDataSource,
          type: "data_source_id"
        },
        properties
      };

      const response = await this.notion.pages.create(notionData);
      return response.id;

    } catch (error) {
      console.error('[ProgramService] Notion 저장 오류:', error.message);
      throw new Error(`Notion 신청 정보 저장에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 프로그램 신청 승인
   * @param {string} programId - 프로그램 ID
   * @param {string} applicationId - 신청 ID (Firestore member ID)
   * @returns {Promise<Object>} 승인 결과
   */
  async approveApplication(programId, applicationId) {
    try {
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      console.log(`[ProgramService] 승인 요청 - programId: ${programId}, applicationId: ${applicationId}`);
      
      const member = await this.firestoreService.getDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId
      );

      if (!member) {
        console.error(`[ProgramService] 멤버를 찾을 수 없음 - programId: ${programId}, applicationId: ${applicationId}`);
        const error = new Error('신청 정보를 찾을 수 없습니다.');
        error.code = ERROR_CODES.NOT_FOUND;
        error.statusCode = 404;
        throw error;
      }

      await this.firestoreService.updateDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId,
        {
          status: 'approved',
          approvedAt: new Date()
        }
      );

      if (member.applicantsPageId) {
        try {
          await this.notion.pages.update({
            page_id: member.applicantsPageId,
            properties: {
              '승인여부': {
                select: {
                  name: '승인'
                }
              }
            }
          });
        } catch (notionError) {
          console.warn('[ProgramService] Notion 업데이트 실패:', notionError.message);
        }
      }

      if (member.userId) {
        try {
          const community = await this.communityService.getCommunityMapping(normalizedProgramId);
          const programName = community?.name || "프로그램";
          
          await fcmHelper.sendNotification(
            member.userId,
            "프로그램 신청 승인",
            `"${programName}" 프로그램 신청이 승인되었습니다.`,
            "ANNOUNCEMENT",
            "",
            "",
            `https://youth-it.vercel.app/programs/${programId}`
          );
          
          console.log(`[ProgramService] 승인 알림 발송 완료 - userId: ${member.userId}, programName: ${programName}`);
        } catch (notificationError) {
          console.warn('[ProgramService] 승인 알림 발송 실패:', notificationError.message);
        }
      }

      return {
        applicationId,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ProgramService] 신청 승인 오류:', error.message);
      
      if (error.code === ERROR_CODES.NOT_FOUND) {
        throw error;
      }
      
      const serviceError = new Error(`신청 승인 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 프로그램 신청 승인 취소
   * @param {string} programId - 프로그램 ID
   * @param {string} applicationId - 신청 ID (Firestore member ID)
   * @returns {Promise<Object>} 승인 취소 결과
   */
  async rejectApplication(programId, applicationId) {
    try {
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      console.log(`[ProgramService] 거절 요청 - programId: ${programId}, applicationId: ${applicationId}`);
      
      const member = await this.firestoreService.getDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId
      );

      if (!member) {
        console.error(`[ProgramService] 멤버를 찾을 수 없음 - programId: ${programId}, applicationId: ${applicationId}`);
        const error = new Error('신청 정보를 찾을 수 없습니다.');
        error.code = ERROR_CODES.NOT_FOUND;
        error.statusCode = 404;
        throw error;
      }

      await this.firestoreService.updateDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId,
        {
          status: 'rejected',
          rejectedAt: new Date()
        }
      );

      if (member.applicantsPageId) {
        try {
          await this.notion.pages.update({
            page_id: member.applicantsPageId,
            properties: {
              '승인여부': {
                select: {
                  name: '승인거절'
                }
              }
            }
          });
        } catch (notionError) {
          console.warn('[ProgramService] Notion 업데이트 실패:', notionError.message);
        }
      }

      return {
        applicationId,
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ProgramService] 신청 승인 취소 오류:', error.message);
      
      // 이미 정의된 에러는 그대로 전달
      if (error.code === 'NOT_FOUND') {
        throw error;
      }
      
      const serviceError = new Error(`신청 승인 취소 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 두 날짜 값이 동일한지 비교 (Firestore Timestamp 및 다양한 형식 지원)
   * @param {any} date1 - 첫 번째 날짜 (Firestore Timestamp, Date, string 등)
   * @param {any} date2 - 두 번째 날짜 (Firestore Timestamp, Date, string 등)
   * @returns {boolean} 두 날짜가 동일하면 true, 다르면 false
   */
  _compareDates(date1, date2) {
    // CommunityService의 toDate 헬퍼 사용
    const d1 = CommunityService.toDate(date1);
    const d2 = CommunityService.toDate(date2);
    
    // 둘 다 null이면 동일
    if (!d1 && !d2) return true;
    
    // 하나만 null이면 다름
    if (!d1 || !d2) return false;
    
    // 타임스탬프 비교 (밀리초 단위)
    return d1.getTime() === d2.getTime();
  }

  /**
   * Community와 Notion 데이터 동기화
   * @param {string} programId - 프로그램 ID (Community ID)
   * @param {Object} program - Notion에서 가져온 최신 프로그램 정보
   * @returns {Promise<Object|null>} 업데이트된 필드 정보 또는 null (동기화 불필요 시)
   */
  async syncCommunityWithNotion(programId, program) {
    try {
      // Community 전체 데이터 조회
      const community = await this.firestoreService.getDocument('communities', programId);
      if (!community) {
        // Community가 없으면 동기화 불필요
        return null;
      }

      // Notion 데이터에서 동기화할 필드 추출
      const notionName = program?.programName || program?.title || null;
      const notionProgramType = normalizeProgramTypeValue(program?.programType) || null;
      const notionStartDate = toDateOrNull(program?.startDate);
      const notionEndDate = toDateOrNull(program?.endDate);

      // 업데이트할 필드 확인
      const updateData = {};
      let needsUpdate = false;

      // name 비교 및 업데이트
      if (community.name !== notionName) {
        updateData.name = notionName;
        needsUpdate = true;
      }

      // programType 비교 및 업데이트
      const normalizedCommunityProgramType = normalizeProgramTypeValue(community.programType);
      if (normalizedCommunityProgramType !== notionProgramType) {
        updateData.programType = notionProgramType;
        needsUpdate = true;
      }

      // startDate 비교 및 업데이트
      if (!this._compareDates(community.startDate, notionStartDate)) {
        updateData.startDate = notionStartDate;
        needsUpdate = true;
      }

      // endDate 비교 및 업데이트
      if (!this._compareDates(community.endDate, notionEndDate)) {
        updateData.endDate = notionEndDate;
        needsUpdate = true;
      }

      // 업데이트가 필요한 경우에만 실행
      if (needsUpdate) {
        updateData.updatedAt = FieldValue.serverTimestamp();
        await this.firestoreService.updateDocument('communities', programId, updateData);
        console.log(`[ProgramService] Community 동기화 완료 - programId: ${programId}, 업데이트된 필드: ${Object.keys(updateData).join(', ')}`);
        return updateData;
      }

      return null;
    } catch (error) {
      console.error('[ProgramService] Community 동기화 오류:', error.message);
      // 동기화 실패해도 신청 프로세스는 계속 진행
      return null;
    }
  }

  /**
   * 프로그램 정보로 Community 생성
   * @param {string} programId - 프로그램 ID (Community ID)
   * @param {Object} program - 프로그램 정보
   * @returns {Promise<Object>} 생성된 Community 정보
   */
  async createCommunityFromProgram(programId, program) {
    try {
      const communityData = {
        id: programId,
        name: program?.programName || program?.title || null,
        programType: normalizeProgramTypeValue(program?.programType) || null,
        startDate: toDateOrNull(program?.startDate),
        endDate: toDateOrNull(program?.endDate),
        createdAt: FieldValue.serverTimestamp(),
      };

      // Community 생성
      await this.firestoreService.setDocument('communities', programId, communityData);
      return communityData;

    } catch (error) {
      console.error('[ProgramService] Community 생성 오류:', error.message);
      throw new Error('Community 생성에 실패했습니다.');
    }
  }



}

module.exports = new ProgramService();
