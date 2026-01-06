/**
 * @description Users 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post, put, patch } from "@/lib/axios";
import type * as Types from "@/types/generated/users-types";

export const getUsers = () => {
  return get<Types.TGETUsersRes>(`/users`);
};

export const getUsersById = (request: Types.TGETUsersByIdReq) => {
  return get<Types.TGETUsersByIdRes>(`/users/${request.userId}`);
};

export const putUsersById = (request: Types.TPUTUsersByIdReq) => {
  const { userId, ...data } = request;
  return put<Types.TPUTUsersByIdRes>(
    `/users/${request.userId}`,
    data.data ?? data
  );
};

export const getUsersDeletePostById = (
  request: Types.TGETUsersDeletePostByIdReq
) => {
  return get<Types.TGETUsersDeletePostByIdRes>(
    `/users/deletePost/${request.userId}`
  );
};

export const getUsersMe = (request: Types.TGETUsersMeReq) => {
  return get<Types.TGETUsersMeRes>(`/users/me`, { params: request });
};

export const getUsersMeCommentedPosts = (
  request: Types.TGETUsersMeCommentedPostsReq
) => {
  return get<Types.TGETUsersMeCommentedPostsRes>(`/users/me/commented-posts`, {
    params: request,
  });
};

export const getUsersMeCompletedCommunities = () => {
  return get<Types.TGETUsersMeCompletedCommunitiesRes>(
    `/users/me/completed-communities`
  );
};

export const getUsersMeLikedPosts = (
  request: Types.TGETUsersMeLikedPostsReq
) => {
  return get<Types.TGETUsersMeLikedPostsRes>(`/users/me/liked-posts`, {
    params: request,
  });
};

export const postUsersMeMarketingTermsToggle = (
  request: Types.TPOSTUsersMeMarketingTermsToggleReq
) => {
  return post<Types.TPOSTUsersMeMarketingTermsToggleRes>(
    `/users/me/marketing-terms/toggle`,
    request.data ?? request
  );
};

export const getUsersMeMyPage = () => {
  return get<Types.TGETUsersMeMyPageRes>(`/users/me/my-page`);
};

export const patchUsersMeOnboarding = (
  request: Types.TPATCHUsersMeOnboardingReq
) => {
  return patch<Types.TPATCHUsersMeOnboardingRes>(
    `/users/me/onboarding`,
    request.data ?? request
  );
};

export const getUsersMeParticipatingCommunities = () => {
  return get<Types.TGETUsersMeParticipatingCommunitiesRes>(
    `/users/me/participating-communities`
  );
};

export const getUsersMePosts = (request: Types.TGETUsersMePostsReq) => {
  return get<Types.TGETUsersMePostsRes>(`/users/me/posts`, { params: request });
};

export const postUsersMePushNotificationToggle = (
  request: Types.TPOSTUsersMePushNotificationToggleReq
) => {
  return post<Types.TPOSTUsersMePushNotificationToggleRes>(
    `/users/me/push-notification-toggle`,
    request.data ?? request
  );
};

export const getUsersMeRewardsEarned = (
  request: Types.TGETUsersMeRewardsEarnedReq
) => {
  return get<Types.TGETUsersMeRewardsEarnedRes>(`/users/me/rewards-earned`, {
    params: request,
  });
};

export const getUsersMeRoutineCalendar = (
  request: Types.TGETUsersMeRoutineCalendarReq
) => {
  return get<Types.TGETUsersMeRoutineCalendarRes>(
    `/users/me/routine-calendar`,
    { params: request }
  );
};

export const postUsersMeSyncKakaoProfile = (
  request: Types.TPOSTUsersMeSyncKakaoProfileReq
) => {
  return post<Types.TPOSTUsersMeSyncKakaoProfileRes>(
    `/users/me/sync-kakao-profile`,
    request.data ?? request
  );
};

export const getUsersNicknameAvailability = (
  request: Types.TGETUsersNicknameAvailabilityReq
) => {
  return get<Types.TGETUsersNicknameAvailabilityRes>(
    `/users/nickname-availability`,
    { params: request }
  );
};

export const postUsersTestCreate = (request: Types.TPOSTUsersTestCreateReq) => {
  return post<Types.TPOSTUsersTestCreateRes>(
    `/users/test/create`,
    request.data ?? request
  );
};
