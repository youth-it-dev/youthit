/**
 * @description RewardMonitoring 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/rewardmonitoring-api";
import { rewardmonitoringKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/rewardmonitoring-types";

export const useGetRewardmonitoringExportHistory = <TData = any>(
  options: {
    request: Types.TGETRewardMonitoringExportHistoryReq;
  } & Omit<UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {
  const { request, ...queryOptions } = options;
  return useQuery<any, Error, TData>({
    queryKey: rewardmonitoringKeys.getRewardmonitoringExportHistory(request),
    queryFn: async () => {
      const response = await Api.getRewardmonitoringExportHistory(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetRewardmonitoringExportMonthlySummary = <TData = any>(
  options: {
    request: Types.TGETRewardMonitoringExportMonthlySummaryReq;
  } & Omit<UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {
  const { request, ...queryOptions } = options;
  return useQuery<any, Error, TData>({
    queryKey:
      rewardmonitoringKeys.getRewardmonitoringExportMonthlySummary(request),
    queryFn: async () => {
      const response =
        await Api.getRewardmonitoringExportMonthlySummary(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetRewardmonitoringExportStorePurchases = <TData = any>(
  options: {
    request: Types.TGETRewardMonitoringExportStorePurchasesReq;
  } & Omit<UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {
  const { request, ...queryOptions } = options;
  return useQuery<any, Error, TData>({
    queryKey:
      rewardmonitoringKeys.getRewardmonitoringExportStorePurchases(request),
    queryFn: async () => {
      const response =
        await Api.getRewardmonitoringExportStorePurchases(request);
      return response.data;
    },
    ...queryOptions,
  });
};
