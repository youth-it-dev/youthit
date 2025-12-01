const {
  buildNotionHeadersFromEnv, 
  getTitleValue,
  getTextContent,
  getMultiSelectNames,
  getSelectValue,
  getDateValue,
  getCreatedTimeValue,
  getLastEditedTimeValue,
  formatNotionBlocks,
} = require("../utils/notionHelper");

class FaqService {
  constructor() {
    this.dataSourceId = process.env.NOTION_FAQ_DB_ID;
    this.baseUrl = "https://api.notion.com/v1";
    this.NOTION_API_TIMEOUT = 10000;
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.NOTION_API_TIMEOUT);

    try {
      const resp = await fetch(url, {...options, signal: controller.signal});
      clearTimeout(timeoutId);
      return resp;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        const err = new Error("노션 API 요청 시간 초과");
        err.status = 504;
        throw err;
      }
      throw error;
    }
  }

  async queryFaqList({category, pageSize = 20, startCursor} = {}) {
    if (!this.dataSourceId) {
      const err = new Error("노션 FAQ 데이터 소스 ID가 설정되지 않았습니다");
      err.status = 500;
      err.code = "MISSING_CONFIG";
      throw err;
    }

    const url = `${this.baseUrl}/data_sources/${this.dataSourceId}/query`;
    const headers = buildNotionHeadersFromEnv();
    
    console.log(`[FAQ 서비스] FAQ 목록 조회 중 - 카테고리: ${category}, 페이지 크기: ${pageSize}`);

    const body = {};

    if (category) {
      body.filter = {
        property: "주제",
        multi_select: {contains: String(category)},
      };
    }

    if (pageSize) {
      const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
      body.page_size = size;
    }
    if (startCursor) body.start_cursor = String(startCursor);

    const resp = await this.fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[FAQ 서비스] FAQ 목록 조회 실패: ${resp.status} - ${text}`);
      const err = new Error(`노션 FAQ 목록 조회 실패: ${text}`);
      err.status = resp.status;
      throw err;
    }
    
    console.log(`[FAQ 서비스] FAQ 목록 조회 성공`);
    return resp.json();
  }

  async getPageBlocks({pageId, pageSize = 50, startCursor}) {
    if (!pageId) {
      const err = new Error("pageId is required");
      err.status = 400;
      err.code = "MISSING_PARAMETER";
      throw err;
    }

    const headers = buildNotionHeadersFromEnv();

    const searchParams = new URLSearchParams();
    if (pageSize) {
      const size = Math.min(100, Math.max(1, Number(pageSize) || 50));
      searchParams.set("page_size", String(size));
    }
    if (startCursor) searchParams.set("start_cursor", String(startCursor));

    const url = `${this.baseUrl}/blocks/${pageId}/children${searchParams.size ? `?${searchParams.toString()}` : ""}`;
    
    console.log(`[FAQ 서비스] 페이지 블록 조회 중 - 페이지 ID: ${pageId}`);

    const resp = await this.fetchWithTimeout(url, {method: "GET", headers});
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[FAQ 서비스] 페이지 블록 조회 실패: ${resp.status} - ${text}`);
      const err = new Error(`노션 블록 조회 실패: ${text}`);
      err.status = resp.status;
      throw err;
    }
    
    console.log(`[FAQ 서비스] 페이지 블록 조회 성공 - 페이지 ID: ${pageId}`);
    return resp.json();
  }

  /**
   * FAQ 데이터 포맷팅
   * @param {Object} pageData - Notion 페이지 데이터
   * @param {Array} blocks - 페이지 블록 데이터
   * @returns {Object} 포맷팅된 FAQ 데이터
   */
  formatFaqData(pageData, blocks = []) {
    const props = pageData.properties;
    
    const title = getTitleValue(props["FAQ"]);

    // 카테고리: Multi-select 우선, 없으면 select 값을 단일 배열로 래핑
    let category = getMultiSelectNames(props["주제"]);
    if ((!category || category.length === 0) && props["주제"]) {
      const singleCategory = getSelectValue(props["주제"]);
      category = singleCategory ? [singleCategory] : [];
    }

    return {
      id: pageData.id,
      title,
      category,
      content: this.formatFaqBlocks(blocks),
      createdAt: getCreatedTimeValue(props["생성일"]) || pageData.created_time,
      updatedAt: getLastEditedTimeValue(props["수정일"]) || pageData.last_edited_time
    };
  }

  /**
   * FAQ 블록 포맷팅
   * @param {Array} blocks - Notion 블록 배열
   * @returns {Array} 포맷팅된 FAQ 내용
   */
  formatFaqBlocks(blocks) {
    return formatNotionBlocks(blocks, { 
      includeRichText: true, 
      includeMetadata: false 
    });
  }
}

module.exports = new FaqService();


