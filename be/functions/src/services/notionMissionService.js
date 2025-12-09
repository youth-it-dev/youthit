const { Client } = require('@notionhq/client');
const {
  getTextContent,
  getTitleValue,
  getMultiSelectNames,
  getDateValue,
  getCheckboxValue,
  getNumberValue,
  getUrlValue,
  getRelationValues,
  formatNotionBlocks,
  getCoverImageUrl,
} = require('../utils/notionHelper');
const notionFaqService = require("./notionFaqService");

// 상수 정의
const NOTION_VERSION = process.env.NOTION_VERSION || "2025-09-03";
const { NOTION_MISSION_FAQ_DB_ID } = process.env;
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
  MISSION_NOT_FOUND: 'MISSION_NOT_FOUND',
  INVALID_PAGE_SIZE: 'INVALID_PAGE_SIZE',
  SEARCH_ERROR: 'SEARCH_ERROR',
  SYNC_ERROR: "NOTION_SYNC_ERROR",
};

// Notion 필드명 상수 (실제 노션 DB 구조 반영)
const NOTION_FIELDS = {
  TITLE: "상세페이지(노션)",                        // Title (페이지 제목으로 사용)
  MISSION_INTRODUCTION: "미션 소개",                // Text
  IS_RECRUITING: "현재 모집 여부",                  // Checkbox
  CATEGORY: "카테고리",                             // Multi-select
  DETAIL_TAGS: "상세 태그",                         // Text
  IS_UNLIMITED: "무제한 여부",                      // Checkbox
  APPLICATION_DEADLINE: "신청 마감일시",            // Date (무제한이 아닐 경우)
  CERTIFICATION_DEADLINE: "인증 마감",              // Date
  TARGET_AUDIENCE: "참여 대상",                     // Text
  NOTES: "참고 사항",                               // Text
  CERTIFICATION_METHOD: "인증방법(미션상세)",       // Multi-select
  FAQ: "(미션) 자주 묻는 질문이에요!",              // Relation (Q&A 연동)
  REACTION_COUNT: "반응 수",                        // Number (찜 기능)
  IS_REVIEW_REGISTERED: "미션 인증글 등록 여부",    // Checkbox
  LAST_EDITED_TIME: "최근 수정 날짜",               // Date
  LINK_URL: "바로 보러 가기",                       // URL
};

class NotionMissionService {
  constructor() {
    const {
      NOTION_API_KEY,
      NOTION_MISSION_DB_ID,
    } = process.env;

    // 환경 변수 검증
    if (!NOTION_API_KEY) {
      const error = new Error("NOTION_API_KEY가 필요합니다");
      error.code = ERROR_CODES.MISSING_API_KEY;
      throw error;
    }
    if (!NOTION_MISSION_DB_ID) {
      const error = new Error("NOTION_MISSION_DB_ID가 필요합니다");
      error.code = ERROR_CODES.MISSING_DB_ID;
      throw error;
    }

    // Notion 클라이언트 초기화
    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    this.missionDataSourceId = NOTION_MISSION_DB_ID;
  }

  /**
   * 미션 카테고리 목록 조회
   * @returns {Promise<Object>} 카테고리 목록
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   * @note 모든 미션에서 사용된 카테고리를 중복 제거하여 반환
   */
  async getCategories() {
    try {
      // 전체 미션 조회 (신 API - dataSources.query)
      const response = await this.notion.dataSources.query({
        data_source_id: this.missionDataSourceId,
        page_size: MAX_PAGE_SIZE,
      });

      // 모든 미션에서 카테고리 추출 및 중복 제거
      const categorySet = new Set();
      
      response.results.forEach(page => {
        const categories = getMultiSelectNames(page.properties[NOTION_FIELDS.CATEGORY]);
        categories.forEach(category => categorySet.add(category));
      });

      // Set을 배열로 변환하고 정렬
      const categories = Array.from(categorySet).sort();

      return { categories };

    } catch (error) {
      console.error('[NotionMissionService] 카테고리 조회 오류:', error.message);
      const notionError = new Error('미션 카테고리 조회에 실패했습니다');
      notionError.code = ERROR_CODES.NOTION_API_ERROR;
      notionError.statusCode = 500;
      throw notionError;
    }
  }

  /**
   * 미션 목록 조회 (필터링 & 정렬)
   * @param {Object} filters - 필터 조건
   * @param {string} [filters.category] - 카테고리 (자기만족, 취미생활, 건강, 관계, 성장)
   * @param {string} [filters.sortBy] - 정렬 기준 ("latest" | "popular")
   * @returns {Promise<Object>} 미션 목록
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   * 
   * @note Notion dataSources.cursor 기반 페이지네이션
   * @note 정렬: 최신순(기본) | 인기순(반응 수)
   * @note 필터: 카테고리 칩
   */
  async getMissions(filters = {}) {
    try {
      const requestedPageSize =
        typeof filters.pageSize !== "undefined"
          ? normalizePageSize(filters.pageSize)
          : DEFAULT_PAGE_SIZE;
      const startCursor =
        typeof filters.startCursor === "string" && filters.startCursor.trim().length > 0
          ? filters.startCursor.trim()
          : undefined;

      const queryBody = {
        page_size: requestedPageSize,
      };

      // 정렬 조건
      if (filters.sortBy === 'popular') {
        // 인기순: 찜 많은 순
        queryBody.sorts = [
          {
            property: NOTION_FIELDS.REACTION_COUNT,
            direction: "descending"
          },
          {
            property: NOTION_FIELDS.LAST_EDITED_TIME,
            direction: "descending"
          }
        ];
      } else {
        // 최신순 (기본)
        queryBody.sorts = [
          {
            property: NOTION_FIELDS.LAST_EDITED_TIME,
            direction: "descending"
          }
        ];
      }

      // 필터 조건
      const filterConditions = [];

      // 기본 필터: 현재 모집 여부가 true인 미션만 조회
      filterConditions.push({
        property: NOTION_FIELDS.IS_RECRUITING,
        checkbox: {
          equals: true
        }
      });

      // 카테고리 필터 (Multi-select 중 포함 여부)
      if (filters.category) {
        filterConditions.push({
          property: NOTION_FIELDS.CATEGORY,
          multi_select: {
            contains: filters.category
          }
        });
      }

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      queryBody.filter = {
        and: filterConditions
      };

      // Notion API 호출 (신 API - dataSources.query)
      const data = await this.notion.dataSources.query({
        data_source_id: this.missionDataSourceId,
        ...queryBody
      });
      
      const missions = data.results.map(page => this.formatMissionData(page));
      const hasMore = Boolean(data.has_more);
      const nextCursor = data.next_cursor || null;
      
      return {
        missions,
        totalCount: missions.length,
        hasMore,
        nextCursor,
      };

    } catch (error) {
      console.error('[NotionMissionService] 미션 목록 조회 오류:', error.message);
      
      // Notion SDK 에러 처리
      if (error.code === 'object_not_found') {
        const notFoundError = new Error('미션 데이터 소스를 찾을 수 없습니다.');
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
      
      const serviceError = new Error(`미션 목록 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 미션 상세 조회
   * @param {string} missionId - 미션 ID (Notion 페이지 ID)
   * @returns {Promise<Object>} 미션 상세 정보
   * @throws {Error} MISSION_NOT_FOUND - 미션을 찾을 수 없음
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   */
  async getMissionById(missionId, options = {}) {
    try {
      const { includePageContent = true } = options;
      // Notion 페이지 조회
      const page = await this.notion.pages.retrieve({
        page_id: missionId
      });
      const missionData = this.formatMissionData(page, includePageContent);

      if (includePageContent) {
        // 미션 페이지 블록 내용 조회
        const pageBlocks = await this.getMissionPageBlocks(missionId);
        missionData.pageContent = pageBlocks;
      }

      return missionData;

    } catch (error) {
      console.error('[NotionMissionService] 미션 상세 조회 오류:', error.message);
      
      // Notion SDK 에러 처리
      if (error.code === 'object_not_found') {
        const notFoundError = new Error('해당 미션을 찾을 수 없습니다.');
        notFoundError.code = ERROR_CODES.MISSION_NOT_FOUND;
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
      
      const serviceError = new Error(`미션 상세 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 미션 기준 FAQ 목록 조회
   * @param {string} missionId - 미션 ID (Notion 페이지 ID)
   * @returns {Promise<{faqs: Object[], count: number, hasMore: boolean, nextCursor: string|null}>}
   */
  async getFaqsForMission(missionId) {
    if (!missionId) {
      const error = new Error("missionId가 필요합니다");
      error.code = "MISSING_REQUIRED_FIELD";
      error.statusCode = 400;
      throw error;
    }

    if (!NOTION_MISSION_FAQ_DB_ID) {
      const error = new Error("NOTION_MISSION_FAQ_DB_ID가 필요합니다");
      error.code = 'MISSING_NOTION_DB_ID';
      error.statusCode = 500;
      throw error;
    }

    // 미션 FAQ DB에서 Relation(미션 관리)으로 직접 조회
    const result = await notionFaqService.getFaqsByRelation({
      dataSourceId: NOTION_MISSION_FAQ_DB_ID,
      relationProperty: "미션 관리",
      pageId: missionId,
    });

    return {
      faqs: result.faqs,
      count: result.faqs.length,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }

  /**
   * 미션 페이지 블록 내용 조회
   * @param {string} missionId - 미션 ID
   * @returns {Promise<Array>} 페이지 블록 내용
   */
  async getMissionPageBlocks(missionId) {
    try {
      const data = await this.notion.blocks.children.list({
        block_id: missionId
      });
      
      return this.formatMissionBlocks(data.results);
    } catch (error) {
      console.warn('[NotionMissionService] 미션 페이지 블록 조회 오류:', error.message);
      return [];
    }
  }

  /**
   * 미션 페이지 블록 포맷팅
   * @param {Array} blocks - Notion 블록 배열
   * @returns {Array} 포맷팅된 페이지 내용
   */
  formatMissionBlocks(blocks) {
    return formatNotionBlocks(blocks, { 
      includeRichText: true, 
      includeMetadata: true 
    });
  }

  /**
   * 미션 데이터 포맷팅
   * @param {Object} page - Notion 페이지 객체
   * @param {boolean} includeDetails - 상세 정보 포함 여부
   */
  formatMissionData(page, includeDetails = false) {
    const props = page.properties;
    
    // 페이지 제목 가져오기: "상세페이지(노션)" 필드(title 타입) 사용
    const resolvedTitle = getTitleValue(props[NOTION_FIELDS.TITLE]) || '';

    const missionData = {
      id: page.id,
      title: resolvedTitle || "",
      missionIntroduction: getTextContent(props[NOTION_FIELDS.MISSION_INTRODUCTION]),
      coverImage: getCoverImageUrl(page), // 노션 페이지 커버 이미지 (unsplash 등)
      
      // 모집 상태
      isRecruiting: getCheckboxValue(props[NOTION_FIELDS.IS_RECRUITING]),
      isUnlimited: getCheckboxValue(props[NOTION_FIELDS.IS_UNLIMITED]),
      applicationDeadline: getDateValue(props[NOTION_FIELDS.APPLICATION_DEADLINE]), // 무제한이 아닐 경우
      certificationDeadline: getDateValue(props[NOTION_FIELDS.CERTIFICATION_DEADLINE]),
      
      // 분류
      categories: getMultiSelectNames(props[NOTION_FIELDS.CATEGORY]), // Multi-select
      detailTags: getTextContent(props[NOTION_FIELDS.DETAIL_TAGS]),
      
      // 내용
      targetAudience: getTextContent(props[NOTION_FIELDS.TARGET_AUDIENCE]),
      notes: getTextContent(props[NOTION_FIELDS.NOTES]),
      certificationMethod: getMultiSelectNames(props[NOTION_FIELDS.CERTIFICATION_METHOD]), // Multi-select
      
      // 통계 & 관계
      reactionCount: getNumberValue(props[NOTION_FIELDS.REACTION_COUNT]) || 0, // 찜 수
      faqRelation: getRelationValues(props[NOTION_FIELDS.FAQ]),
      isReviewRegistered: getCheckboxValue(props[NOTION_FIELDS.IS_REVIEW_REGISTERED]),
      
      // 메타
      createdAt: page.created_time,
      updatedAt: getDateValue(props[NOTION_FIELDS.LAST_EDITED_TIME]) || page.last_edited_time,
    };

    return missionData;
  }

}

module.exports = new NotionMissionService();

