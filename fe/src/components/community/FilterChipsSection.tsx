"use client";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const CHIP_SCROLL_OFFSET = 200;

interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface FilterChipsSectionProps {
  chips: FilterChip[];
}

/**
 * @description 필터 칩 섹션 컴포넌트
 * - 가로 스크롤 가능한 필터 칩 목록
 * - 좌우 스크롤 버튼 및 그라데이션 표시
 * - 메모이제이션으로 불필요한 리렌더링 방지
 */
const FilterChipsSection = memo(({ chips }: FilterChipsSectionProps) => {
  const chipScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);

  const updateChipScrollIndicators = useCallback(() => {
    const scrollContainer = chipScrollContainerRef.current;
    if (!scrollContainer) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    const isAtStart = scrollLeft <= 0;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;

    setShowLeftGradient(!isAtStart);
    setShowRightGradient(!isAtEnd);
  }, []);

  useEffect(() => {
    const scrollContainer = chipScrollContainerRef.current;
    if (!scrollContainer) return;

    updateChipScrollIndicators();

    const handleScroll = () => updateChipScrollIndicators();
    const resizeObserver = new ResizeObserver(() => {
      updateChipScrollIndicators();
    });

    scrollContainer.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver.disconnect();
    };
  }, [chips.length, updateChipScrollIndicators]);

  const handleScrollLeft = () => {
    chipScrollContainerRef.current?.scrollBy({
      left: -CHIP_SCROLL_OFFSET,
      behavior: "smooth",
    });
  };

  const handleScrollRight = () => {
    chipScrollContainerRef.current?.scrollBy({
      left: CHIP_SCROLL_OFFSET,
      behavior: "smooth",
    });
  };

  if (chips.length === 0) return null;

  return (
    <div className="relative mb-2">
      <div
        ref={chipScrollContainerRef}
        className="scrollbar-hide flex flex-nowrap gap-2 overflow-x-auto pr-8"
      >
        {chips.map((chip) => (
          <div
            key={chip.id}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
          >
            <span>{chip.label}</span>
            <button
              type="button"
              aria-label={`${chip.label} 필터 제거`}
              onClick={chip.onRemove}
              className="flex items-center justify-center rounded-full p-0.5 text-gray-500 hover:bg-gray-200"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>

      {showLeftGradient && (
        <div className="pointer-events-none absolute top-0 left-0 z-10 flex h-full items-center">
          <div className="relative h-full w-16">
            <div className="h-full w-full bg-gradient-to-r from-white via-white to-transparent" />
            <button
              type="button"
              onClick={handleScrollLeft}
              className="pointer-events-auto absolute top-1/2 -translate-y-1/2 rounded-full bg-white p-1 shadow"
              aria-label="필터 칩 왼쪽으로 스크롤"
            >
              <ChevronLeft className="size-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {showRightGradient && (
        <div className="pointer-events-none absolute top-0 right-0 z-10 flex h-full items-center">
          <div className="relative h-full w-16">
            <div className="h-full w-full bg-gradient-to-l from-white via-white to-transparent" />
            <button
              type="button"
              onClick={handleScrollRight}
              className="pointer-events-auto absolute top-1/2 right-0 -translate-y-1/2 rounded-full bg-white p-1 shadow"
              aria-label="필터 칩 오른쪽으로 스크롤"
            >
              <ChevronRight className="size-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

FilterChipsSection.displayName = "FilterChipsSection";

export default FilterChipsSection;
