/**
 * @description Missions 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, post, put, patch, del } from "@/lib/axios";
import type * as Types from "@/types/generated/missions-types";

export const getMissions = (request: Types.TGETMissionsReq) => {
  return get<Types.TGETMissionsRes>(`/missions`, { params: request });
};

export const getMissionsById = (request: Types.TGETMissionsByIdReq) => {
  return get<Types.TGETMissionsByIdRes>(`/missions/${request.missionId}`);
};

export const postMissionsApplyById = (
  request: Types.TPOSTMissionsApplyByIdReq
) => {
  return post<Types.TPOSTMissionsApplyByIdRes>(
    `/missions/${request.missionId}/apply`
  );
};

export const postMissionsLikeById = (
  request: Types.TPOSTMissionsLikeByIdReq
) => {
  return post<Types.TPOSTMissionsLikeByIdRes>(
    `/missions/${request.missionId}/like`
  );
};

export const postMissionsPostsById = (
  request: Types.TPOSTMissionsPostsByIdReq
) => {
  const { missionId, ...data } = request;
  return post<Types.TPOSTMissionsPostsByIdRes>(
    `/missions/${request.missionId}/posts`,
    data.data ?? data
  );
};

export const postMissionsQuitById = (
  request: Types.TPOSTMissionsQuitByIdReq
) => {
  return post<Types.TPOSTMissionsQuitByIdRes>(
    `/missions/${request.missionId}/quit`
  );
};

export const getMissionsCategories = () => {
  return get<Types.TGETMissionsCategoriesRes>(`/missions/categories`);
};

export const getMissionsMe = (request: Types.TGETMissionsMeReq) => {
  return get<Types.TGETMissionsMeRes>(`/missions/me`, { params: request });
};

export const getMissionsPosts = (request: Types.TGETMissionsPostsReq) => {
  return get<Types.TGETMissionsPostsRes>(`/missions/posts`, {
    params: request,
  });
};

export const getMissionsPostsById = (
  request: Types.TGETMissionsPostsByIdReq
) => {
  return get<Types.TGETMissionsPostsByIdRes>(
    `/missions/posts/${request.postId}`
  );
};

export const getMissionsPostsCommentsById = (
  request: Types.TGETMissionsPostsCommentsByIdReq
) => {
  return get<Types.TGETMissionsPostsCommentsByIdRes>(
    `/missions/posts/${request.postId}/comments`,
    { params: request }
  );
};

export const postMissionsPostsCommentsById = (
  request: Types.TPOSTMissionsPostsCommentsByIdReq
) => {
  const { postId, ...data } = request;
  return post<Types.TPOSTMissionsPostsCommentsByIdRes>(
    `/missions/posts/${request.postId}/comments`,
    data.data ?? data
  );
};

export const deleteMissionsPostsCommentsByTwoIds = (
  request: Types.TDELETEMissionsPostsCommentsByTwoIdsReq
) => {
  return del<any>(
    `/missions/posts/${request.postId}/comments/${request.commentId}`
  );
};

export const putMissionsPostsCommentsByTwoIds = (
  request: Types.TPUTMissionsPostsCommentsByTwoIdsReq
) => {
  const { postId, commentId, ...data } = request;
  return put<Types.TPUTMissionsPostsCommentsByTwoIdsRes>(
    `/missions/posts/${request.postId}/comments/${request.commentId}`,
    data.data ?? data
  );
};

export const postMissionsPostsCommentsReportByTwoIds = (
  request: Types.TPOSTMissionsPostsCommentsReportByTwoIdsReq
) => {
  const { postId, commentId, ...data } = request;
  return post<Types.TPOSTMissionsPostsCommentsReportByTwoIdsRes>(
    `/missions/posts/${request.postId}/comments/${request.commentId}/report`,
    data.data ?? data
  );
};

export const postMissionsPostsReportById = (
  request: Types.TPOSTMissionsPostsReportByIdReq
) => {
  const { postId, ...data } = request;
  return post<Types.TPOSTMissionsPostsReportByIdRes>(
    `/missions/posts/${request.postId}/report`,
    data.data ?? data
  );
};

export const getMissionsStats = () => {
  return get<Types.TGETMissionsStatsRes>(`/missions/stats`);
};
