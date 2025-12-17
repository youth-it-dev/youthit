/**
 * @description NotionRewardHistory 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/notionrewardhistory-api";
import { notionrewardhistoryKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/notionrewardhistory-types";

export const useGetNotionrewardhistorySync = <
  TData = Types.TGETNotionRewardHistorySyncRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionRewardHistorySyncRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionRewardHistorySyncRes, Error, TData>({
    queryKey: notionrewardhistoryKeys.getNotionrewardhistorySync,
    queryFn: async () => {
      const response = await Api.getNotionrewardhistorySync();
      return response.data;
    },
    ...options,
  });
};
