"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { getCommunitiesPosts } from "@/api/generated/communities-api";
import CommunityEmptyState from "@/components/community/CommunityEmptyState";
import CommunityErrorState from "@/components/community/CommunityErrorState";
import CommunityInfiniteScrollTrigger from "@/components/community/CommunityInfiniteScrollTrigger";
import CommunityLoadingStates from "@/components/community/CommunityLoadingStates";
import CommunityPageHeader from "@/components/community/CommunityPageHeader";
import FloatingWriteButton from "@/components/community/FloatingWriteButton";
import PostFeed from "@/components/community/PostFeed";
import ProgramFilterBottomSheet, {
  type ProgramCategoryFilter,
  type ProgramSortOption,
  type ProgramStateFilter,
} from "@/components/community/ProgramFilterBottomSheet";
import ProgramSelectBottomSheet from "@/components/community/ProgramSelectBottomSheet";
import Modal from "@/components/shared/ui/modal";
import { communitiesKeys } from "@/constants/generated/query-keys";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetPrograms } from "@/hooks/generated/programs-hooks";
import { useGetUsersMeParticipatingCommunities } from "@/hooks/generated/users-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { onAuthStateChange } from "@/lib/auth";
import { CommunityPostListItem } from "@/types/generated/api-schema";
import type { ProgramListResponse } from "@/types/generated/api-schema";
import type { TGETCommunitiesPostsRes } from "@/types/generated/communities-types";

const COMMUNITY_POST_LIST_SIZE = 20;

const PROGRAM_CATEGORY_TO_TYPE: Record<
  ProgramCategoryFilter,
  "ROUTINE" | "GATHERING" | "TMI"
> = {
  한끗루틴: "ROUTINE",
  월간소모임: "GATHERING",
  TMI: "TMI",
};

const PROGRAM_STATE_LABELS: Record<ProgramStateFilter, string> = {
  all: "전체",
  ongoing: "진행중",
  finished: "종료됨",
};

const PROGRAM_SORT_LABELS: Record<ProgramSortOption, string> = {
  latest: "최신순",
  popular: "인기순",
};

/**
 * @description 커뮤니티 페이지 컨텐츠 (useSearchParams 사용)
 */
const CommunityPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 쿼리스트링에서 필터 상태 복원
  const getInitialSearchQuery = () => searchParams.get("search") || "";
  const getInitialAppliedSearchQuery = () => searchParams.get("search") || "";
  const getInitialSort = (): ProgramSortOption => {
    const sort = searchParams.get("sort");
    return sort === "popular" ? "popular" : "latest";
  };
  const getInitialProgramState = (): ProgramStateFilter => {
    const state = searchParams.get("state");
    return state === "ongoing" || state === "finished" ? state : "all";
  };
  const getInitialCategories = (): ProgramCategoryFilter[] => {
    const categories = searchParams.get("categories");
    if (!categories) return [];
    return categories.split(",").filter((cat): cat is ProgramCategoryFilter => {
      return ["한끗루틴", "월간소모임", "TMI"].includes(cat);
    });
  };
  const getInitialOnlyMyPrograms = () => {
    return searchParams.get("onlyMyPrograms") === "true";
  };

  const [searchQuery, setSearchQuery] = useState(getInitialSearchQuery);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(
    getInitialAppliedSearchQuery
  );
  const [selectedSort, setSelectedSort] =
    useState<ProgramSortOption>(getInitialSort);
  const [selectedProgramState, setSelectedProgramState] =
    useState<ProgramStateFilter>(getInitialProgramState);
  const [selectedCategories, setSelectedCategories] =
    useState<ProgramCategoryFilter[]>(getInitialCategories);
  const [onlyMyPrograms, setOnlyMyPrograms] = useState(
    getInitialOnlyMyPrograms
  );
  const [isProgramSelectSheetOpen, setIsProgramSelectSheetOpen] =
    useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [hasFilterChanges, setHasFilterChanges] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSearchingRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // 게시물 정보 없음 모달 상태
  const {
    isOpen: isPostNotFoundModalOpen,
    open: openPostNotFoundModal,
    close: closePostNotFoundModal,
  } = useToggle();

  // Firebase Auth 상태 추적
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  // 로그인된 사용자일 때만 API 호출
  const { data: participatingCommunities } =
    useGetUsersMeParticipatingCommunities({
      enabled: Boolean(currentUser),
    });

  // 프로그램 목록 조회 (추천 섹션용)
  const { data: programsData } = useGetPrograms({
    request: { pageSize: 20, recruitmentStatus: "ongoing" },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return [];
      }
      const responseData = data as ProgramListResponse["data"];
      if (
        responseData &&
        "programs" in responseData &&
        Array.isArray(responseData.programs)
      ) {
        return responseData.programs || [];
      }
      return [];
    },
  });

  const participatingCommunityIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!participatingCommunities) {
      return set;
    }

    const routineItems = participatingCommunities.routine?.items ?? [];
    const gatheringItems = participatingCommunities.gathering?.items ?? [];
    const tmiItems = participatingCommunities.tmi?.items ?? [];

    [...routineItems, ...gatheringItems, ...tmiItems].forEach((item) => {
      if (item?.id) {
        set.add(item.id);
      }
    });
    return set;
  }, [participatingCommunities]);

  const appliedProgramState =
    selectedProgramState === "all" ? undefined : selectedProgramState;

  const appliedProgramType =
    selectedCategories.length === 1
      ? PROGRAM_CATEGORY_TO_TYPE[selectedCategories[0]]
      : undefined;

  const {
    data: paginatedPostsData,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<TGETCommunitiesPostsRes, Error>({
    queryKey: communitiesKeys.getCommunitiesPosts({
      page: undefined, // useInfiniteQuery는 각 페이지마다 다른 쿼리 키를 사용하므로 page는 queryFn에서 처리
      size: COMMUNITY_POST_LIST_SIZE,
      programType: appliedProgramType,
      programState: appliedProgramState,
      sort: selectedSort === "popular" ? "popular" : undefined,
    }),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const currentPage =
        typeof pageParam === "number" && pageParam >= 0 ? pageParam : 0;
      const response = await getCommunitiesPosts({
        page: currentPage,
        size: COMMUNITY_POST_LIST_SIZE,
        programType: appliedProgramType,
        programState: appliedProgramState,
        sort: selectedSort === "popular" ? "popular" : undefined,
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.hasNext) {
        return (lastPage.pagination.pageNumber ?? 0) + 1;
      }
      return undefined;
    },
  });

  // 변환된 포스트 데이터
  const posts = useMemo<CommunityPostListItem[]>(() => {
    if (!paginatedPostsData?.pages) {
      return [];
    }
    return paginatedPostsData.pages.flatMap((page) => {
      if (!page?.posts || !Array.isArray(page.posts)) {
        return [];
      }
      return page.posts as CommunityPostListItem[];
    });
  }, [paginatedPostsData]);

  // 초기 로딩만 감지 (데이터가 없고 로딩 중일 때만 true)
  // 데이터가 이미 있으면 브라우저 탭 전환 시에도 캐시된 데이터를 표시
  const isInitialLoading = isLoading && posts.length === 0;

  // 필터 상태를 쿼리스트링에 업데이트하는 함수
  const updateQueryParams = useCallback(
    (filters: {
      search?: string;
      sort?: ProgramSortOption;
      state?: ProgramStateFilter;
      categories?: ProgramCategoryFilter[];
      onlyMyPrograms?: boolean;
    }) => {
      const params = new URLSearchParams();

      // 검색어
      if (filters.search && filters.search.trim()) {
        params.set("search", filters.search.trim());
      }

      // 정렬
      if (filters.sort && filters.sort !== "latest") {
        params.set("sort", filters.sort);
      }

      // 프로그램 상태
      if (filters.state && filters.state !== "all") {
        params.set("state", filters.state);
      }

      // 카테고리
      if (filters.categories && filters.categories.length > 0) {
        params.set("categories", filters.categories.join(","));
      }

      // 내가 참여중인 프로그램만 보기
      if (filters.onlyMyPrograms) {
        params.set("onlyMyPrograms", "true");
      }

      // 현재 쿼리스트링과 비교하여 변경된 경우에만 업데이트
      const newQueryString = params.toString();
      const currentQueryString = searchParams.toString();

      if (newQueryString !== currentQueryString) {
        const newUrl = newQueryString
          ? `${LINK_URL.COMMUNITY}?${newQueryString}`
          : LINK_URL.COMMUNITY;
        router.replace(newUrl, { scroll: false });
      }
    },
    [router, searchParams]
  );

  const handlePostClick = (post: CommunityPostListItem) => {
    // CommunityPostListItem을 Schema.CommunityPost로 확장하여 communityId 추출
    const postWithCommunity = post as CommunityPostListItem & {
      communityId?: string;
      communityPath?: string;
      community?: { id?: string };
    };

    // communityId 추출: communityId > community?.id > communityPath에서 추출
    const communityId =
      postWithCommunity.communityId ||
      postWithCommunity.community?.id ||
      (postWithCommunity.communityPath
        ? postWithCommunity.communityPath.replace("communities/", "")
        : "");

    const postId = post.id;
    if (postId && communityId) {
      // 현재 필터 상태를 쿼리스트링에 포함하여 상세 페이지로 이동
      const params = new URLSearchParams();
      params.set("communityId", communityId);

      // 필터 상태 추가
      if (appliedSearchQuery.trim()) {
        params.set("search", appliedSearchQuery.trim());
      }
      if (selectedSort !== "latest") {
        params.set("sort", selectedSort);
      }
      if (selectedProgramState !== "all") {
        params.set("state", selectedProgramState);
      }
      if (selectedCategories.length > 0) {
        params.set("categories", selectedCategories.join(","));
      }
      if (onlyMyPrograms) {
        params.set("onlyMyPrograms", "true");
      }

      router.push(`${LINK_URL.COMMUNITY_POST}/${postId}?${params.toString()}`);
    } else {
      openPostNotFoundModal();
    }
  };

  const normalizedSearchKeyword = appliedSearchQuery.trim().toLowerCase();

  const handleSearch = useCallback(() => {
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    setAppliedSearchQuery(searchQuery);
    // 다음 이벤트 루프에서 플래그 리셋
    setTimeout(() => {
      isSearchingRef.current = false;
    }, 0);
    // 쿼리스트링 업데이트
    updateQueryParams({
      search: searchQuery,
      sort: selectedSort,
      state: selectedProgramState,
      categories: selectedCategories,
      onlyMyPrograms,
    });
  }, [
    searchQuery,
    selectedSort,
    selectedProgramState,
    selectedCategories,
    onlyMyPrograms,
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
    // blur 이벤트는 약간의 지연 후 실행하여 엔터키로 인한 blur와 구분
    setTimeout(() => {
      if (
        !isSearchingRef.current &&
        document.activeElement !== searchInputRef.current
      ) {
        handleSearch();
      }
    }, 100);
  }, [handleSearch]);

  const extractCommunityId = useCallback((post: CommunityPostListItem) => {
    const postWithCommunity = post as CommunityPostListItem & {
      communityId?: string;
      communityPath?: string;
      community?: { id?: string };
    };

    return (
      postWithCommunity.communityId ||
      postWithCommunity.community?.id ||
      (postWithCommunity.communityPath
        ? postWithCommunity.communityPath.replace("communities/", "")
        : "")
    );
  }, []);

  const filterChips = useMemo(() => {
    const chips: {
      id: string;
      label: string;
      onRemove: () => void;
    }[] = [];

    // 정렬 옵션 (초기값이 아닌 경우만 추가)
    if (selectedSort !== "latest") {
      chips.push({
        id: `sort-${selectedSort}`,
        label: PROGRAM_SORT_LABELS[selectedSort],
        onRemove: () => setSelectedSort("latest"),
      });
    }

    // 프로그램 상태 (초기값이 아닌 경우만 추가)
    if (selectedProgramState !== "all") {
      chips.push({
        id: `state-${selectedProgramState}`,
        label: PROGRAM_STATE_LABELS[selectedProgramState],
        onRemove: () => setSelectedProgramState("all"),
      });
    }

    // 카테고리
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

    // 검색어
    if (normalizedSearchKeyword) {
      chips.push({
        id: "search",
        label: `검색: "${appliedSearchQuery.trim()}"`,
        onRemove: () => {
          setSearchQuery("");
          setAppliedSearchQuery("");
        },
      });
    }

    return chips;
  }, [
    normalizedSearchKeyword,
    appliedSearchQuery,
    selectedCategories,
    selectedProgramState,
    selectedSort,
  ]);

  const handleSearchInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleFilterApply = ({
    sort,
    programState,
    categories,
  }: {
    sort: ProgramSortOption;
    programState: ProgramStateFilter;
    categories: ProgramCategoryFilter[];
  }) => {
    const hasChanges =
      sort !== "latest" || programState !== "all" || categories.length > 0;
    setSelectedSort(sort);
    setSelectedProgramState(programState);
    setSelectedCategories(categories);
    setHasFilterChanges(hasChanges);
    setIsFilterSheetOpen(false);
    // 쿼리스트링 업데이트
    updateQueryParams({
      search: appliedSearchQuery,
      sort,
      state: programState,
      categories,
      onlyMyPrograms,
    });
  };

  useEffect(() => {
    const hasChanges =
      selectedSort !== "latest" ||
      selectedProgramState !== "all" ||
      selectedCategories.length > 0 ||
      normalizedSearchKeyword.length > 0;
    setHasFilterChanges(hasChanges);
  }, [
    selectedSort,
    selectedProgramState,
    selectedCategories,
    normalizedSearchKeyword,
  ]);

  // 필터 상태 변경 시 쿼리스트링 업데이트 (초기 로드 제외)
  const isInitialMount = useRef(true);
  useEffect(() => {
    // 초기 마운트 시에는 쿼리스트링에서 복원한 상태이므로 업데이트하지 않음
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    updateQueryParams({
      search: appliedSearchQuery,
      sort: selectedSort,
      state: selectedProgramState,
      categories: selectedCategories,
      onlyMyPrograms,
    });
  }, [
    selectedSort,
    selectedProgramState,
    selectedCategories,
    onlyMyPrograms,
    appliedSearchQuery,
    updateQueryParams,
  ]);

  const filteredPosts = useMemo(() => {
    if (isInitialLoading || !posts.length) return [];

    let currentPosts = [...posts];

    if (onlyMyPrograms) {
      if (participatingCommunityIdSet.size === 0) {
        return [];
      }

      currentPosts = currentPosts.filter((post) => {
        const communityId = extractCommunityId(post);
        return communityId && participatingCommunityIdSet.has(communityId);
      });
    }

    if (selectedCategories.length > 0) {
      currentPosts = currentPosts.filter((post) => {
        const normalizedCategory = post.category?.replace(/\s/g, "");
        const normalizedTags = post.tags?.map((tag) => tag.replace(/\s/g, ""));
        return selectedCategories.some((category) => {
          const target = category.replace(/\s/g, "");
          if (normalizedCategory && normalizedCategory === target) {
            return true;
          }
          return normalizedTags?.some((tag) => tag === target);
        });
      });
    }

    if (normalizedSearchKeyword) {
      currentPosts = currentPosts.filter((post) => {
        const title = (post.title || "").toLowerCase();
        const description =
          (post.preview?.description || "").toLowerCase() || "";
        const tagMatch = post.tags?.some((tag) =>
          tag.toLowerCase().includes(normalizedSearchKeyword)
        );

        return (
          title.includes(normalizedSearchKeyword) ||
          description.includes(normalizedSearchKeyword) ||
          Boolean(tagMatch)
        );
      });
    }

    const sortByLatest = (
      a: CommunityPostListItem,
      b: CommunityPostListItem
    ) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    };

    const sortByPopularity = (
      a: CommunityPostListItem,
      b: CommunityPostListItem
    ) => {
      const likesDiff = (b.likesCount ?? 0) - (a.likesCount ?? 0);
      if (likesDiff !== 0) return likesDiff;
      const commentsDiff = (b.commentsCount ?? 0) - (a.commentsCount ?? 0);
      if (commentsDiff !== 0) return commentsDiff;
      return sortByLatest(a, b);
    };

    currentPosts.sort((a, b) =>
      selectedSort === "popular" ? sortByPopularity(a, b) : sortByLatest(a, b)
    );

    return currentPosts;
  }, [
    extractCommunityId,
    isInitialLoading,
    normalizedSearchKeyword,
    onlyMyPrograms,
    participatingCommunityIdSet,
    posts,
    selectedCategories,
    selectedSort,
  ]);

  const segmentedPosts = useMemo(() => {
    const top = filteredPosts.slice(0, 4);
    const rest = filteredPosts.slice(4);
    return { top, rest };
  }, [filteredPosts]);

  const handleFetchNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // 에러 상태 처리
  if (error) {
    return (
      <CommunityErrorState
        error={error}
        onRetry={() => refetch()}
        defaultMessage="포스트를 불러오는데 실패했습니다"
      />
    );
  }

  return (
    <div className="relative min-h-full bg-white">
      <CommunityPageHeader
        activeTab="program"
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
          currentUser
            ? {
                show: true,
                id: "only-my-programs",
                checked: onlyMyPrograms,
                label: "내가 참여중인 프로그램만 보기",
                ariaLabel: "내가 참여중인 프로그램 게시글만 보기",
                onChange: setOnlyMyPrograms,
              }
            : undefined
        }
      />

      <div className="px-5 pb-32">
        {/* 전체 포스트가 없을 때 - 로딩 완료 후에만 표시 */}
        {!isInitialLoading &&
          segmentedPosts.top.length + segmentedPosts.rest.length === 0 && (
            <CommunityEmptyState
              title="아직 게시글이 없어요"
              description="첫 번째 이야기를 공유해보세요!"
            />
          )}

        {/* 상위 4개 포스트 */}
        <div>
          <PostFeed
            posts={segmentedPosts.top}
            onPostClick={handlePostClick}
            isLoading={isInitialLoading}
            skeletonCount={4}
          />
        </div>
        {/* 나머지 포스트 */}
        <div className="mb-6">
          <PostFeed
            posts={segmentedPosts.rest}
            onPostClick={handlePostClick}
            isLoading={isInitialLoading}
            skeletonCount={5}
          />
        </div>

        <CommunityInfiniteScrollTrigger
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={handleFetchNextPage}
        />

        <CommunityLoadingStates
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          hasData={filteredPosts.length > 0}
          loadingMessage="게시글을 더 불러오는 중이에요..."
          completedMessage="모든 게시글을 확인했어요"
        />

        {/* 플로팅 작성 버튼 */}
        <FloatingWriteButton
          onOpenBottomSheet={() => setIsProgramSelectSheetOpen(true)}
        />

        {/* 프로그램 선택 바텀시트 */}
        <ProgramSelectBottomSheet
          isOpen={isProgramSelectSheetOpen}
          onClose={() => setIsProgramSelectSheetOpen(false)}
        />

        <ProgramFilterBottomSheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          selectedSort={selectedSort}
          selectedProgramState={selectedProgramState}
          selectedCategories={selectedCategories}
          onApply={handleFilterApply}
        />

        {/* 게시물 정보 없음 모달 */}
        <Modal
          isOpen={isPostNotFoundModalOpen}
          title="게시물을 찾을 수 없어요"
          description="게시물 정보를 찾을 수 없습니다."
          confirmText="확인"
          onConfirm={closePostNotFoundModal}
          onClose={closePostNotFoundModal}
          variant="primary"
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
      <CommunityPageContent />
    </Suspense>
  );
};

export default Page;
