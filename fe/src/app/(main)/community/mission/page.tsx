"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  Suspense,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CommunityEmptyState from "@/components/community/CommunityEmptyState";
import CommunityErrorState from "@/components/community/CommunityErrorState";
import CommunityInfiniteScrollTrigger from "@/components/community/CommunityInfiniteScrollTrigger";
import CommunityLoadingStates from "@/components/community/CommunityLoadingStates";
import CommunityPageHeader from "@/components/community/CommunityPageHeader";
import MissionFeed from "@/components/mission/MissionFeed";
import MissionPostsFilterBottomSheet, {
  type MissionPostsSortOption,
} from "@/components/mission/MissionPostsFilterBottomSheet";
import { MISSION_POSTS_SORT_LABELS } from "@/constants/mission/_mission-posts-constants";
import { DEFAULT_MISSION_POSTS_PAGE_SIZE } from "@/constants/mission/_mission-posts-infinite";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { useInfiniteMissionPosts } from "@/hooks/mission/useInfiniteMissionPosts";
import { useTopBarStore } from "@/stores/shared/topbar-store";

/**
 * @description 미션 인증글 목록 페이지
 */
const MissionCommunityPageContent = () => {
  const setHideTopBar = useTopBarStore((state) => state.setHideTopBar);
  useEffect(() => {
    setHideTopBar(true);
    return () => {
      setHideTopBar(false);
    };
  }, [setHideTopBar]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userMe } = useGetUsersMe({
    request: {},
  });

  const getInitialSearchQuery = () => searchParams.get("search") || "";
  const getInitialAppliedSearchQuery = () => searchParams.get("search") || "";

  const getInitialSort = (): MissionPostsSortOption => {
    const sort = searchParams.get("sort");
    return sort === "popular" ? "popular" : "latest";
  };
  const getInitialCategories = () => {
    const categories = searchParams.get("categories");
    if (!categories) return [];
    return categories.split(",").filter((category) => category.trim().length);
  };
  const getInitialOnlyMyMissions = () => {
    return searchParams.get("userId") !== null;
  };

  const [searchQuery, setSearchQuery] = useState(getInitialSearchQuery);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(
    getInitialAppliedSearchQuery
  );
  const [selectedSort, setSelectedSort] =
    useState<MissionPostsSortOption>(getInitialSort);
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(getInitialCategories);
  const [onlyMyMissions, setOnlyMyMissions] = useState(
    getInitialOnlyMyMissions
  );
  const [hasFilterChanges, setHasFilterChanges] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isSearchingRef = useRef(false);

  const appliedSortParam =
    selectedSort === "popular" ? ("popular" as const) : undefined;

  const appliedUserId = useMemo(() => {
    const userIdFromUrl = searchParams.get("userId");
    if (userIdFromUrl) {
      return userIdFromUrl;
    }
    if (onlyMyMissions && userMe?.user?.id) {
      return userMe.user.id;
    }
    return undefined;
  }, [searchParams, onlyMyMissions, userMe?.user?.id]);

  const {
    data: missionPostsPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteMissionPosts({
    pageSize: DEFAULT_MISSION_POSTS_PAGE_SIZE,
    ...(appliedSortParam ? { sort: appliedSortParam } : {}),
    ...(selectedCategories.length > 0
      ? { categories: selectedCategories.join(",") }
      : {}),
    ...(appliedUserId ? { userId: appliedUserId } : {}),
  });

  const missionPosts = useMemo(() => {
    if (!missionPostsPages?.pages) return [];
    return missionPostsPages.pages.flatMap((page) => page.posts ?? []);
  }, [missionPostsPages]);

  const isInitialLoading = isLoading && missionPosts.length === 0;

  const updateQueryParams = useCallback(
    (next: {
      search?: string;
      sort?: MissionPostsSortOption;
      categories?: string[];
      userId?: string;
    }) => {
      const params = new URLSearchParams();

      if (next.search && next.search.trim().length > 0) {
        params.set("search", next.search.trim());
      }

      if (next.sort && next.sort !== "latest") {
        params.set("sort", next.sort);
      }

      if (next.categories && next.categories.length > 0) {
        params.set("categories", next.categories.join(","));
      }

      if (next.userId) {
        params.set("userId", next.userId);
      }

      const newQueryString = params.toString();
      const currentQueryString = searchParams.toString();

      if (newQueryString !== currentQueryString) {
        const newUrl = newQueryString
          ? `${LINK_URL.COMMUNITY_MISSION}?${newQueryString}`
          : LINK_URL.COMMUNITY_MISSION;
        router.replace(newUrl, { scroll: false });
      }
    },
    [router, searchParams]
  );

  useEffect(() => {
    const hasChanges =
      selectedSort !== "latest" || selectedCategories.length > 0;
    setHasFilterChanges(hasChanges);
  }, [selectedSort, selectedCategories.length]);

  const normalizedSearchKeyword = appliedSearchQuery.trim().toLowerCase();

  const filterChips = useMemo(() => {
    const chips: {
      id: string;
      label: string;
      onRemove: () => void;
    }[] = [];

    if (selectedSort !== "latest") {
      chips.push({
        id: `sort-${selectedSort}`,
        label: MISSION_POSTS_SORT_LABELS[selectedSort],
        onRemove: () => setSelectedSort("latest"),
      });
    }

    selectedCategories.forEach((category) => {
      chips.push({
        id: `category-${category}`,
        label: category,
        onRemove: () =>
          setSelectedCategories((prev) =>
            prev.filter((item) => item !== category)
          ),
      });
    });

    return chips;
  }, [selectedCategories, selectedSort]);

  const handleFilterApply = ({
    sort,
    categories,
  }: {
    sort: MissionPostsSortOption;
    categories: string[];
  }) => {
    const hasChanges = sort !== "latest" || categories.length > 0;
    setSelectedSort(sort);
    setSelectedCategories(categories);
    setHasFilterChanges(hasChanges);
    setIsFilterSheetOpen(false);

    updateQueryParams({
      search: appliedSearchQuery,
      sort,
      categories,
      userId: onlyMyMissions && userMe?.user?.id ? userMe.user.id : undefined,
    });
  };

  const handleSearch = useCallback(() => {
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    setAppliedSearchQuery(searchQuery);
    setTimeout(() => {
      isSearchingRef.current = false;
    }, 0);

    updateQueryParams({
      search: searchQuery,
      sort: appliedSortParam ?? "latest",
      categories: selectedCategories,
      userId: onlyMyMissions && userMe?.user?.id ? userMe.user.id : undefined,
    });
  }, [
    searchQuery,
    appliedSortParam,
    selectedCategories,
    onlyMyMissions,
    userMe?.user?.id,
    updateQueryParams,
  ]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchInputRef.current?.blur();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      if (
        !isSearchingRef.current &&
        document.activeElement !== searchInputRef.current
      ) {
        handleSearch();
      }
    }, 100);
  }, [handleSearch]);

  const handleSearchInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSearchQuery(event.target.value);
  };

  const filteredMissionPosts = useMemo(() => {
    if (!normalizedSearchKeyword) {
      return missionPosts;
    }

    return missionPosts.filter((post) => {
      const title = (post?.title ?? "").toLowerCase();
      const missionTitle = (post?.missionTitle ?? "").toLowerCase();
      const description = (post?.preview?.description ?? "").toLowerCase();

      return (
        title.includes(normalizedSearchKeyword) ||
        missionTitle.includes(normalizedSearchKeyword) ||
        description.includes(normalizedSearchKeyword)
      );
    });
  }, [missionPosts, normalizedSearchKeyword]);

  if (error) {
    return (
      <CommunityErrorState
        error={error}
        onRetry={() => refetch()}
        defaultMessage="미션 인증글을 불러오는데 실패했습니다"
      />
    );
  }

  return (
    <div className="relative min-h-full bg-white">
      <CommunityPageHeader
        activeTab="mission"
        searchQuery={searchQuery}
        onSearchInputChange={handleSearchInputChange}
        onSearchKeyDown={handleSearchKeyDown}
        onSearchBlur={handleSearchBlur}
        onSearchClick={handleSearch}
        searchInputRef={searchInputRef}
        hasFilterChanges={hasFilterChanges}
        onFilterClick={() => setIsFilterSheetOpen(true)}
        filterChips={filterChips}
        toggleSection={
          userMe?.user?.id
            ? {
                show: true,
                id: "only-my-missions",
                checked: onlyMyMissions,
                label: "내가 인증한 미션만 보기",
                onChange: (checked) => {
                  setOnlyMyMissions(checked);
                  updateQueryParams({
                    search: appliedSearchQuery,
                    sort: appliedSortParam ?? "latest",
                    categories: selectedCategories,
                    userId:
                      checked && userMe?.user?.id ? userMe.user.id : undefined,
                  });
                },
              }
            : undefined
        }
      />

      <div className="px-5 pb-32">
        {!isInitialLoading && filteredMissionPosts.length === 0 && (
          <CommunityEmptyState
            title="아직 미션 인증글이 없어요"
            description="첫 번째 인증글을 남겨보세요!"
          />
        )}

        <MissionFeed
          posts={filteredMissionPosts}
          onPostClick={(post) => {
            if (!post?.id) return;
            router.push(`${LINK_URL.COMMUNITY_MISSION}/${post.id}`);
          }}
          isLoading={isInitialLoading}
          skeletonCount={4}
        />

        <CommunityInfiniteScrollTrigger
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
        />

        <CommunityLoadingStates
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          hasData={missionPosts.length > 0}
          loadingMessage="인증글을 더 불러오는 중이에요..."
          completedMessage="모든 인증글을 확인했어요"
        />

        <MissionPostsFilterBottomSheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          selectedSort={selectedSort}
          selectedCategories={selectedCategories}
          onApply={handleFilterApply}
        />
      </div>
    </div>
  );
};

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              <div className="h-12 rounded bg-gray-200" />
              <div className="h-40 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      }
    >
      <MissionCommunityPageContent />
    </Suspense>
  );
};

export default Page;
