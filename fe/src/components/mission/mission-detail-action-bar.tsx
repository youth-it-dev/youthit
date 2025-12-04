"use client";

import { useEffect, useState } from "react";
import { Heart, Timer } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import { cn } from "@/utils/shared/cn";
import { Button } from "../shared/ui/button";

interface MissionDetailActionBarProps {
  /**
   * @description 인증 마감 시간 (Date 객체, 선택적)
   */
  deadline?: Date;
  /**
   * @description 하트 버튼 활성화 여부
   */
  isLiked: boolean;
  /**
   * @description 하트 버튼 클릭 핸들러
   */
  onLikeClick: () => void;
  /**
   * @description 미션 시작하기 버튼 클릭 핸들러
   */
  onStartClick: () => void;
  /**
   * @description 미션 모집 중 여부
   */
  isRecruiting?: boolean;
}

const COUNTDOWN_UPDATE_INTERVAL_MS = 1000; // 1초마다 업데이트

/**
 * @description 미션 상세 페이지 하단 액션 바 컴포넌트
 */
const MissionDetailActionBar = ({
  deadline,
  isLiked,
  onLikeClick,
  onStartClick,
  isRecruiting = true,
}: MissionDetailActionBarProps) => {
  const [remainingHours, setRemainingHours] = useState<number>(0);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);

  useEffect(() => {
    if (!deadline) {
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = deadline.getTime();
      const diff = end - now;

      if (diff <= 0) {
        setRemainingHours(0);
        setRemainingMinutes(0);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setRemainingHours(hours);
      setRemainingMinutes(minutes);
    };

    // 초기 업데이트
    updateCountdown();

    // 1초마다 업데이트
    const interval = setInterval(updateCountdown, COUNTDOWN_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className="sticky bottom-0 z-50 border-t border-gray-200 bg-white px-5 pt-5 pb-10">
      {/* 인증 마감 카운트다운 - 모집 중일 때만 표시 */}
      {deadline && isRecruiting && (
        <div className="mb-3 flex items-center justify-center gap-1">
          <Timer size={16} className="text-main-500" />
          <Typography font="noto" variant="label1M" className="text-main-500">
            인증 마감까지 {remainingHours}시간 {remainingMinutes}분 남았어요!
          </Typography>
        </div>
      )}

      {/* 모집 기간이 아닐 때 안내 문구 */}
      {!isRecruiting && (
        <div className="mb-3 flex items-center justify-center">
          <Typography font="noto" variant="label1M" className="text-gray-500">
            모집 기간이 아니예요.
          </Typography>
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-2">
        {/* 하트 버튼 */}
        <button
          type="button"
          onClick={onLikeClick}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border bg-white p-2.5 transition-colors",
            isLiked ? "border-main-500" : "border-gray-200"
          )}
          aria-label={isLiked ? "찜하기 취소" : "찜하기"}
        >
          <Heart
            size={20}
            className={cn(
              isLiked ? "fill-main-500 text-main-500" : "text-gray-400"
            )}
          />
        </button>

        {/* 미션 시작하기 버튼 */}
        <Button
          variant="default"
          size="default"
          onClick={onStartClick}
          disabled={!isRecruiting}
          className="h-full flex-1 rounded-lg"
        >
          <Typography font="noto" variant="body1M" className="text-white">
            미션 시작하기
          </Typography>
        </Button>
      </div>
    </div>
  );
};

export default MissionDetailActionBar;
