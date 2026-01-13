"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ExtendedRecordMap } from "notion-types";
import { NotionRenderer } from "react-notion-x";
import "react-notion-x/src/styles.css";
import { InquiryFloatingButton } from "@/components/shared/inquiry/InquiryFloatingButton";
import { Typography } from "@/components/shared/typography";
import Icon from "@/components/shared/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { useGetAnnouncementsById } from "@/hooks/generated/announcements-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { getTimeAgo } from "@/utils/shared/date";
import { shareContent } from "@/utils/shared/share";

/**
 * @description 공지사항 상세 페이지
 */
const AnnouncementDetailPage = () => {
  const params = useParams();
  const pageId = params.id as string;

  const [shouldLoadNotion, setShouldLoadNotion] = useState(false);

  // TopBar 제어
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 공지사항 상세 정보 조회
  const {
    data: announcementData,
    isLoading,
    error,
  } = useGetAnnouncementsById({
    request: { pageId },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      return data.announcement || null;
    },
  });

  // 공유하기 기능
  const handleShare = useCallback(async () => {
    if (!announcementData) return;

    const shareTitle = announcementData.title || "공지사항";
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";

    await shareContent({
      title: shareTitle,
      text: shareTitle,
      url: shareUrl,
    });
  }, [announcementData]);

  // 공지사항 데이터 로드 시 TopBar title과 rightSlot 설정
  useEffect(() => {
    if (!announcementData) return;
    // 공유하기 버튼
    const shareButton = (
      <button
        onClick={handleShare}
        className="flex h-10 w-10 items-center justify-center"
        aria-label="공유하기"
      >
        <Icon
          src={IMAGE_URL.ICON.share.url}
          width={24}
          height={24}
          className="text-gray-600"
        />
      </button>
    );
    setRightSlot(shareButton);

    // 언마운트 시 TopBar 초기화
    return () => {
      resetTopBar();
    };
  }, [announcementData, setRightSlot, resetTopBar, handleShare]);

  // 공지사항 상세 정보가 로드된 후 일정 시간 지연 후 Notion 데이터 로드
  useEffect(() => {
    if (!announcementData || shouldLoadNotion) return;

    // 공지사항 상세 정보가 로드된 후 500ms 지연 후 Notion 데이터 로드
    const timer = setTimeout(() => {
      setShouldLoadNotion(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [announcementData, shouldLoadNotion]);

  // Notion 데이터 조회 (지연 로드)
  const { data: notionRecordMap } = useQuery<ExtendedRecordMap, Error>({
    queryKey: ["notion-announcement-blocks", pageId],
    queryFn: async () => {
      const response = await fetch(`/api/notion/${pageId}/blocks`);
      if (!response.ok) {
        throw new Error(`Notion API 요청 실패: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data as ExtendedRecordMap;
    },
    enabled: shouldLoadNotion,
  });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          데이터를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  if (isLoading || !announcementData) {
    return (
      <div className="mt-12 min-h-screen bg-white">
        <div className="space-y-6 p-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-12">
      {/* 제목 및 작성일시 */}
      <div className="w-full bg-white px-4 pt-4">
        <Typography as="h1" font="noto" variant="title5" className="mb-3">
          {announcementData.title || "-"}
        </Typography>
        {announcementData.createdAt && (
          <div className="mb-4">
            <Typography
              font="noto"
              variant="caption1R"
              className="text-gray-500"
            >
              {getTimeAgo(announcementData.createdAt)}
            </Typography>
          </div>
        )}
      </div>

      {/* Notion 컨텐츠 */}
      <div className="w-full bg-white pb-4">
        {notionRecordMap ? (
          <div>
            <NotionRenderer
              recordMap={notionRecordMap}
              fullPage={false}
              darkMode={false}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
            <Typography font="noto" variant="body2R" className="text-gray-500">
              컨텐츠를 불러오는 중...
            </Typography>
          </div>
        )}
      </div>

      {/* 문의하기 플로팅 버튼 */}
      <InquiryFloatingButton />
    </div>
  );
};

export default AnnouncementDetailPage;
