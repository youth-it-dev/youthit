"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Typography } from "@/components/shared/typography";
import { cn } from "@/utils/shared/cn";

interface ModalProps {
  /** 모달 열림/닫힘 상태 */
  isOpen: boolean;
  /** 모달 제목 */
  title: string;
  /** 모달 설명 (선택) */
  description?: string;
  /** 추가 콘텐츠 (선택, 예: input 필드) */
  children?: ReactNode;
  /** 확인 버튼 텍스트 */
  confirmText: string;
  /** 취소 버튼 텍스트 (없으면 취소 버튼 숨김) */
  cancelText?: string;
  /** 확인 버튼 클릭 핸들러 */
  onConfirm: () => void;
  /** 취소/닫기 핸들러 */
  onClose: () => void;
  /** 확인 버튼 비활성화 여부 (선택) */
  confirmDisabled?: boolean;
  /** 버튼 스타일 변형 (기본값: 'primary') */
  variant?: "primary" | "danger";
  /** 오버레이 클릭으로 닫기 허용 여부 (기본값: true) */
  closeOnOverlayClick?: boolean;
  /** Escape 키로 닫기 허용 여부 (기본값: true) */
  closeOnEscape?: boolean;
}

/**
 * @description 공통 모달 컴포넌트
 * - 오버레이: #000 60% 투명도 (rgba(0, 0, 0, 0.6))
 * - 모달 카드: 흰색 배경, 둥근 모서리
 * - 버튼: variant에 따라 primary(핑크) 또는 danger(빨강) 스타일
 */
const Modal = ({
  isOpen,
  title,
  description,
  children,
  confirmText,
  cancelText,
  onConfirm,
  onClose,
  confirmDisabled = false,
  variant = "primary",
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) => {
  const previousOverflow = useRef<string>("");
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // 이전 포커스 요소 저장 (모달 열릴 때)
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedElementRef.current =
      document.activeElement as HTMLElement | null;
  }, [isOpen]);

  // 모달 닫기 핸들러 (포커스 복원)
  const handleClose = useCallback(() => {
    onClose();
    // 모달이 닫힌 후 이전 포커스 요소로 복원
    requestAnimationFrame(() => {
      const target = previouslyFocusedElementRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    });
  }, [onClose]);

  // Body 스크롤 방지 (모달 열릴 때)
  useEffect(() => {
    if (isOpen) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow.current;
      };
    }

    return () => {
      document.body.style.overflow = previousOverflow.current;
    };
  }, [isOpen]);

  // Escape 키로 모달 닫기
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeOnEscape, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      {/* 오버레이: #000 60% 투명도 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={closeOnOverlayClick ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* 모달 컨텐츠 */}
      <div
        className="relative mx-8 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 제목 */}
        <Typography
          as="h2"
          id="modal-title"
          font="noto"
          variant="heading2B"
          className="mb-2 text-black"
        >
          {title}
        </Typography>

        {/* 설명 (선택) */}
        {description && (
          <Typography
            as="p"
            font="noto"
            variant="body2R"
            className={cn(
              "mb-4",
              variant === "danger" ? "text-red-500" : "text-gray-700"
            )}
          >
            {description}
          </Typography>
        )}

        {/* 추가 콘텐츠 (선택) */}
        {children && <div className="mb-6">{children}</div>}

        {/* 버튼들 */}
        <div className="mt-6 flex gap-3">
          {/* 취소 버튼 - cancelText가 있을 때만 표시 */}
          {cancelText && (
            <button
              onClick={handleClose}
              className="flex-1 grow rounded-lg border border-gray-100 bg-white py-2 text-black shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500"
              aria-label={cancelText}
            >
              <Typography font="noto" variant="body2M">
                {cancelText}
              </Typography>
            </button>
          )}

          {/* 확인 버튼 */}
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              "bg-main-600 hover:bg-main-700 rounded-lg py-2 text-white transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300",
              "flex-1 grow"
            )}
            aria-label={confirmText}
          >
            <Typography font="noto" variant="body2M" className="text-white">
              {confirmText}
            </Typography>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
