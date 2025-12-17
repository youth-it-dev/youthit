/**
 * @description NotionRewardHistory 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get } from "@/lib/axios";
import type * as Types from "@/types/generated/notionrewardhistory-types";

export const getNotionrewardhistorySync = () => {
  return get<Types.TGETNotionRewardHistorySyncRes>(`/notionRewardHistory/sync`);
};
