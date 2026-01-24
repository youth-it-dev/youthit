/**
 * @description PendingRewards 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import * as Api from "@/api/generated/pendingrewards-api";
import { pendingrewardsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/pendingrewards-types";

export const useGetPendingrewardsList = <
  TData = Types.TGETPendingRewardsListRes,
>(
  options: {
    request: Types.TGETPendingRewardsListReq;
  } & Omit<
    UseQueryOptions<Types.TGETPendingRewardsListRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETPendingRewardsListRes, Error, TData>({
    queryKey: pendingrewardsKeys.getPendingrewardsList(request),
    queryFn: async () => {
      const response = await Api.getPendingrewardsList(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostPendingrewardsRetryAll = <
  TContext = unknown,
  TVariables = void,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postPendingrewardsRetryAll>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postPendingrewardsRetryAll>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) => Api.postPendingrewardsRetryAll(),
    ...options,
  });
};

export const usePostPendingrewardsRetrySelected = <
  TContext = unknown,
  TVariables = void,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postPendingrewardsRetrySelected>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postPendingrewardsRetrySelected>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) =>
      Api.postPendingrewardsRetrySelected(),
    ...options,
  });
};

export const useGetPendingrewardsStats = <
  TData = Types.TGETPendingRewardsStatsRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETPendingRewardsStatsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETPendingRewardsStatsRes, Error, TData>({
    queryKey: pendingrewardsKeys.getPendingrewardsStats,
    queryFn: async () => {
      const response = await Api.getPendingrewardsStats();
      return response.data;
    },
    ...options,
  });
};
