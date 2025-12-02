const { Client } = require("@notionhq/client");
const {
  getTitleValue,
  getCreatedTimeValue,
  getLastEditedTimeValue,
} = require("../utils/notionHelper");
const faqService = require("./faqService");

const {
  NOTION_API_KEY,
  NOTION_VERSION = "2025-09-03",
} = process.env;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

function normalizePageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(num)));
}

class NotionFaqService {
  constructor() {
    if (!NOTION_API_KEY) {
      const error = new Error("NOTION_API_KEY가 필요합니다");
      error.code = "MISSING_NOTION_API_KEY";
      error.statusCode = 500;
      throw error;
    }

    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    // notion-client는 ES 모듈이므로 동적 import 필요
    // lazy initialization을 위한 Promise 저장
    this._notionClientPromise = null;
  }

  /**
   * notion-client 인스턴스를 lazy initialization으로 가져오기
   * @returns {Promise<NotionAPI>} NotionAPI 인스턴스
   */
  async getNotionClient() {
    if (!this._notionClientPromise) {
      this._notionClientPromise = (async () => {
        const { NotionAPI } = await import("notion-client");
        return new NotionAPI({
          authToken: NOTION_API_KEY,
        });
      })();
    }
    return this._notionClientPromise;
  }

  /**
   * Relation 속성에서 FAQ 페이지 ID 배열 추출
   * @param {Object} relationProperty - getRelationValues 결과 또는 Notion relation 속성
   * @returns {string[]} FAQ 페이지 ID 배열
   */
  getFaqIdsFromRelation(relationProperty) {
    if (!relationProperty) return [];

    if (Array.isArray(relationProperty.relations)) {
      return relationProperty.relations
        .filter((relation) => relation && typeof relation.id === "string")
        .map((relation) => relation.id);
    }

    if (Array.isArray(relationProperty.relation)) {
      return relationProperty.relation
        .filter((relation) => relation && typeof relation.id === "string")
        .map((relation) => relation.id);
    }

    return [];
  }

  /**
   * 단일 FAQ 조회 (페이지 + 블록 → 포맷된 FAQ 데이터)
   * @param {string} faqId - FAQ 페이지 ID
   * @returns {Promise<Object|null>} 포맷된 FAQ 데이터 또는 null
   */
  async getFaq(faqId) {
    if (!faqId) return null;

    try {
      const pagePromise = this.notion.pages.retrieve({
        page_id: faqId,
      });

      const blocksPromise = faqService.getPageBlocks({ pageId: faqId });

      const [pageResult, blocksResult] = await Promise.allSettled([
        pagePromise,
        blocksPromise,
      ]);

      if (pageResult.status !== "fulfilled") {
        console.warn(
          `[NotionFaqService] FAQ 페이지 조회 실패 - faqId: ${faqId}, reason: ${
            pageResult.reason && pageResult.reason.message
          }`,
        );
        return null;
      }

      const pageData = pageResult.value;
      let blocks = [];

      if (blocksResult.status === "fulfilled" && blocksResult.value) {
        const raw = blocksResult.value;
        blocks = Array.isArray(raw.results) ? raw.results : [];
      } else if (blocksResult.status === "rejected") {
        console.warn(
          `[NotionFaqService] FAQ 블록 조회 실패 - faqId: ${faqId}, reason: ${
            blocksResult.reason && blocksResult.reason.message
          }`,
        );
      }

      return faqService.formatFaqData(pageData, blocks);
    } catch (error) {
      console.warn(
        `[NotionFaqService] FAQ 조회 중 예외 발생 - faqId: ${faqId}, error: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * FAQ ID 배열로 FAQ 리스트 조회
   * @param {string[]} faqIds - FAQ 페이지 ID 배열
   * @returns {Promise<Object[]>} 포맷된 FAQ 리스트
   */
  async getFaqList(faqIds) {
    if (!Array.isArray(faqIds) || faqIds.length === 0) {
      return [];
    }

    try {
      const promises = faqIds.map((id) => this.getFaq(id));
      const results = await Promise.allSettled(promises);

      return results
        .filter(
          (result) => result.status === "fulfilled" && result.value != null,
        )
        .map((result) => result.value);
    } catch (error) {
      console.error(
        "[NotionFaqService] FAQ 리스트 조회 오류:",
        error.message,
      );
      return [];
    }
  }

  /**
   * Relation 필터를 사용하여 FAQ 페이지 목록 조회 (Notion 원본 응답)
   * @param {Object} options
   * @param {string} options.dataSourceId - Notion FAQ 데이터 소스 ID
   * @param {string} options.relationProperty - Relation 필드명 (예: "미션 관리", "프로그램명")
   * @param {string} options.pageId - 연결된 페이지 ID (미션/프로그램 Notion 페이지 ID)
   * @param {number} [options.pageSize=20] - 페이지 크기 (1~100)
   * @param {string} [options.startCursor] - 페이지네이션 커서
   * @returns {Promise<Object>} Notion dataSources.query 응답
   */
  async queryPagesByRelation({
    dataSourceId,
    relationProperty,
    pageId,
    pageSize = DEFAULT_PAGE_SIZE,
    startCursor,
  } = {}) {
    if (!dataSourceId) {
      const error = new Error("FAQ 데이터 소스 ID가 필요합니다");
      error.code = "MISSING_NOTION_DB_ID";
      error.statusCode = 500;
      throw error;
    }

    if (!relationProperty) {
      const error = new Error("Relation 필드명이 필요합니다");
      error.code = "MISSING_REQUIRED_FIELD";
      error.statusCode = 500;
      throw error;
    }

    if (!pageId) {
      const error = new Error("pageId가 필요합니다");
      error.code = "MISSING_REQUIRED_FIELD";
      error.statusCode = 400;
      throw error;
    }

    const size = normalizePageSize(pageSize);

    const queryBody = {
      page_size: size,
      filter: {
        property: relationProperty,
        relation: {
          contains: pageId,
        },
      },
    };

    if (startCursor) {
      queryBody.start_cursor = String(startCursor);
    }

    try {
      const data = await this.notion.dataSources.query({
        data_source_id: dataSourceId,
        ...queryBody,
      });

      return data;
    } catch (error) {
      console.error(
        "[NotionFaqService] FAQ 페이지 목록 조회 오류:",
        error.message,
      );

      const serviceError = new Error(
        `FAQ 페이지 목록 조회 중 오류가 발생했습니다: ${error.message}`,
      );
      serviceError.code = "NOTION_API_ERROR";
      serviceError.statusCode = 500;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * Relation 필터를 사용하여 포맷팅된 FAQ 목록 조회
   * notion-client로 recordMap을 가져와서 react-notion-x에서 사용할 수 있도록 반환
   * @param {Object} options - queryPagesByRelation과 동일 + pageSize/startCursor
   * @returns {Promise<{faqs: Object[], hasMore: boolean, nextCursor: string|null}>}
   */
  async getFaqsByRelation(options = {}) {
    const data = await this.queryPagesByRelation(options);
    const pages = Array.isArray(data.results) ? data.results : [];

    if (!pages.length) {
      return {
        faqs: [],
        hasMore: Boolean(data.has_more),
        nextCursor: data.next_cursor || null,
      };
    }

    // 디버깅: 첫 번째 페이지 구조 확인
    if (pages.length > 0) {
      console.log(
        "[NotionFaqService] 첫 번째 FAQ 페이지 구조:",
        JSON.stringify(
          {
            id: pages[0].id,
            object: pages[0].object,
            properties: pages[0].properties ? Object.keys(pages[0].properties) : [],
          },
          null,
          2,
        ),
      );
    }

    // notion-client로 각 FAQ의 recordMap 가져오기 (홈 화면과 동일)
    const notionClient = await this.getNotionClient();

    // 각 FAQ의 recordMap 병렬 조회
    const recordMapPromises = pages.map((page) => {
      const pageId = page.id;
      console.log(
        `[NotionFaqService] FAQ recordMap 조회 시도 - pageId: ${pageId}`,
      );
      return notionClient.getPage(pageId).catch((error) => {
        console.warn(
          `[NotionFaqService] FAQ recordMap 조회 실패 - pageId: ${pageId}, reason: ${error.message}`,
        );
        return null;
      });
    });
    const recordMapResults = await Promise.allSettled(recordMapPromises);

    const faqs = pages
      .map((page, index) => {
        const recordMapResult = recordMapResults[index];
        const recordMap =
          recordMapResult.status === "fulfilled"
            ? recordMapResult.value
            : null;

        if (!recordMap) {
          return null;
        }

        // FAQ 제목 추출
        const props = page.properties || {};
        const title = getTitleValue(props["FAQ"]) || "";

        return {
          id: page.id,
          title,
          recordMap, // 프론트에서 NotionRenderer로 바로 사용
          createdAt:
            getCreatedTimeValue(props["생성일"]) || page.created_time,
          updatedAt:
            getLastEditedTimeValue(props["수정일"]) ||
            page.last_edited_time,
        };
      })
      .filter((faq) => faq !== null);

    return {
      faqs,
      hasMore: Boolean(data.has_more),
      nextCursor: data.next_cursor || null,
    };
  }
}

module.exports = new NotionFaqService();


