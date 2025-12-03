/**
 * @description Users 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import * as Api from "@/api/generated/users-api";
import { usersKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/users-types";

export const useGetUsers = <TData = Types.TGETUsersRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETUsersRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETUsersRes, Error, TData>({
    queryKey: usersKeys.getUsers,
    queryFn: async () => {
      const response = await Api.getUsers();
      return response.data;
    },
    ...options,
  });
};

export const useGetUsersById = <TData = Types.TGETUsersByIdRes>(
  options: {
    request: Types.TGETUsersByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersByIdRes, Error, TData>({
    queryKey: usersKeys.getUsersById(request),
    queryFn: async () => {
      const response = await Api.getUsersById(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePutUsersById = <
  TContext = unknown,
  TVariables = Types.TPUTUsersByIdReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.putUsersById>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.putUsersById>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.putUsersById(variables as Types.TPUTUsersByIdReq),
    ...options,
  });
};

export const useGetUsersDeletePostById = <
  TData = Types.TGETUsersDeletePostByIdRes,
>(
  options: {
    request: Types.TGETUsersDeletePostByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersDeletePostByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersDeletePostByIdRes, Error, TData>({
    queryKey: usersKeys.getUsersDeletePostById(request),
    queryFn: async () => {
      const response = await Api.getUsersDeletePostById(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetUsersMe = <TData = Types.TGETUsersMeRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETUsersMeRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETUsersMeRes, Error, TData>({
    queryKey: usersKeys.getUsersMe,
    queryFn: async () => {
      const response = await Api.getUsersMe();
      return response.data;
    },
    ...options,
  });
};

export const useGetUsersMeCommentedPosts = <
  TData = Types.TGETUsersMeCommentedPostsRes,
>(
  options: {
    request: Types.TGETUsersMeCommentedPostsReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersMeCommentedPostsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersMeCommentedPostsRes, Error, TData>({
    queryKey: usersKeys.getUsersMeCommentedPosts(request),
    queryFn: async () => {
      const response = await Api.getUsersMeCommentedPosts(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetUsersMeCompletedCommunities = <
  TData = Types.TGETUsersMeCompletedCommunitiesRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETUsersMeCompletedCommunitiesRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETUsersMeCompletedCommunitiesRes, Error, TData>({
    queryKey: usersKeys.getUsersMeCompletedCommunities,
    queryFn: async () => {
      const response = await Api.getUsersMeCompletedCommunities();
      return response.data;
    },
    ...options,
  });
};

export const useGetUsersMeLikedPosts = <TData = Types.TGETUsersMeLikedPostsRes>(
  options: {
    request: Types.TGETUsersMeLikedPostsReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersMeLikedPostsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersMeLikedPostsRes, Error, TData>({
    queryKey: usersKeys.getUsersMeLikedPosts(request),
    queryFn: async () => {
      const response = await Api.getUsersMeLikedPosts(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetUsersMeMyPage = <TData = Types.TGETUsersMeMyPageRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETUsersMeMyPageRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETUsersMeMyPageRes, Error, TData>({
    queryKey: usersKeys.getUsersMeMyPage,
    queryFn: async () => {
      const response = await Api.getUsersMeMyPage();
      return response.data;
    },
    ...options,
  });
};

export const usePatchUsersMeOnboarding = <
  TContext = unknown,
  TVariables = Types.TPATCHUsersMeOnboardingReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.patchUsersMeOnboarding>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.patchUsersMeOnboarding>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.patchUsersMeOnboarding(variables as Types.TPATCHUsersMeOnboardingReq),
    ...options,
  });
};

export const useGetUsersMeParticipatingCommunities = <
  TData = Types.TGETUsersMeParticipatingCommunitiesRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETUsersMeParticipatingCommunitiesRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETUsersMeParticipatingCommunitiesRes, Error, TData>({
    queryKey: usersKeys.getUsersMeParticipatingCommunities,
    queryFn: async () => {
      const response = await Api.getUsersMeParticipatingCommunities();
      return response.data;
    },
    ...options,
  });
};

export const useGetUsersMePosts = <TData = Types.TGETUsersMePostsRes>(
  options: {
    request: Types.TGETUsersMePostsReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersMePostsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersMePostsRes, Error, TData>({
    queryKey: usersKeys.getUsersMePosts(request),
    queryFn: async () => {
      const response = await Api.getUsersMePosts(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostUsersMePushNotificationToggle = <
  TContext = unknown,
  TVariables = void,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postUsersMePushNotificationToggle>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postUsersMePushNotificationToggle>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) =>
      Api.postUsersMePushNotificationToggle(),
    ...options,
  });
};

export const useGetUsersMeRewardsEarned = <
  TData = Types.TGETUsersMeRewardsEarnedRes,
>(
  options: {
    request: Types.TGETUsersMeRewardsEarnedReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersMeRewardsEarnedRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersMeRewardsEarnedRes, Error, TData>({
    queryKey: usersKeys.getUsersMeRewardsEarned(request),
    queryFn: async () => {
      const response = await Api.getUsersMeRewardsEarned(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetUsersMeRewardsUsed = <
  TData = Types.TGETUsersMeRewardsUsedRes,
>(
  options: {
    request: Types.TGETUsersMeRewardsUsedReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersMeRewardsUsedRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersMeRewardsUsedRes, Error, TData>({
    queryKey: usersKeys.getUsersMeRewardsUsed(request),
    queryFn: async () => {
      const response = await Api.getUsersMeRewardsUsed(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostUsersMeSyncKakaoProfile = <
  TContext = unknown,
  TVariables = Types.TPOSTUsersMeSyncKakaoProfileReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postUsersMeSyncKakaoProfile>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postUsersMeSyncKakaoProfile>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postUsersMeSyncKakaoProfile(
        variables as Types.TPOSTUsersMeSyncKakaoProfileReq
      ),
    ...options,
  });
};

export const useGetUsersNicknameAvailability = <
  TData = Types.TGETUsersNicknameAvailabilityRes,
>(
  options: {
    request: Types.TGETUsersNicknameAvailabilityReq;
  } & Omit<
    UseQueryOptions<Types.TGETUsersNicknameAvailabilityRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETUsersNicknameAvailabilityRes, Error, TData>({
    queryKey: usersKeys.getUsersNicknameAvailability(request),
    queryFn: async () => {
      const response = await Api.getUsersNicknameAvailability(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const usePostUsersTestCreate = <
  TContext = unknown,
  TVariables = Types.TPOSTUsersTestCreateReq,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postUsersTestCreate>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postUsersTestCreate>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postUsersTestCreate(variables as Types.TPOSTUsersTestCreateReq),
    ...options,
  });
};
