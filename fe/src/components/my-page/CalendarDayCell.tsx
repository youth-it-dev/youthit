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
  /** 게시글 ID */
  postId?: string;
  /** 인증 여부 */
  hasPost: boolean;
  /** 연속 인증 여부 */
  isConsecutive: boolean;
  /** 연속 인증 며칠째인지 (1부터 시작) */
  consecutiveDayNumber?: number;
  /** 현재 달 여부 */
  isCurrentMonth: boolean;
  /** 오늘 날짜 여부 */
  isToday?: boolean;
  /** 현재 루틴 커뮤니티 ID */
  currentRoutineCommunityId?: string | null;
  /** 인증 버튼 클릭 핸들러 */
  onCertifyClick?: () => void;
  /** 게시글 클릭 핸들러 */
  onPostClick?: (postId: string) => void;
}

/**
 * @description 달력 날짜 셀 컴포넌트
 */
const CalendarDayCell = ({
  date,
  dateKey,
  imageUrl,
  postId,
  hasPost,
  isConsecutive,
  consecutiveDayNumber,
  isCurrentMonth,
  isToday = false,
  currentRoutineCommunityId,
  onCertifyClick,
  onPostClick,
}: Props) => {
  // 오늘 날짜이고 인증 사진이 없고 currentRoutineCommunityId가 있으면 인증 가능 상태
  const canCertify = isToday && !hasPost && Boolean(currentRoutineCommunityId);
  // 인증 사진이 있고 postId가 있으면 게시글로 이동 가능
  const canNavigateToPost = hasPost && imageUrl && postId;

  const handleClick = () => {
    if (canCertify && onCertifyClick) {
      onCertifyClick();
    } else if (canNavigateToPost && onPostClick && postId) {
      onPostClick(postId);
    }
  };

  const isClickable = canCertify || canNavigateToPost;

  return (
    <button
      type="button"
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg",
        !isCurrentMonth && "invisible",
        hasPost && imageUrl
          ? "bg-gray-900"
          : canCertify
            ? "border-2 border-blue-500 bg-white"
            : "bg-gray-200",
        isClickable && "cursor-pointer"
      )}
      onClick={handleClick}
      disabled={!isClickable}
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

      {/* 연속 인증 불꽃 아이콘과 숫자 - 사진 정가운데 */}
      {isConsecutive && hasPost && imageUrl && consecutiveDayNumber && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <Flame className="fill-primary-green text-primary-green h-4 w-4" />
            <Typography font="noto" variant="label2B" className="text-white">
              {consecutiveDayNumber}
            </Typography>
          </div>
        </div>
      )}
    </button>
  );
};

export default CalendarDayCell;
