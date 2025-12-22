"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { FormEvent, RefObject } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { getMissionsPostsCommentsById } from "@/api/generated/missions-api";
import CommentItem from "@/components/community/CommentItem";
import { CommentEmptyMessage } from "@/components/shared/comment-empty-message";
import { CommentInputForm } from "@/components/shared/comment-input-form";
import { CommentSkeleton } from "@/components/shared/comment-skeleton";
import Modal from "@/components/shared/ui/modal";
import { missionsKeys } from "@/constants/generated/query-keys";
import {
  COMMENT_DELETE_MODAL_TITLE,
  COMMENT_DELETE_MODAL_CONFIRM,
  COMMENT_DELETE_MODAL_CANCEL,
  COMMENT_PAGE_SIZE,
} from "@/constants/shared/_comment-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  usePostMissionsPostsCommentsById,
  usePutMissionsPostsCommentsByTwoIds,
  useDeleteMissionsPostsCommentsByTwoIds,
} from "@/hooks/generated/missions-hooks";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { useCommentFocus } from "@/hooks/shared/use-comment-focus";
import type { TGETMissionsPostsCommentsByIdRes } from "@/types/generated/missions-types";
import type { ReplyingToState } from "@/types/shared/comment";
import { debug } from "@/utils/shared/debugger";
import { showToast } from "@/utils/shared/toast";

interface MissionCommentsSectionProps {
  postId: string;
  missionId: string;
  commentInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFocusRequestRef?: React.RefObject<(() => void) | null>;
}

/**
 * @description 미션 인증글 댓글 섹션 컴포넌트
 * - 댓글 목록 표시 (API 연동)
 * - 댓글 작성 기능 (API 연동)
 * - 답글 기능
 */
const MissionCommentsSection = ({
  postId,
  missionId,
  commentInputRef,
  onFocusRequestRef,
}: MissionCommentsSectionProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [commentInput, setCommentInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyingToState>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const bottomTextareaRef = useRef<HTMLTextAreaElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // commentInputRef가 전달되면 그것을 사용, 없으면 내부 ref 사용
  const inputRef =
    (commentInputRef as RefObject<HTMLTextAreaElement>) || bottomTextareaRef;

  // 외부에서 포커스 요청 시 답글 상태 초기화 및 포커스
  useCommentFocus({
    onFocusRequestRef,
    replyingTo,
    setReplyingTo,
    setCommentInput,
    inputRef,
  });

  // 현재 사용자 정보
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
  });

  // 댓글 목록 조회 API (무한 스크롤)
  const {
    data: commentsPagesData,
    isLoading: isCommentsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<TGETMissionsPostsCommentsByIdRes, Error>({
    queryKey: missionsKeys.getMissionsPostsCommentsById({
      postId,
      pageSize: COMMENT_PAGE_SIZE,
    }),
    queryFn: async ({ pageParam }) => {
      const response = await getMissionsPostsCommentsById({
        postId,
        pageSize: COMMENT_PAGE_SIZE,
        startCursor: pageParam as string | undefined,
      });
      return response.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pageInfo?.hasNext && lastPage?.pageInfo?.nextCursor) {
        return lastPage.pageInfo.nextCursor;
      }
      return undefined;
    },
    enabled: !!postId,
  });

  // 댓글 목록 (모든 페이지의 댓글을 합치고 최신순 정렬)
  const comments = useMemo(() => {
    if (!commentsPagesData?.pages) return [];

    const allComments = commentsPagesData.pages.flatMap(
      (page) => page?.comments || []
    );

    return [...allComments].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // 최신순 (내림차순)
    });
  }, [commentsPagesData?.pages]);

  // 미션 게시글 및 댓글 쿼리 무효화 헬퍼
  const invalidateCommentQueries = useCallback(() => {
    // 게시글 상세 정보 refetch (댓글 카운트 반영)
    queryClient.invalidateQueries({
      queryKey: missionsKeys.getMissionsPostsById({ postId }),
    });
    // 댓글 목록 refetch (무한 스크롤 쿼리 무효화)
    queryClient.invalidateQueries({
      queryKey: missionsKeys.getMissionsPostsCommentsById({
        postId,
        pageSize: COMMENT_PAGE_SIZE,
      }),
    });
  }, [queryClient, postId]);

  // 댓글 작성 mutation
  const { mutateAsync: postCommentAsync, isPending: isPostCommentPending } =
    usePostMissionsPostsCommentsById({
      onSuccess: () => {
        invalidateCommentQueries();
        setCommentInput("");
        setReplyingTo(null);
      },
      onError: () => {
        showToast("댓글 작성에 실패했습니다. 다시 시도해주세요.");
      },
    });

  // 댓글 수정 mutation
  const { mutateAsync: putCommentAsync } = usePutMissionsPostsCommentsByTwoIds({
    onSuccess: () => {
      invalidateCommentQueries();
      setEditingCommentId(null);
      setEditingContent("");
    },
    onError: () => {
      showToast("댓글 수정에 실패했습니다. 다시 시도해주세요.");
    },
  });

  // 댓글 삭제 mutation
  const { mutateAsync: deleteCommentAsync } =
    useDeleteMissionsPostsCommentsByTwoIds({
      onSuccess: () => {
        invalidateCommentQueries();
        setIsDeleteModalOpen(false);
        setDeleteTargetId(null);
      },
      onError: () => {
        showToast("댓글 삭제에 실패했습니다. 다시 시도해주세요.");
      },
    });

  // 댓글 제출 핸들러
  const handleCommentSubmit = useCallback(
    async (e: FormEvent, customContent?: string) => {
      e.preventDefault();
      if (isPostCommentPending) return;

      const contentToSubmit = customContent ?? commentInput;
      if (!contentToSubmit.trim() || !postId) return;

      try {
        await postCommentAsync({
          postId,
          data: {
            content: contentToSubmit.trim(),
            ...(replyingTo?.commentId && { parentId: replyingTo.commentId }),
          },
        });
      } catch (error) {
        // 에러는 mutation의 onError에서 처리됨
        debug.error("댓글 작성 실패:", error);
      }
    },
    [commentInput, postId, replyingTo, postCommentAsync, isPostCommentPending]
  );

  // 원댓글에 답글 작성 시작
  const handleStartReplyToRoot = useCallback(
    (commentId: string, author: string) => {
      setEditingCommentId(null);
      setReplyingTo({ commentId, author, isReply: false });
      setCommentInput("");
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 0);
    },
    [inputRef]
  );

  // 답글에 답글 작성 시작
  const handleStartReplyToReply = useCallback(
    (commentId: string, author: string) => {
      setEditingCommentId(null);
      setReplyingTo({ commentId, author, isReply: true });
      setCommentInput("");
    },
    []
  );

  // 답글 작성 취소
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setCommentInput("");
  }, []);

  // 댓글 수정 시작
  const handleStartEdit = useCallback((commentId: string, content: string) => {
    setReplyingTo(null);
    setCommentInput("");
    setEditingCommentId(commentId);
    setEditingContent(content);
  }, []);

  // 댓글 수정 취소
  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditingContent("");
    setReplyingTo(null);
  }, []);

  // 댓글 수정 제출
  const handleEditSubmit = useCallback(
    async (commentId: string) => {
      if (!editingContent.trim()) return;

      try {
        await putCommentAsync({
          postId,
          commentId,
          data: {
            content: editingContent.trim(),
          },
        });
      } catch (error) {
        debug.error("댓글 수정 실패:", error);
      }
    },
    [editingContent, postId, putCommentAsync]
  );

  // 댓글 삭제 확인
  const handleDeleteClick = useCallback((commentId: string) => {
    setDeleteTargetId(commentId);
    setIsDeleteModalOpen(true);
  }, []);

  // 댓글 삭제 실행
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId || !postId) return;

    try {
      await deleteCommentAsync({
        postId,
        commentId: deleteTargetId,
      });
    } catch (error) {
      debug.error("댓글 삭제 실패:", error);
    }
  }, [deleteTargetId, postId, deleteCommentAsync]);

  // 댓글 신고 - 공통 신고 페이지로 이동
  const handleReportComment = useCallback(
    (commentId: string) => {
      if (!postId || !missionId) return;

      // 신고 대상 댓글 찾기 (원댓글 + 대댓글 포함)
      const targetComment =
        comments.find((comment) => comment.id === commentId) ||
        comments
          .flatMap((comment) => comment.replies || [])
          .find((reply) => reply.id === commentId);

      const targetUserId = targetComment?.userId;

      if (!targetUserId) {
        showToast(
          "댓글 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }

      const searchParams = new URLSearchParams({
        targetType: "comment",
        targetId: commentId,
        postId,
        targetUserId,
        missionId,
      });

      router.push(
        `${LINK_URL.COMMUNITY_MISSION_REPORT}?${searchParams.toString()}`
      );
    },
    [comments, missionId, postId, router]
  );

  // 답글 더보기 토글
  const handleToggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  // 메뉴 토글 핸들러
  const handleMenuToggle = useCallback((menuId: string | null) => {
    setOpenMenuId((prev) => (prev === menuId ? null : menuId));
  }, []);

  // 무한 스크롤 트리거 핸들러
  const handleFetchNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Intersection Observer로 무한 스크롤 트리거
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          handleFetchNextPage();
        }
      },
      {
        rootMargin: "120px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [handleFetchNextPage]);

  // 로딩 중
  if (isCommentsLoading) {
    return <CommentSkeleton />;
  }

  return (
    <>
      {/* 댓글 목록 */}
      <div className="border-t border-gray-200 py-6">
        {comments.length > 0 ? (
          <div className="space-y-4 px-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                userData={userData}
                isExpanded={expandedReplies.has(comment.id || "")}
                onToggleReplies={() => handleToggleReplies(comment.id || "")}
                onStartReply={handleStartReplyToRoot}
                onStartReplyToReply={handleStartReplyToReply}
                onStartEdit={handleStartEdit}
                onDelete={handleDeleteClick}
                onReport={handleReportComment}
                editingCommentId={editingCommentId}
                editingContent={editingContent}
                onEditContentChange={setEditingContent}
                onCancelEdit={handleCancelEdit}
                onEditSubmit={handleEditSubmit}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                onCommentSubmit={handleCommentSubmit}
                openMenuId={openMenuId}
                onMenuToggle={handleMenuToggle}
                isCommentSubmitting={isPostCommentPending}
              />
            ))}
          </div>
        ) : (
          <CommentEmptyMessage />
        )}

        {/* 무한 스크롤 트리거 요소 */}
        {hasNextPage && <div ref={loadMoreRef} className="h-4" />}

        {/* 로딩 인디케이터 */}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-gray-400">댓글을 불러오는 중...</div>
          </div>
        )}

        {/* 하단 댓글 작성칸 */}
        {!editingCommentId && (
          <CommentInputForm
            commentInput={commentInput}
            onCommentInputChange={setCommentInput}
            onCommentSubmit={handleCommentSubmit}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            userData={userData}
            inputRef={inputRef}
            isSubmitting={isPostCommentPending}
          />
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={isDeleteModalOpen}
        title={COMMENT_DELETE_MODAL_TITLE}
        confirmText={COMMENT_DELETE_MODAL_CONFIRM}
        cancelText={COMMENT_DELETE_MODAL_CANCEL}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTargetId(null);
        }}
        variant="danger"
      />
    </>
  );
};

export default MissionCommentsSection;
