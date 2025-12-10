"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsKeys } from "@/constants/generated/query-keys";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetNotifications,
  usePatchNotificationsReadAll,
  usePatchNotificationsReadById,
} from "@/hooks/generated/notifications-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { TGETNotificationsRes } from "@/types/generated/notifications-types";
import { getTimeAgo } from "@/utils/shared/date";
import { getNotificationTypeLabel } from "@/utils/shared/notification-type";

/**
 * @description 알림 목록 페이지
 */
const NotificationsPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 알림 목록 조회
  const {
    data: notificationsData,
    isLoading,
    error,
  } = useGetNotifications({
    request: {
      page: 0,
      size: 50,
    },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      return {
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0,
      };
    },
  });

  // 전체 읽음 처리 mutation
  const markAllAsReadMutation = usePatchNotificationsReadAll({
    onSuccess: () => {
      // 알림 목록 쿼리 무효화하여 다시 불러오기
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.getNotifications({ page: 0, size: 50 }),
      });
    },
  });

  // 전체 읽음 처리 핸들러
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  // TopBar rightSlot 설정 (모두 읽음 버튼)
  useEffect(() => {
    const hasUnreadNotifications = (notificationsData?.unreadCount || 0) > 0;

    if (hasUnreadNotifications) {
      const readAllButton = (
        <button
          onClick={handleMarkAllAsRead}
          disabled={markAllAsReadMutation.isPending}
          className="flex items-center justify-center py-1 text-sm text-gray-600 disabled:opacity-50"
          aria-label="모두 읽음"
        >
          <Typography font="noto" variant="caption1M">
            모두 읽음
          </Typography>
        </button>
      );
      setRightSlot(readAllButton);
    } else {
      setRightSlot(null);
    }

    return () => {
      resetTopBar();
    };
  }, [
    notificationsData?.unreadCount,
    handleMarkAllAsRead,
    markAllAsReadMutation.isPending,
    setRightSlot,
    resetTopBar,
  ]);

  // 개별 알림 읽음 처리 mutation
  const markAsReadMutation = usePatchNotificationsReadById({
    onSuccess: () => {
      // 알림 목록 쿼리 무효화하여 다시 불러오기
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.getNotifications({ page: 0, size: 50 }),
      });
    },
  });

  // 개별 알림 클릭 핸들러 (읽음 처리 및 페이지 이동)
  const handleNotificationClick = useCallback(
    async (notification: {
      id?: string;
      type?: string;
      postId?: string;
      communityId?: string;
      commentId?: string;
      isRead?: boolean;
    }) => {
      const notificationId = notification.id;
      const isRead = notification.isRead || false;

      if (!notificationId) return;

      // 게시글/댓글 관련 알림인 경우 해당 페이지로 이동
      const hasPostId = notification.postId && notification.postId !== "";
      const hasCommunityId =
        notification.communityId && notification.communityId !== "";

      if (hasCommunityId && hasPostId) {
        // 게시글 상세 페이지로 이동
        const postPath = `${LINK_URL.COMMUNITY_POST}/${notification.postId}?communityId=${notification.communityId}`;
        router.push(postPath);
      }

      // 이미 읽은 알림이면 페이지 이동만 수행
      if (isRead) return;

      // 낙관적 업데이트: 클라이언트에서 먼저 읽음 처리
      queryClient.setQueryData(
        notificationsKeys.getNotifications({ page: 0, size: 50 }),
        (oldData: TGETNotificationsRes) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            notifications: oldData.notifications?.map((notif) =>
              notif.id === notificationId ? { ...notif, isRead: true } : notif
            ),
            unreadCount: Math.max(0, (oldData.unreadCount || 0) - 1),
          };
        }
      );

      // 개별 읽음 처리 API 호출
      try {
        await markAsReadMutation.mutateAsync({
          notificationId,
        });
      } catch (error) {
        // 실패 시 롤백
        queryClient.invalidateQueries({
          queryKey: notificationsKeys.getNotifications({ page: 0, size: 50 }),
        });
      }
    },
    [queryClient, router, markAsReadMutation]
  );

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="mt-12 min-h-screen bg-white">
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="border-b border-white bg-white p-4 first:border-t"
            >
              <div className="mb-2">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="mb-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          알림을 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  const notifications = notificationsData?.notifications || [];

  return (
    <div className="mt-12 min-h-screen bg-white">
      {notifications.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Typography font="noto" variant="body2R" className="text-gray-500">
            알림이 없습니다.
          </Typography>
        </div>
      ) : (
        <div className="space-y-0">
          {notifications.map((notification) => {
            const isRead = notification.isRead || false;
            const categoryLabel = getNotificationTypeLabel(notification.type);
            const message = notification.message || "";
            const createdAt = notification.createdAt;

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full border-b border-white px-5 py-6 text-left transition-colors first:border-t ${
                  isRead ? "bg-white" : "bg-main-50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Typography
                    font="noto"
                    variant="body3R"
                    className="text-gray-600"
                  >
                    {categoryLabel}
                  </Typography>
                  {createdAt && (
                    <div>
                      <Typography
                        font="noto"
                        variant="body3R"
                        className="text-gray-500"
                      >
                        {getTimeAgo(createdAt)}
                      </Typography>
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <Typography
                    font="noto"
                    variant="body1M"
                    className="line-clamp-2 text-gray-950"
                  >
                    {message}
                  </Typography>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
