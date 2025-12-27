"use client";

import Image from "next/image";
import { cn } from "@/utils/shared/cn";

interface DetailImageProps {
  /**
   * @description 이미지 URL
   */
  imageUrl: string;
  /**
   * @description 이미지 alt 텍스트
   */
  alt: string;
  /**
   * @description 추가 클래스명
   */
  className?: string;
}

/**
 * @description 상세 페이지 메인 이미지 컴포넌트
 */
const DetailImage = ({ imageUrl, alt, className }: DetailImageProps) => {
  return (
    <div
      className={cn("relative aspect-square w-full overflow-hidden", className)}
    >
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className="object-contain"
        priority
      />
    </div>
  );
};

export default DetailImage;
