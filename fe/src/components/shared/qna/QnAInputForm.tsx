"use client";

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
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
import { cn } from "@/utils/shared/cn";

interface QnAInputFormProps {
  qnaInput: string;
  onQnaInputChange: (value: string) => void;
  onQnaSubmit: (e: FormEvent, customContent?: string) => void | Promise<void>;
  replyingTo?: { qnaId: string; author: string } | null;
  onCancelReply?: () => void;
  userName: string;
  profileImageUrl?: string;
  inputRef: RefObject<HTMLDivElement | null>;
  isSubmitting?: boolean;
}

/**
 * @description QnA 작성 폼 컴포넌트
 */
export const QnAInputForm = ({
  qnaInput,
  onQnaInputChange,
  onQnaSubmit,
  replyingTo,
  onCancelReply,
  userName,
  profileImageUrl,
  inputRef,
  isSubmitting = false,
}: QnAInputFormProps) => {
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);

  // 입력 내용 확인 (텍스트 또는 이미지)
  const hasContent = useMemo(() => {
    const textContent = qnaInput.replace(/<[^>]*>/g, "").trim();
    const hasImage = /<img[^>]*>/i.test(qnaInput);
    return textContent.length > 0 || hasImage;
  }, [qnaInput]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (isSubmitting || !hasContent) return;
      onQnaSubmit(e);
    },
    [onQnaSubmit, isSubmitting, hasContent]
  );

  const placeholder = replyingTo
    ? `${replyingTo.author}님에게 답글 남기기`
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
        inputElement.focus();

        const currentHtml = qnaInput || "";
        const imgTag = `<img src="${gifUrl}" alt="GIF" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 4px 0;" />`;
        const newHtml = currentHtml
          ? `${currentHtml}<br>${imgTag}<br>`
          : `${imgTag}<br>`;

        onQnaInputChange(newHtml);

        setTimeout(() => {
          inputElement.innerHTML = newHtml;
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
      }
    },
    [qnaInput, inputRef, onQnaInputChange]
  );

  const handleInputChange = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      isInternalChangeRef.current = true;
      const target = e.currentTarget;
      const html = target.innerHTML;
      onQnaInputChange(html);
    },
    [onQnaInputChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const container = inputRef.current;
        if (!container || !(container instanceof HTMLDivElement)) return;

        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode as Node;
        }

        let imgElement: HTMLImageElement | null = null;
        if (node instanceof HTMLImageElement) {
          imgElement = node;
        } else {
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
          const parent = imgElement.parentNode;
          if (parent) {
            const prevSibling = imgElement.previousSibling;
            if (prevSibling && prevSibling instanceof HTMLBRElement) {
              parent.removeChild(prevSibling);
            }
            parent.removeChild(imgElement);
            const nextSibling = imgElement.nextSibling;
            if (nextSibling && nextSibling instanceof HTMLBRElement) {
              parent.removeChild(nextSibling);
            }

            const newRange = document.createRange();
            if (parent.childNodes.length > 0) {
              newRange.setStart(parent, 0);
            } else {
              newRange.setStart(parent, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            const newHtml = container.innerHTML;
            onQnaInputChange(newHtml);
          }
        }
      }
    },
    [inputRef, onQnaInputChange]
  );

  const handleCloseGiphy = useCallback(() => {
    setIsGiphyOpen(false);
  }, []);

  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const inputElement = inputRef.current;
    if (!inputElement || !(inputElement instanceof HTMLDivElement)) return;

    if (inputElement.innerHTML !== qnaInput) {
      inputElement.innerHTML = qnaInput || "";
    }
  }, [qnaInput, inputRef]);

  return (
    <div className="mt-6 border-t border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ProfileImage src={profileImageUrl} size="h-6 w-6" alt={userName} />
          <Typography font="noto" variant="body2M" className="text-gray-800">
            {userName}
          </Typography>
          {replyingTo && (
            <Typography font="noto" variant="body2R" className="text-gray-500">
              <span className="text-main-500">@{replyingTo.author}</span>
              에게 답글
            </Typography>
          )}
        </div>
        {replyingTo && onCancelReply && (
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
          ref={inputRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInputChange}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          className={cn(
            "max-h-[200px] min-h-[40px] w-full resize-none overflow-y-auto rounded-lg border p-3 pr-20 pb-12 text-sm focus:outline-none",
            "[&:empty]:before:text-gray-400 [&:empty]:before:content-[attr(data-placeholder)]",
            "focus:ring-main-400 border-gray-200 focus:ring-2",
            "[&_img]:my-1 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
          )}
          style={{
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        />
        <div className="absolute right-2 bottom-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleGiphyToggle}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-800"
            aria-label="GIF 선택"
          >
            <ImageIcon size={20} />
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !hasContent}
            className={cn(
              "h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-all",
              !isSubmitting && hasContent
                ? "bg-main-600 hover:bg-main-700 cursor-pointer text-white"
                : "cursor-not-allowed bg-gray-100 text-gray-400 opacity-50"
            )}
          >
            <Typography
              font="noto"
              variant="body2M"
              className={
                !isSubmitting && hasContent ? "text-white" : "text-gray-400"
              }
            >
              {COMMENT_SUBMIT_BUTTON}
            </Typography>
          </button>
        </div>
      </form>
      <ExpandableBottomSheet isOpen={isGiphyOpen} onClose={handleCloseGiphy}>
        <GiphySelector
          onGifSelect={handleGifSelect}
          onClose={handleCloseGiphy}
        />
      </ExpandableBottomSheet>
    </div>
  );
};
