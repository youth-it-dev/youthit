/**
 * @description Programs 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, post } from "@/lib/axios";
import type * as Types from "@/types/generated/programs-types";

export const getPrograms = (request: Types.TGETProgramsReq) => {
  return get<Types.TGETProgramsRes>(`/programs`, { params: request });
};

export const getProgramsById = (request: Types.TGETProgramsByIdReq) => {
  return get<Types.TGETProgramsByIdRes>(`/programs/${request.programId}`);
};

export const getProgramsApplicationsApproveByTwoIds = (
  request: Types.TGETProgramsApplicationsApproveByTwoIdsReq
) => {
  return get<any>(
    `/programs/${request.programId}/applications/${request.applicationId}/approve`
  );
};

export const getProgramsApplicationsRejectByTwoIds = (
  request: Types.TGETProgramsApplicationsRejectByTwoIdsReq
) => {
  return get<any>(
    `/programs/${request.programId}/applications/${request.applicationId}/reject`
  );
};

export const postProgramsApplyById = (
  request: Types.TPOSTProgramsApplyByIdReq
) => {
  const { programId, ...data } = request;
  return post<Types.TPOSTProgramsApplyByIdRes>(
    `/programs/${request.programId}/apply`,
    data.data ?? data
  );
};

export const postProgramsApprove = () => {
  return post<any>(`/programs/approve`);
};

export const postProgramsPending = () => {
  return post<any>(`/programs/pending`);
};

export const postProgramsReject = () => {
  return post<any>(`/programs/reject`);
};

export const getProgramsSearch = (request: Types.TGETProgramsSearchReq) => {
  return get<Types.TGETProgramsSearchRes>(`/programs/search`, {
    params: request,
  });
};
