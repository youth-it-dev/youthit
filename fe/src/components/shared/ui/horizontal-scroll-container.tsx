"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/shared/cn";

/**
 * 그라데이션 색상 클래스 맵
 */
const GRADIENT_COLOR_MAP: Record<string, string> = {
  "gray-200": "from-gray-200/60 via-gray-200/30",
  white: "from-white/60 via-white/30",
  "gray-100": "from-gray-100/60 via-gray-100/30",
  "gray-50": "from-gray-50/60 via-gray-50/30",
} as const;

interface HorizontalScrollContainerProps {
  /** 스크롤 컨테이너의 자식 요소 */
  children: ReactNode;
  /** 추가 클래스명 */
  className?: string;
  /** 스크롤 컨테이너의 추가 클래스명 */
  containerClassName?: string;
  /** 그라데이션 배경색 (Tailwind 색상 클래스명, 예: "gray-200", "white"). 기본값: "gray-200" */
  gradientColor?: string;
  /** 그라데이션 효과 표시 여부. 기본값: true */
  showGradient?: boolean;
  /** 왼쪽 버튼 컨테이너의 위치 클래스명 (예: "left-[10px]", "left-0"). 기본값: "left-[10px]" */
  leftButtonPositionClassName?: string;
  /** 오른쪽 버튼 컨테이너의 위치 클래스명 (예: "right-[10px]", "right-0"). 기본값: "right-[10px]" */
  rightButtonPositionClassName?: string;
}

/**
 * @description 가로 스크롤 컨테이너 컴포넌트
 * - 양쪽 끝에 화살표 버튼을 absolute로 배치
 * - 왼쪽 버튼: 한 칸씩 왼쪽으로 스크롤
 * - 오른쪽 버튼: 한 칸씩 오른쪽으로 스크롤
 * - 스크롤 가능 여부에 따라 버튼 표시/숨김
 */
const HorizontalScrollContainer = ({
  children,
  className,
  containerClassName,
  gradientColor = "gray-200",
  showGradient = true,
  leftButtonPositionClassName = "left-[10px]",
  rightButtonPositionClassName = "right-[10px]",
}: HorizontalScrollContainerProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftButton, setShowLeftButton] = useState(false);
  const [showRightButton, setShowRightButton] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    const isAtStart = scrollLeft <= 1;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;

    setShowLeftButton(!isAtStart);
    setShowRightButton(!isAtEnd);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    updateScrollButtons();

    const handleScroll = () => updateScrollButtons();
    const resizeObserver = new ResizeObserver(() => {
      updateScrollButtons();
    });

    scrollContainer.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollButtons]);

  /**
   * 카드 하나의 너비를 계산 (gap 포함)
   */
  const getCardWidth = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return 0;

    const firstChild = scrollContainer.firstElementChild as HTMLElement;
    if (!firstChild) return 0;

    // 카드 너비
    const cardWidth = firstChild.offsetWidth;

    // gap 값 계산 (getComputedStyle로 실제 gap 값 가져오기)
    const computedStyle = window.getComputedStyle(scrollContainer);
    const gap = parseFloat(computedStyle.gap) || 0;

    return cardWidth + gap;
  }, []);

  /**
   * 다음 카드의 시작 위치로 스크롤
   */
  const scrollToNextCard = useCallback(
    (direction: "left" | "right") => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      // 현재 스크롤 위치
      const currentScroll = scrollContainer.scrollLeft;
      const cardWidth = getCardWidth();

      if (cardWidth === 0) {
        // 카드 너비를 계산할 수 없는 경우 기본 동작
        const offset = Math.floor(scrollContainer.clientWidth * 0.8);
        scrollContainer.scrollBy({
          left: direction === "right" ? offset : -offset,
          behavior: "smooth",
        });
        return;
      }

      // 다음 카드의 시작 위치 계산
      const nextScroll =
        direction === "right"
          ? Math.ceil((currentScroll + 1) / cardWidth) * cardWidth
          : Math.floor((currentScroll - 1) / cardWidth) * cardWidth;

      scrollContainer.scrollTo({
        left: Math.max(0, nextScroll),
        behavior: "smooth",
      });
    },
    [getCardWidth]
  );

  const handleScrollLeft = () => {
    scrollToNextCard("left");
  };

  const handleScrollRight = () => {
    scrollToNextCard("right");
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollContainerRef}
        className={cn(
          "scrollbar-hide overflow-x-auto overflow-y-hidden",
          containerClassName
        )}
      >
        {children}
      </div>

      {/* 왼쪽 그라데이션 및 버튼 */}
      {showLeftButton && (
        <div
          className={cn(
            "pointer-events-none absolute top-0 z-10 flex h-full items-center",
            leftButtonPositionClassName
          )}
        >
          {/* 그라데이션 영역: 버튼과 그라데이션 효과를 위한 충분한 너비 확보, 컨테이너 밖으로 확장 */}
          <div
            className={cn(
              "relative h-full",
              showGradient ? "-ml-8 w-32" : "w-auto"
            )}
          >
            {/* 그라데이션 배경 */}
            {showGradient && (
              <div
                className={cn(
                  "h-full w-full bg-linear-to-r to-transparent",
                  GRADIENT_COLOR_MAP[gradientColor] ||
                    GRADIENT_COLOR_MAP["gray-200"]
                )}
              />
            )}
            {/* 버튼 */}
            <button
              type="button"
              onClick={handleScrollLeft}
              className={cn(
                "focus-visible:outline-main-500 pointer-events-auto absolute top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/90 focus:outline-none focus-visible:outline-2",
                showGradient ? "left-8" : "left-0"
              )}
              aria-label="왼쪽으로 스크롤"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      )}

      {/* 오른쪽 그라데이션 및 버튼 */}
      {showRightButton && (
        <div
          className={cn(
            "pointer-events-none absolute top-0 z-10 flex h-full items-center",
            rightButtonPositionClassName
          )}
        >
          {/* 그라데이션 영역: 버튼과 그라데이션 효과를 위한 충분한 너비 확보, 컨테이너 밖으로 확장 */}
          <div
            className={cn(
              "relative h-full",
              showGradient ? "-mr-8 w-32" : "w-auto"
            )}
          >
            {/* 그라데이션 배경 */}
            {showGradient && (
              <div
                className={cn(
                  "h-full w-full bg-linear-to-l to-transparent",
                  GRADIENT_COLOR_MAP[gradientColor] ||
                    GRADIENT_COLOR_MAP["gray-200"]
                )}
              />
            )}
            {/* 버튼 */}
            <button
              type="button"
              onClick={handleScrollRight}
              className={cn(
                "focus-visible:outline-main-500 pointer-events-auto absolute top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/90 focus:outline-none focus-visible:outline-2",
                showGradient ? "right-8" : "right-0"
              )}
              aria-label="오른쪽으로 스크롤"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalScrollContainer;
