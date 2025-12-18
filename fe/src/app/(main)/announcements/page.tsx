"use client";

import Link from "next/link";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetAnnouncements } from "@/hooks/generated/announcements-hooks";
import { Announcement } from "@/types/generated/api-schema";
import { getTimeAgo } from "@/utils/shared/date";

const filterAnnouncements = (allAnnouncements: Announcement[]) => {
  return allAnnouncements.filter((announcement) => {
    if (!announcement.startDate || !announcement.endDate) return true;
    const startDate = new Date(announcement.startDate);
    const endDate = new Date(announcement.endDate);
    const today = new Date();
    return today >= startDate && today <= endDate;
  });
};

/**
 * @description 공지사항 목록 페이지
 */
const AnnouncementsPage = () => {
  const { data, isLoading, error } = useGetAnnouncements({
    request: {
      pageSize: 50,
    },
    select: (data) => {
      if (!data?.announcements) return { pinned: [], regular: [] };

      const pinned = data.announcements.filter((item) => item.pinned);
      const regular = data.announcements.filter((item) => !item.pinned);

      return { pinned, regular };
    },
  });

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="mt-12 min-h-screen bg-white p-4">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-2">
                <Skeleton className="h-6 w-3/4" />
              </div>
              <div className="mb-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
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
          공지사항을 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  const pinnedAnnouncements = filterAnnouncements(data?.pinned || []);
  const regularAnnouncements = filterAnnouncements(data?.regular || []);

  const allAnnouncements = [...pinnedAnnouncements, ...regularAnnouncements];
  if (!allAnnouncements.length) {
    return (
      <div className="mt-12 min-h-screen bg-white p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <Typography font="noto" variant="body2R" className="text-gray-500">
            등록된 공지사항이 없습니다.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 min-h-screen bg-white p-4">
      {/* 고정된 공지 */}
      {pinnedAnnouncements.length > 0 && (
        <div className="mb-6">
          <div className="space-y-3">
            {pinnedAnnouncements.map((announcement) => (
              <Link
                key={announcement.id}
                href={`/announcements/${announcement.id}`}
                className="block rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4 transition-colors hover:bg-yellow-100"
              >
                <div className="mb-2">
                  <Typography
                    as="h3"
                    font="noto"
                    variant="heading3B"
                    className="text-gray-900"
                  >
                    {announcement.title || "-"}
                  </Typography>
                </div>
                {announcement.startDate && (
                  <div className="mb-3">
                    <Typography
                      font="noto"
                      variant="caption1R"
                      className="text-gray-500"
                    >
                      {getTimeAgo(announcement.startDate)}
                    </Typography>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 일반 공지 */}
      <div className="space-y-3">
        {regularAnnouncements.map((announcement) => (
          <Link
            key={announcement.id}
            href={`/announcements/${announcement.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
          >
            <div className="mb-2">
              <Typography
                as="h3"
                font="noto"
                variant="heading3B"
                className="text-gray-900"
              >
                {announcement.title || "-"}
              </Typography>
            </div>
            {announcement.startDate && (
              <div>
                <Typography
                  font="noto"
                  variant="caption1R"
                  className="text-gray-500"
                >
                  {getTimeAgo(announcement.startDate)}
                </Typography>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementsPage;
