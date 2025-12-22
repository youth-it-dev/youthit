"use client";

import { useEffect, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { QnAList } from "@/components/shared/qna/QnAList";
import { useRequireAuth } from "@/hooks/auth/useRequireAuth";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";

/**
 * @description 프로그램 QnA 댓글 페이지
 */
const ProgramCommentsPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const programId = params.id as string;
  const expandQnaId = searchParams.get("expandQnaId");

  const { user, isReady } = useRequireAuth();
  const setTitle = useTopBarStore((state) => state.setTitle);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 사용자 정보 조회
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
    enabled: isReady && !!user,
  });

  const userName = userData?.nickname || "";

  // TopBar 설정
  useEffect(() => {
    setTitle("문의");
    return () => {
      resetTopBar();
    };
  }, [setTitle, resetTopBar]);

  // 특정 QnA의 답글을 펼치기 위한 처리
  // QnAList 컴포넌트에서 expandQnaId를 받아서 처리할 수 있도록 해야 함
  // 일단 기본적으로 모든 답글을 펼칠 수 있도록 설정

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-12">
      <QnAList
        pageId={programId}
        pageType="program"
        userName={userName}
        profileImageUrl={userData?.profileImageUrl}
        showLike={true}
        showInput={true}
        expandQnaId={expandQnaId}
      />
    </div>
  );
};

export default ProgramCommentsPage;
