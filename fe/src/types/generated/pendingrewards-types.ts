/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @description PendingRewards 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export interface TGETPendingRewardsListReq {
  status?: "all" | "failed" | "pending";
  limit?: number;
}

export type TGETPendingRewardsListRes = {
  failed?: {
    id?: string;
    userId?: string;
    actionKey?: string;
    status?: string;
    retryCount?: number;
    lastError?: string;
  }[];
  pending?: Record<string, any>[];
};

export type TPOSTPendingRewardsRetryAllRes = {
  totalProcessed?: number;
  successCount?: number;
  failCount?: number;
  results?: {
    id?: string;
    userId?: string;
    actionKey?: string;
    success?: boolean;
    amount?: number;
    error?: string;
  }[];
};

export type TPOSTPendingRewardsRetrySelectedRes = {
  totalProcessed?: number;
  successCount?: number;
  failCount?: number;
  results?: any[];
};

export type TGETPendingRewardsStatsRes = {
  pending?: number;
  processing?: number;
  completed?: number;
  failed?: number;
};
