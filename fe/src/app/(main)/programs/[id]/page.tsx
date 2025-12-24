"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import type { ExtendedRecordMap } from "notion-types";
import { NotionRenderer } from "react-notion-x";
import "react-notion-x/src/styles.css";
import { QnAList } from "@/components/shared/qna/QnAList";
import { Typography } from "@/components/shared/typography";
import Icon from "@/components/shared/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { PROGRAM_DETAIL_TABS } from "@/constants/shared/_detail-tabs";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { useGetProgramsById } from "@/hooks/generated/programs-hooks";
import { useGetPrograms } from "@/hooks/generated/programs-hooks";
import {
  useGetUsersMe,
  useGetUsersMeParticipatingCommunities,
} from "@/hooks/generated/users-hooks";
import { onAuthStateChange } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type {
  ProgramDetailResponse,
  ProgramListResponse,
} from "@/types/generated/api-schema";
import { cn } from "@/utils/shared/cn";
import { formatDateRange, getTimeAgo } from "@/utils/shared/date";
import { shareContent } from "@/utils/shared/share";

const MAX_INQUIRIES_DISPLAY = 3;

/**
 * @description 프로그램 상세 페이지
 */
const ProgramDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [shouldLoadNotion, setShouldLoadNotion] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "reviews" | "faq">(
    "detail"
  );
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const detailSectionRef = useRef<HTMLDivElement>(null);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);
  const faqSectionRef = useRef<HTMLDivElement>(null);

  // TopBar 제어
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // Firebase Auth 상태 추적
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  // 프로그램 상세 정보 조회
  const {
    data: programDetailData,
    isLoading,
    error,
  } = useGetProgramsById({
    request: { programId },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      const responseData = data as ProgramDetailResponse["data"];
      return responseData?.program || null;
    },
  });

  // 공유하기 기능
  const handleShare = useCallback(async () => {
    if (!programDetailData) return;

    const programTitle =
      programDetailData.title || programDetailData.programName || "한끗루틴";
    const shareTitle = `${programTitle} 모집`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareText = programDetailData.description || shareTitle;

    await shareContent({
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    });
  }, [programDetailData]);

  // 프로그램 데이터 로드 시 TopBar title과 rightSlot 설정
  useEffect(() => {
    if (!programDetailData) return;

    // 공유하기 버튼
    const shareButton = (
      <button onClick={handleShare} className="flex" aria-label="공유하기">
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
  }, [programDetailData, setRightSlot, resetTopBar, handleShare]);

  // 또는: 윗 컨텐츠 표시 후 일정 시간 지연 후 로드
  useEffect(() => {
    if (!programDetailData || shouldLoadNotion) return;

    // 프로그램 상세 정보가 로드된 후 500ms 지연 후 Notion 데이터 로드
    const timer = setTimeout(() => {
      setShouldLoadNotion(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [programDetailData, shouldLoadNotion]);

  // Notion 데이터 조회 (지연 로드)
  const { data: notionRecordMap } = useQuery<ExtendedRecordMap, Error>({
    queryKey: ["notion-program-blocks", programId],
    queryFn: async () => {
      const response = await fetch(`/api/notion/${programId}/blocks`);
      if (!response.ok) {
        throw new Error(`Notion API 요청 실패: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data as ExtendedRecordMap;
    },
    enabled: shouldLoadNotion,
  });

  // 모집 중인 프로그램 목록 조회 (추천 배너용)
  const { data: recommendedProgramsData } = useGetPrograms({
    request: {
      recruitmentStatus: "ongoing",
      programType: "ROUTINE",
      pageSize: 5,
    },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return [];
      }
      const responseData = data as ProgramListResponse["data"];
      // 현재 프로그램 제외
      return responseData?.programs?.filter((p) => p.id !== programId) || [];
    },
  });

  // 내가 참여 중인 커뮤니티 조회 (신청 상태 확인용)
  // 로그인된 사용자일 때만 API 호출
  const { data: participatingCommunitiesData } =
    useGetUsersMeParticipatingCommunities({
      enabled: Boolean(currentUser),
      staleTime: 0,
      refetchOnWindowFocus: true,
    });

  // 오늘 날짜가 신청 기간 내에 있는지 확인
  const isRecruitmentPeriodActive = useMemo(() => {
    if (
      !programDetailData?.recruitmentStartDate ||
      !programDetailData?.recruitmentEndDate
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 시간 부분 제거

    const startDate = new Date(programDetailData.recruitmentStartDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(programDetailData.recruitmentEndDate);
    endDate.setHours(23, 59, 59, 999); // 종료일은 하루 끝까지

    return today >= startDate && today <= endDate;
  }, [
    programDetailData?.recruitmentStartDate,
    programDetailData?.recruitmentEndDate,
  ]);

  // 선착순 마감 여부 확인
  const isFirstComeDeadlineReached = useMemo(() => {
    if (!programDetailData) return false;

    const isFirstComeEnabled = programDetailData.isFirstComeDeadlineEnabled;
    const firstComeCapacity = programDetailData.firstComeCapacity;
    const approvedMembersCount = programDetailData.approvedMembersCount;

    // 선착순 제한이 활성화되어 있고, 승인된 멤버수가 제한 인원 이상인 경우
    if (
      isFirstComeEnabled &&
      firstComeCapacity !== undefined &&
      approvedMembersCount !== undefined &&
      approvedMembersCount >= firstComeCapacity
    ) {
      return true;
    }

    return false;
  }, [
    programDetailData?.isFirstComeDeadlineEnabled,
    programDetailData?.firstComeCapacity,
    programDetailData?.approvedMembersCount,
  ]);

  // 현재 프로그램의 신청 상태 확인
  const isApplied = (() => {
    if (!participatingCommunitiesData || !programDetailData) return false;
    const programType = programDetailData.programType?.toLowerCase();
    let targetGroup:
      | { items?: Array<{ id?: string; status?: string }> }
      | undefined;

    switch (programType) {
      case "한끗루틴":
      case "routine":
        targetGroup = participatingCommunitiesData.routine;
        break;
      case "월간소모임":
      case "gathering":
        targetGroup = participatingCommunitiesData.gathering;
        break;
      case "tmi":
        targetGroup = participatingCommunitiesData.tmi;
        break;
      default:
        return false;
    }

    if (!targetGroup?.items) return false;

    const foundItem = targetGroup.items.find(
      // TEMP: 미션을 통해 진입한 일부 화면의 경우, 프로그램 ID에 하이픈이 없는 경우가 있음
      (item) => item.id?.replace(/-/g, "") === programId.replace(/-/g, "")
    ) as { status?: string } | undefined;
    return !!foundItem;
  })();

  // 탭에 해당하는 섹션으로 스크롤하는 함수
  const scrollToTabSection = useCallback(
    (tab: "detail" | "reviews" | "faq") => {
      let targetRef: React.RefObject<HTMLDivElement | null> | null = null;

      switch (tab) {
        case "detail":
          targetRef = detailSectionRef;
          break;
        case "reviews":
          targetRef = reviewsSectionRef;
          break;
        case "faq":
          targetRef = faqSectionRef;
          break;
      }

      if (!targetRef?.current) return;

      const targetElement = targetRef.current;

      // scrollIntoView 사용 (MDN 표준 메서드)
      // block: 'start' - 요소의 상단이 뷰포트 상단에 맞춰짐
      // behavior: 'smooth' - 부드러운 스크롤
      // scroll-margin-top CSS 속성으로 offset 조정됨
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    []
  );

  // 탭 클릭 시 해당 섹션으로 스크롤
  const handleTabClick = useCallback(
    (tab: "detail" | "reviews" | "faq") => {
      setActiveTab(tab);

      // DOM 업데이트 완료 후 스크롤 실행
      // setTimeout을 사용하여 상태 업데이트 후 DOM 렌더링 완료 대기
      setTimeout(() => {
        scrollToTabSection(tab);
      }, 0);
    },
    [scrollToTabSection]
  );

  // URL 해시에 따라 초기 탭 설정
  useEffect(() => {
    if (typeof window !== "undefined" && programDetailData) {
      const hash = window.location.hash.replace("#", "");
      if (hash === "detail" || hash === "reviews" || hash === "faq") {
        setActiveTab(hash);
        // DOM 렌더링 완료 후 스크롤
        setTimeout(() => {
          scrollToTabSection(hash);
        }, 100);
      }
    }
  }, [programDetailData, scrollToTabSection]);

  // 프로그램 타입에 따른 일러스트 배경색
  const getProgramBgColor = (programType?: string): string => {
    switch (programType) {
      case "ROUTINE":
        return "bg-pink-100";
      case "TMI":
        return "bg-green-100";
      case "GATHERING":
        return "bg-orange-100";
      default:
        return "bg-blue-100";
    }
  };

  // 프로그램 타입에 따른 일러스트 아이콘
  const getProgramIcon = (programType?: string): string => {
    switch (programType) {
      case "ROUTINE":
        return "🎵";
      case "TMI":
        return "🍿";
      case "GATHERING":
        return "✂️";
      default:
        return "📋";
    }
  };

  // 모집 상태 텍스트 변환
  const getRecruitmentStatusText = (status?: string): string => {
    switch (status) {
      case "모집 전":
        return "모집 전";
      case "모집 중":
        return "모집 중";
      case "모집 완료":
        return "모집 완료";
      case "모집 취소":
        return "모집 취소";
      default:
        return "-";
    }
  };

  // 모집 상태 배경색 클래스
  const getRecruitmentStatusBgClass = (status?: string): string => {
    switch (status) {
      case "모집 중":
        return "bg-pink-100 text-pink-700";
      case "모집 전":
        return "bg-gray-100 text-gray-700";
      case "모집 완료":
        return "bg-gray-100 text-gray-700";
      case "모집 취소":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // 사용자 정보 조회 (QnA 작성자 이름용)
  // 주의: 조건부 return 이전에 Hook을 호출해야 React Hooks 규칙을 준수합니다
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
    enabled: !!currentUser,
  });

  const userName = userData?.nickname || "";

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          데이터를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  if (isLoading || !programDetailData) {
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

  const program = programDetailData;
  const faqList = program.faqList || [];

  return (
    <div className="min-h-screen bg-white pt-12 pb-24">
      <div className="relative aspect-square w-full max-w-[470px] overflow-hidden">
        {/* 썸네일 이미지 우선순위: thumbnail.url > coverImage > 일러스트 */}
        {program.thumbnail?.[0]?.url ? (
          <img
            src={program.thumbnail[0].url}
            alt={program.title || program.programName || "프로그램 썸네일"}
            className="h-full w-full object-cover"
          />
        ) : program.coverImage ? (
          <img
            src={program.coverImage}
            alt={program.title || program.programName || "프로그램 커버 이미지"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`relative flex h-full items-center justify-center ${getProgramBgColor(program.programType)}`}
          >
            {/* 일러스트 영역 */}
            <div className="text-8xl">
              {getProgramIcon(program.programType)}
            </div>
          </div>
        )}
      </div>

      <div className="w-full bg-white px-4 pt-5">
        <Typography
          font="noto"
          variant="label1M"
          className="bg-main-500 inline-flex h-[28px] items-center rounded-lg px-2.5 py-0.5 text-center text-white"
        >
          • {program.recruitmentStatus}
        </Typography>
      </div>

      {/* 제목 및 설명 */}
      <div className="w-full bg-white px-4 pt-2">
        <Typography as="h2" font="noto" variant="title5" className="mb-2">
          {program.notionPageTitle ||
            program.title ||
            program.programName ||
            "-"}
        </Typography>
        <Typography font="noto" variant="body2R" className="text-gray-600">
          {program.description || "-"}
        </Typography>
      </div>

      {/* 주요 정보 박스 */}
      <div className="w-full bg-white px-4 pt-6 pb-15">
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 px-3 py-4">
          {program.recruitmentStartDate && program.recruitmentEndDate && (
            <div className="flex items-start justify-between gap-4">
              <Typography
                font="noto"
                variant="label1B"
                className="shrink-0 text-gray-700"
              >
                신청 기간
              </Typography>
              <Typography
                font="noto"
                variant="label1R"
                className="flex-1 text-gray-600"
              >
                {formatDateRange(
                  program.recruitmentStartDate,
                  program.recruitmentEndDate
                )}
              </Typography>
            </div>
          )}
          {program.startDate && program.endDate && (
            <div className="flex items-start justify-between gap-4">
              <Typography
                font="noto"
                variant="label1B"
                className="shrink-0 text-gray-700"
              >
                활동 기간
              </Typography>
              <Typography
                font="noto"
                variant="label1R"
                className="flex-1 text-gray-600"
              >
                {formatDateRange(program.startDate, program.endDate)}
              </Typography>
            </div>
          )}
          {program.targetAudience && (
            <div className="flex items-start justify-between gap-4">
              <Typography
                font="noto"
                variant="label1B"
                className="shrink-0 text-gray-700"
              >
                참여 대상
              </Typography>
              <Typography
                font="noto"
                variant="label1R"
                className="flex-1 text-gray-600"
              >
                {program.targetAudience}
              </Typography>
            </div>
          )}
        </div>
        <Typography
          font="noto"
          variant="label2R"
          className="mt-4 text-gray-400"
        >
          {program.notes}
        </Typography>
      </div>

      {/* 탭 네비게이션 */}
      <div ref={tabRef} className="sticky top-12 z-10 bg-white">
        <div className="flex px-5">
          {PROGRAM_DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex-1 border-b-2 px-4 py-3 text-center",
                activeTab === tab.id
                  ? "border-gray-950 text-gray-950"
                  : "border-transparent text-gray-400"
              )}
            >
              <Typography font="noto" variant="body3B">
                {tab.label}
              </Typography>
            </button>
          ))}
        </div>
      </div>

      {/* 상세 설명 탭 */}
      <div
        id="detail"
        ref={detailSectionRef}
        style={{ scrollMarginTop: "120px" }}
      >
        {notionRecordMap ? (
          <div className="notion-page">
            <NotionRenderer
              recordMap={notionRecordMap}
              fullPage={false}
              darkMode={false}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
            <Typography font="noto" variant="body2R" className="text-gray-500">
              컨텐츠를 불러올 수 없습니다.
            </Typography>
          </div>
        )}
      </div>

      {/* 프로그램 후기 탭 */}
      <div
        id="reviews"
        ref={reviewsSectionRef}
        className="p-4"
        style={{ scrollMarginTop: "120px" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <Typography as="h3" font="noto" variant="heading3B">
            참여했던 친구들의 후기에요!
          </Typography>
          <Link href={`/community?category=한끗루틴`} className="text-pink-500">
            <Typography font="noto" variant="body3R">
              피드 보러가기 →
            </Typography>
          </Link>
        </div>
        {/* TODO: 후기 목록 구현 */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <Typography font="noto" variant="body2R" className="text-gray-500">
              아직 후기가 없습니다.
            </Typography>
          </div>
        </div>
      </div>

      {/* 자주 묻는 질문 탭 */}
      <div
        id="faq"
        ref={faqSectionRef}
        className="p-4"
        style={{ scrollMarginTop: "120px" }}
      >
        <Typography as="h3" font="noto" variant="heading3B" className="mb-4">
          자주 묻는 질문이에요!
        </Typography>
        <div className="space-y-2">
          {faqList.length > 0 ? (
            faqList.map((faq) => (
              <details
                key={faq.id}
                className="rounded-lg border border-gray-200 bg-white"
                open={expandedFaqId === faq.id}
                onToggle={(e) => {
                  setExpandedFaqId(
                    e.currentTarget.open ? faq.id || null : null
                  );
                }}
              >
                <summary className="flex cursor-pointer items-center justify-between p-4">
                  <Typography font="noto" variant="body3R">
                    {faq.title || "-"}
                  </Typography>
                  <svg
                    className={cn(
                      "h-5 w-5 transition-transform",
                      expandedFaqId === faq.id && "rotate-180"
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="border-t border-gray-200 p-4">
                  {faq.content && faq.content.length > 0 ? (
                    <div className="space-y-2">
                      {faq.content.map((item, index) => (
                        <Typography
                          key={index}
                          font="noto"
                          variant="body2R"
                          className="text-gray-700"
                        >
                          {item.text || ""}
                        </Typography>
                      ))}
                    </div>
                  ) : (
                    <Typography
                      font="noto"
                      variant="body2R"
                      className="text-gray-500"
                    >
                      내용이 없습니다.
                    </Typography>
                  )}
                </div>
              </details>
            ))
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-500"
              >
                아직 등록된 질문이 없습니다.
              </Typography>
            </div>
          )}
        </div>
      </div>

      {/* 최하단: 댓글/문의 섹션 */}
      <div className="border-t border-gray-200 bg-white">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <Typography as="h3" font="noto" variant="heading3B">
              더 궁금한 점이 있으신가요?
            </Typography>
            <Link
              href={`/programs/${programId}/comments`}
              className="text-pink-500"
            >
              <Typography font="noto" variant="body3R">
                문의 남기기 →
              </Typography>
            </Link>
          </div>
        </div>

        {/* QnA 목록 (최대 3개, 답글 1개, 좋아요 숨김) */}
        <QnAList
          pageId={programId}
          pageType="program"
          userName={userName}
          maxDisplay={3}
          maxReplies={1}
          showLike={false}
          showInput={false}
          onShowMoreClick={() => {
            router.push(`/programs/${programId}/comments`);
          }}
        />
      </div>

      {/* 프로그램 추천 배너 */}
      {recommendedProgramsData && recommendedProgramsData.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <Typography as="h3" font="noto" variant="heading3B" className="mb-2">
            현재 모집 중인 프로그램이에요!
          </Typography>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recommendedProgramsData.map((recommendedProgram) => (
              <Link
                key={recommendedProgram.id}
                href={`/programs/${recommendedProgram.id || ""}`}
                className="flex min-w-[240px] flex-shrink-0 flex-col overflow-hidden rounded-lg border-2 border-pink-300 bg-white"
              >
                {/* 일러스트 영역 */}
                <div
                  className={`relative flex h-32 items-center justify-center ${getProgramBgColor(recommendedProgram.programType)}`}
                >
                  <div className="text-6xl">
                    {getProgramIcon(recommendedProgram.programType)}
                  </div>
                </div>
                {/* 텍스트 영역 */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <Typography
                      as="h4"
                      font="noto"
                      variant="heading3B"
                      className="mb-2"
                    >
                      {recommendedProgram.title ||
                        recommendedProgram.programName ||
                        "-"}
                    </Typography>
                    <Typography
                      font="noto"
                      variant="body3R"
                      className="line-clamp-2 text-gray-600"
                    >
                      {recommendedProgram.description || "-"}
                    </Typography>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 하단 고정 버튼 */}
      <div className="pb-safe fixed bottom-0 z-20 w-full max-w-[470px] bg-transparent p-4">
        {isApplied ? (
          <button
            disabled
            className="block w-full cursor-not-allowed rounded-lg bg-gray-300 px-4 py-3 text-center"
          >
            <Typography font="noto" variant="body3R" className="text-gray-600">
              신청완료
            </Typography>
          </button>
        ) : (
          <Link
            href={`/programs/${programId}/apply`}
            className={cn(
              "bg-main-600 block w-full rounded-lg px-4 py-3 text-center text-white",
              (!isRecruitmentPeriodActive || isFirstComeDeadlineReached) &&
                "pointer-events-none cursor-not-allowed opacity-50"
            )}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              {isFirstComeDeadlineReached
                ? "모집이 마감되었어요"
                : isRecruitmentPeriodActive
                  ? "신청하기"
                  : "모집 기간이 아니에요"}
            </Typography>
          </Link>
        )}
      </div>
    </div>
  );
};

export default ProgramDetailPage;
