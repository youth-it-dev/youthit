"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Settings, ChevronRight, ChevronLeft, Info, Flame } from "lucide-react";
import CalendarDayCell from "@/components/my-page/CalendarDayCell";
import CalendarWeekDayItem from "@/components/my-page/CalendarWeekDayItem";
import MyPageSkeleton from "@/components/my-page/MyPageSkeleton";
import PostCard from "@/components/my-page/PostCard";
import ButtonBase from "@/components/shared/base/button-base";
import { Typography } from "@/components/shared/typography";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import ProfileImage from "@/components/shared/ui/profile-image";
import {
  ALL_ACTIVITY_FILTERS,
  DEFAULT_ACTIVITY_POSTS_REQUEST,
  type AllActivityFilterType,
} from "@/constants/my-page/_my-page-activity-posts";
import {
  WEEK_DAYS,
  CALENDAR_CONSTANTS,
} from "@/constants/my-page/_my-page-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetRewardsPolicies } from "@/hooks/generated/rewards-hooks";
import {
  useGetUsersMe,
  useGetUsersMeAllPosts,
  useGetUsersMeCommentedPosts,
  useGetUsersMeLikedPosts,
  useGetUsersMePosts,
  useGetUsersMeRoutineCalendar,
  useGetUsersMeParticipatingCommunities,
} from "@/hooks/generated/users-hooks";
import useToggle from "@/hooks/shared/useToggle";
import {
  generateCalendarDays,
  generateDateKey,
} from "@/utils/my-page/calendar-utils";
import { cn } from "@/utils/shared/cn";

/**
 * @description 마이 페이지
 */
type ActivityTabType = "routine" | "all";

const Page = () => {
  const router = useRouter();

  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState<ActivityTabType>("routine");

  const [activeAllActivityFilter, setActiveAllActivityFilter] =
    useState<AllActivityFilterType>("all");

  // 나다움 획득 조건 bottom sheet 상태
  const {
    isOpen: isRewardPoliciesOpen,
    open: openRewardPolicies,
    close: closeRewardPolicies,
  } = useToggle();

  // 나다움 획득 조건 조회
  const { data: rewardPoliciesData } = useGetRewardsPolicies({
    enabled: isRewardPoliciesOpen,
  });

  // 달력 상태 관리
  const today = new Date();
  const [currentDate, setCurrentDate] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  const {
    data: userData,
    isLoading,
    isFetched: isUserFetched,
  } = useGetUsersMe({
    request: {},
    select: (data) => {
      return data?.user;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const hasNickname = Boolean(userData?.nickname?.trim());

  // 참여 중인 커뮤니티 조회
  const { data: participatingCommunitiesData } =
    useGetUsersMeParticipatingCommunities({
      enabled: Boolean(userData) && hasNickname,
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    });

  // 참여 중인 루틴 커뮤니티가 있는지 확인
  const hasParticipatingRoutine = useMemo(() => {
    if (!participatingCommunitiesData) return false;
    return (participatingCommunitiesData.routine?.items?.length ?? 0) > 0;
  }, [participatingCommunitiesData]);

  // 인증 기록이 없고 참여 중인 루틴도 없을 때만 true
  const hasNoRoutineCertifications =
    (userData?.certificationPosts ?? 0) === 0 && !hasParticipatingRoutine;

  // 달력 데이터 조회
  const { data: calendarDataFromApi } = useGetUsersMeRoutineCalendar({
    request: {
      year: currentDate.year,
      month: currentDate.month,
    },
    enabled: activeTab === "routine" && hasNickname,
  });

  const allPostsQuery = useGetUsersMeAllPosts({
    request: DEFAULT_ACTIVITY_POSTS_REQUEST,
    enabled: activeTab === "all" && activeAllActivityFilter === "all",
  });

  const postsQuery = useGetUsersMePosts({
    request: DEFAULT_ACTIVITY_POSTS_REQUEST,
    enabled: activeTab === "all" && activeAllActivityFilter === "post",
  });

  const commentedPostsQuery = useGetUsersMeCommentedPosts({
    request: DEFAULT_ACTIVITY_POSTS_REQUEST,
    enabled: activeTab === "all" && activeAllActivityFilter === "commented",
  });

  const likedPostsQuery = useGetUsersMeLikedPosts({
    request: DEFAULT_ACTIVITY_POSTS_REQUEST,
    enabled: activeTab === "all" && activeAllActivityFilter === "liked",
  });

  const activePostsData = useMemo(() => {
    if (activeAllActivityFilter === "all") return allPostsQuery.data;
    if (activeAllActivityFilter === "post") return postsQuery.data;
    if (activeAllActivityFilter === "commented")
      return commentedPostsQuery.data;
    return likedPostsQuery.data;
  }, [
    activeAllActivityFilter,
    allPostsQuery.data,
    commentedPostsQuery.data,
    likedPostsQuery.data,
    postsQuery.data,
  ]);

  const isActivePostsLoading =
    activeAllActivityFilter === "all"
      ? allPostsQuery.isLoading
      : activeAllActivityFilter === "post"
        ? postsQuery.isLoading
        : activeAllActivityFilter === "commented"
          ? commentedPostsQuery.isLoading
          : likedPostsQuery.isLoading;

  const isActivePostsError =
    activeAllActivityFilter === "all"
      ? allPostsQuery.isError
      : activeAllActivityFilter === "post"
        ? postsQuery.isError
        : activeAllActivityFilter === "commented"
          ? commentedPostsQuery.isError
          : likedPostsQuery.isError;

  const handlePostClick = (
    postId?: string,
    communityId?: string,
    communityPath?: string
  ) => {
    if (!postId) return;

    const communityIdFromPath = communityPath
      ? communityPath.replace("communities/", "")
      : undefined;
    const finalCommunityId = communityId ?? communityIdFromPath;

    const params = new URLSearchParams();
    if (finalCommunityId) params.set("communityId", finalCommunityId);

    const queryString = params.toString();
    router.push(
      `${LINK_URL.COMMUNITY_POST}/${postId}${queryString ? `?${queryString}` : ""}`
    );
  };

  // 달력 헬퍼 함수들
  const goToPreviousMonth = () => {
    setCurrentDate((prev) => {
      if (prev.month === CALENDAR_CONSTANTS.FIRST_MONTH) {
        return { year: prev.year - 1, month: CALENDAR_CONSTANTS.LAST_MONTH };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => {
      if (prev.month === CALENDAR_CONSTANTS.LAST_MONTH) {
        return { year: prev.year + 1, month: CALENDAR_CONSTANTS.FIRST_MONTH };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  // 현재 캘린더가 오늘의 월과 같은지 확인
  const isCurrentMonthToday =
    currentDate.year === today.getFullYear() &&
    currentDate.month === today.getMonth() + 1;

  const goToToday = () => {
    if (isCurrentMonthToday) return; // 이미 오늘 월이면 동작하지 않음
    setCurrentDate({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    });
  };

  // 오늘 날짜 키 계산
  const todayDateKey = generateDateKey(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );

  // 인증 페이지로 이동하는 핸들러
  const handleCertifyClick = () => {
    if (!userData?.currentRoutineCommunityId) return;

    // 참여 중인 루틴 커뮤니티에서 현재 루틴의 이름 찾기
    const currentRoutine = participatingCommunitiesData?.routine?.items?.find(
      (item) => item.id === userData.currentRoutineCommunityId
    );
    const communityName = currentRoutine?.name || "";

    router.push(
      `/community/write?communityId=${userData.currentRoutineCommunityId}&communityName=${encodeURIComponent(communityName)}&category=한끗루틴&isReview=false`
    );
  };

  // 달력 그리드 생성
  const calendarDays = useMemo(() => {
    return generateCalendarDays(
      currentDate.year,
      currentDate.month,
      calendarDataFromApi?.days,
      todayDateKey
    );
  }, [
    currentDate.year,
    currentDate.month,
    calendarDataFromApi?.days,
    todayDateKey,
  ]);

  useEffect(() => {
    if (isUserFetched && !hasNickname) {
      router.replace(LINK_URL.MY_PAGE_EDIT);
    }
  }, [hasNickname, isUserFetched, router]);

  if (isUserFetched && !hasNickname) {
    return null;
  }

  // 프로필 편집 버튼 핸들러
  const handleEditProfile = () => {
    router.push(LINK_URL.MY_PAGE_EDIT);
  };

  // 설정 버튼 핸들러
  const handleSettingsClick = () => {
    router.push(LINK_URL.SETTINGS);
  };

  const handleGoToHome = () => {
    router.push(LINK_URL.HOME);
  };

  // 나다움 클릭 핸들러
  const handlePointsClick = () => {
    router.push(LINK_URL.STORE_HISTORY_NADAUM);
  };

  return (
    <div className="flex min-h-full w-full flex-col px-5 pb-24">
      {/* 프로필 섹션 */}
      {isLoading || !hasNickname ? (
        <MyPageSkeleton />
      ) : (
        <div className="flex flex-col bg-white pt-7">
          {/* 상단: 프로필 이미지 + 닉네임 + 버튼 + 설정 아이콘 */}
          <div className="flex items-center justify-between gap-3 pb-4">
            {/* 프로필 이미지 + 닉네임 + 프로필 편집 버튼 */}
            <div className="flex items-start gap-3">
              {/* 프로필 이미지 */}
              <div className="h-[75px] w-[75px] shrink-0">
                <ProfileImage
                  src={userData?.profileImageUrl}
                  size="h-full w-full"
                />
              </div>

              {/* 닉네임 및 프로필 편집 버튼 영역 */}
              <div className="flex flex-col gap-2">
                <Typography
                  font="noto"
                  variant="body2B"
                  className="text-gray-950"
                >
                  {userData?.nickname ?? "-"}
                </Typography>
                <ButtonBase
                  onClick={handleEditProfile}
                  className="rounded-lg border border-gray-300 p-1"
                >
                  <Typography
                    font="noto"
                    variant="label2M"
                    className="text-gray-950"
                  >
                    프로필 편집
                  </Typography>
                </ButtonBase>
              </div>
            </div>

            {/* 설정 버튼 */}
            <ButtonBase
              onClick={handleSettingsClick}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-gray-100"
              aria-label="설정"
            >
              <Settings className="h-5 w-5 text-gray-800" />
            </ButtonBase>
          </div>

          {/* 통계 정보 및 나다움 카드 */}
          <div className="flex flex-col rounded-lg bg-gray-50">
            {/* 통계 정보 */}
            <div className="flex justify-around py-4">
              {/* 한끗루틴 */}
              <div className="flex flex-col items-center gap-1">
                <Typography
                  font="noto"
                  variant="label2B"
                  className="text-gray-400"
                >
                  한끗루틴
                </Typography>
                <Typography
                  font="noto"
                  variant="body3M"
                  className="text-gray-600"
                >
                  {userData?.participationCounts?.routine ?? 0}번
                </Typography>
              </div>

              {/* TMI프로젝트 */}
              <div className="flex flex-col items-center gap-1">
                <Typography
                  font="noto"
                  variant="label2B"
                  className="text-gray-400"
                >
                  TMI프로젝트
                </Typography>
                <Typography
                  font="noto"
                  variant="body3M"
                  className="text-gray-600"
                >
                  {userData?.participationCounts?.tmi ?? 0}회
                </Typography>
              </div>

              {/* 월간소모임 */}
              <div className="flex flex-col items-center gap-1">
                <Typography
                  font="noto"
                  variant="label2B"
                  className="text-gray-400"
                >
                  월간소모임
                </Typography>
                <Typography
                  font="noto"
                  variant="body3M"
                  className="text-gray-600"
                >
                  {userData?.participationCounts?.gathering ?? 0}회
                </Typography>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-px bg-gray-200" />

            {/* 사용 가능한 나다움 */}
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-1">
                <Typography
                  font="noto"
                  variant="label2B"
                  className="text-gray-400"
                >
                  사용 가능한 나다움
                </Typography>
                <ButtonBase
                  onClick={(e) => {
                    e.stopPropagation();
                    openRewardPolicies();
                  }}
                  className="flex items-center justify-center"
                  aria-label="나다움 획득 조건"
                >
                  <Info className="h-4 w-4 text-gray-400" />
                </ButtonBase>
              </div>
              <ButtonBase
                onClick={handlePointsClick}
                className="flex items-center gap-1"
              >
                <Typography
                  font="noto"
                  variant="heading3B"
                  className="text-main-500"
                >
                  {userData?.rewards ?? 0}N
                </Typography>
                <ChevronRight className="h-4 w-4 text-gray-900" />
              </ButtonBase>
            </div>
          </div>
        </div>
      )}
      {/* 탭메뉴 섹션 - 한끗루틴 현황 / 전체 활동 관리 */}
      <div className="relative pt-6">
        <div className="flex items-center">
          <ButtonBase
            onClick={() => setActiveTab("routine")}
            className={cn(
              "flex flex-1 flex-col items-center justify-center border-b-2 py-[10px]",
              activeTab === "routine" ? "border-gray-950" : "border-transparent"
            )}
            aria-label="한끗루틴 현황"
            aria-selected={activeTab === "routine"}
          >
            <Typography
              font="noto"
              variant={activeTab === "routine" ? "body3B" : "body3R"}
              className={
                activeTab === "routine" ? "text-gray-950" : "text-gray-400"
              }
            >
              한끗루틴 현황
            </Typography>
          </ButtonBase>

          <ButtonBase
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex flex-1 flex-col items-center justify-center border-b-2 py-[10px]",
              activeTab === "all" ? "border-gray-950" : "border-transparent"
            )}
            aria-label="전체 활동 관리"
            aria-selected={activeTab === "all"}
          >
            <Typography
              font="noto"
              variant={activeTab === "all" ? "body3B" : "body3R"}
              className={
                activeTab === "all" ? "text-gray-950" : "text-gray-400"
              }
            >
              전체 활동 관리
            </Typography>
          </ButtonBase>
        </div>

        {/* 탭 메뉴 섹션 하단에만 보이는 그림자 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px translate-y-full shadow-md" />
      </div>

      {/* 탭 컨텐츠 영역 */}
      {activeTab === "routine" && (
        <div className="flex flex-col gap-4 py-5">
          {/* 통계 카드 */}
          <div className="flex gap-2.5">
            {/* 총 인증 카드 */}
            <div className="bg-main-50 flex flex-1 items-center justify-between rounded-lg p-4">
              <Typography
                font="noto"
                variant="label2B"
                className="text-gray-400"
              >
                총 인증
              </Typography>
              <Typography
                font="noto"
                variant="body2B"
                className="text-gray-700"
              >
                {userData?.certificationPosts ?? 0}일
              </Typography>
            </div>

            {/* 이번 루틴 연속 인증 카드 */}
            <div className="bg-main-50 flex flex-1 items-center justify-between rounded-lg p-4">
              <Typography
                font="noto"
                variant="label2B"
                className="text-gray-400"
              >
                이번 루틴 <br /> 연속 인증
              </Typography>
              <div className="flex items-center gap-1">
                <Flame className="fill-primary-green text-primary-green h-4 w-4" />
                <Typography
                  font="noto"
                  variant="body2B"
                  className="text-gray-700"
                >
                  {userData?.consecutiveRoutinePosts ?? 0}일
                </Typography>
              </div>
            </div>
          </div>
          {/* 달력 */}
          <div className="relative flex flex-col gap-2">
            {/* 달력 헤더 */}
            <div className="relative flex items-center">
              {/* 연/월/chevron 버튼 컨테이너 - 가운데 정렬 */}
              <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3">
                <ButtonBase
                  onClick={goToPreviousMonth}
                  className="flex items-center justify-center"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="size-4 text-gray-700" />
                </ButtonBase>
                <Typography
                  font="noto"
                  variant="body2B"
                  className="flex items-center text-gray-700"
                >
                  {currentDate.year}년 {currentDate.month}월
                </Typography>
                <ButtonBase
                  onClick={goToNextMonth}
                  className="flex items-center justify-center"
                  aria-label="다음 달"
                >
                  <ChevronRight className="size-4 text-gray-700" />
                </ButtonBase>
              </div>
              {/* 오늘 버튼 - 오른쪽 정렬 */}
              <div className="ml-auto">
                <ButtonBase
                  onClick={goToToday}
                  disabled={isCurrentMonthToday}
                  className={cn(
                    "flex items-center rounded-lg border border-gray-300 bg-white px-2 py-1",
                    isCurrentMonthToday && "cursor-not-allowed opacity-70"
                  )}
                >
                  <Typography
                    font="noto"
                    variant="label2M"
                    className="text-gray-950"
                  >
                    오늘
                  </Typography>
                </ButtonBase>
              </div>
            </div>

            {/* 요일 표시 */}
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => (
                <CalendarWeekDayItem key={day} day={day} />
              ))}
            </div>

            {/* 달력 그리드 */}
            <div className="relative">
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <CalendarDayCell
                    key={`${day.dateKey}-${index}`}
                    date={day.date}
                    dateKey={day.dateKey}
                    imageUrl={day.imageUrl}
                    postId={day.postId}
                    hasPost={day.hasPost}
                    isConsecutive={day.isConsecutive}
                    isCurrentMonth={day.isCurrentMonth}
                    isToday={day.isToday}
                    currentRoutineCommunityId={
                      hasNoRoutineCertifications
                        ? null
                        : userData?.currentRoutineCommunityId
                    }
                    onCertifyClick={
                      hasNoRoutineCertifications
                        ? undefined
                        : handleCertifyClick
                    }
                    onPostClick={(postId: string) =>
                      handlePostClick(
                        postId,
                        userData?.currentRoutineCommunityId
                      )
                    }
                  />
                ))}
              </div>

              {/* 총 인증 0일 때: 요일 아래(그리드 영역)만 오버레이 + 홈 유도 */}
              {hasNoRoutineCertifications && (
                <div className="absolute -inset-x-5 -inset-y-2 z-10 flex flex-col items-center justify-center gap-2 bg-white/20 px-6 text-center backdrop-blur-xs">
                  <Typography
                    font="noto"
                    variant="body3M"
                    className="text-gray-600"
                  >
                    인증 기록이 없어요.
                    <br />
                    한끗루틴을 둘러보고 인증을 시작해보세요.
                  </Typography>

                  <ButtonBase
                    onClick={handleGoToHome}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1"
                  >
                    <Typography
                      font="noto"
                      variant="label2M"
                      className="text-gray-950"
                    >
                      홈으로 이동
                    </Typography>
                  </ButtonBase>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "all" && (
        <div className="flex flex-col gap-4 py-5">
          {/* 전체 활동 관리 섹션 내용을 여기에 작성 */}
          <div className="scrollbar-hide flex gap-2 overflow-x-auto bg-white">
            {ALL_ACTIVITY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveAllActivityFilter(filter.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-2 whitespace-nowrap transition-colors",
                  activeAllActivityFilter === filter.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700"
                )}
                aria-label={filter.label}
                aria-pressed={activeAllActivityFilter === filter.id}
              >
                <Typography
                  font="noto"
                  variant="body2M"
                  className={cn(
                    "whitespace-nowrap",
                    activeAllActivityFilter === filter.id
                      ? "text-white"
                      : "text-gray-500"
                  )}
                >
                  {filter.label}
                </Typography>
              </button>
            ))}
          </div>

          {isActivePostsLoading && (
            <Typography font="noto" variant="body2R" className="text-gray-500">
              불러오는 중...
            </Typography>
          )}

          {isActivePostsError && !isActivePostsLoading && (
            <Typography font="noto" variant="body2R" className="text-gray-500">
              데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </Typography>
          )}

          {!isActivePostsLoading &&
            !isActivePostsError &&
            (activePostsData?.posts?.length ?? 0) === 0 && (
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-500"
              >
                게시글이 없어요.
              </Typography>
            )}

          {!isActivePostsLoading && !isActivePostsError && (
            <div className="grid grid-cols-2 gap-3">
              {activePostsData?.posts?.map((post) => {
                if (!post?.id) return null;
                return (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    imageUrl={post.preview?.thumbnail?.url ?? ""}
                    title={post.title ?? ""}
                    description={post.preview?.description ?? ""}
                    authorName={post.author ?? "-"}
                    authorProfileUrl={post.profileImageUrl}
                    likeCount={post.likesCount ?? 0}
                    commentCount={post.commentsCount ?? 0}
                    onClick={() =>
                      handlePostClick(
                        post.id,
                        post.community?.id,
                        post.communityPath
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 나다움 획득 조건 Bottom Sheet */}
      <BottomSheet isOpen={isRewardPoliciesOpen} onClose={closeRewardPolicies}>
        <div className="flex flex-col gap-4 px-5 pb-6">
          <Typography font="noto" variant="heading2B" className="text-gray-950">
            나다움 획득 조건
          </Typography>
          <div className="flex flex-col gap-3">
            {rewardPoliciesData?.policies?.map((policy, index) => (
              <div key={index} className="flex items-center justify-between">
                <Typography
                  font="noto"
                  variant="body2R"
                  className="text-gray-700"
                >
                  {policy.name}
                </Typography>
                <Typography
                  font="noto"
                  variant="body2B"
                  className="text-gray-700"
                >
                  {policy.points}N
                </Typography>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

export default Page;
