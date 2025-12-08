"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Target } from "lucide-react";
import { ActiveMissionCard } from "@/components/mission/active-mission-card";
import { MissionCertificationCard } from "@/components/mission/mission-certification-card";
import { MissionCertificationSuccessModal } from "@/components/mission/mission-certification-success-modal";
import { MissionRecommendationCard } from "@/components/mission/mission-recommendation-card";
import MissionReviewCard from "@/components/mission/mission-review-card";
import { RecommendedMissionCard } from "@/components/mission/recommended-mission-card";
import { Typography } from "@/components/shared/typography";
import { Button } from "@/components/shared/ui/button";
import HorizontalScrollContainer from "@/components/shared/ui/horizontal-scroll-container";
import { InfoIconWithTooltip } from "@/components/shared/ui/info-icon-with-tooltip";
import Modal from "@/components/shared/ui/modal";
import { MoreButton } from "@/components/shared/ui/more-button";
import { ProgressGauge } from "@/components/shared/ui/progress-gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { missionsKeys } from "@/constants/generated/query-keys";
import {
  QUIT_MISSION_ERROR_MESSAGE,
  QUIT_MISSION_SUCCESS_MESSAGE,
  TOAST_DELAY_MS,
  TOAST_DURATION_MS,
} from "@/constants/mission/_mission-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetMissions,
  useGetMissionsMe,
  useGetMissionsStats,
  usePostMissionsQuitById,
} from "@/hooks/generated/missions-hooks";
import { useGetPrograms } from "@/hooks/generated/programs-hooks";
import { useInfiniteMissionPosts } from "@/hooks/mission/useInfiniteMissionPosts";
import useToggle from "@/hooks/shared/useToggle";
import type { ProgramListResponse } from "@/types/generated/api-schema";
import { getNextDay5AM } from "@/utils/shared/date";
import { showToast } from "@/utils/shared/toast";

/**
 * @description 미션 페이지 컨텐츠 (useSearchParams 사용)
 */
const MissionPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {
    isOpen: isQuitMissionConfirmOpen,
    open: openQuitMissionConfirm,
    close: closeQuitMissionConfirm,
  } = useToggle();
  const {
    isOpen: isErrorModalOpen,
    open: openErrorModal,
    close: closeErrorModal,
  } = useToggle();
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const {
    isOpen: isSuccessModalOpen,
    open: openSuccessModal,
    close: closeSuccessModal,
  } = useToggle();
  const [successMissionName, setSuccessMissionName] = useState<string>("");
  const [successPostId, setSuccessPostId] = useState<string | undefined>(
    undefined
  );
  const missionPostsLoadMoreRef = useRef<HTMLDivElement | null>(null);

  // 진행중인 미션 조회 API
  const { data: myMissionsResponse, isLoading: isMissionsMeLoading } =
    useGetMissionsMe({
      request: {},
    });

  // 미션 통계 조회 API
  const { data: missionStatsResponse, isLoading: isStatsLoading } =
    useGetMissionsStats();

  const isLoading = isMissionsMeLoading || isStatsLoading;

  const activeMissions = myMissionsResponse?.missions || [];
  const isOnMission = activeMissions.length > 0;

  // 미션 통계 데이터
  const missionStats = missionStatsResponse || {};
  const todayTotalCount = missionStats.todayTotalCount ?? 0;
  const todayCompletedCount = missionStats.todayCompletedCount ?? 0;
  const consecutiveDays = missionStats.consecutiveDays ?? 0;
  const totalPostsCount = missionStats.totalPostsCount ?? 0;
  // 진행 미션 수: 현재까지 진행한 미션 개수 누적
  const activeMissionCount = totalPostsCount;
  // 남은 미션 수: 오늘의 총 미션 수 - 오늘 완료한 미션 수
  const remainingMission = todayTotalCount - todayCompletedCount;

  /**
   * 미션 관련 쿼리 무효화
   */
  const invalidateMissionQueries = () => {
    queryClient.invalidateQueries({
      queryKey: missionsKeys.getMissionsMe({}),
    });
    queryClient.invalidateQueries({
      queryKey: missionsKeys.getMissionsStats,
    });
  };

  /**
   * 미션 그만두기 성공 처리
   */
  const handleQuitMissionSuccess = () => {
    invalidateMissionQueries();
    closeQuitMissionConfirm();
    setSelectedMissionId(null);
    // 모달이 완전히 닫힌 후 토스트 메시지 표시
    setTimeout(() => {
      showToast(QUIT_MISSION_SUCCESS_MESSAGE, {
        duration: TOAST_DURATION_MS,
      });
    }, TOAST_DELAY_MS);
  };

  /**
   * 미션 그만두기 에러 처리
   */
  const handleQuitMissionError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : QUIT_MISSION_ERROR_MESSAGE;
    setErrorMessage(message);
    openErrorModal();
  };

  // 미션 그만두기 API
  const { mutate: quitMission, isPending: isQuittingMission } =
    usePostMissionsQuitById({
      onSuccess: handleQuitMissionSuccess,
      onError: handleQuitMissionError,
    });

  const handleQuitMission = (missionId: string) => {
    quitMission({ missionId });
  };

  // 추천 미션 목록 조회 API (인기순으로 최대 4개)
  const { data: recommendedMissionsResponse } = useGetMissions({
    request: {
      sortBy: "popular",
    },
  });

  const recommendedMissions =
    recommendedMissionsResponse?.missions?.slice(0, 4) || [];

  // 미션 인증글 목록 무한 스크롤 (친구들이 인증한 미션)
  const {
    data: missionPostsPages,
    isLoading: isMissionPostsLoading,
    error: missionPostsError,
    fetchNextPage: fetchNextMissionPosts,
    hasNextPage: hasNextMissionPosts,
    isFetchingNextPage: isFetchingNextMissionPosts,
  } = useInfiniteMissionPosts({
    sort: "latest",
  });

  const missionPosts = useMemo(() => {
    if (!missionPostsPages?.pages) return [];
    return missionPostsPages.pages.flatMap((page) => page.posts ?? []);
  }, [missionPostsPages]);

  // 프로그램 목록 조회 API
  const { data: programsResponse } = useGetPrograms({
    request: { pageSize: 20 },
  });

  const programs = useMemo(() => {
    if (!programsResponse || typeof programsResponse !== "object") return [];
    const responseData = programsResponse as ProgramListResponse["data"];
    if (
      responseData &&
      "programs" in responseData &&
      Array.isArray(responseData.programs)
    ) {
      return responseData.programs || [];
    }
    return [];
  }, [programsResponse]);

  // 친구들이 인증한 미션 - 무한 스크롤 Intersection Observer
  useEffect(() => {
    if (!hasNextMissionPosts || !missionPostsLoadMoreRef.current) return;

    const target = missionPostsLoadMoreRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          hasNextMissionPosts &&
          !isFetchingNextMissionPosts
        ) {
          fetchNextMissionPosts();
        }
      },
      {
        root: null,
        threshold: 0.1,
      }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
      observer.disconnect();
    };
  }, [hasNextMissionPosts, isFetchingNextMissionPosts, fetchNextMissionPosts]);

  // 이미 처리된 쿼리 파라미터인지 확인하는 ref
  const hasProcessedSuccessParams = useRef(false);

  // 쿼리 파라미터에서 성공 정보 확인 및 모달 표시
  useEffect(() => {
    const success = searchParams.get("success");
    const missionName = searchParams.get("missionName");
    const postId = searchParams.get("postId");

    // 성공 파라미터가 있고 아직 처리하지 않은 경우에만 실행
    if (
      success === "true" &&
      missionName &&
      !hasProcessedSuccessParams.current
    ) {
      hasProcessedSuccessParams.current = true;

      setSuccessMissionName(missionName);
      setSuccessPostId(postId || undefined);
      openSuccessModal();

      // URL에서 쿼리 파라미터 제거 (Next.js router 사용)
      const params = new URLSearchParams(searchParams.toString());
      params.delete("success");
      params.delete("missionName");
      params.delete("postId");
      const newSearch = params.toString();
      const newUrl = newSearch ? `/mission?${newSearch}` : "/mission";
      router.replace(newUrl);
    }
  }, [searchParams, openSuccessModal, router]);

  // 로딩 중일 때는 스켈레톤 표시
  if (isLoading) {
    return (
      <div className="h-full min-h-screen bg-white">
        <div className="p-5">
          {/* 헤더 스켈레톤 */}
          <Skeleton className="h-8 w-64 pb-4" />

          {/* 현재 미션 카드 스켈레톤 */}
          <div className="mt-4">
            <div className="flex w-[99%] shrink-0 flex-col gap-1">
              <div className="w-full rounded-lg bg-white p-4 shadow-sm">
                {/* 상단: 시계 아이콘 + 시간 (왼쪽), 휴지통 아이콘 (오른쪽) */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                {/* 제목 */}
                <Skeleton className="mb-2 h-6 w-48" />
                {/* 설명 */}
                <Skeleton className="mb-4 h-4 w-full" />
                {/* 태그 2개 */}
                <div className="mb-4 flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-lg" />
                  <Skeleton className="h-6 w-20 rounded-lg" />
                </div>
              </div>
              {/* 미션 인증하기 버튼 */}
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* 흰화면 - 미션 진척 현황 */}
        <div className="pb-safe rounded-t-2xl bg-white px-5 py-6">
          {/* 미션 진척 현황 스켈레톤 */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-3 grid grid-cols-[1.2fr_1fr] grid-rows-2 gap-2">
            {/* 왼쪽: 오늘의 미션 인증 현황 (큰 카드, 2행 병합) */}
            <div className="row-span-2 flex flex-col items-center justify-center rounded-lg border border-gray-200 py-2">
              <Skeleton className="mb-3 h-4 w-40" />
              <Skeleton className="mb-2 h-20 w-20 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            {/* 오른쪽 위: 연속 미션일 */}
            <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
              <div className="mb-2 flex items-center gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-3 rounded-full" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-6" />
              </div>
            </div>
            {/* 오른쪽 아래: 진행 미션 수 */}
            <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
              <div className="mb-2 flex items-center gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-3 rounded-full" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-screen bg-white">
      <div className="bg-gray-200 p-5">
        <Typography
          as="span"
          font="noto"
          variant="heading2B"
          className="pb-4 text-gray-950"
        >
          {isOnMission
            ? `오늘의 미션이 ${remainingMission}개 남았어요!`
            : `오늘의 미션을 시작해 볼까요?`}
        </Typography>
        {/* 흰카드 */}
        {isOnMission ? (
          <HorizontalScrollContainer
            className="mt-4"
            containerClassName="flex w-[calc(100%)] gap-3"
            gradientColor="white"
          >
            {activeMissions.map((mission) => {
              const missionNotionPageId = mission.missionNotionPageId || "";
              const missionTitle = mission.missionTitle || "";
              const endTime = mission.startedAt
                ? getNextDay5AM(mission.startedAt)
                : new Date();
              const tags = mission.detailTags
                ? mission.detailTags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                : [];

              const handleDelete = () => {
                if (!missionNotionPageId) {
                  return;
                }

                setSelectedMissionId(missionNotionPageId);
                openQuitMissionConfirm();
              };

              return (
                <div
                  key={mission.id || missionNotionPageId}
                  className="flex w-[99%] max-w-[99%] min-w-[99%] shrink-0 flex-col gap-1"
                >
                  <div className="w-full">
                    <ActiveMissionCard
                      title={missionTitle}
                      tags={tags}
                      endTime={endTime}
                      onDelete={handleDelete}
                      onClick={() => {
                        if (missionNotionPageId) {
                          router.push(
                            `${LINK_URL.MISSION_CERTIFY}?missionId=${missionNotionPageId}`
                          );
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="default"
                    size="default"
                    className="w-full rounded-lg"
                    onClick={() => {
                      if (missionNotionPageId) {
                        router.push(
                          `${LINK_URL.MISSION_CERTIFY}?missionId=${missionNotionPageId}`
                        );
                      }
                    }}
                  >
                    <Typography
                      font="noto"
                      variant="body3B"
                      className="text-white"
                    >
                      미션 인증하기
                    </Typography>
                    <ChevronRight className="h-4 w-4 text-white" />
                  </Button>
                </div>
              );
            })}
          </HorizontalScrollContainer>
        ) : (
          <>
            <MissionRecommendationCard />
            <Button
              variant="default"
              size="default"
              className="mt-1 w-full rounded-lg"
              onClick={() => router.push(LINK_URL.MISSION_LIST)}
            >
              <Typography font="noto" variant="body3B" className="text-white">
                미션 보러가기
              </Typography>
              <ChevronRight className="h-4 w-4 text-white" />
            </Button>
          </>
        )}
      </div>

      {/* 흰화면 */}
      <div className="rounded-t-2xl rounded-tl-xl rounded-tr-xl bg-white px-5 py-6 pb-26">
        {/* 미션 진척 현황 */}
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-gray-400" />
          <Typography font="noto" variant="heading3B" className="text-gray-950">
            미션 진척 현황
          </Typography>
        </div>
        <div className="mt-3 grid grid-cols-[1.2fr_1fr] grid-rows-2 gap-2">
          {/* 왼쪽 큰 패널: 행 2개 병합 */}
          <div className="row-span-2 flex flex-col items-center justify-center rounded-lg border border-gray-200 py-2">
            {/* 왼쪽 패널 내용 */}
            <Typography font="noto" variant="label1R" className="text-gray-950">
              오늘의 미션 인증 현황
            </Typography>
            <ProgressGauge
              total={todayTotalCount}
              completed={todayCompletedCount}
            />
          </div>

          {/* 오른쪽 위 패널 */}
          <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
            {/* 오른쪽 위 패널 내용 */}
            <div className="flex items-center gap-1">
              <Typography
                font="noto"
                variant="label1R"
                className="text-gray-950"
              >
                연속 미션일
              </Typography>
              <InfoIconWithTooltip message="하루도 빠짐없이 매일 미션을 인증한 연속 일수입니다." />
            </div>
            <div className="flex items-center gap-1">
              <Typography
                font="noto"
                variant="heading1B"
                className="text-gray-600"
              >
                {consecutiveDays}
              </Typography>
              <Typography
                font="noto"
                variant="label2R"
                className="text-gray-400"
              >
                일
              </Typography>
            </div>
          </div>

          {/* 오른쪽 아래 패널 */}
          <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
            {/* 오른쪽 아래 패널 내용 */}
            <div className="flex items-center gap-1">
              <Typography
                font="noto"
                variant="label1R"
                className="text-gray-950"
              >
                진행 미션 수
              </Typography>
              <InfoIconWithTooltip message="현재 진행 중인 미션의 개수입니다." />
            </div>
            <div className="flex items-center gap-1">
              <Typography
                font="noto"
                variant="heading1B"
                className="text-gray-600"
              >
                {activeMissionCount}
              </Typography>
              <Typography
                font="noto"
                variant="label2R"
                className="text-gray-400"
              >
                개
              </Typography>
            </div>
          </div>
        </div>
        {/* 미션 진행중인거 없을때 */}
        {!isOnMission && (
          <>
            {/* 친구들이 인증한 미션이에요 */}
            <div className="mt-9 mb-5 flex w-full items-center justify-between">
              <Typography
                font="noto"
                variant="heading3B"
                className="text-gray-950"
              >
                친구들이 인증한 미션이에요
              </Typography>
              <MoreButton
                onClick={() => router.push(LINK_URL.COMMUNITY_MISSION)}
              />
            </div>
            {/* 후기 슬라이딩 (친구들이 인증한 미션) */}
            <HorizontalScrollContainer
              className="-mx-5"
              containerClassName="flex gap-3 px-5"
              gradientColor="white"
            >
              {isMissionPostsLoading && missionPosts.length === 0 && (
                <div className="flex items-center justify-center py-6">
                  <Typography
                    font="noto"
                    variant="body2R"
                    className="text-gray-400"
                  >
                    친구들의 인증글을 불러오는 중...
                  </Typography>
                </div>
              )}

              {missionPostsError && (
                <div className="flex items-center justify-center py-6">
                  <Typography
                    font="noto"
                    variant="body2R"
                    className="text-red-500"
                  >
                    친구들의 인증글을 불러오는 중 오류가 발생했습니다.
                  </Typography>
                </div>
              )}

              {!isMissionPostsLoading &&
                !missionPostsError &&
                missionPosts.length === 0 && (
                  <div className="flex items-center justify-center py-6">
                    <Typography
                      font="noto"
                      variant="body2R"
                      className="text-gray-400"
                    >
                      아직 올라온 인증글이 없습니다.
                    </Typography>
                  </div>
                )}

              {missionPosts.map((post) => (
                <MissionCertificationCard
                  key={post?.id}
                  title={post?.title || "제목 없음"}
                  thumbnailText={
                    post?.preview?.description || "인증글 내용을 확인해보세요."
                  }
                  thumbnailImageUrl={
                    post?.preview?.thumbnail?.url || "/imgs/mockup3.jpg"
                  }
                  tagName={post?.missionTitle || ""}
                  postId={post?.id || ""}
                />
              ))}

              {/* 무한 스크롤 트리거 (가로 스크롤 끝에서 다음 페이지 로드) */}
              <div
                ref={missionPostsLoadMoreRef}
                className="h-px w-px shrink-0"
              />
            </HorizontalScrollContainer>
          </>
        )}
        {/* 미션 진행 중인거 있을때  */}
        {isOnMission && (
          <>
            <div className="mt-9 mb-3 flex w-full items-center justify-between">
              <Typography
                font="noto"
                variant="heading3B"
                className="text-gray-950"
              >
                다음 미션으로 이건 어때요?
              </Typography>
              <MoreButton onClick={() => router.push(LINK_URL.MISSION_LIST)} />
            </div>
            {/* 후기 슬라이딩 */}
            <HorizontalScrollContainer
              className="-mx-5"
              containerClassName="flex gap-3 px-5"
              gradientColor="white"
            >
              {recommendedMissions.map((mission) => (
                <RecommendedMissionCard
                  key={mission.id}
                  title={mission.title || ""}
                  tagName={mission.categories?.[0] || ""}
                  likeCount={mission.reactionCount || 0}
                  onClick={() => {
                    if (mission.id) {
                      router.push(`${LINK_URL.MISSION}/${mission.id}`);
                    }
                  }}
                />
              ))}
            </HorizontalScrollContainer>
          </>
        )}

        <div className="flex flex-col gap-5 pt-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Typography
                font="noto"
                variant="heading3B"
                className="text-gray-950"
              >
                이런 프로그램도 있어요!
              </Typography>
            </div>
            {/* y scroll layout */}
            <HorizontalScrollContainer
              className="-mx-5"
              containerClassName="flex gap-2 px-5"
              gradientColor="white"
            >
              {programs.length > 0 ? (
                programs.map((program) => (
                  <MissionReviewCard
                    key={program.id}
                    imageUrl={
                      program.thumbnail?.[0]?.url || "/imgs/mockup2.jpg"
                    }
                    imageAlt={program.title || "프로그램"}
                    title={program.title || "-"}
                    content={program.description || "-"}
                    onClick={() => {
                      if (program.id) {
                        router.push(`${LINK_URL.PROGRAMS}/${program.id}`);
                      }
                    }}
                  />
                ))
              ) : (
                <Typography
                  font="noto"
                  variant="body3R"
                  className="px-5 text-gray-400"
                >
                  아직 프로그램이 없어요.
                </Typography>
              )}
            </HorizontalScrollContainer>
          </div>
        </div>
      </div>
      {/* 미션 그만두기 컨펌 모달 */}
      <Modal
        isOpen={isQuitMissionConfirmOpen}
        title="미션을 그만둘까요?"
        description="진행 중인 미션을 그만두면 더 이상 미션을 진행할 수 없어요. 그래도 그만둘까요?"
        cancelText="취소"
        confirmText={isQuittingMission ? "처리 중..." : "그만두기"}
        onClose={() => {
          closeQuitMissionConfirm();
          setSelectedMissionId(null);
        }}
        onConfirm={() => {
          if (selectedMissionId) {
            handleQuitMission(selectedMissionId);
          }
        }}
        variant="primary"
        confirmDisabled={isQuittingMission}
      />

      {/* 에러 모달 */}
      <Modal
        isOpen={isErrorModalOpen}
        title="오류가 발생했어요"
        description={errorMessage}
        confirmText="확인"
        onClose={closeErrorModal}
        onConfirm={closeErrorModal}
        variant="primary"
      />

      {/* 미션 인증 완료 성공 모달 */}
      <MissionCertificationSuccessModal
        isOpen={isSuccessModalOpen}
        missionName={successMissionName}
        postId={successPostId}
        onClose={closeSuccessModal}
      />
    </div>
  );
};

/**
 * @description 미션 페이지 (Suspense로 감싸기)
 */
const PageWrapper = () => {
  return (
    <Suspense
      fallback={
        <div className="h-full min-h-screen bg-white">
          <div className="p-5">
            {/* 헤더 스켈레톤 */}
            <Skeleton className="h-8 w-64 pb-4" />

            {/* 현재 미션 카드 스켈레톤 */}
            <div className="mt-4">
              <div className="flex w-[99%] shrink-0 flex-col gap-1">
                <div className="w-full rounded-lg bg-white p-4 shadow-sm">
                  {/* 상단: 시계 아이콘 + 시간 (왼쪽), 휴지통 아이콘 (오른쪽) */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>
                  {/* 제목 */}
                  <Skeleton className="mb-2 h-6 w-48" />
                  {/* 설명 */}
                  <Skeleton className="mb-4 h-4 w-full" />
                  {/* 태그 2개 */}
                  <div className="mb-4 flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-lg" />
                    <Skeleton className="h-6 w-20 rounded-lg" />
                  </div>
                </div>
                {/* 미션 인증하기 버튼 */}
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>
          </div>

          {/* 흰화면 - 미션 진척 현황 */}
          <div className="pb-safe rounded-t-2xl bg-white px-5 py-6">
            {/* 미션 진척 현황 스켈레톤 */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="mt-3 grid grid-cols-[1.2fr_1fr] grid-rows-2 gap-2">
              {/* 왼쪽: 오늘의 미션 인증 현황 (큰 카드, 2행 병합) */}
              <div className="row-span-2 flex flex-col items-center justify-center rounded-lg border border-gray-200 py-2">
                <Skeleton className="mb-3 h-4 w-40" />
                <Skeleton className="mb-2 h-20 w-20 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              {/* 오른쪽 위: 연속 미션일 */}
              <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
                <div className="mb-2 flex items-center gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-3 rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-6" />
                </div>
              </div>
              {/* 오른쪽 아래: 진행 미션 수 */}
              <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
                <div className="mb-2 flex items-center gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-3 rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-6" />
                </div>
              </div>
            </div>

            {/* 친구들이 인증한 미션이에요 섹션 스켈레톤 */}
            <div className="mt-9 mb-5 flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="min-w-[280px] shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  {/* 썸네일 이미지 */}
                  <Skeleton className="mb-3 h-40 w-full rounded-lg" />
                  {/* 태그 */}
                  <Skeleton className="mb-2 h-5 w-32 rounded-lg" />
                  {/* 제목 */}
                  <Skeleton className="mb-2 h-5 w-full" />
                  {/* 설명 (2줄) */}
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>

            {/* 추천 미션 섹션 스켈레톤 */}
            <div className="mt-9 mb-3 flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-16" />
            </div>
            <HorizontalScrollContainer
              className="-mx-5"
              containerClassName="flex gap-3 px-5"
              gradientColor="white"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="min-w-[280px] shrink-0 rounded-lg bg-white p-4 shadow-sm"
                >
                  {/* 제목 */}
                  <Skeleton className="mb-2 h-5 w-40" />
                  {/* 설명 */}
                  <Skeleton className="mb-3 h-4 w-28" />
                  {/* 태그 + 좋아요 */}
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-lg" />
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-6" />
                    </div>
                  </div>
                </div>
              ))}
            </HorizontalScrollContainer>
          </div>
        </div>
      }
    >
      <MissionPageContent />
    </Suspense>
  );
};

export default PageWrapper;
