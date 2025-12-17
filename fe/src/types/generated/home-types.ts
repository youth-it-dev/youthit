/**
 * @description Home 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export type TGETHomeRes = {
  id: string;
  name: string;
  backgroundImage?: {
    name?: string;
    url?: string;
    type?: "file" | "external";
  }[];
  activityReview?: boolean;
  nadaumExhibition?: boolean;
  deployDate?: string;
  content: {
    type:
      | "paragraph"
      | "heading_1"
      | "heading_2"
      | "heading_3"
      | "bulleted_list_item"
      | "numbered_list_item"
      | "to_do"
      | "toggle"
      | "quote"
      | "callout"
      | "image"
      | "video"
      | "file"
      | "divider";
    id: string;
    text?: string;
    url?: string;
    caption?: string;
    links?: {
      text?: string;
      url?: string;
    }[];
    checked?: boolean;
  }[];
  createdAt?: string;
  updatedAt?: string;
  url?: string;
};
