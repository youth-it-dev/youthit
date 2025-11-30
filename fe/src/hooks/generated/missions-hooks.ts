/**
 * @description Missions 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import * as Api from "@/api/generated/missions-api";
import { missionsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/missions-types";

export const useGetMissions = <TData = Types.TGETMissionsRes>(
  options: {
    request: Types.TGETMissionsReq;
  } & Omit<
    UseQueryOptions<Types.TGETMissionsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETMissionsRes, Error, TData>({
    queryKey: missionsKeys.getMissions(request),
    queryFn: async () => {
      const response = await Api.getMissions(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetMissionsById = <TData = Types.TGETMissionsByIdRes>(
  options: {
    request: Types.TGETMissionsByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETMissionsByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETMissionsByIdRes, Error, TData>({
    queryKey: missionsKeys.getMissionsById(request),
    queryFn: async () => {
      const response = await Api.getMissionsById(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostMissionsApplyById = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsApplyByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsApplyById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsApplyById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsApplyById(variables as Types.TPOSTMissionsApplyByIdReq),
    ...options,
  });
};

export const usePostMissionsLikeById = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsLikeByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsLikeById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsLikeById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsLikeById(variables as Types.TPOSTMissionsLikeByIdReq),
    ...options,
  });
};

export const usePostMissionsPostsById = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsPostsByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsPostsById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsPostsById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsPostsById(variables as Types.TPOSTMissionsPostsByIdReq),
    ...options,
  });
};

export const usePostMissionsQuitById = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsQuitByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsQuitById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsQuitById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsQuitById(variables as Types.TPOSTMissionsQuitByIdReq),
    ...options,
  });
};

export const useGetMissionsCategories = <
  TData = Types.TGETMissionsCategoriesRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETMissionsCategoriesRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETMissionsCategoriesRes, Error, TData>({
    queryKey: missionsKeys.getMissionsCategories,
    queryFn: async () => {
      const response = await Api.getMissionsCategories();
      return response.data;
    },
    ...options,
  });
};

export const useGetMissionsMe = <TData = Types.TGETMissionsMeRes>(
  options: {
    request: Types.TGETMissionsMeReq;
  } & Omit<
    UseQueryOptions<Types.TGETMissionsMeRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETMissionsMeRes, Error, TData>({
    queryKey: missionsKeys.getMissionsMe(request),
    queryFn: async () => {
      const response = await Api.getMissionsMe(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetMissionsPosts = <TData = Types.TGETMissionsPostsRes>(
  options: {
    request: Types.TGETMissionsPostsReq;
  } & Omit<
    UseQueryOptions<Types.TGETMissionsPostsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETMissionsPostsRes, Error, TData>({
    queryKey: missionsKeys.getMissionsPosts(request),
    queryFn: async () => {
      const response = await Api.getMissionsPosts(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetMissionsPostsById = <TData = Types.TGETMissionsPostsByIdRes>(
  options: {
    request: Types.TGETMissionsPostsByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETMissionsPostsByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETMissionsPostsByIdRes, Error, TData>({
    queryKey: missionsKeys.getMissionsPostsById(request),
    queryFn: async () => {
      const response = await Api.getMissionsPostsById(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetMissionsPostsCommentsById = <
  TData = Types.TGETMissionsPostsCommentsByIdRes,
>(
  options: {
    request: Types.TGETMissionsPostsCommentsByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETMissionsPostsCommentsByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETMissionsPostsCommentsByIdRes, Error, TData>({
    queryKey: missionsKeys.getMissionsPostsCommentsById(request),
    queryFn: async () => {
      const response = await Api.getMissionsPostsCommentsById(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostMissionsPostsCommentsById = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsPostsCommentsByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsPostsCommentsById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsPostsCommentsById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsPostsCommentsById(
        variables as Types.TPOSTMissionsPostsCommentsByIdReq
      ),
    ...options,
  });
};

export const useDeleteMissionsPostsCommentsByTwoIds = <
  TContext = unknown,
  TVariables = Types.TDELETEMissionsPostsCommentsByTwoIdsReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.deleteMissionsPostsCommentsByTwoIds>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.deleteMissionsPostsCommentsByTwoIds>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.deleteMissionsPostsCommentsByTwoIds(
        variables as Types.TDELETEMissionsPostsCommentsByTwoIdsReq
      ),
    ...options,
  });
};

export const usePutMissionsPostsCommentsByTwoIds = <
  TContext = unknown,
  TVariables = Types.TPUTMissionsPostsCommentsByTwoIdsReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.putMissionsPostsCommentsByTwoIds>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.putMissionsPostsCommentsByTwoIds>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.putMissionsPostsCommentsByTwoIds(
        variables as Types.TPUTMissionsPostsCommentsByTwoIdsReq
      ),
    ...options,
  });
};

export const usePostMissionsPostsCommentsReportByTwoIds = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsPostsCommentsReportByTwoIdsReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsPostsCommentsReportByTwoIds>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsPostsCommentsReportByTwoIds>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsPostsCommentsReportByTwoIds(
        variables as Types.TPOSTMissionsPostsCommentsReportByTwoIdsReq
      ),
    ...options,
  });
};

export const usePostMissionsPostsReportById = <
  TContext = unknown,
  TVariables = Types.TPOSTMissionsPostsReportByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postMissionsPostsReportById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postMissionsPostsReportById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postMissionsPostsReportById(
        variables as Types.TPOSTMissionsPostsReportByIdReq
      ),
    ...options,
  });
};

export const useGetMissionsStats = <TData = Types.TGETMissionsStatsRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETMissionsStatsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETMissionsStatsRes, Error, TData>({
    queryKey: missionsKeys.getMissionsStats,
    queryFn: async () => {
      const response = await Api.getMissionsStats();
      return response.data;
    },
    ...options,
  });
};
