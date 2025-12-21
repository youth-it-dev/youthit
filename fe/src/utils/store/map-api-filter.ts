/**
 * @description 나다움 내역 필터 변환 유틸리티
 */

import {
  API_FILTER,
  PAGE_FILTER,
} from "@/constants/store/_nadaum-history-constants";
import type {
  ApiFilterType,
  PageFilterType,
} from "@/types/store/_nadaum-history-types";

/**
 * @description 페이지 필터 타입을 API 필터 타입으로 변환
 * @param filter - 페이지 필터 타입
 * @returns API 필터 타입
 */
export const mapPageFilterToApiFilter = (
  filter: PageFilterType
): ApiFilterType => {
  if (filter === PAGE_FILTER.ALL) return API_FILTER.ALL;
  if (filter === PAGE_FILTER.EARN) return API_FILTER.EARNED;
  if (filter === PAGE_FILTER.USE) return API_FILTER.USED;
  if (filter === PAGE_FILTER.EXPIRE) return API_FILTER.EXPIRED;
  return API_FILTER.ALL;
};
