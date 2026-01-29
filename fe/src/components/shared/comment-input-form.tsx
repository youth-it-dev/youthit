"use client";

import { useCallback, useState, useRef, useEffect, useMemo, memo } from "react";
import type { FormEvent, RefObject, KeyboardEvent } from "react";
import { Image as ImageIcon } from "lucide-react";
import { GiphySelector } from "@/components/shared/giphy-selector";
import { Typography } from "@/components/shared/typography";
import ExpandableBottomSheet from "@/components/shared/ui/expandable-bottom-sheet";
import ProfileImage from "@/components/shared/ui/profile-image";
import {
  COMMENT_PLACEHOLDER,
  COMMENT_SUBMIT_BUTTON,
} from "@/constants/shared/_comment-constants";
import type * as Schema from "@/types/generated/api-schema";
import type { ReplyingToState } from "@/types/shared/comment";
import { cn } from "@/utils/shared/cn";
import { getReplyPlaceholder } from "@/utils/shared/comment";

interface CommentInputFormProps {
  commentInput: string;
  onCommentInputChange: (value: string) => void;
  onCommentSubmit: (
    e: FormEvent,
    customContent?: string
  ) => void | Promise<void>;
  replyingTo: ReplyingToState;
  onCancelReply: () => void;
  userData?: Schema.User;
  inputRef: RefObject<HTMLDivElement | HTMLTextAreaElement>;
  isSubmitting?: boolean;
  commentAuthorName?: string;
}

/**
 * @description 댓글 작성 폼 컴포넌트
 */
export const CommentInputForm = memo(
  ({
    commentInput,
    onCommentInputChange,
    onCommentSubmit,
    replyingTo,
    onCancelReply,
    userData,
    inputRef,
    isSubmitting = false,
    commentAuthorName,
  }: CommentInputFormProps) => {
    const [isGiphyOpen, setIsGiphyOpen] = useState(false);

    const userId = userData?.id;
    const userName = commentAuthorName || userData?.nickname;
    const profileImageUrl = userData?.profileImageUrl;

    // 입력 내용 확인 (텍스트 또는 이미지)
    const hasContent = useMemo(() => {
      const textContent = commentInput.replace(/<[^>]*>/g, "").trim();
      const hasImage = /<img[^>]*>/i.test(commentInput);
      return textContent.length > 0 || hasImage;
    }, [commentInput]);

    const handleSubmit = useCallback(
      (e: FormEvent) => {
        e.preventDefault();
        if (replyingTo?.isReply === true || isSubmitting || !hasContent) return;
        onCommentSubmit(e);
      },
      [onCommentSubmit, replyingTo?.isReply, isSubmitting, hasContent]
    );

    const placeholder =
      replyingTo && !replyingTo.isReply
        ? getReplyPlaceholder(replyingTo.author)
        : COMMENT_PLACEHOLDER;

    const handleGiphyToggle = useCallback(() => {
      setIsGiphyOpen((prev) => !prev);
    }, []);

    const handleGifSelect = useCallback(
      (gifUrl: string) => {
        const inputElement = inputRef.current;
        if (!inputElement) return;

        // contentEditable div인 경우
        if (inputElement instanceof HTMLDivElement) {
          // 입력창에 포커스 주기
          inputElement.focus();

          // 현재 HTML 가져오기
          const currentHtml = commentInput || "";

          // img 태그 생성
          const imgTag = `<img src="${gifUrl}" alt="GIF" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 4px 0;" />`;

          // 현재 내용이 있으면 줄바꿈 추가, 없으면 그냥 추가
          const newHtml = currentHtml
            ? `${currentHtml}<br>${imgTag}<br>`
            : `${imgTag}<br>`;

          // HTML 업데이트
          onCommentInputChange(newHtml);

          // DOM에 직접 삽입하여 즉시 반영
          setTimeout(() => {
            inputElement.innerHTML = newHtml;

            // 커서를 끝으로 이동
            const range = document.createRange();
            const selection = window.getSelection();
            if (selection && inputElement.lastChild) {
              range.selectNodeContents(inputElement);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            }

            inputElement.focus();
          }, 0);
        } else if (inputElement instanceof HTMLTextAreaElement) {
          // textarea인 경우 (fallback)
          const cursorPosition = inputElement.selectionStart || 0;
          const textBefore = commentInput.substring(0, cursorPosition);
          const textAfter = commentInput.substring(cursorPosition);

          const imgTag = `<img src="${gifUrl}" alt="GIF" style="max-width: 100%; height: auto; border-radius: 8px;" />`;
          const newText = `${textBefore}\n${imgTag}\n${textAfter}`;

          onCommentInputChange(newText);

          setTimeout(() => {
            const newCursorPosition = textBefore.length + imgTag.length + 2;
            inputElement.setSelectionRange(
              newCursorPosition,
              newCursorPosition
            );
            inputElement.focus();
          }, 0);
        }
      },
      [commentInput, inputRef, onCommentInputChange]
    );

    const handleInputChange = useCallback(
      (e: React.FormEvent<HTMLDivElement>) => {
        isInternalChangeRef.current = true;
        const target = e.currentTarget;
        const html = target.innerHTML;
        onCommentInputChange(html);
      },
      [onCommentInputChange]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        // Backspace 또는 Delete 키로 img 태그 전체 삭제
        if (e.key === "Backspace" || e.key === "Delete") {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const range = selection.getRangeAt(0);
          const container = inputRef.current;
          if (!container || !(container instanceof HTMLDivElement)) return;

          // 선택된 노드 확인
          let node = range.startContainer;
          if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode as Node;
          }

          // img 태그 찾기
          let imgElement: HTMLImageElement | null = null;
          if (node instanceof HTMLImageElement) {
            imgElement = node;
          } else {
            // 부모 노드에서 img 찾기
            let current: Node | null = node;
            while (current && current !== container) {
              if (current instanceof HTMLImageElement) {
                imgElement = current;
                break;
              }
              current = current.parentNode;
            }
          }

          if (imgElement) {
            e.preventDefault();
            // img 태그와 앞뒤 br 태그 제거
            const parent = imgElement.parentNode;
            if (parent) {
              // 앞의 br 제거
              const prevSibling = imgElement.previousSibling;
              if (prevSibling && prevSibling instanceof HTMLBRElement) {
                parent.removeChild(prevSibling);
              }
              // img 제거
              parent.removeChild(imgElement);
              // 뒤의 br 제거
              const nextSibling = imgElement.nextSibling;
              if (nextSibling && nextSibling instanceof HTMLBRElement) {
                parent.removeChild(nextSibling);
              }

              // 커서 위치 조정
              const newRange = document.createRange();
              if (parent.childNodes.length > 0) {
                newRange.setStart(parent, 0);
              } else {
                newRange.setStart(parent, 0);
              }
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);

              // HTML 업데이트
              const newHtml = container.innerHTML;
              onCommentInputChange(newHtml);
            }
          }
        }
      },
      [inputRef, onCommentInputChange]
    );

    const handleCloseGiphy = useCallback(() => {
      setIsGiphyOpen(false);
    }, []);

    // contentEditable div의 내용 동기화 (외부에서 값이 변경될 때만)
    const isInternalChangeRef = useRef(false);

    useEffect(() => {
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        return;
      }

      const inputElement = inputRef.current;
      if (!inputElement || !(inputElement instanceof HTMLDivElement)) return;

      // 현재 innerHTML과 commentInput이 다를 때만 업데이트
      if (inputElement.innerHTML !== commentInput) {
        inputElement.innerHTML = commentInput || "";
      }
    }, [commentInput, inputRef]);

    return (
      <div className="mt-6 border-t border-gray-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ProfileImage src={profileImageUrl} size="h-6 w-6" alt={userName} />
            <Typography
              font="noto"
              variant="body2M"
              className={cn(
                "text-gray-800",
                replyingTo?.isReply && "text-gray-400"
              )}
            >
              {userName}
            </Typography>
            {replyingTo && !replyingTo.isReply && (
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-500"
              >
                <span className="text-main-500">@{replyingTo.author}</span>
                에게 답글
              </Typography>
            )}
          </div>
          {replyingTo && !replyingTo.isReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              <Typography font="noto" variant="body2R">
                취소
              </Typography>
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <div
            ref={inputRef as RefObject<HTMLDivElement>}
            contentEditable={!replyingTo?.isReply}
            suppressContentEditableWarning
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            data-placeholder={placeholder}
            className={cn(
              "max-h-[200px] min-h-[40px] w-full resize-none overflow-y-auto rounded-lg border p-3 pr-20 pb-12 text-sm focus:outline-none",
              "empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]",
              replyingTo?.isReply
                ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                : "focus:ring-main-400 border-gray-200 focus:ring-2",
              "[&_img]:my-1 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
            )}
            style={{
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          />
          <div className="absolute right-2 bottom-3 flex items-center gap-2">
            {!replyingTo?.isReply && (
              <button
                type="button"
                onClick={handleGiphyToggle}
                disabled={replyingTo?.isReply === true}
                className={cn(
                  "flex h-[40px] w-[40px] items-center justify-center rounded-lg transition-all",
                  replyingTo?.isReply === true
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                )}
                aria-label="GIF 선택"
              >
                <ImageIcon size={20} />
              </button>
            )}
            <button
              type="submit"
              disabled={
                replyingTo?.isReply === true || isSubmitting || !hasContent
              }
              className={cn(
                "h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-all",
                !replyingTo?.isReply && !isSubmitting && hasContent
                  ? "bg-main-500 hover:bg-main-600 cursor-pointer text-white"
                  : "cursor-not-allowed bg-gray-100 text-gray-400 opacity-50"
              )}
            >
              <Typography
                font="noto"
                variant="body2M"
                className={
                  !replyingTo?.isReply && !isSubmitting && hasContent
                    ? "text-white"
                    : "text-gray-400"
                }
              >
                {COMMENT_SUBMIT_BUTTON}
              </Typography>
            </button>
          </div>
        </form>
        {/* GIPHY 선택 UI - 바텀시트로 표시 */}
        <ExpandableBottomSheet
          isOpen={isGiphyOpen && !replyingTo?.isReply}
          onClose={handleCloseGiphy}
        >
          <GiphySelector
            onGifSelect={handleGifSelect}
            onClose={handleCloseGiphy}
          />
        </ExpandableBottomSheet>
      </div>
    );
  }
);

CommentInputForm.displayName = "CommentInputForm";
