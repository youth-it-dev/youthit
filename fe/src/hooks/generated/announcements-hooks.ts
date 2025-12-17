/**
 * @description Announcements 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/announcements-api";
import { announcementsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/announcements-types";

export const useGetAnnouncements = <TData = Types.TGETAnnouncementsRes>(
  options: {
    request: Types.TGETAnnouncementsReq;
  } & Omit<
    UseQueryOptions<Types.TGETAnnouncementsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETAnnouncementsRes, Error, TData>({
    queryKey: announcementsKeys.getAnnouncements(request),
    queryFn: async () => {
      const response = await Api.getAnnouncements(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetAnnouncementsById = <TData = Types.TGETAnnouncementsByIdRes>(
  options: {
    request: Types.TGETAnnouncementsByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETAnnouncementsByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETAnnouncementsByIdRes, Error, TData>({
    queryKey: announcementsKeys.getAnnouncementsById(request),
    queryFn: async () => {
      const response = await Api.getAnnouncementsById(request);
      return response.data;
    },
    ...queryOptions,
  });
};
