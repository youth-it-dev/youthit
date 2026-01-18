/**
 * @description RewardMonitoring 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get } from "@/lib/axios";
import type * as Types from "@/types/generated/rewardmonitoring-types";

export const getRewardmonitoringExportHistory = (
  request: Types.TGETRewardMonitoringExportHistoryReq
) => {
  return get<any>(`/rewardMonitoring/export/history`, { params: request });
};

export const getRewardmonitoringExportMonthlySummary = (
  request: Types.TGETRewardMonitoringExportMonthlySummaryReq
) => {
  return get<any>(`/rewardMonitoring/export/monthly-summary`, {
    params: request,
  });
};

export const getRewardmonitoringExportStorePurchases = (
  request: Types.TGETRewardMonitoringExportStorePurchasesReq
) => {
  return get<any>(`/rewardMonitoring/export/store-purchases`, {
    params: request,
  });
};
