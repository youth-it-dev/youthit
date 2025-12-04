"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/utils/shared/cn";

interface BottomSheetProps {
  /** 바텀시트 열림/닫힘 상태 */
  isOpen: boolean;
  /** 바텀시트 닫기 핸들러 */
  onClose: () => void;
  /** 바텀시트 콘텐츠 */
  children: ReactNode;
  /** 추가 클래스명 (선택) */
  className?: string;
}

// 기본 높이와 최대 높이 설정
const DEFAULT_HEIGHT = 0.5; // 50vh
const MAX_HEIGHT = 0.9; // 90vh

/**
 * @description 공통 바텀시트 컴포넌트
 * - 하단에서 올라오는 모달 형태
 * - 오버레이 클릭 시 닫힘
 * - 애니메이션 포함
 * - 핸들바 드래그로 높이 조정 가능
 */
const BottomSheet = ({
  isOpen,
  onClose,
  children,
  className,
}: BottomSheetProps) => {
  const previousOverflow = useRef<string>("");
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 높이 조정 관련 상태
  const [height, setHeight] = useState<number | null>(null); // null이면 기본 높이
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef<number | null>(null); // 최신 height 값 참조용
  const isDraggingRef = useRef<boolean>(false); // 최신 isDragging 값 참조용

  // height와 isDragging ref 동기화
  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // 이전 포커스 요소 저장 (바텀시트 열릴 때)
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedElementRef.current =
      document.activeElement as HTMLElement | null;
  }, [isOpen]);

  // 바텀시트 열림/닫힘 애니메이션 처리
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300); // 애니메이션 지속 시간과 동일
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 바텀시트 닫기 핸들러 (포커스 복원)
  const handleClose = () => {
    onClose();
    // 바텀시트가 닫힌 후 이전 포커스 요소로 복원
    setTimeout(() => {
      const target = previouslyFocusedElementRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    }, 300);
  };

  // Body 스크롤 방지 (바텀시트 열릴 때)
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

  // Escape 키로 바텀시트 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // 드래그 시작 핸들러
  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    const currentHeight = height ?? DEFAULT_HEIGHT;
    dragStartHeight.current = currentHeight;
  };

  // 드래그 중 핸들러
  const handleDragMove = (clientY: number) => {
    if (!isDraggingRef.current) return;

    const deltaY = dragStartY.current - clientY; // 위로 드래그하면 양수
    const viewportHeight = window.innerHeight;
    const deltaHeight = deltaY / viewportHeight;
    const newHeight = Math.max(
      DEFAULT_HEIGHT,
      Math.min(MAX_HEIGHT, dragStartHeight.current + deltaHeight)
    );
    setHeight(newHeight);
  };

  // 드래그 종료 핸들러 (스냅 처리)
  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);

    const currentHeight = heightRef.current ?? DEFAULT_HEIGHT;
    const midPoint = (DEFAULT_HEIGHT + MAX_HEIGHT) / 2;

    // 중간 지점 기준으로 기본 높이 또는 최대 높이로 스냅
    if (currentHeight < midPoint) {
      setHeight(DEFAULT_HEIGHT);
    } else {
      setHeight(MAX_HEIGHT);
    }
  };

  // 마우스 이벤트 핸들러
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // 터치 이벤트 핸들러
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  // 바텀시트가 열릴 때 높이 초기화
  useEffect(() => {
    if (isOpen) {
      setHeight(DEFAULT_HEIGHT);
    } else {
      setHeight(null);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* 오버레이 */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          isAnimating ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 바텀시트 컨텐츠 */}
      <div
        ref={bottomSheetRef}
        className={cn(
          "pb-safe relative mx-auto flex w-full max-w-[470px] flex-col rounded-t-3xl bg-white transition-all duration-300 ease-out",
          isAnimating ? "translate-y-0" : "translate-y-full",
          isDragging && "transition-none", // 드래그 중에는 transition 비활성화
          className
        )}
        style={{
          height: height !== null ? `${height * 100}vh` : undefined,
          maxHeight: `${MAX_HEIGHT * 100}vh`,
        }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 바 - 드래그 가능 */}
        <div
          className="flex shrink-0 cursor-grab justify-center py-4 active:cursor-grabbing"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e.clientY);
          }}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handleDragStart(e.touches[0].clientY);
            }
          }}
        >
          <div className="h-1 w-8 rounded-full bg-gray-400" />
        </div>

        {/* 컨텐츠 - 스크롤 가능 영역 */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
};

export default BottomSheet;
