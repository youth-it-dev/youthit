/**
 * @description 나다움 내역 필터 옵션 상수 정의
 */

import type { HistoryType } from "@/types/reward-history";

/**
 * @description 나다움 내역 필터 옵션
 */
export const NADAUM_HISTORY_FILTER_OPTIONS: Array<{
  id: "all" | HistoryType;
  label: string;
}> = [
  { id: "all", label: "전체" },
  { id: "earn", label: "적립" },
  { id: "use", label: "사용" },
  { id: "expire", label: "소멸" },
] as const;
