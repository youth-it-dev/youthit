/**
 * @description 조회 기간 선택 버튼 컴포넌트
 */

import { Typography } from "@/components/shared/typography";
import type { PeriodOption } from "@/types/store/_nadaum-history-types";
import { cn } from "@/utils/shared/cn";

interface PeriodOptionButtonProps {
  /** 옵션 값 */
  value: PeriodOption;
  /** 표시할 라벨 */
  label: string;
  /** 선택 여부 */
  isSelected: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
}

/**
 * @description 조회 기간 선택 버튼
 */
export function PeriodOptionButton({
  value,
  label,
  isSelected,
  onClick,
}: PeriodOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center rounded-lg border bg-white py-3 transition-colors",
        isSelected ? "border-black" : "border-gray-100"
      )}
    >
      <Typography
        font="noto"
        variant="body2M"
        className={isSelected ? "text-gray-950" : "text-gray-400"}
      >
        {label}
      </Typography>
    </button>
  );
}
