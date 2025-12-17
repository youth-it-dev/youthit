/**
 * @description Home 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/home-api";
import { homeKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/home-types";

export const useGetHome = <TData = Types.TGETHomeRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETHomeRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETHomeRes, Error, TData>({
    queryKey: homeKeys.getHome,
    queryFn: async () => {
      const response = await Api.getHome();
      return response.data;
    },
    ...options,
  });
};
