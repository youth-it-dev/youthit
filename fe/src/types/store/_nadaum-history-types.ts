/**
 * @description 나다움 내역 관련 타입 정의
 */

import type { HistoryType } from "@/types/reward-history";

/**
 * @description API 필터 타입
 */
export type ApiFilterType = "all" | "earned" | "used" | "expired";

/**
 * @description 페이지 필터 타입
 */
export type PageFilterType = "all" | HistoryType;

/**
 * @description 변경 타입 (API 응답)
 */
export type ChangeType = "add" | "deduct";

/**
 * @description 액션 키 타입
 */
export type ActionKey = "expiration" | string;
