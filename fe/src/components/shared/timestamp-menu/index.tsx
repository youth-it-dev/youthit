"use client";

import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { isAndroidDevice } from "@/utils/shared/device";

interface TimestampMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onLocalGalleryClick: () => void;
  onUsitGalleryClick: () => void;
  onCameraClick?: () => void;
}

/**
 * @description 타임스탬프 메뉴 컴포넌트
 * 플랫폼별로 최적화된 사진 선택 방식을 제공합니다.
 * - 안드로이드: 사진 촬영과 갤러리 선택을 명확히 구분하여 제공
 * - iOS: 시스템 기본 선택지를 활용
 */
export const TimestampMenu = forwardRef<HTMLDivElement, TimestampMenuProps>(
  (
    {
      isOpen,
      position,
      onLocalGalleryClick,
      onUsitGalleryClick,
      onCameraClick,
    },
    ref
  ) => {
    const isAndroid = isAndroidDevice();

    if (!isOpen) return null;

    return createPortal(
      <div
        ref={ref}
        className="fixed z-[9999] w-48 overflow-hidden rounded border border-gray-300 bg-white shadow-sm"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        {isAndroid && onCameraClick && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
            onClick={onCameraClick}
            aria-label="사진 촬영"
          >
            <span className="text-sm">사진 촬영</span>
          </button>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
          onClick={onLocalGalleryClick}
          aria-label="갤러리에서 사진 선택"
        >
          <span className="text-sm">갤러리 선택</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
          onClick={onUsitGalleryClick}
        >
          <span className="text-sm">유스잇 갤러리 선택</span>
        </button>
      </div>,
      document.body
    );
  }
);

TimestampMenu.displayName = "TimestampMenu";
