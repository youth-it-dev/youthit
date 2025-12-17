/**
 * @description NotionUsers 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/notionusers-api";
import { notionusersKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/notionusers-types";

export const useGetNotionusersSyncActive = <
  TData = Types.TGETNotionUsersSyncActiveRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionUsersSyncActiveRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionUsersSyncActiveRes, Error, TData>({
    queryKey: notionusersKeys.getNotionusersSyncActive,
    queryFn: async () => {
      const response = await Api.getNotionusersSyncActive();
      return response.data;
    },
    ...options,
  });
};

export const useGetNotionusersSyncAllUsersRollback = <
  TData = Types.TGETNotionUsersSyncAllUsersRollbackRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionUsersSyncAllUsersRollbackRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionUsersSyncAllUsersRollbackRes, Error, TData>({
    queryKey: notionusersKeys.getNotionusersSyncAllUsersRollback,
    queryFn: async () => {
      const response = await Api.getNotionusersSyncAllUsersRollback();
      return response.data;
    },
    ...options,
  });
};

export const useGetNotionusersSyncFull = <
  TData = Types.TGETNotionUsersSyncFullRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionUsersSyncFullRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionUsersSyncFullRes, Error, TData>({
    queryKey: notionusersKeys.getNotionusersSyncFull,
    queryFn: async () => {
      const response = await Api.getNotionusersSyncFull();
      return response.data;
    },
    ...options,
  });
};

export const useGetNotionusersSyncPenalty = <
  TData = Types.TGETNotionUsersSyncPenaltyRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionUsersSyncPenaltyRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionUsersSyncPenaltyRes, Error, TData>({
    queryKey: notionusersKeys.getNotionusersSyncPenalty,
    queryFn: async () => {
      const response = await Api.getNotionusersSyncPenalty();
      return response.data;
    },
    ...options,
  });
};

export const useGetNotionusersSyncSelected = <
  TData = Types.TGETNotionUsersSyncSelectedRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionUsersSyncSelectedRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionUsersSyncSelectedRes, Error, TData>({
    queryKey: notionusersKeys.getNotionusersSyncSelected,
    queryFn: async () => {
      const response = await Api.getNotionusersSyncSelected();
      return response.data;
    },
    ...options,
  });
};
