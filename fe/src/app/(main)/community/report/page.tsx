"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ReportReasonPage } from "@/components/community/ReportReasonPage";
import { LINK_URL } from "@/constants/shared/_link-url";
import { usePostReportcontent } from "@/hooks/generated/reports-hooks";
import { getCurrentUser } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { hasAuthCookie, removeAuthCookie } from "@/utils/auth/auth-cookie";

import { getErrorMessage } from "@/utils/shared/error";
import { showToast } from "@/utils/shared/toast";

/**
 * @description 신고 페이지 콘텐츠 (useSearchParams 사용)
 */
const ReportPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const targetType = searchParams.get("targetType") as
    | "post"
    | "comment"
    | null;
  const targetId = searchParams.get("targetId") || "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const communityId = searchParams.get("communityId") || "";

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
      if (!targetType || !targetId || !targetUserId) {
        showToast("신고 정보가 올바르지 않습니다.");
        return;
      }

      try {
        await reportContentAsync({
          data: {
            targetType,
            targetId,
            targetUserId,
            communityId: communityId || undefined,
            reportReason,
          },
        });

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
      targetUserId,
      communityId,
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
 * @description 신고 페이지
 * - 게시글/댓글 신고 기능
 * - 신고 사유 선택 및 직접 작성
 * 페이지 레벨에서 동기적으로 인증 체크하여 스켈레톤이 보이지 않도록 합니다.
 */
const ReportPage = () => {
  const hasRedirectedRef = useRef(false);

  const initialHasCookie =
    typeof document !== "undefined" ? hasAuthCookie() : false;
  const initialCurrentUser =
    typeof window !== "undefined" ? getCurrentUser() : null;

  const shouldRedirect = !initialHasCookie && !initialCurrentUser;

  useLayoutEffect(() => {
    if (
      shouldRedirect &&
      typeof window !== "undefined" &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      if (initialHasCookie) {
        removeAuthCookie();
      }
      window.location.replace(LINK_URL.LOGIN);
    }
  }, [shouldRedirect, initialHasCookie]);

  if (shouldRedirect) {
    return null;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ReportPageContent />
    </Suspense>
  );
};

export default ReportPage;
