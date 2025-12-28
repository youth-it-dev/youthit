"use client";

import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/shared/useMounted";
import type { StoredPhoto } from "@/types/shared/_photo-storage-types";
import { TimestampGallery } from "../timestamp-gallery";

interface TimestampGalleryPortalProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onPhotoSelect: (photos: StoredPhoto[]) => void;
  onClose: () => void;
  onNoPhotos?: () => void;
}

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
  const isMounted = useMounted();

  if (!isOpen || !isMounted) return null;

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
        className="fixed z-[10000] max-h-[calc(100vh-100px)] w-full max-w-[440px] overflow-y-auto rounded-lg border border-gray-300 bg-white p-4 shadow-2xl"
        style={{
          top: `${position.top}px`,
          left: `${
            typeof window !== "undefined"
              ? Math.max(16, Math.min(position.left, window.innerWidth - 16))
              : position.left
          }px`,
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
