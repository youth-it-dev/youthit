"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ReportReasonPage } from "@/components/community/ReportReasonPage";
import { useGetMissionsPostsById } from "@/hooks/generated/missions-hooks";
import { usePostReportcontent } from "@/hooks/generated/reports-hooks";
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
  const missionId = searchParams.get("missionId") || "";

  // 미션 인증글 상세 조회 (authorId 가져오기용)
  const { data: postData } = useGetMissionsPostsById({
    request: {
      postId: targetType === "post" ? targetId : postId,
    },
    enabled: targetType === "post" && !!targetId,
  });

  const authorId = postData?.authorId || "";

  const { mutateAsync: reportContentAsync, isPending: isReporting } =
    usePostReportcontent();

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
      if (!targetType || !targetId || !missionId) {
        showToast("신고 정보가 올바르지 않습니다.");
        return;
      }

      // 게시글 신고인 경우 authorId 필수
      if (targetType === "post" && !authorId) {
        showToast(
          "인증글 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }

      // 댓글 신고인 경우에는 postId도 필수
      if (targetType === "comment" && !postId) {
        showToast("댓글 신고 정보가 올바르지 않습니다.");
        return;
      }

      try {
        if (targetType === "post") {
          await reportContentAsync({
            data: {
              targetType: "post",
              targetId,
              targetUserId: authorId,
              missionId,
              reportReason,
            },
          });
        } else if (targetType === "comment") {
          // 댓글 신고는 기존 방식 유지 (targetUserId는 쿼리 파라미터에서 받음)
          const targetUserId = searchParams.get("targetUserId") || "";
          if (!targetUserId) {
            showToast("댓글 신고 정보가 올바르지 않습니다.");
            return;
          }
          await reportContentAsync({
            data: {
              targetType: "comment",
              targetId,
              targetUserId,
              missionId,
              reportReason,
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
      authorId,
      missionId,
      searchParams,
      reportContentAsync,
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
