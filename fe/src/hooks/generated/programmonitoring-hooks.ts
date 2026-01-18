/**
 * @description ProgramMonitoring 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/programmonitoring-api";
import { programmonitoringKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/programmonitoring-types";

export const useGetProgrammonitoringExport = <TData = any>(
  options: {
    request: Types.TGETProgramMonitoringExportReq;
  } & Omit<UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {
  const { request, ...queryOptions } = options;
  return useQuery<any, Error, TData>({
    queryKey: programmonitoringKeys.getProgrammonitoringExport(request),
    queryFn: async () => {
      const response = await Api.getProgrammonitoringExport(request);
      return response.data;
    },
    ...queryOptions,
  });
};
