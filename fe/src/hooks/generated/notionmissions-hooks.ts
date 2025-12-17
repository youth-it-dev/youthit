/**
 * @description NotionMissions 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import * as Api from "@/api/generated/notionmissions-api";
import { notionmissionsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/notionmissions-types";

export const useGetNotionmissionsReactionsSync = <
  TData = Types.TGETNotionMissionsReactionsSyncRes,
>(
  options?: Omit<
    UseQueryOptions<Types.TGETNotionMissionsReactionsSyncRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETNotionMissionsReactionsSyncRes, Error, TData>({
    queryKey: notionmissionsKeys.getNotionmissionsReactionsSync,
    queryFn: async () => {
      const response = await Api.getNotionmissionsReactionsSync();
      return response.data;
    },
    ...options,
  });
};
