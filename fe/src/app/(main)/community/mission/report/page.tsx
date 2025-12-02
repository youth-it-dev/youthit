"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ReportReasonPage } from "@/components/community/ReportReasonPage";
import {
  usePostMissionsPostsReportById,
  usePostMissionsPostsCommentsReportByTwoIds,
} from "@/hooks/generated/missions-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { getErrorMessage } from "@/utils/shared/error";
import { showToast } from "@/utils/shared/toast";

type MissionReportTargetType = "post" | "comment";

/**
 * @description 미션 인증글/댓글 신고 공통 페이지 콘텐츠
 */
const MissionReportPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const targetType = searchParams.get(
    "targetType"
  ) as MissionReportTargetType | null;
  const targetId = searchParams.get("targetId") || "";
  const postId = searchParams.get("postId") || "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const missionId = searchParams.get("missionId") || "";

  const { mutateAsync: reportPostAsync, isPending: isPostReporting } =
    usePostMissionsPostsReportById();
  const { mutateAsync: reportCommentAsync, isPending: isCommentReporting } =
    usePostMissionsPostsCommentsReportByTwoIds();

  const isReporting = isPostReporting || isCommentReporting;

  const setHideTopBar = useTopBarStore((state) => state.setHideTopBar);

  // 공통 헤더 숨기기/보이기 관리
  useEffect(() => {
    setHideTopBar(true);
    return () => {
      setHideTopBar(false);
    };
  }, [setHideTopBar]);

  // 뒤로가기 핸들러
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // 신고 완료 처리 (API 연동)
  const handleSubmit = useCallback(
    async (reportReason: string) => {
      // 기본 필수 값 체크
      if (!targetType || !targetId || !targetUserId || !missionId) {
        showToast("신고 정보가 올바르지 않습니다.");
        return;
      }

      // 댓글 신고인 경우에는 postId도 필수
      if (targetType === "comment" && !postId) {
        showToast("댓글 신고 정보가 올바르지 않습니다.");
        return;
      }

      try {
        if (targetType === "post") {
          await reportPostAsync({
            postId: targetId,
            data: {
              targetUserId,
              reportReason,
              missionId,
            },
          });
        } else if (targetType === "comment") {
          await reportCommentAsync({
            postId,
            commentId: targetId,
            data: {
              targetUserId,
              reportReason,
              missionId,
            },
          });
        }

        showToast("신고가 완료되었습니다.");
        router.back();
      } catch (error) {
        const errorMessage = getErrorMessage(
          error,
          "신고 처리 중 오류가 발생했습니다."
        );
        showToast(errorMessage);
      }
    },
    [
      targetType,
      targetId,
      postId,
      targetUserId,
      missionId,
      reportPostAsync,
      reportCommentAsync,
      router,
    ]
  );

  return (
    <ReportReasonPage
      onBack={handleBack}
      onSubmit={handleSubmit}
      isSubmitting={isReporting}
    />
  );
};

/**
 * @description 미션 인증글/댓글 신고 공통 페이지
 */
const MissionReportPage = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <MissionReportPageContent />
    </Suspense>
  );
};

export default MissionReportPage;
