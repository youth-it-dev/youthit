/**
 * @description Images 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/images-api";
export const usePostImagesUploadImage = <
  TContext = unknown,
  TVariables = FormData,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postImagesUploadImage>>,
      Error,
      TVariables,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postImagesUploadImage>>,
    Error,
    TVariables,
    TContext
  >({
    mutationFn: (variables: TVariables) =>
      Api.postImagesUploadImage(variables as FormData),
    ...options,
  });
};
