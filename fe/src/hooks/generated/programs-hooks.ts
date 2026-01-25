/**
 * @description Programs 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import * as Api from "@/api/generated/programs-api";
import { programsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/programs-types";

export const useGetPrograms = <TData = Types.TGETProgramsRes>(
  options: {
    request: Types.TGETProgramsReq;
  } & Omit<
    UseQueryOptions<Types.TGETProgramsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETProgramsRes, Error, TData>({
    queryKey: programsKeys.getPrograms(request),
    queryFn: async () => {
      const response = await Api.getPrograms(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetProgramsById = <TData = Types.TGETProgramsByIdRes>(
  options: {
    request: Types.TGETProgramsByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETProgramsByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETProgramsByIdRes, Error, TData>({
    queryKey: programsKeys.getProgramsById(request),
    queryFn: async () => {
      const response = await Api.getProgramsById(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetProgramsApplicationsApproveByTwoIds = <TData = any>(
  options: {
    request: Types.TGETProgramsApplicationsApproveByTwoIdsReq;
  } & Omit<UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {
  const { request, ...queryOptions } = options;
  return useQuery<any, Error, TData>({
    queryKey: programsKeys.getProgramsApplicationsApproveByTwoIds(request),
    queryFn: async () => {
      const response =
        await Api.getProgramsApplicationsApproveByTwoIds(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetProgramsApplicationsRejectByTwoIds = <TData = any>(
  options: {
    request: Types.TGETProgramsApplicationsRejectByTwoIdsReq;
  } & Omit<UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {
  const { request, ...queryOptions } = options;
  return useQuery<any, Error, TData>({
    queryKey: programsKeys.getProgramsApplicationsRejectByTwoIds(request),
    queryFn: async () => {
      const response = await Api.getProgramsApplicationsRejectByTwoIds(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostProgramsApplyById = <
  TContext = unknown,
  TVariables = Types.TPOSTProgramsApplyByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postProgramsApplyById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postProgramsApplyById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postProgramsApplyById(variables as Types.TPOSTProgramsApplyByIdReq),
    ...options,
  });
};

export const usePostProgramsApprove = <TContext = unknown, TVariables = void>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postProgramsApprove>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postProgramsApprove>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) => Api.postProgramsApprove(),
    ...options,
  });
};

export const usePostProgramsPending = <TContext = unknown, TVariables = void>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postProgramsPending>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postProgramsPending>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) => Api.postProgramsPending(),
    ...options,
  });
};

export const usePostProgramsReject = <TContext = unknown, TVariables = void>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postProgramsReject>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postProgramsReject>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) => Api.postProgramsReject(),
    ...options,
  });
};

export const useGetProgramsSearch = <TData = Types.TGETProgramsSearchRes>(
  options: {
    request: Types.TGETProgramsSearchReq;
  } & Omit<
    UseQueryOptions<Types.TGETProgramsSearchRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETProgramsSearchRes, Error, TData>({
    queryKey: programsKeys.getProgramsSearch(request),
    queryFn: async () => {
      const response = await Api.getProgramsSearch(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostProgramsWebhooksLeaderChange = <
  TContext = unknown,
  TVariables = Types.TPOSTProgramsWebhooksLeaderChangeReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postProgramsWebhooksLeaderChange>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postProgramsWebhooksLeaderChange>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postProgramsWebhooksLeaderChange(
        variables as Types.TPOSTProgramsWebhooksLeaderChangeReq
      ),
    ...options,
  });
};
