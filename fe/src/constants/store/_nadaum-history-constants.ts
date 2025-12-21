/**
 * @description 나다움 내역 관련 상수 정의
 */

import type { HistoryType } from "@/types/reward-history";
import type {
  ActionKey,
  ChangeType,
} from "@/types/store/_nadaum-history-types";

/**
 * @description API 필터 값 상수
 */
export const API_FILTER = {
  ALL: "all",
  EARNED: "earned",
  USED: "used",
  EXPIRED: "expired",
} as const;

/**
 * @description 페이지 필터 값 상수
 */
export const PAGE_FILTER = {
  ALL: "all",
  EARN: "earn",
  USE: "use",
  EXPIRE: "expire",
} as const satisfies Record<string, "all" | HistoryType>;

/**
 * @description 변경 타입 값 상수
 */
export const CHANGE_TYPE = {
  ADD: "add",
  DEDUCT: "deduct",
} as const satisfies Record<string, ChangeType>;

/**
 * @description 액션 키 값 상수
 */
export const ACTION_KEY = {
  EXPIRATION: "expiration",
} as const satisfies Record<string, ActionKey>;

/**
 * @description 히스토리 타입별 라벨 매핑
 */
export const HISTORY_TYPE_LABEL: Record<HistoryType, string> = {
  earn: "적립",
  use: "사용",
  expire: "소멸",
} as const;

/**
 * @description 소멸 예정 description 템플릿
 */
export const EXPIRATION_DESCRIPTION_TEMPLATE = (expirationDate: string) =>
  `적립 | ${expirationDate} 소멸예정` as const;
