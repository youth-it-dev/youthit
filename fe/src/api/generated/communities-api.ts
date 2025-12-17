/**
 * @description Communities 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, post, put, del } from "@/lib/axios";
import type * as Types from "@/types/generated/communities-types";

export const getCommunities = (request: Types.TGETCommunitiesReq) => {
  return get<Types.TGETCommunitiesRes>(`/communities`, { params: request });
};

export const getCommunitiesMembersByTwoIds = (
  request: Types.TGETCommunitiesMembersByTwoIdsReq
) => {
  return get<Types.TGETCommunitiesMembersByTwoIdsRes>(
    `/communities/${request.communityId}/members/${request.userId}`
  );
};

export const getCommunitiesNicknameAvailabilityById = (
  request: Types.TGETCommunitiesNicknameAvailabilityByIdReq
) => {
  return get<Types.TGETCommunitiesNicknameAvailabilityByIdRes>(
    `/communities/${request.communityId}/nickname-availability`,
    { params: request }
  );
};

export const postCommunitiesPostsById = (
  request: Types.TPOSTCommunitiesPostsByIdReq
) => {
  const { communityId, ...data } = request;
  return post<Types.TPOSTCommunitiesPostsByIdRes>(
    `/communities/${request.communityId}/posts`,
    data.data ?? data
  );
};

export const deleteCommunitiesPostsByTwoIds = (
  request: Types.TDELETECommunitiesPostsByTwoIdsReq
) => {
  return del<any>(
    `/communities/${request.communityId}/posts/${request.postId}`
  );
};

export const getCommunitiesPostsByTwoIds = (
  request: Types.TGETCommunitiesPostsByTwoIdsReq
) => {
  return get<Types.TGETCommunitiesPostsByTwoIdsRes>(
    `/communities/${request.communityId}/posts/${request.postId}`
  );
};

export const putCommunitiesPostsByTwoIds = (
  request: Types.TPUTCommunitiesPostsByTwoIdsReq
) => {
  const { communityId, postId, ...data } = request;
  return put<Types.TPUTCommunitiesPostsByTwoIdsRes>(
    `/communities/${request.communityId}/posts/${request.postId}`,
    data.data ?? data
  );
};

export const postCommunitiesPostsLikeByTwoIds = (
  request: Types.TPOSTCommunitiesPostsLikeByTwoIdsReq
) => {
  return post<Types.TPOSTCommunitiesPostsLikeByTwoIdsRes>(
    `/communities/${request.communityId}/posts/${request.postId}/like`
  );
};

export const getCommunitiesPosts = (request: Types.TGETCommunitiesPostsReq) => {
  return get<Types.TGETCommunitiesPostsRes>(`/communities/posts`, {
    params: request,
  });
};
