/**
 * @description AdminLogs 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/adminlogs-api";
import { adminlogsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/adminlogs-types";

export const useGetAdminlogsSyncAdminLogs = <
  TData = Types.TGETAdminLogsSyncAdminLogsRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETAdminLogsSyncAdminLogsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETAdminLogsSyncAdminLogsRes, Error, TData>({
    queryKey: adminlogsKeys.getAdminlogsSyncAdminLogs,
    queryFn: async () => {
      const response = await Api.getAdminlogsSyncAdminLogs();
      return response.data;
    },
    ...options,
  });
};
