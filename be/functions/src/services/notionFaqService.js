const { Client } = require("@notionhq/client");
const faqService = require("./faqService");

const {
  NOTION_API_KEY,
  NOTION_VERSION = "2025-09-03",
} = process.env;

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
}

module.exports = new NotionFaqService();


