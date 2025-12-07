"use client";

import { useState, useMemo, useCallback } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import KebabMenu from "@/components/shared/kebab-menu";
import { Typography } from "@/components/shared/typography";
import { parseCommentContent } from "@/utils/community/parse-comment-content";
import { cn } from "@/utils/shared/cn";
import { getTimeAgo } from "@/utils/shared/date";

/**
 * QnA 콘텐츠 렌더링 컴포넌트
 */
const QnAContent = ({ content }: { content: string }) => {
  const parsedContent = useMemo(() => parseCommentContent(content), [content]);

  return (
    <div className="prose prose-sm [&_*]:overflow-wrap-anywhere mb-2 max-w-full text-sm wrap-break-word text-gray-700">
      {parsedContent}
    </div>
  );
};

interface QnAItemProps {
  qna: {
    id?: string;
    author?: string;
    content?: string;
    parentId?: string | null;
    depth?: number;
    isLocked?: boolean;
    isDeleted?: boolean;
    likesCount?: number;
    isLiked?: boolean;
    repliesCount?: number;
    createdAt?: string;
    updatedAt?: string;
    isAdmin?: boolean;
    replies?: Array<{
      id?: string;
      author?: string;
      content?: string;
      createdAt?: string;
      isAdmin?: boolean;
      isLiked?: boolean;
      likesCount?: number;
    }>;
  };
  userName: string;
  isExpanded?: boolean;
  onToggleReplies?: () => void;
  onStartReply?: (qnaId: string, author: string) => void;
  onStartEdit?: (qnaId: string, content: string) => void;
  onDelete?: (qnaId: string) => void;
  editingQnaId?: string | null;
  editingContent?: string;
  onEditContentChange?: (content: string) => void;
  onCancelEdit?: () => void;
  onEditSubmit?: (qnaId: string) => void;
  replyingTo?: { qnaId: string; author: string } | null;
  onCancelReply?: () => void;
  onQnaSubmit?: (e: FormEvent) => void | Promise<void>;
  showLike?: boolean;
  onLike?: (qnaId: string) => void;
  maxReplies?: number; // 최대 표시할 답글 수 (기본값: 모든 답글)
  onShowMoreReplies?: (qnaId: string) => void; // 더 많은 답글 보기 클릭 시
}

/**
 * @description QnA 아이템 컴포넌트
 */
export const QnAItem = ({
  qna,
  userName,
  isExpanded = false,
  onToggleReplies,
  onStartReply,
  onStartEdit,
  onDelete,
  editingQnaId,
  editingContent = "",
  onEditContentChange,
  onCancelEdit,
  onEditSubmit,
  replyingTo,
  onCancelReply,
  onQnaSubmit,
  showLike = true,
  onLike,
  maxReplies,
  onShowMoreReplies,
}: QnAItemProps) => {
  const qnaId = qna.id || "";
  const isRootQnA = !qna.parentId;
  const isEditing = editingQnaId === qnaId;
  const isReplying = replyingTo?.qnaId === qnaId;
  const isOwnQnA = qna.author === userName;

  // replies 배열 정규화
  const replies = useMemo(() => {
    const rawReplies = qna.replies || [];
    return Array.isArray(rawReplies)
      ? rawReplies.filter((reply) => reply && reply.id)
      : [];
  }, [qna.replies]);

  const repliesCount = qna.repliesCount ?? replies.length;

  // maxReplies가 설정되어 있으면 제한
  const visibleReplies = useMemo(() => {
    if (maxReplies !== undefined) {
      return isExpanded ? replies : replies.slice(0, maxReplies);
    }
    return isExpanded ? replies : replies.slice(0, 1);
  }, [isExpanded, replies, maxReplies]);

  const hiddenRepliesCount = Math.max(0, repliesCount - (maxReplies ?? 1));
  const shouldShowMoreButton = hiddenRepliesCount > 0 && !isExpanded;

  const handleLike = useCallback(() => {
    if (onLike && qnaId) {
      onLike(qnaId);
    }
  }, [onLike, qnaId]);

  if (qna.isLocked) {
    return (
      <div className="flex flex-col gap-1">
        <Typography
          font="noto"
          variant="label1M"
          className="mb-2 text-gray-700"
        >
          신고된 문의입니다.
        </Typography>
        {qna.createdAt && (
          <Typography
            font="noto"
            variant="label2R"
            className="shrink-0 text-gray-400"
          >
            {getTimeAgo(qna.createdAt)}
          </Typography>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 메인 QnA */}
      <div className="flex gap-3">
        {/* 작성자 프로필 썸네일 */}
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-300" />

        <div className="min-w-0 flex-1">
          {/* QnA 헤더 */}
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-800"
              >
                {qna.author || "익명"}
              </Typography>
              {qna.isAdmin && (
                <span className="bg-main-500 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white">
                  유스보이스
                </span>
              )}
              {qna.createdAt && (
                <Typography
                  font="noto"
                  variant="label2R"
                  className="shrink-0 text-gray-400"
                >
                  {getTimeAgo(qna.createdAt)}
                </Typography>
              )}
            </div>
            {/* 본인 QnA일 때만 수정/삭제 메뉴 표시 */}
            {!isEditing && isOwnQnA && (onStartEdit || onDelete) && (
              <KebabMenu
                onEdit={
                  onStartEdit && qna.content
                    ? () => {
                        if (qna.content) {
                          onStartEdit(qnaId, qna.content);
                        }
                      }
                    : undefined
                }
                onDelete={onDelete ? () => onDelete(qnaId) : undefined}
                className="shrink-0"
              />
            )}
          </div>

          {/* QnA 내용 또는 수정 입력칸 */}
          {isEditing ? (
            <div className="mb-2 space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gray-300"></div>
                  <Typography
                    font="noto"
                    variant="body2M"
                    className="text-gray-800"
                  >
                    {qna.author || "익명"}
                  </Typography>
                </div>
                <button
                  onClick={onCancelEdit}
                  className="text-sm text-gray-600 hover:text-gray-800"
                  type="button"
                >
                  <Typography font="noto" variant="body2R">
                    취소
                  </Typography>
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingContent.trim() && onEditSubmit) {
                    onEditSubmit(qnaId);
                  }
                }}
              >
                <textarea
                  value={editingContent}
                  onChange={(e) => onEditContentChange?.(e.target.value)}
                  className="focus:ring-main-400 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:ring-2 focus:outline-none"
                  rows={Math.min(editingContent.split("\n").length + 1, 5)}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!editingContent.trim()}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      editingContent.trim()
                        ? "bg-main-600 hover:bg-main-700 text-white"
                        : "bg-gray-200 text-gray-400"
                    )}
                  >
                    <Typography
                      font="noto"
                      variant="body2M"
                      className={
                        editingContent.trim() ? "text-white" : "text-gray-400"
                      }
                    >
                      등록
                    </Typography>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {qna.content && <QnAContent content={qna.content} />}

              {/* QnA 액션 버튼 */}
              <div className="flex items-center gap-[6px]">
                {onStartReply && (
                  <button
                    onClick={() => onStartReply(qnaId, qna.author || "")}
                    className="flex items-center rounded-sm border border-gray-200 px-2 py-1 text-gray-600 hover:text-gray-800"
                    type="button"
                  >
                    <Typography font="noto" variant="label1R">
                      답글 쓰기
                    </Typography>
                  </button>
                )}
                {showLike && onLike && (
                  <button
                    onClick={handleLike}
                    className="flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600 hover:text-gray-800"
                    type="button"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-colors",
                        qna.isLiked
                          ? "fill-main-500 text-main-500"
                          : "text-gray-600"
                      )}
                      fill={qna.isLiked ? "currentColor" : "none"}
                    />
                    <Typography font="noto" variant="label1R">
                      {qna.likesCount || 0}
                    </Typography>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 답글 목록 */}
      {isRootQnA && (replies.length > 0 || repliesCount > 0) && (
        <div className="ml-11 space-y-3">
          {visibleReplies.length > 0
            ? visibleReplies.map((reply) => {
                const replyId = reply.id || "";
                const replyAuthor = reply.author || "익명";

                return (
                  <div key={replyId} className="flex gap-3">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-300" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Typography
                          font="noto"
                          variant="body2R"
                          className="text-gray-800"
                        >
                          {replyAuthor}
                        </Typography>
                        {reply.isAdmin && (
                          <span className="bg-main-500 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white">
                            유스보이스
                          </span>
                        )}
                        {reply.createdAt && (
                          <Typography
                            font="noto"
                            variant="label2R"
                            className="shrink-0 text-gray-400"
                          >
                            {getTimeAgo(reply.createdAt)}
                          </Typography>
                        )}
                      </div>
                      {reply.content && <QnAContent content={reply.content} />}
                      {showLike && onLike && (
                        <button
                          onClick={() => onLike(replyId)}
                          className="mt-1 flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600 hover:text-gray-800"
                          type="button"
                        >
                          <Heart
                            className={cn(
                              "h-4 w-4 transition-colors",
                              reply.isLiked
                                ? "fill-main-500 text-main-500"
                                : "text-gray-600"
                            )}
                            fill={reply.isLiked ? "currentColor" : "none"}
                          />
                          <Typography font="noto" variant="label1R">
                            {reply.likesCount || 0}
                          </Typography>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            : null}

          {/* 더 많은 답글 보기 버튼 */}
          {shouldShowMoreButton && (
            <button
              onClick={() => {
                if (onShowMoreReplies) {
                  onShowMoreReplies(qnaId);
                } else if (onToggleReplies) {
                  onToggleReplies();
                }
              }}
              className="text-main-500 text-sm hover:underline"
              type="button"
            >
              <Typography font="noto" variant="body2R">
                답글 {hiddenRepliesCount}개 더보기
              </Typography>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
