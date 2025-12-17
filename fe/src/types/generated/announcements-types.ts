/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @description Announcements 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export interface TGETAnnouncementsReq {
  pageSize?: number;
  cursor?: string;
}

export type TGETAnnouncementsRes = {
  message?: string;
  announcements?: {
    id?: string;
    title?: string;
    author?: string;
    pinned?: boolean;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
  }[];
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string;
    currentPageCount?: number;
  };
};

export interface TGETAnnouncementsByIdReq {
  pageId: string;
}

export type TGETAnnouncementsByIdRes = {
  message?: string;
  announcement?: {
    id?: string;
    title?: string;
    author?: string;
    contentRich?: Record<string, any>[];
    pinned?: boolean;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
  };
};
