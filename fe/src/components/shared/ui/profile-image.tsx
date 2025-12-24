"use client";

import { memo, useState, useEffect } from "react";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { cn } from "@/utils/shared/cn";
import { isValidImageUrl } from "@/utils/shared/url";

interface ProfileImageProps {
  /** 프로필 이미지 URL */
  src?: string | null;
  /** 이미지 alt 텍스트 (기본값: IMAGE_URL.ICON.avatar.alt) */
  alt?: string;
  /** 이미지 크기 (예: "w-16 h-16", "w-full h-full") */
  size?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * @description 프로필 이미지 컴포넌트
 * - 이미지 로드 실패 시 fallback 이미지 사용
 * - data: URL (새로 선택한 이미지) 지원
 * - 사이즈를 prop으로 받아 유연하게 사용 가능
 */
const ProfileImage = ({
  src,
  alt = IMAGE_URL.ICON.avatar.alt,
  size = "h-full w-full",
  className,
}: ProfileImageProps) => {
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(
    src && isValidImageUrl(src) ? src : IMAGE_URL.ICON.avatar.url
  );

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(IMAGE_URL.ICON.avatar.url);
    }
  };

  // src 변경 시 이미지 소스 업데이트
  // data: URL인 경우 (새로 선택한 이미지)는 그대로 사용
  useEffect(() => {
    if (src && src.startsWith("data:")) {
      setImageSrc(src);
      setHasError(false);
    } else if (src && isValidImageUrl(src)) {
      setImageSrc(src);
      setHasError(false);
    } else {
      setImageSrc(IMAGE_URL.ICON.avatar.url);
      setHasError(false);
    }
  }, [src]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-gray-100",
        size,
        className
      )}
    >
      <img
        src={imageSrc}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={handleError}
      />
    </div>
  );
};

export default memo(ProfileImage);
