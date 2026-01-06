/**
 * @description Rewards 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/rewards-api";
import { rewardsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/rewards-types";

export const useGetRewardsPolicies = <TData = Types.TGETRewardsPoliciesRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETRewardsPoliciesRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETRewardsPoliciesRes, Error, TData>({
    queryKey: rewardsKeys.getRewardsPolicies,
    queryFn: async () => {
      const response = await Api.getRewardsPolicies();
      return response.data;
    },
    ...options,
  });
};
