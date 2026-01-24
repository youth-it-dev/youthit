/**
 * @description NotionRewardPolicy 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { post } from "@/lib/axios";
import type * as Types from "@/types/generated/notionrewardpolicy-types";

export const postNotionrewardpolicySync = () => {
  return post<Types.TPOSTNotionRewardPolicySyncRes>(`/notionRewardPolicy/sync`);
};
