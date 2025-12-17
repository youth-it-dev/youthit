/**
 * @description Notifications 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export interface TGETNotificationsReq {
  page?: number;
  size?: number;
}

export type TGETNotificationsRes = {
  notifications?: {
    id?: string;
    title?: string;
    message?: string;
    type?: string;
    commentId?: string;
    communityId?: string;
    postId?: string;
    isRead?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }[];
  pagination?: {
    page?: number;
    size?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
  };
  unreadCount?: number;
};

export interface TPATCHNotificationsReadByIdReq {
  notificationId: string;
}

export type TPATCHNotificationsReadByIdRes = {
  message?: string;
  updated?: boolean;
};

export type TPATCHNotificationsReadAllRes = {
  message?: string;
  updatedCount?: number;
};

export type TGETNotificationsSendAllPendingRes = {
  success?: boolean;
  message?: string;
  total?: number;
  successCount?: number;
  errorCount?: number;
  results?: {
    pageId?: string;
    success?: boolean;
    title?: string;
    totalUsers?: number;
    successCount?: number;
    failureCount?: number;
  }[];
};
