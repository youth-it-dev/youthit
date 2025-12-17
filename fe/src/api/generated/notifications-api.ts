/**
 * @description Notifications 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, patch } from "@/lib/axios";
import type * as Types from "@/types/generated/notifications-types";

export const getNotifications = (request: Types.TGETNotificationsReq) => {
  return get<Types.TGETNotificationsRes>(`/notifications`, { params: request });
};

export const patchNotificationsReadById = (
  request: Types.TPATCHNotificationsReadByIdReq
) => {
  return patch<Types.TPATCHNotificationsReadByIdRes>(
    `/notifications/${request.notificationId}/read`
  );
};

export const patchNotificationsReadAll = () => {
  return patch<Types.TPATCHNotificationsReadAllRes>(`/notifications/read-all`);
};

export const getNotificationsSendAllPending = () => {
  return get<Types.TGETNotificationsSendAllPendingRes>(
    `/notifications/send-all-pending`
  );
};
