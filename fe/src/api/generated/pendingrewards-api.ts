/**
 * @description PendingRewards 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post } from "@/lib/axios";
import type * as Types from "@/types/generated/pendingrewards-types";

export const getPendingrewardsList = (
  request: Types.TGETPendingRewardsListReq
) => {
  return get<Types.TGETPendingRewardsListRes>(`/pendingRewards/list`, {
    params: request,
  });
};

export const postPendingrewardsRetryAll = () => {
  return post<Types.TPOSTPendingRewardsRetryAllRes>(
    `/pendingRewards/retry-all`
  );
};

export const postPendingrewardsRetrySelected = () => {
  return post<Types.TPOSTPendingRewardsRetrySelectedRes>(
    `/pendingRewards/retry-selected`
  );
};

export const getPendingrewardsStats = () => {
  return get<Types.TGETPendingRewardsStatsRes>(`/pendingRewards/stats`);
};
