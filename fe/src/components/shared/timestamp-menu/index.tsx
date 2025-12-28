"use client";

import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/shared/useMounted";

interface TimestampMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onLocalGalleryClick: () => void;
  onUsitGalleryClick: () => void;
}

/**
 * @description 타임스탬프 메뉴 컴포넌트
 * 갤러리 선택 버튼으로 사진 촬영과 로컬 갤러리 선택을 모두 처리합니다.
 */
export const TimestampMenu = forwardRef<HTMLDivElement, TimestampMenuProps>(
  ({ isOpen, position, onLocalGalleryClick, onUsitGalleryClick }, ref) => {
    const isMounted = useMounted();

    if (!isOpen || !isMounted) return null;

    return createPortal(
      <div
        ref={ref}
        className="fixed z-[9999] w-40 overflow-hidden rounded border border-gray-300 bg-white shadow-sm"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
          onClick={onLocalGalleryClick}
          aria-label="사진 촬영 또는 갤러리 선택"
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
