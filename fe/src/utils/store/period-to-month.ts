/**
 * @description PeriodOption을 month 숫자로 변환하는 유틸 함수
 */

import type { PeriodOption } from "@/types/store/_nadaum-history-types";

/**
 * @description PeriodOption을 month 숫자로 변환
 * @param period - 조회 기간 옵션
 * @returns month 숫자 (이번달은 undefined 반환)
 */
export const periodToMonth = (period: PeriodOption): number | undefined => {
  switch (period) {
    case "thisMonth":
      return undefined;
    case "1month":
      return 1;
    case "3months":
      return 3;
    case "6months":
      return 6;
    case "1year":
      return 12;
    default:
      return undefined;
  }
};
