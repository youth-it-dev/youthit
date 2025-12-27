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
    <div
      className="fixed z-[10000] max-h-[calc(100vh-100px)] w-[600px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-lg border border-gray-300 bg-white p-4 shadow-2xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <TimestampGallery
        onPhotoSelect={onPhotoSelect}
        onClose={onClose}
        onNoPhotos={() => {
          onNoPhotos?.();
          onClose();
        }}
      />
    </div>,
    document.body
  );
};
