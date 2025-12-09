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
  /** 핸들바 드래그로 높이 조정 가능 여부 (기본값: false) */
  enableDrag?: boolean;
}

// 기본 높이와 최대 높이 설정
const DEFAULT_HEIGHT = 0.5; // 50vh
const MAX_HEIGHT = 0.9; // 90vh

/**
 * @description 공통 바텀시트 컴포넌트
 * - 하단에서 올라오는 모달 형태
 * - 오버레이 클릭 시 닫힘
 * - 애니메이션 포함
 * - enableDrag prop으로 핸들바 드래그 기능 선택 가능
 */
const BottomSheet = ({
  isOpen,
  onClose,
  children,
  className,
  enableDrag = false,
}: BottomSheetProps) => {
  const previousOverflow = useRef<string>("");
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 높이 조정 관련 상태
  const [height, setHeight] = useState<number | null>(null); // null이면 컨텐츠 높이에 맞춤
  const [isDragging, setIsDragging] = useState(false);
  const [isManuallyAdjusted, setIsManuallyAdjusted] = useState(false); // 사용자가 수동으로 조정했는지 여부
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const hasDragged = useRef<boolean>(false); // 실제 드래그가 발생했는지 여부
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); // 컨텐츠 영역 ref
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

  // 드래그 시작 핸들러 (enableDrag가 true일 때만 사용)
  const handleDragStart = (clientY: number) => {
    if (!enableDrag) return;
    hasDragged.current = false; // 드래그 시작 시 초기화
    setIsDragging(true);
    setIsManuallyAdjusted(true); // 사용자가 수동으로 조정 시작
    dragStartY.current = clientY;
    const currentHeight = height ?? DEFAULT_HEIGHT;
    dragStartHeight.current = currentHeight;
  };

  // 핸들바 클릭 핸들러 (enableDrag가 false일 때 바텀시트 닫기)
  const handleHandleClick = (e: React.MouseEvent) => {
    if (!enableDrag) {
      handleClose();
    } else {
      // enableDrag가 true일 때는 클릭 이벤트를 막고 마우스업에서 처리
      e.preventDefault();
    }
  };

  // 핸들바 마우스/터치 업 핸들러 (클릭과 드래그 구분)
  const handleHandleMouseUp = () => {
    // enableDrag가 활성화되어 있고, 실제 드래그가 발생하지 않았을 때만 닫기
    if (enableDrag && !hasDragged.current) {
      handleClose();
    }
  };

  // 드래그 중 핸들러
  const handleDragMove = (clientY: number) => {
    if (!isDraggingRef.current || !enableDrag) return;

    const deltaY = dragStartY.current - clientY; // 위로 드래그하면 양수

    // 드래그가 발생했는지 확인 (5px 이상 이동 시 드래그로 간주)
    if (Math.abs(deltaY) > 5) {
      hasDragged.current = true;
    }

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
    if (!isDraggingRef.current || !enableDrag) return;
    setIsDragging(false);

    // 실제 드래그가 발생했을 때만 스냅 처리
    if (hasDragged.current) {
      const currentHeight = heightRef.current ?? DEFAULT_HEIGHT;
      const midPoint = (DEFAULT_HEIGHT + MAX_HEIGHT) / 2;

      // 중간 지점 기준으로 기본 높이 또는 최대 높이로 스냅
      if (currentHeight < midPoint) {
        setHeight(DEFAULT_HEIGHT);
      } else {
        setHeight(MAX_HEIGHT);
      }
    }

    // 드래그 상태 초기화
    hasDragged.current = false;
  };

  // 마우스 이벤트 핸들러 (enableDrag가 true일 때만 활성화)
  useEffect(() => {
    if (!isDragging || !enableDrag) return;

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
  }, [isDragging, enableDrag]);

  // 터치 이벤트 핸들러 (enableDrag가 true일 때만 활성화)
  useEffect(() => {
    if (!isDragging || !enableDrag) return;

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
  }, [isDragging, enableDrag]);

  // 컨텐츠 높이에 맞춰 바텀시트 높이 자동 조정 (enableDrag가 true일 때만 실행)
  useEffect(() => {
    if (
      !enableDrag ||
      !isOpen ||
      !isVisible ||
      isManuallyAdjusted ||
      !contentRef.current
    )
      return;

    const updateHeight = () => {
      if (!contentRef.current) return;

      const contentElement = contentRef.current;
      // 컨텐츠의 실제 높이 측정 (스크롤 가능한 전체 높이)
      // 컨텐츠가 자동 높이에 맞춰지도록 하기 위해 scrollHeight 사용
      const contentHeight = contentElement.scrollHeight;

      // 핸들바 높이 포함
      const handleBarHeight = 48; // 핸들바 높이 (py-4 = 16px * 2 + 16px 핸들)
      const paddingBottom = 24; // pb-6 = 24px
      const totalHeight = contentHeight + handleBarHeight + paddingBottom;
      const viewportHeight = window.innerHeight;
      const heightRatio = totalHeight / viewportHeight;

      // 최대 높이 제한 적용
      const finalHeight = Math.min(heightRatio, MAX_HEIGHT);

      // 최소 높이보다 작으면 최소 높이 사용
      if (finalHeight < DEFAULT_HEIGHT) {
        setHeight(DEFAULT_HEIGHT);
      } else {
        setHeight(finalHeight);
      }
    };

    // DOM 렌더링 완료 후 높이 계산 (애니메이션 시작 후)
    const timeoutId = setTimeout(() => {
      updateHeight();
    }, 50);

    // ResizeObserver로 컨텐츠 높이 변경 감지
    const resizeObserver = new ResizeObserver(() => {
      if (!isManuallyAdjusted) {
        updateHeight();
      }
    });

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [enableDrag, isOpen, isVisible, children, isManuallyAdjusted]);

  // 바텀시트가 열릴 때 수동 조정 플래그 초기화 (enableDrag가 true일 때만)
  useEffect(() => {
    if (!enableDrag) return;

    if (isOpen) {
      setIsManuallyAdjusted(false);
    } else {
      setHeight(null);
      setIsManuallyAdjusted(false);
    }
  }, [enableDrag, isOpen]);

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
          enableDrag && isDragging && "transition-none", // 드래그 중에는 transition 비활성화
          className
        )}
        style={{
          // enableDrag가 true일 때만 높이 관련 스타일 적용
          ...(enableDrag
            ? {
                height: height !== null ? `${height * 100}vh` : undefined,
                maxHeight: `${MAX_HEIGHT * 100}vh`,
              }
            : {}),
        }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 바 - 항상 표시, enableDrag에 따라 동작 다름 */}
        <div
          className={cn(
            "flex shrink-0 justify-center py-4",
            enableDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
          )}
          onClick={handleHandleClick}
          onMouseDown={(e) => {
            if (enableDrag) {
              e.preventDefault();
              e.stopPropagation();
              handleDragStart(e.clientY);
            }
          }}
          onMouseUp={(e) => {
            if (enableDrag) {
              e.stopPropagation();
              handleHandleMouseUp();
            }
          }}
          onTouchStart={(e) => {
            if (enableDrag && e.touches.length > 0) {
              e.stopPropagation();
              handleDragStart(e.touches[0].clientY);
            }
          }}
          onTouchEnd={(e) => {
            if (enableDrag) {
              e.stopPropagation();
              handleHandleMouseUp();
            }
          }}
        >
          <div className="h-1 w-8 rounded-full bg-gray-400" />
        </div>

        {/* 컨텐츠 - 스크롤 가능 영역 */}
        <div
          ref={enableDrag ? contentRef : undefined}
          className={cn(
            "px-5",
            // enableDrag가 활성화되고 수동으로 조정되었고 최대 높이에 도달한 경우에만 flex-1 사용 (스크롤 가능)
            // 그 외에는 자동 높이에 맞춰짐
            enableDrag && isManuallyAdjusted && height && height >= MAX_HEIGHT
              ? "flex-1 overflow-y-auto"
              : "overflow-y-auto"
          )}
          style={{
            // enableDrag가 false일 때는 스타일 적용하지 않음
            // enableDrag가 true일 때만 높이 관련 스타일 적용
            ...(enableDrag
              ? enableDrag &&
                isManuallyAdjusted &&
                height &&
                height >= MAX_HEIGHT
                ? {}
                : { height: "auto", maxHeight: "none" }
              : {}),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
