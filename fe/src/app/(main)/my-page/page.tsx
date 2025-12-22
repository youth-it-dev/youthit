"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MyPageProfileSection from "@/components/my-page/MyPageProfileSection";
import MyPageTabs, { TabType } from "@/components/my-page/MyPageTabs";
// import MyPageFilter, { FilterType } from "@/components/my-page/MyPageFilter"; // MVP 범위에서 제외
import PostCard from "@/components/my-page/PostCard";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetUsersMe,
  useGetUsersMePosts,
  useGetUsersMeLikedPosts,
  useGetUsersMeCommentedPosts,
} from "@/hooks/generated/users-hooks";
import type * as Types from "@/types/generated/users-types";

/**
 * @description 마이 페이지
 */
const Page = () => {
  const router = useRouter();

  // 상태 관리
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  // const [activeFilter, setActiveFilter] = useState<FilterType>("program"); // MVP 범위에서 제외

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

  useEffect(() => {
    if (isUserFetched && !hasNickname) {
      router.replace(LINK_URL.MY_PAGE_EDIT);
    }
  }, [hasNickname, isUserFetched, router]);

  const shouldQueryMyPageData = isUserFetched && hasNickname;

  // 최초 진입 시 posts 탭 데이터만 페칭
  const { data: postsData, isLoading: isLoadingPosts } = useGetUsersMePosts({
    request: { page: 0, size: 20 },
    enabled: shouldQueryMyPageData,
  });

  // posts 로드 완료 여부를 React Query 응답값으로 확인
  const isPostsLoaded = Boolean(
    shouldQueryMyPageData && !isLoadingPosts && postsData
  );

  // 탭 전환 시점에 다른 탭 데이터 페칭 (탭 클릭 또는 posts 로드 완료 후)
  const shouldFetchLiked =
    shouldQueryMyPageData && (activeTab === "liked" || isPostsLoaded);
  const shouldFetchCommented =
    shouldQueryMyPageData && (activeTab === "comments" || isPostsLoaded);

  const { data: likedPostsData, isLoading: isLoadingLiked } =
    useGetUsersMeLikedPosts({
      request: { page: 0, size: 20 },
      enabled: shouldFetchLiked,
    });

  const { data: commentedPostsData, isLoading: isLoadingCommented } =
    useGetUsersMeCommentedPosts({
      request: { page: 0, size: 20 },
      enabled: shouldFetchCommented,
    });

  // API 응답을 PostCard props로 변환하는 헬퍼 함수
  const transformPostToCardProps = (
    post:
      | NonNullable<Types.TGETUsersMePostsRes["posts"]>[number]
      | NonNullable<Types.TGETUsersMeLikedPostsRes["posts"]>[number]
      | NonNullable<Types.TGETUsersMeCommentedPostsRes["posts"]>[number]
  ) => {
    if (!post) return null;

    return {
      id: post.id || "",
      imageUrl: post.preview?.thumbnail?.url || "",
      title: post.category || post.channel || "-",
      description: post.preview?.description || "-",
      authorName: post.author || "익명",
      authorProfileUrl: "",
      likeCount: post.likesCount || 0,
      commentCount: post.commentsCount || 0,
    };
  };

  // 탭별 데이터 매핑
  const currentPostsData = useMemo(() => {
    switch (activeTab) {
      case "posts":
        return postsData?.posts || [];
      case "liked":
        return likedPostsData?.posts || [];
      case "comments":
        return commentedPostsData?.posts || [];
      default:
        return [];
    }
  }, [activeTab, postsData, likedPostsData, commentedPostsData]);

  // 로딩 상태 확인
  const isLoadingCurrentTab =
    (activeTab === "posts" && isLoadingPosts) ||
    (activeTab === "liked" && isLoadingLiked) ||
    (activeTab === "comments" && isLoadingCommented);

  // PostCard props로 변환된 데이터
  const currentPosts = useMemo(() => {
    return currentPostsData
      .map(transformPostToCardProps)
      .filter((post): post is NonNullable<typeof post> => post !== null);
  }, [currentPostsData]);

  // communityId 추출 헬퍼 (타입 안전 + 폴백 고려)
  const extractCommunityId = (raw: unknown): string | undefined => {
    const asAny = raw as {
      communityId?: unknown;
      community?: { id?: unknown };
    };
    const direct =
      typeof asAny?.communityId === "string" ? asAny.communityId : undefined;
    const nested =
      typeof asAny?.community?.id === "string" ? asAny.community.id : undefined;
    return direct ?? nested;
  };

  // raw 데이터에서 postId -> communityId 매핑 생성 (훅은 조건부로 호출되면 안 되므로 early return 위에 둠)
  const postIdToCommunityIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (currentPostsData || []).forEach((rawPost) => {
      if (!rawPost) return;
      // 다양한 위치에서 communityId 추출 시도
      const candidate = extractCommunityId(rawPost);
      if (rawPost.id && typeof candidate === "string" && candidate.length > 0) {
        map.set(rawPost.id, candidate);
      }
    });
    return map;
  }, [currentPostsData]);

  if (isUserFetched && !hasNickname) {
    return null;
  }

  // 프로필 편집 버튼 핸들러
  const handleEditProfile = () => {
    router.push(LINK_URL.MY_PAGE_EDIT);
  };

  // 게시글 클릭 핸들러
  const handlePostClick = (postId: string) => {
    const communityId = postIdToCommunityIdMap.get(postId);
    if (!communityId) {
      console.warn(
        "communityId가 없어 상세 페이지로 이동할 수 없습니다. 커뮤니티 목록으로 이동합니다.",
        {
          postId,
        }
      );
      router.push(LINK_URL.COMMUNITY);
      return;
    }
    router.push(
      `/community/post/${postId}?communityId=${encodeURIComponent(communityId)}`
    );
  };

  return (
    <div className="flex min-h-full w-full flex-col px-5">
      {/* 프로필 섹션 */}
      <MyPageProfileSection
        profileImageUrl={userData?.profileImageUrl}
        nickname={userData?.nickname}
        bio={userData?.bio}
        postCount={userData?.certificationPosts}
        activityCount={userData?.activityParticipationCount}
        points={userData?.rewards}
        onEditClick={handleEditProfile}
        isLoading={isLoading}
      />

      {/* 탭 */}
      <MyPageTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 필터 - MVP 범위에서 제외 */}
      {/* <MyPageFilter
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      /> */}

      {/* 게시글 그리드 */}
      <div className="grid grid-cols-2 gap-4 pt-4 pb-24">
        {isLoadingCurrentTab ? (
          // 로딩 중일 때 스켈레톤 표시
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <Skeleton className="aspect-square w-full" />
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="mt-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : currentPosts.length === 0 ? (
          // 데이터가 없을 때 빈 상태 표시
          <div className="col-span-2 flex items-center justify-center py-12">
            <Typography font="noto" variant="body2R" className="text-gray-500">
              게시글이 없습니다.
            </Typography>
          </div>
        ) : (
          currentPosts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              imageUrl={post.imageUrl}
              title={post.title}
              description={post.description}
              authorName={post.authorName}
              authorProfileUrl={post.authorProfileUrl}
              likeCount={post.likeCount}
              commentCount={post.commentCount}
              onClick={() => handlePostClick(post.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Page;
