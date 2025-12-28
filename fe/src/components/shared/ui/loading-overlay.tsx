"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/utils/shared/cn";

interface LoadingOverlayProps {
  /**
   * 로딩 상태
   */
  isLoading: boolean;
  /**
   * 로딩 메시지
   */
  message?: string;
  /**
   * 추가 클래스명
   */
  className?: string;
}

/**
 * @description 로딩 중 화면을 막고 스피너를 표시하는 오버레이 컴포넌트
 */
export function LoadingOverlay({
  isLoading,
  message = "업로드 중입니다",
  className,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[10002] flex items-center justify-center bg-gray-950/40",
        className
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white px-6 py-8 shadow-lg">
        <Loader2 className="text-main-500 h-8 w-8 animate-spin" />
        <p className="font-noto text-sm font-medium text-gray-800">{message}</p>
      </div>
    </div>
  );
}
