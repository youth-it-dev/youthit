"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Modal from "@/components/shared/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { qnaKeys } from "@/constants/generated/query-keys";
import {
  COMMENT_DELETE_MODAL_TITLE,
  COMMENT_DELETE_MODAL_CONFIRM,
  COMMENT_DELETE_MODAL_CANCEL,
} from "@/constants/shared/_comment-constants";
import {
  useGetQnaById,
  usePostQnaById,
  usePutQnaById,
  useDeleteQnaById,
  usePostQnaLikeById,
} from "@/hooks/generated/qna-hooks";
import { debug } from "@/utils/shared/debugger";
import { QnAEmptyMessage } from "./QnAEmptyMessage";
import { QnAInputForm } from "./QnAInputForm";
import { QnAItem } from "./QnAItem";

interface QnAListProps {
  pageId: string;
  pageType: "program" | "announcement" | "store";
  userName: string;
  profileImageUrl?: string;
  maxDisplay?: number; // 최대 표시할 QnA 수 (모집 페이지에서 3개 제한)
  maxReplies?: number; // 최대 표시할 답글 수 (모집 페이지에서 1개 제한)
  showLike?: boolean; // 좋아요 표시 여부
  showInput?: boolean; // 입력 폼 표시 여부
  onShowMoreClick?: () => void; // 더 보기 버튼 클릭 시
  expandQnaId?: string | null; // 특정 QnA의 답글을 펼칠 ID
}

/**
 * @description QnA 목록 컴포넌트
 */
export const QnAList = ({
  pageId,
  pageType,
  userName,
  profileImageUrl,
  maxDisplay,
  maxReplies = 1,
  showLike = true,
  showInput = true,
  onShowMoreClick,
  expandQnaId,
}: QnAListProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [qnaInput, setQnaInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    qnaId: string;
    author: string;
  } | null>(null);
  const [editingQnaId, setEditingQnaId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    expandQnaId ? new Set([expandQnaId]) : new Set()
  );
  const bottomInputRef = useRef<HTMLDivElement>(null);

  // QnA 데이터 가져오기
  const { data: qnaData, isLoading: isQnaLoading } = useGetQnaById({
    request: { pageId, page: 0, size: maxDisplay || 10 },
    enabled: !!pageId,
  });

  const qnas = useMemo(() => {
    const allQnas = qnaData?.qnas || [];
    return maxDisplay ? allQnas.slice(0, maxDisplay) : allQnas;
  }, [qnaData?.qnas, maxDisplay]);

  const hasMore = useMemo(() => {
    if (!maxDisplay) return false;
    return (qnaData?.qnas?.length || 0) > maxDisplay;
  }, [qnaData?.qnas?.length, maxDisplay]);

  // QnA 작성 mutation
  const { mutateAsync: postQnaAsync, isPending: isPostQnaPending } =
    usePostQnaById({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: qnaKeys.getQnaById({ pageId }),
        });
        setQnaInput("");
        setReplyingTo(null);
      },
    });

  // QnA 수정 mutation
  const { mutateAsync: putQnaAsync } = usePutQnaById({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qnaKeys.getQnaById({ pageId }),
      });
      setEditingQnaId(null);
      setEditingContent("");
    },
  });

  // QnA 삭제 mutation
  const { mutateAsync: deleteQnaAsync } = useDeleteQnaById({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qnaKeys.getQnaById({ pageId }),
      });
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
    },
  });

  // QnA 좋아요 mutation
  const { mutateAsync: likeQnaAsync } = usePostQnaLikeById({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qnaKeys.getQnaById({ pageId }),
      });
    },
  });

  // QnA 제출 핸들러
  const handleQnaSubmit = useCallback(
    async (e: FormEvent, customContent?: string) => {
      e.preventDefault();
      if (isPostQnaPending) return;
      const contentToSubmit = customContent ?? qnaInput;
      if (!contentToSubmit.trim() || !pageId) return;

      try {
        await postQnaAsync({
          pageId,
          data: {
            pageType,
            content: contentToSubmit.trim(),
            parentId: replyingTo?.qnaId,
          },
        });
      } catch (error) {
        debug.error("QnA 작성 실패:", error);
      }
    },
    [qnaInput, pageId, pageType, replyingTo, postQnaAsync, isPostQnaPending]
  );

  // 답글 작성 시작
  const handleStartReply = useCallback((qnaId: string, author: string) => {
    setEditingQnaId(null);
    setReplyingTo({ qnaId, author });
    setQnaInput("");
    setTimeout(() => {
      bottomInputRef.current?.focus();
      bottomInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }, []);

  // 답글 작성 취소
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setQnaInput("");
  }, []);

  // QnA 수정 시작
  const handleStartEdit = useCallback((qnaId: string, content: string) => {
    setReplyingTo(null);
    setQnaInput("");
    setEditingQnaId(qnaId);
    setEditingContent(content);
  }, []);

  // QnA 수정 취소
  const handleCancelEdit = useCallback(() => {
    setEditingQnaId(null);
    setEditingContent("");
    setReplyingTo(null);
  }, []);

  // QnA 수정 제출
  const handleEditSubmit = useCallback(
    async (qnaId: string) => {
      if (!editingContent.trim()) return;

      try {
        await putQnaAsync({
          qnaId,
          data: {
            content: editingContent.trim(),
          },
        });
      } catch (error) {
        debug.error("QnA 수정 실패:", error);
      }
    },
    [editingContent, putQnaAsync]
  );

  // QnA 삭제 확인
  const handleDeleteClick = useCallback((qnaId: string) => {
    setDeleteTargetId(qnaId);
    setIsDeleteModalOpen(true);
  }, []);

  // QnA 삭제 실행
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return;

    try {
      await deleteQnaAsync({
        qnaId: deleteTargetId,
      });
    } catch (error) {
      debug.error("QnA 삭제 실패:", error);
    }
  }, [deleteTargetId, deleteQnaAsync]);

  // 답글 더보기 토글
  const handleToggleReplies = useCallback((qnaId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(qnaId)) {
        next.delete(qnaId);
      } else {
        next.add(qnaId);
      }
      return next;
    });
  }, []);

  // 좋아요 핸들러
  const handleLike = useCallback(
    async (qnaId: string) => {
      try {
        await likeQnaAsync({ qnaId });
      } catch (error) {
        debug.error("QnA 좋아요 실패:", error);
      }
    },
    [likeQnaAsync]
  );

  // 더 많은 답글 보기 핸들러
  const handleShowMoreReplies = useCallback(
    (qnaId: string) => {
      // 댓글 페이지로 이동하면서 해당 QnA의 답글을 펼침
      router.push(`/programs/${pageId}/comments?expandQnaId=${qnaId}`);
    },
    [router, pageId]
  );

  // 로딩 중
  if (isQnaLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* QnA 목록 */}
      <div className="border-t border-gray-200 py-6">
        {qnas.length > 0 ? (
          <div className="space-y-4 px-4">
            {qnas.map((qna) => (
              <QnAItem
                key={qna.id}
                qna={qna}
                userName={userName}
                isExpanded={expandedReplies.has(qna.id || "")}
                onToggleReplies={() => handleToggleReplies(qna.id || "")}
                onStartReply={handleStartReply}
                onStartEdit={handleStartEdit}
                onDelete={handleDeleteClick}
                editingQnaId={editingQnaId}
                editingContent={editingContent}
                onEditContentChange={setEditingContent}
                onCancelEdit={handleCancelEdit}
                onEditSubmit={handleEditSubmit}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                onQnaSubmit={handleQnaSubmit}
                showLike={showLike}
                onLike={handleLike}
                maxReplies={maxReplies}
                onShowMoreReplies={handleShowMoreReplies}
              />
            ))}
          </div>
        ) : (
          <QnAEmptyMessage />
        )}

        {/* 더 보기 버튼 */}
        {hasMore && onShowMoreClick && (
          <div className="px-4 pt-4">
            <button
              onClick={onShowMoreClick}
              className="block w-full rounded-lg border border-gray-200 bg-white p-4 text-center hover:bg-gray-50"
              type="button"
            >
              <span className="text-gray-700">다른 문의 더 보기 →</span>
            </button>
          </div>
        )}

        {/* 하단 QnA 작성칸 */}
        {showInput && !editingQnaId && (
          <QnAInputForm
            qnaInput={qnaInput}
            onQnaInputChange={setQnaInput}
            onQnaSubmit={handleQnaSubmit}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            userName={userName}
            profileImageUrl={profileImageUrl}
            inputRef={bottomInputRef}
            isSubmitting={isPostQnaPending}
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
