/**
 * @description FAQs 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export interface TGETFaqsReq {
  category?: string;
  pageSize?: number;
  startCursor?: string;
}

export type TGETFaqsRes = {
  object?: string;
  results?: {
    id?: string;
    properties?: {
      주제?: {
        multi_select?: {
          name?: string;
        }[];
      };
      제목?: {
        title?: {
          plain_text?: string;
        }[];
      };
    };
  }[];
  next_cursor?: string;
  has_more?: boolean;
};

export interface TGETFaqsBlocksByIdReq {
  pageId: string;
  pageSize?: number;
  startCursor?: string;
}

export type TGETFaqsBlocksByIdRes = {
  object?: string;
  results?: {
    id?: string;
    type?: string;
    paragraph?: {
      rich_text?: {
        plain_text?: string;
      }[];
    };
  }[];
  next_cursor?: string;
  has_more?: boolean;
};
