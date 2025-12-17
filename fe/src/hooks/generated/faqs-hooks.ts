/**
 * @description FAQs 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/faqs-api";
import { faqsKeys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/faqs-types";

export const useGetFaqs = <TData = Types.TGETFaqsRes>(
  options: {
    request: Types.TGETFaqsReq;
  } & Omit<
    UseQueryOptions<Types.TGETFaqsRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETFaqsRes, Error, TData>({
    queryKey: faqsKeys.getFaqs(request),
    queryFn: async () => {
      const response = await Api.getFaqs(request);
      return response.data;
    },
    ...queryOptions,
  });
};

export const useGetFaqsBlocksById = <TData = Types.TGETFaqsBlocksByIdRes>(
  options: {
    request: Types.TGETFaqsBlocksByIdReq;
  } & Omit<
    UseQueryOptions<Types.TGETFaqsBlocksByIdRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  const { request, ...queryOptions } = options;
  return useQuery<Types.TGETFaqsBlocksByIdRes, Error, TData>({
    queryKey: faqsKeys.getFaqsBlocksById(request),
    queryFn: async () => {
      const response = await Api.getFaqsBlocksById(request);
      return response.data;
    },
    ...queryOptions,
  });
};
