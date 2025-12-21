"use client";

import { ReactNode } from "react";
import FilterButton from "./FilterButton";
import HorizontalScrollContainer from "./ui/horizontal-scroll-container";

interface FilterOption<TId extends string> {
  id: TId;
  label: string;
}

interface SingleSelectFilterButtonsProps<TId extends string> {
  /** 현재 선택된 필터 ID */
  selectedId: TId;
  /** 필터 변경 핸들러 */
  onSelect: (id: TId) => void;
  /** 필터 옵션 목록 */
  options: Array<FilterOption<TId>>;
  /** 커스텀 아이콘 렌더링 함수 (옵션) */
  renderCustomIcon?: (optionId: TId, isActive: boolean) => ReactNode;
  /** 컨테이너 클래스명 (옵션) */
  className?: string;
}

/**
 * @description 단일 선택 필터 버튼 컴포넌트
 * - 여러 필터 옵션 중 하나만 선택 가능
 * - FilterButton의 UI 스타일을 사용
 */
const SingleSelectFilterButtons = <TId extends string>({
  selectedId,
  onSelect,
  options,
  renderCustomIcon,
  className,
}: SingleSelectFilterButtonsProps<TId>) => {
  return (
    <HorizontalScrollContainer
      className={className}
      leftButtonPositionClassName="-left-4"
      rightButtonPositionClassName="-right-4"
      gradientColor="white"
    >
      <div className="flex items-center gap-2">
        {options.map((option) => {
          const isActive = selectedId === option.id;

          return (
            <FilterButton
              key={String(option.id)}
              label={option.label}
              customIcon={renderCustomIcon?.(option.id, isActive)}
              isActive={isActive}
              onClick={() => onSelect(option.id)}
            />
          );
        })}
      </div>
    </HorizontalScrollContainer>
  );
};

export default SingleSelectFilterButtons;
