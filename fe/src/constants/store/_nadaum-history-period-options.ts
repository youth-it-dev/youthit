/**
 * @description 나다움 내역 조회 기간 옵션 상수 정의
 */

import type { PeriodOption } from "@/types/store/_nadaum-history-types";

/**
 * @description 조회 기간 옵션
 */
export const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: "thisMonth", label: "이번달" },
  { value: "1month", label: "1개월" },
  { value: "3months", label: "3개월" },
  { value: "6months", label: "6개월" },
  { value: "1year", label: "1년" },
] as const;
