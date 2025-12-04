"use client";

import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import ButtonBase from "@/components/shared/base/button-base";
import { Typography } from "@/components/shared/typography";
import ProfileImage from "@/components/shared/ui/profile-image";
import { Skeleton } from "@/components/ui/skeleton";
import { LINK_URL } from "@/constants/shared/_link-url";

interface MyPageProfileSectionProps {
  /** 프로필 이미지 URL (선택) */
  profileImageUrl?: string;
  /** 닉네임 */
  nickname?: string;
  /** 자기소개 */
  bio?: string;
  /** 인증 글 수 */
  postCount?: number;
  /** 활동 참여 수 */
  activityCount?: number;
  /** 포인트 */
  points?: number;
  /** 프로필 편집 버튼 클릭 핸들러 */
  onEditClick: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
}

/**
 * @description 프로필 편집 및 설정 버튼 컴포넌트
 */
interface ProfileActionButtonsProps {
  /** 프로필 편집 버튼 클릭 핸들러 */
  onEditClick: () => void;
  /** 설정 버튼 클릭 핸들러 */
  onSettingsClick: () => void;
  /** 비활성화 상태 */
  disabled?: boolean;
}

const ProfileActionButtons = ({
  onEditClick,
  onSettingsClick,
  disabled = false,
}: ProfileActionButtonsProps) => {
  return (
    <div className="flex items-center gap-2">
      <ButtonBase
        onClick={onEditClick}
        disabled={disabled}
        className="h-10 flex-1 rounded-lg border border-gray-300 bg-white py-3 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Typography font="noto" variant="body3M" className="text-gray-950">
          프로필 편집
        </Typography>
      </ButtonBase>

      <ButtonBase
        onClick={onSettingsClick}
        disabled={disabled}
        className="h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="설정"
      >
        <Settings className="h-5 w-5 text-gray-900" />
      </ButtonBase>
    </div>
  );
};

/**
 * @description 마이페이지 프로필 섹션 컴포넌트
 * - 프로필 이미지, 닉네임, 자기소개
 * - 통계 정보 (인증 글, 활동 참여, 포인트)
 * - 프로필 편집 버튼 및 설정 버튼
 * - 로딩 중일 때 스켈레톤 표시
 */
const MyPageProfileSection = ({
  profileImageUrl,
  nickname,
  bio,
  postCount,
  activityCount,
  points,
  onEditClick,
  isLoading = false,
}: MyPageProfileSectionProps) => {
  const router = useRouter();

  const handleSettingsClick = () => {
    router.push(LINK_URL.SETTINGS);
  };

  // 로딩 중이거나 데이터가 없을 때 스켈레톤 표시
  if (isLoading || !nickname) {
    return (
      <div className="flex flex-col bg-white pt-7 pb-6">
        {/* 상단: 프로필 이미지 + 통계 정보 */}
        <div className="mb-4 flex items-center justify-between gap-2 max-[423px]:gap-1 max-[380px]:gap-0.5">
          {/* 프로필 이미지 스켈레톤 */}
          <Skeleton className="h-[75px] w-[75px] shrink-0 rounded-full" />

          {/* 통계 정보 스켈레톤 */}
          <div className="flex w-[280px] justify-center gap-12 max-[423px]:w-auto max-[423px]:flex-1 max-[380px]:gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* 닉네임 스켈레톤 */}
        <Skeleton className="mb-2 h-6 w-24" />

        {/* 자기소개 스켈레톤 */}
        <Skeleton className="mb-[13px] h-4 w-full" />

        <ProfileActionButtons
          onEditClick={onEditClick}
          onSettingsClick={handleSettingsClick}
          disabled={true}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white pt-7 pb-6">
      {/* 상단: 프로필 이미지 + 통계 정보 */}
      <div className="mb-4 flex items-center justify-between gap-2 max-[423px]:gap-1 max-[380px]:gap-0.5">
        {/* 프로필 이미지 */}
        <div className="h-[75px] w-[75px] shrink-0">
          <ProfileImage src={profileImageUrl} size="h-full w-full" />
        </div>

        {/* 통계 정보 */}
        <div className="flex w-[280px] justify-center gap-12 max-[423px]:w-auto max-[423px]:flex-1 max-[380px]:gap-4">
          {/* 인증 글 */}
          <div className="flex flex-col items-center gap-2">
            <Typography font="noto" variant="body2B" className="text-gray-950">
              {postCount ?? 0}개
            </Typography>
            <Typography font="noto" variant="label1R" className="text-gray-600">
              인증글
            </Typography>
          </div>

          {/* 활동 참여 */}
          <div className="flex flex-col items-center gap-2">
            <Typography font="noto" variant="body2B" className="text-gray-950">
              {activityCount ?? 0}회
            </Typography>
            <Typography font="noto" variant="label1R" className="text-gray-600">
              활동참여
            </Typography>
          </div>

          {/* 나다움 */}
          <div className="flex flex-col items-center gap-2">
            <Typography font="noto" variant="body2B" className="text-gray-950">
              {points ?? 0}N
            </Typography>
            <Typography font="noto" variant="label1R" className="text-gray-600">
              나다움
            </Typography>
          </div>
        </div>
      </div>

      {/* 닉네임 */}
      <Typography
        font="noto"
        variant="body2B"
        className="mb-2 text-left text-gray-950"
      >
        {nickname ?? "-"}
      </Typography>

      {/* 자기소개 */}
      <Typography
        font="noto"
        variant="body3R"
        className="mb-[13px] text-left text-gray-950"
      >
        {bio ?? ""}
      </Typography>

      {/* 프로필 편집 버튼 및 설정 버튼 */}
      <ProfileActionButtons
        onEditClick={onEditClick}
        onSettingsClick={handleSettingsClick}
        disabled={false}
      />
    </div>
  );
};

export default MyPageProfileSection;
