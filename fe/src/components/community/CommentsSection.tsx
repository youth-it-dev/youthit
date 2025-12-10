"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import CommentItem from "@/components/community/CommentItem";
import { CommentEmptyMessage } from "@/components/shared/comment-empty-message";
import { CommentInputForm } from "@/components/shared/comment-input-form";
import { CommentSkeleton } from "@/components/shared/comment-skeleton";
import Modal from "@/components/shared/ui/modal";
import { commentsKeys } from "@/constants/generated/query-keys";
import { communitiesKeys } from "@/constants/generated/query-keys";
import {
  COMMENT_DELETE_MODAL_TITLE,
  COMMENT_DELETE_MODAL_CONFIRM,
  COMMENT_DELETE_MODAL_CANCEL,
} from "@/constants/shared/_comment-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetCommentsCommunitiesPostsByTwoIds,
  usePostCommentsCommunitiesPostsByTwoIds,
  usePutCommentsById,
  useDeleteCommentsById,
} from "@/hooks/generated/comments-hooks";
import { useCommentFocus } from "@/hooks/shared/use-comment-focus";
import type * as Schema from "@/types/generated/api-schema";
import type * as CommentTypes from "@/types/generated/comments-types";
import type { ReplyingToState } from "@/types/shared/comment";

interface CommentsSectionProps {
  postId: string;
  communityId: string;
  postType?: string;
  userData?: Schema.User;
  commentInputRef?: React.RefObject<
    HTMLDivElement | HTMLTextAreaElement | null
  >;
  onFocusRequestRef?: React.RefObject<(() => void) | null>;
}

/**
 * @description 댓글 섹션 컴포넌트
 * - 댓글 목록 표시
 * - 댓글 작성/수정/삭제 기능
 * - 답글 기능
 */
const CommentsSection = ({
  postId,
  communityId,
  userData,
  commentInputRef,
  onFocusRequestRef,
}: CommentsSectionProps) => {
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
  const bottomInputRef = useRef<HTMLDivElement>(null);

  // commentInputRef가 전달되면 그것을 사용, 없으면 내부 ref 사용
  const inputRef =
    (commentInputRef as React.RefObject<
      HTMLDivElement | HTMLTextAreaElement
    >) || bottomInputRef;

  // 외부에서 포커스 요청 시 답글 상태 초기화 및 포커스
  useCommentFocus({
    onFocusRequestRef,
    replyingTo,
    setReplyingTo,
    setCommentInput,
    inputRef,
  });

  // 댓글 요청 파라미터 메모이제이션
  const commentsRequest = useMemo(
    () => ({
      communityId: communityId || "",
      postId,
    }),
    [communityId, postId]
  );

  // 댓글 데이터 가져오기
  const { data: commentsData, isLoading: isCommentsLoading } =
    useGetCommentsCommunitiesPostsByTwoIds({
      request: commentsRequest,
      enabled: !!postId && !!communityId,
    });

  const comments = useMemo(
    () =>
      (commentsData?.comments || []) as NonNullable<
        CommentTypes.TGETCommentsCommunitiesPostsByTwoIdsRes["comments"]
      >,
    [commentsData?.comments]
  );

  // 댓글 작성 mutation
  const { mutateAsync: postCommentAsync, isPending: isPostCommentPending } =
    usePostCommentsCommunitiesPostsByTwoIds({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: commentsKeys.getCommentsCommunitiesPostsByTwoIds({
            communityId: communityId || "",
            postId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: communitiesKeys.getCommunitiesPostsByTwoIds({
            communityId: communityId || "",
            postId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: communitiesKeys.getCommunitiesPosts({
            page: undefined,
            size: undefined,
            programType: undefined,
            programState: undefined,
          }),
        });
        setCommentInput("");
        setReplyingTo(null);
      },
    });

  // 댓글 수정 mutation
  const { mutateAsync: putCommentAsync } = usePutCommentsById({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentsKeys.getCommentsCommunitiesPostsByTwoIds({
          communityId: communityId || "",
          postId,
        }),
      });
      setEditingCommentId(null);
      setEditingContent("");
    },
  });

  // 댓글 삭제 mutation
  const { mutateAsync: deleteCommentAsync } = useDeleteCommentsById({
    onSuccess: () => {
      // 댓글 목록 조회 인밸리데이션
      queryClient.invalidateQueries({
        queryKey: commentsKeys.getCommentsCommunitiesPostsByTwoIds({
          communityId: communityId || "",
          postId,
        }),
      });
      // 게시글의 댓글 카운트 즉시 업데이트
      queryClient.invalidateQueries({
        queryKey: communitiesKeys.getCommunitiesPostsByTwoIds({
          communityId: communityId || "",
          postId,
        }),
      });
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
    },
  });

  // 댓글 제출 핸들러
  const handleCommentSubmit = useCallback(
    async (e: FormEvent, customContent?: string) => {
      e.preventDefault();
      if (isPostCommentPending) return;
      const contentToSubmit = customContent ?? commentInput;
      if (!contentToSubmit.trim() || !communityId || !postId) return;

      try {
        await postCommentAsync({
          communityId,
          postId,
          data: {
            content: contentToSubmit.trim(),
            parentId: replyingTo?.commentId,
          },
        });
      } catch (error) {
        console.error("댓글 작성 실패:", error);
      }
    },
    [
      commentInput,
      communityId,
      postId,
      replyingTo,
      postCommentAsync,
      isPostCommentPending,
    ]
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
          commentId,
          data: {
            content: editingContent.trim(),
          },
        });
      } catch (error) {
        console.error("댓글 수정 실패:", error);
      }
    },
    [editingContent, putCommentAsync]
  );

  // 댓글 삭제 확인
  const handleDeleteClick = useCallback((commentId: string) => {
    setDeleteTargetId(commentId);
    setIsDeleteModalOpen(true);
  }, []);

  // 댓글 삭제 실행
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return;

    try {
      await deleteCommentAsync({
        commentId: deleteTargetId,
      });
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
    }
  }, [deleteTargetId, deleteCommentAsync]);

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

  // 신고 핸들러
  const handleReport = useCallback(
    (commentId: string) => {
      if (!commentId || !communityId || !postId) return;

      // 댓글 정보 찾기 (댓글과 답글 모두 확인)
      let targetComment = comments.find((c) => c.id === commentId);

      // 답글인 경우 replies에서 찾기
      if (!targetComment) {
        for (const comment of comments) {
          const reply = comment.replies?.find((r) => r.id === commentId);
          if (reply) {
            targetComment = reply as typeof comment;
            break;
          }
        }
      }

      if (!targetComment) return;

      // 신고 페이지로 이동
      const reportUrl = `${LINK_URL.COMMUNITY_REPORT}?targetType=comment&targetId=${commentId}&targetUserId=${targetComment.userId || ""}&communityId=${communityId}&postId=${postId}`;
      router.push(reportUrl);
    },
    [comments, communityId, postId, router]
  );

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
                communityId={communityId}
                userData={userData}
                isExpanded={expandedReplies.has(comment.id || "")}
                onToggleReplies={() => handleToggleReplies(comment.id || "")}
                onStartReply={handleStartReplyToRoot}
                onStartReplyToReply={handleStartReplyToReply}
                onStartEdit={handleStartEdit}
                onDelete={handleDeleteClick}
                onReport={handleReport}
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

export default CommentsSection;
