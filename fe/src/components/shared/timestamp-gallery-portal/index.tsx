"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { StoredPhoto } from "@/types/shared/_photo-storage-types";
import { TimestampGallery } from "../timestamp-gallery";

interface TimestampGalleryPortalProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onPhotoSelect: (photos: StoredPhoto[]) => void;
  onClose: () => void;
  onNoPhotos?: () => void;
}

const MODAL_MAX_WIDTH = 400;
const VIEWPORT_PADDING = 16;

/**
 * @description 뷰포트 경계 내로 모달의 left 위치를 클램핑
 * @param left - 원본 left 위치 (scrollX 포함 절대 좌표)
 * @returns 클램핑된 left 위치
 */
const clampModalLeftPosition = (left: number): number => {
  if (typeof window === "undefined") {
    return left;
  }

  const viewportWidth = window.innerWidth;
  const modalWidth = Math.min(
    MODAL_MAX_WIDTH,
    viewportWidth - VIEWPORT_PADDING * 2
  );
  const maxLeft = viewportWidth - modalWidth - VIEWPORT_PADDING;

  return Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft));
};

/**
 * @description 타임스탬프 갤러리 포털 컴포넌트
 */
export const TimestampGalleryPortal = ({
  isOpen,
  position,
  onPhotoSelect,
  onClose,
  onNoPhotos,
}: TimestampGalleryPortalProps) => {
  const clampedLeft = useMemo(
    () => clampModalLeftPosition(position.left),
    [position.left]
  );

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* 오버레이: 뒤의 요소 클릭 방지 */}
      <div
        className="fixed inset-0 z-[9999] bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 갤러리 컨텐츠 */}
      <div
        data-timestamp-gallery
        className="fixed z-[10000] max-h-[calc(100vh-100px)] w-[calc(100vw-32px)] max-w-[400px] overflow-y-auto rounded-lg border border-gray-300 bg-white p-4 shadow-2xl"
        style={{
          top: `${position.top}px`,
          left: `${clampedLeft}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TimestampGallery
          onPhotoSelect={onPhotoSelect}
          onClose={onClose}
          onNoPhotos={() => {
            onClose();
            onNoPhotos?.();
          }}
        />
      </div>
    </>,
    document.body
  );
};
