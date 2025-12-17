/**
 * @description QnA 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, post, put, del } from "@/lib/axios";
import type * as Types from "@/types/generated/qna-types";

export const getQnaById = (request: Types.TGETQnaByIdReq) => {
  return get<Types.TGETQnaByIdRes>(`/qna/${request.pageId}`, {
    params: request,
  });
};

export const postQnaById = (request: Types.TPOSTQnaByIdReq) => {
  const { pageId, ...data } = request;
  return post<Types.TPOSTQnaByIdRes>(
    `/qna/${request.pageId}`,
    data.data ?? data
  );
};

export const deleteQnaById = (request: Types.TDELETEQnaByIdReq) => {
  return del<any>(`/qna/${request.qnaId}`);
};

export const putQnaById = (request: Types.TPUTQnaByIdReq) => {
  const { qnaId, ...data } = request;
  return put<Types.TPUTQnaByIdRes>(`/qna/${request.qnaId}`, data.data ?? data);
};

export const postQnaLikeById = (request: Types.TPOSTQnaLikeByIdReq) => {
  return post<Types.TPOSTQnaLikeByIdRes>(`/qna/${request.qnaId}/like`);
};
