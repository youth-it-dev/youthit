import Image from "next/image";
import { Flame, Plus } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import { cn } from "@/utils/shared/cn";

interface Props {
  /** 날짜 */
  date: number;
  /** 날짜 키 (YYYY-MM-DD) */
  dateKey: string;
  /** 이미지 URL */
  imageUrl?: string;
  /** 인증 여부 */
  hasPost: boolean;
  /** 연속 인증 여부 */
  isConsecutive: boolean;
  /** 현재 달 여부 */
  isCurrentMonth: boolean;
  /** 오늘 날짜 여부 */
  isToday?: boolean;
  /** 현재 루틴 커뮤니티 ID */
  currentRoutineCommunityId?: string | null;
  /** 클릭 핸들러 */
  onClick?: () => void;
}

/**
 * @description 달력 날짜 셀 컴포넌트
 */
const CalendarDayCell = ({
  date,
  dateKey,
  imageUrl,
  hasPost,
  isConsecutive,
  isCurrentMonth,
  isToday = false,
  currentRoutineCommunityId,
  onClick,
}: Props) => {
  // 오늘 날짜이고 인증 사진이 없고 currentRoutineCommunityId가 있으면 인증 가능 상태
  const canCertify = isToday && !hasPost && Boolean(currentRoutineCommunityId);

  const handleClick = () => {
    if (canCertify && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg",
        !isCurrentMonth && "invisible",
        hasPost && imageUrl
          ? "bg-gray-900"
          : canCertify
            ? "border-2 border-blue-500 bg-white"
            : "bg-gray-200",
        canCertify && "cursor-pointer"
      )}
      onClick={handleClick}
    >
      {/* 날짜 숫자 */}
      {!canCertify && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Typography
            font="noto"
            variant="label2B"
            className={cn(hasPost && imageUrl ? "text-white" : "text-gray-400")}
          >
            {date}
          </Typography>
        </div>
      )}

      {/* 인증 가능 상태일 때 플러스 아이콘 */}
      {canCertify && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Plus className="size-5 stroke-3 text-gray-950" />
        </div>
      )}

      {/* 이미지 */}
      {hasPost && imageUrl && (
        <Image
          src={imageUrl}
          alt={`${dateKey} 인증 이미지`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 14vw, 14vw"
        />
      )}

      {/* 연속 인증 불꽃 아이콘 */}
      {isConsecutive && hasPost && imageUrl && (
        <div className="absolute top-0.5 right-1">
          <Flame className="fill-primary-green text-primary-green h-3 w-3" />
        </div>
      )}
    </div>
  );
};

export default CalendarDayCell;
