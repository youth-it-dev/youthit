"use client";

import { Camera, Image as ImageIcon, User } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import useIsMobile from "@/hooks/shared/useIsMobile";

interface ProfileImageBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onSelectDefault?: () => void;
}

/**
 * @description 프로필 이미지 선택 바텀시트 컴포넌트
 * - 모바일: 카메라 촬영 + 앨범 선택
 * - PC: 파일 선택만
 */
const ProfileImageBottomSheet = ({
  isOpen,
  onClose,
  onSelectCamera,
  onSelectGallery,
  onSelectDefault,
}: ProfileImageBottomSheetProps) => {
  const isMobile = useIsMobile();

  const handleCameraClick = () => {
    onSelectCamera();
    onClose();
  };

  const handleGalleryClick = () => {
    onSelectGallery();
    onClose();
  };

  const handleDefaultClick = () => {
    onSelectDefault?.();
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {/* 직접 촬영 - 모바일에서만 표시 */}
        {isMobile && (
          <button
            onClick={handleCameraClick}
            className="flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-gray-50"
            aria-label="직접 촬영"
          >
            <Camera className="h-6 w-6 text-gray-700" />
            <Typography font="noto" variant="body1R" className="text-gray-900">
              직접 촬영
            </Typography>
          </button>
        )}

        {/* 앨범에서 사진 선택 (PC에서는 "사진 선택") */}
        <button
          onClick={handleGalleryClick}
          className="flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-gray-50"
          aria-label={isMobile ? "앨범에서 사진 선택" : "사진 선택"}
        >
          <ImageIcon className="h-6 w-6 text-gray-700" />
          <Typography font="noto" variant="body1R" className="text-gray-900">
            {isMobile ? "앨범에서 사진 선택" : "사진 선택"}
          </Typography>
        </button>

        {/* 기본 이미지 적용 */}
        {onSelectDefault && (
          <button
            onClick={handleDefaultClick}
            className="flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-gray-50"
            aria-label="기본 이미지 적용"
          >
            <User className="h-6 w-6 text-gray-700" />
            <Typography font="noto" variant="body1R" className="text-gray-900">
              기본 이미지 적용
            </Typography>
          </button>
        )}
      </div>
    </BottomSheet>
  );
};

export default ProfileImageBottomSheet;
