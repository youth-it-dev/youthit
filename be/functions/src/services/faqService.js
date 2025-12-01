const {
  buildNotionHeadersFromEnv, 
  getTitleValue,
  getMultiSelectNames,
  getSelectValue,
  getCreatedTimeValue,
  getLastEditedTimeValue,
  formatNotionBlocks,
  extractPlainText,
  extractLinksFromRichText,
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
    
    const json = await resp.json();
    console.log(
      "[FAQ 서비스] raw blocks:",
      JSON.stringify(json.results?.slice(0, 3), null, 2)  // 앞 3개만
    );
    return json;
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

    return {
      id: pageData.id,
      title,
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
    if (!Array.isArray(blocks)) return [];

    // 기본 포맷팅(이미지/특수 블록 포함)을 재사용하되,
    // 응답에서는 내부용 id / richText 필드는 제거하고, 텍스트/링크 정보만 노출
    const base = formatNotionBlocks(blocks, {
      includeRichText: true,
      includeMetadata: false,
    });

    return base.map((block, index) => {
      const raw = blocks[index] || {};

      // 응답에서 숨길 필드(id, richText)를 먼저 제거
      const { id, richText, ...rest } = block || {};

      const textTypes = [
        "paragraph",
        "heading_1",
        "heading_2",
        "heading_3",
        "bulleted_list_item",
        "numbered_list_item",
      ];

      if (textTypes.includes(raw.type)) {
        const richTextSource = raw[raw.type]?.rich_text || [];
        return {
          ...rest,
          text: extractPlainText(richTextSource) || "",
          links: extractLinksFromRichText(richTextSource),
        };
      }

      // 이미지/기타 블록은 formatNotionBlocks 결과에서 id/richText만 제거한 형태로 반환
      return rest;
    });
  }
}

module.exports = new FaqService();


