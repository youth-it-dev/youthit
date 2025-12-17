/**
 * @description Announcements 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get } from "@/lib/axios";
import type * as Types from "@/types/generated/announcements-types";

export const getAnnouncements = (request: Types.TGETAnnouncementsReq) => {
  return get<Types.TGETAnnouncementsRes>(`/announcements`, { params: request });
};

export const getAnnouncementsById = (
  request: Types.TGETAnnouncementsByIdReq
) => {
  return get<Types.TGETAnnouncementsByIdRes>(
    `/announcements/${request.pageId}`
  );
};
