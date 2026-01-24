/**
 * @description NotionRewardPolicy 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/notionrewardpolicy-api";
export const usePostNotionrewardpolicySync = <
  TContext = unknown,
  TVariables = void,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postNotionrewardpolicySync>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postNotionrewardpolicySync>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (_variables: TVariables) => Api.postNotionrewardpolicySync(),
    ...options,
  });
};
