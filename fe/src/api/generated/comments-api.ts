/**
 * @description Comments 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, post, put, del } from "@/lib/axios";
import type * as Types from "@/types/generated/comments-types";

export const deleteCommentsById = (request: Types.TDELETECommentsByIdReq) => {
  return del<any>(`/comments/${request.commentId}`);
};

export const putCommentsById = (request: Types.TPUTCommentsByIdReq) => {
  const { commentId, ...data } = request;
  return put<Types.TPUTCommentsByIdRes>(
    `/comments/${request.commentId}`,
    data.data ?? data
  );
};

export const postCommentsLikeById = (
  request: Types.TPOSTCommentsLikeByIdReq
) => {
  return post<Types.TPOSTCommentsLikeByIdRes>(
    `/comments/${request.commentId}/like`
  );
};

export const getCommentsCommunitiesPostsByTwoIds = (
  request: Types.TGETCommentsCommunitiesPostsByTwoIdsReq
) => {
  return get<Types.TGETCommentsCommunitiesPostsByTwoIdsRes>(
    `/comments/communities/${request.communityId}/posts/${request.postId}`,
    { params: request }
  );
};

export const postCommentsCommunitiesPostsByTwoIds = (
  request: Types.TPOSTCommentsCommunitiesPostsByTwoIdsReq
) => {
  const { communityId, postId, ...data } = request;
  return post<Types.TPOSTCommentsCommunitiesPostsByTwoIdsRes>(
    `/comments/communities/${request.communityId}/posts/${request.postId}`,
    data.data ?? data
  );
};
