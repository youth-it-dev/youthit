"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import CommentsSection from "@/components/community/CommentsSection";
import { PostActionBar } from "@/components/community/PostActionBar";
import { PostMainContent } from "@/components/community/PostMainContent";
import KebabMenu from "@/components/shared/kebab-menu";
import { PostDetailError } from "@/components/shared/post-detail-error";
import { PostDetailSkeleton } from "@/components/shared/post-detail-skeleton";
import Modal from "@/components/shared/ui/modal";
import { POST_EDIT_CONSTANTS } from "@/constants/community/_write-constants";
import { communitiesKeys } from "@/constants/generated/query-keys";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetCommunitiesPostsByTwoIds,
  usePostCommunitiesPostsLikeByTwoIds,
  useDeleteCommunitiesPostsByTwoIds,
  useGetCommunitiesMembersByTwoIds,
} from "@/hooks/generated/communities-hooks";
import {
  useGetUsersMe,
  useGetUsersMeParticipatingCommunities,
} from "@/hooks/generated/users-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { getCurrentUser } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type * as Schema from "@/types/generated/api-schema";
import { hasAuthCookie, removeAuthCookie } from "@/utils/auth/auth-cookie";
import { debug } from "@/utils/shared/debugger";
import { sharePost } from "@/utils/shared/post-share";

/**
 * @description 게시글 상세 페이지 콘텐츠
 */
const PostDetailPageContent = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL에서 postId와 communityId를 추출
  const postId = params.id as string;
  const communityId = searchParams.get("communityId") || "";

  const queryClient = useQueryClient();
  const {
    isOpen: isDeleteModalOpen,
    open: openDeleteModal,
    close: closeDeleteModal,
  } = useToggle();
  const {
    isOpen: isDeleteSuccessModalOpen,
    open: openDeleteSuccessModal,
    close: closeDeleteSuccessModal,
  } = useToggle();
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const focusCommentInputRef = useRef<(() => void) | null>(null);

  // API 연동 - useGetCommunitiesPostsByTwoIds 사용 (communityId와 postId 모두 필요)
  const {
    data: post,
    isLoading,
    error,
  } = useGetCommunitiesPostsByTwoIds({
    request: {
      communityId: communityId || "",
      postId,
    },
    enabled: !!postId && !!communityId, // communityId가 있을 때만 요청
  });

  const postQueryKey = useMemo(
    () =>
      communitiesKeys.getCommunitiesPostsByTwoIds({
        communityId: communityId || "",
        postId,
      }),
    [communityId, postId]
  );
  const isLiked = post?.isLiked ?? false;
  const isAuthor = post?.isAuthor ?? false;

  // 현재 사용자 정보
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
  });

  // 내가 참여 중인 커뮤니티 조회
  const { data: participatingCommunitiesData } =
    useGetUsersMeParticipatingCommunities({
      enabled: Boolean(userData),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    });

  // 내가 참여중인 프로그램인지 확인
  const isParticipating = useMemo(() => {
    if (!participatingCommunitiesData || !communityId) return false;

    const allItems = [
      ...(participatingCommunitiesData.routine?.items || []),
      ...(participatingCommunitiesData.gathering?.items || []),
      ...(participatingCommunitiesData.tmi?.items || []),
    ];

    return allItems.some((item) => item.id === communityId);
  }, [participatingCommunitiesData, communityId]);

  // 커뮤니티 멤버 닉네임 조회 (참여중인 프로그램인 경우에만)
  const { data: memberData } = useGetCommunitiesMembersByTwoIds({
    request: {
      communityId: communityId || "",
      userId: userData?.id || "",
    },
    enabled: Boolean(
      isParticipating &&
        userData?.id &&
        communityId &&
        post?.programType !== "TMI"
    ),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // 댓글 작성용 이름 계산
  const authorName = useMemo(() => {
    if (!userData || !post) return "";

    const programType = post?.programType;
    const isTMIPost = programType === "TMI";
    // TMI 타입이면 실명 사용
    if (isTMIPost) {
      return userData.name || "";
    }

    // 내가 참여중인 프로그램이면 members nickname 사용
    if (
      isParticipating &&
      memberData?.status === "approved" &&
      memberData?.nickname
    ) {
      return memberData.nickname;
    }

    // 내가 참여중이지 않거나 member nickname이 없으면 user nickname 사용
    return userData.nickname || "";
  }, [
    userData?.nickname,
    post?.programType,
    isParticipating,
    memberData?.nickname,
  ]);

  // 공유하기 기능
  const handleShare = useCallback(async () => {
    if (!post) return;

    const contentString = post.content as unknown as string | undefined;
    await sharePost({
      title: post.title,
      content: contentString,
      postId,
      sharePath: LINK_URL.COMMUNITY_POST,
      queryParams: communityId ? `?communityId=${communityId}` : "",
      defaultTitle: "게시글",
    });
  }, [post, postId, communityId]);

  // 수정 클릭 핸들러
  const handleEditClick = useCallback(() => {
    if (!postId || !communityId) return;
    router.push(
      `${LINK_URL.COMMUNITY_POST}/${postId}/edit?communityId=${communityId}`
    );
  }, [postId, communityId, router]);

  // 삭제 클릭 핸들러
  const handleDeleteClick = useCallback(() => {
    openDeleteModal();
  }, [openDeleteModal]);

  // 신고 클릭 핸들러
  const handleReportClick = useCallback(() => {
    if (!postId || !post) return;

    const authorId = post?.authorId || "";

    router.push(
      `${LINK_URL.COMMUNITY_REPORT}?targetType=post&targetId=${postId}&targetUserId=${authorId}&communityId=${communityId}`
    );
  }, [postId, post, communityId, router]);

  // 탑바 커스텀
  useEffect(() => {
    setRightSlot(
      <KebabMenu
        onShare={handleShare}
        onEdit={isAuthor ? handleEditClick : undefined}
        onDelete={isAuthor ? handleDeleteClick : undefined}
        onReport={!isAuthor ? handleReportClick : undefined}
      />
    );
  }, [
    setRightSlot,
    isAuthor,
    handleShare,
    handleEditClick,
    handleDeleteClick,
    handleReportClick,
  ]);

  // 삭제 mutation
  const { mutateAsync: deletePostAsync, isPending: isDeleting } =
    useDeleteCommunitiesPostsByTwoIds();

  /**
   * 게시글 삭제 핸들러
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!postId || !communityId) return;

    try {
      await deletePostAsync({
        communityId,
        postId,
      });

      // 쿼리 무효화 (목록 및 상세 조회)
      queryClient.invalidateQueries({
        queryKey: communitiesKeys.getCommunitiesPostsByTwoIds({
          communityId,
          postId,
        }),
      });
      // 커뮤니티 목록 조회 쿼리 무효화 (generated 쿼리 키 사용)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            queryKey[0] === "communities" &&
            queryKey[1] === "getCommunitiesPosts"
          );
        },
      });

      // 삭제 확인 모달 닫기
      closeDeleteModal();

      // 성공 모달 표시
      openDeleteSuccessModal();
    } catch (error) {
      debug.error("게시글 삭제 실패:", error);
      closeDeleteModal();
    }
  }, [
    postId,
    communityId,
    deletePostAsync,
    queryClient,
    closeDeleteModal,
    openDeleteSuccessModal,
  ]);

  /**
   * 삭제 성공 모달 확인 핸들러
   */
  const handleDeleteSuccessConfirm = useCallback(() => {
    closeDeleteSuccessModal();

    // 커뮤니티 목록 조회 쿼리 무효화 (generated 쿼리 키 사용)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return (
          Array.isArray(queryKey) &&
          queryKey.length > 0 &&
          queryKey[0] === "communities" &&
          queryKey[1] === "getCommunitiesPosts"
        );
      },
    });

    // 커뮤니티 목록으로 이동
    router.replace(LINK_URL.COMMUNITY);
  }, [closeDeleteSuccessModal, queryClient, router]);

  // 좋아요 mutation
  const { mutateAsync: toggleLikeAsync, isPending: isToggleLikePending } =
    usePostCommunitiesPostsLikeByTwoIds({
      onMutate: async () => {
        // Optimistic update: 즉시 UI 업데이트
        await queryClient.cancelQueries({ queryKey: postQueryKey });
        const previousPost =
          queryClient.getQueryData<Schema.CommunityPost>(postQueryKey);

        if (previousPost) {
          queryClient.setQueryData<Schema.CommunityPost>(postQueryKey, {
            ...previousPost,
            isLiked: !previousPost.isLiked,
            likesCount: previousPost.isLiked
              ? (previousPost.likesCount || 1) - 1
              : (previousPost.likesCount || 0) + 1,
          });
        }

        return { previousPost };
      },
      onSuccess: (response) => {
        // API 응답으로 정확한 값으로 업데이트 (실제 변경사항이 있을 때만)
        const result = response.data;
        if (!result) return;

        const currentPost =
          queryClient.getQueryData<Schema.CommunityPost>(postQueryKey);

        // 현재 상태와 API 응답이 다를 때만 업데이트 (불필요한 리렌더링 방지)
        const needsUpdate =
          currentPost &&
          (currentPost.likesCount !== result.likesCount ||
            currentPost.isLiked !== result.isLiked);

        if (needsUpdate) {
          queryClient.setQueryData<Schema.CommunityPost>(
            postQueryKey,
            (prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                likesCount:
                  typeof result.likesCount === "number"
                    ? result.likesCount
                    : prev.likesCount,
                isLiked:
                  typeof result.isLiked === "boolean"
                    ? result.isLiked
                    : prev.isLiked,
              };
            }
          );
        }

        // 게시글 목록 쿼리들도 업데이트 (목록에서도 카운트 반영)
        // setQueriesData를 사용하되, 실제 변경이 필요한 경우에만 새 객체 반환
        queryClient.setQueriesData<{
          pages?: Array<{
            posts?: Array<{
              id?: string;
              likesCount?: number;
              isLiked?: boolean;
            }>;
          }>;
        }>(
          {
            predicate: (query) => {
              const queryKey = query.queryKey;
              return (
                Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                queryKey[0] === "communities" &&
                queryKey[1] === "getCommunitiesPosts"
              );
            },
          },
          (oldData) => {
            if (!oldData) return oldData;

            // InfiniteQuery 데이터 구조 업데이트
            if (oldData.pages) {
              let hasChanges = false;
              const newPages = oldData.pages.map((page) => {
                if (!page.posts) return page;

                const newPosts = page.posts.map((post) => {
                  if (post.id === postId) {
                    const postNeedsUpdate =
                      (typeof result.likesCount === "number" &&
                        post.likesCount !== result.likesCount) ||
                      (typeof result.isLiked === "boolean" &&
                        post.isLiked !== result.isLiked);

                    if (postNeedsUpdate) {
                      hasChanges = true;
                      return {
                        ...post,
                        likesCount:
                          typeof result.likesCount === "number"
                            ? result.likesCount
                            : post.likesCount,
                        isLiked:
                          typeof result.isLiked === "boolean"
                            ? result.isLiked
                            : post.isLiked,
                      };
                    }
                  }
                  return post;
                });

                return hasChanges ? { ...page, posts: newPosts } : page;
              });

              // 실제 변경사항이 있을 때만 새 객체 반환
              return hasChanges ? { ...oldData, pages: newPages } : oldData;
            }
            return oldData;
          }
        );
      },
      onError: (err, variables, context) => {
        // 에러 발생 시 이전 상태로 롤백
        if (context?.previousPost) {
          queryClient.setQueryData(postQueryKey, context.previousPost);
        }
      },
    });

  // 좋아요 핸들러
  const handleLike = async () => {
    if (!communityId || !postId || isToggleLikePending) return;
    try {
      await toggleLikeAsync({
        communityId,
        postId,
      });
    } catch (error) {
      debug.error("좋아요 실패:", error);
    }
  };

  // 댓글 버튼 클릭 핸들러 - 입력창으로 스크롤 및 포커스
  const handleCommentClick = useCallback(() => {
    // CommentsSection의 포커스 핸들러가 있으면 사용 (답글 상태 초기화 포함)
    if (focusCommentInputRef.current) {
      focusCommentInputRef.current();
    } else {
      // 없으면 기본 동작
      setTimeout(() => {
        commentInputRef.current?.focus();
        commentInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, []);

  // 로딩 중 - 스켈레톤 표시
  if (isLoading || !communityId) {
    return <PostDetailSkeleton headerButtonCount={3} showCategory={true} />;
  }

  // 에러 처리 또는 communityId가 없는 경우
  if (error || !post || !communityId) {
    const errorMessage = error
      ? "포스트를 불러오는 중 오류가 발생했습니다."
      : !communityId
        ? "커뮤니티 정보를 찾을 수 없습니다."
        : "포스트를 찾을 수 없습니다.";

    return (
      <PostDetailError
        error={error || undefined}
        notFoundMessage={errorMessage}
        backButtonText="커뮤니티로 돌아가기"
      />
    );
  }

  return (
    <div className="bg-white pt-12">
      {/* 메인 콘텐츠 */}
      <PostMainContent
        category={post?.category}
        title={post?.title}
        profileImageUrl={post?.profileImageUrl}
        author={post?.author}
        createdAt={post?.createdAt}
        viewCount={post?.viewCount}
        content={post?.content}
      />
      {/* 좋아요/댓글 액션 바 */}
      <PostActionBar
        isLiked={isLiked}
        likesCount={post?.likesCount || 0}
        commentsCount={post?.commentsCount || 0}
        onLikeClick={handleLike}
        onCommentClick={handleCommentClick}
      />
      {/* 댓글 섹션 */}
      {postId && communityId && (
        <CommentsSection
          postId={postId}
          communityId={communityId}
          postType={post?.type}
          userData={userData}
          commentInputRef={commentInputRef}
          onFocusRequestRef={focusCommentInputRef}
        />
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={isDeleteModalOpen}
        title="게시글을 삭제할까요?"
        description="삭제한 게시글은 복구할 수 없어요."
        cancelText="취소"
        confirmText={isDeleting ? "삭제 중..." : "삭제"}
        onClose={() => !isDeleting && closeDeleteModal()}
        onConfirm={handleDeleteConfirm}
        confirmDisabled={isDeleting}
        variant="danger"
      />

      {/* 삭제 성공 모달 */}
      <Modal
        isOpen={isDeleteSuccessModalOpen}
        title="게시글이 삭제되었어요"
        description={POST_EDIT_CONSTANTS.DELETE_SUCCESS}
        confirmText="확인"
        onClose={handleDeleteSuccessConfirm}
        onConfirm={handleDeleteSuccessConfirm}
        variant="primary"
      />
    </div>
  );
};

/**
 * @description 게시글 상세 페이지
 * 페이지 레벨에서 동기적으로 인증 체크하여 스켈레톤이 보이지 않도록 합니다.
 */
const PostDetailPage = () => {
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
      removeAuthCookie();
      window.location.replace(LINK_URL.LOGIN);
    }
  }, [shouldRedirect]);

  if (shouldRedirect) {
    return null;
  }

  return <PostDetailPageContent />;
};

export default PostDetailPage;
