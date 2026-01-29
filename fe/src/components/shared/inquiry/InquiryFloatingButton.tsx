"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Typography } from "@/components/shared/typography";
import { INQUIRY_CHANNELS } from "@/constants/shared/_inquiry-channel";
import { cn } from "@/utils/shared/cn";

interface InquiryFloatingButtonProps {
  /** 버튼 위치 조정을 위한 className */
  className?: string;
}

/**
 * 카카오톡 아이콘 SVG
 */
const KakaoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 3C6.477 3 2 6.463 2 10.73c0 2.73 1.804 5.127 4.516 6.489-.151.545-.967 3.505-1.002 3.745 0 0-.02.167.088.23.108.064.235.014.235.014.31-.043 3.59-2.347 4.155-2.745.653.09 1.324.137 2.008.137 5.523 0 10-3.463 10-7.73S17.523 3 12 3z"
      fill="#3C1E1E"
    />
  </svg>
);

/**
 * 인스타그램 아이콘 SVG (흰색)
 */
const InstagramIconWhite = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      rx="5"
      stroke="white"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" />
    <circle cx="18" cy="6" r="1.5" fill="white" />
  </svg>
);

/**
 * 말풍선 아이콘 SVG (플로팅 버튼용)
 */
const MessageIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * @description 문의 채널 선택 바텀시트
 */
const InquiryChannelSheet = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const previousOverflow = useRef<string>("");

  // Body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow.current;
      };
    }
    return () => {
      document.body.style.overflow = previousOverflow.current;
    };
  }, [isOpen]);

  // Escape 키로 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleChannelClick = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 바텀시트 - 화면 규격(470px)에 맞춤 + safe area 고려 */}
      <div
        className="animate-slide-up relative w-full max-w-[470px] rounded-t-2xl bg-white px-6 pt-5 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="문의 채널 선택"
        style={{
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* 핸들 바 */}
        <div className="mb-5 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* 채널 아이콘 버튼들 */}
        <div className="flex justify-center gap-8">
          {/* 카카오톡 */}
          <button
            onClick={() => handleChannelClick(INQUIRY_CHANNELS.kakao.url)}
            className="flex flex-col items-center gap-2 transition-transform hover:scale-105"
            aria-label="카카오톡으로 문의하기"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEE500]">
              <KakaoIcon />
            </div>
            <Typography
              font="noto"
              variant="caption1R"
              className="text-gray-600"
            >
              카카오톡
            </Typography>
          </button>

          {/* 인스타그램 */}
          <button
            onClick={() => handleChannelClick(INQUIRY_CHANNELS.instagram.url)}
            className="flex flex-col items-center gap-2 transition-transform hover:scale-105"
            aria-label="인스타그램으로 문의하기"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]">
              <InstagramIconWhite />
            </div>
            <Typography
              font="noto"
              variant="caption1R"
              className="text-gray-600"
            >
              인스타그램
            </Typography>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * @description 문의하기 플로팅 버튼 컴포넌트
 * - 우하단 고정 위치
 * - 클릭 시 채널 선택 바텀시트 표시
 */
export const InquiryFloatingButton = ({
  className,
}: InquiryFloatingButtonProps) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsSheetOpen(false);
  }, []);

  return (
    <>
      {/* 플로팅 버튼 컨테이너 - 앱 레이아웃(470px) 안에서 우측 하단 고정 */}
      <div
        className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex w-full max-w-[470px] justify-end px-4"
        style={{
          bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={handleOpen}
          className={cn(
            "bg-main-500 hover:bg-main-600 pointer-events-auto flex h-11 items-center gap-2 rounded-full px-4 shadow-lg transition-all hover:scale-105",
            className
          )}
        >
          <span className="text-white">
            <MessageIcon />
          </span>
          <Typography font="noto" variant="body3B" className="text-white">
            문의하기
          </Typography>
        </button>
      </div>

      {/* 채널 선택 바텀시트 */}
      <InquiryChannelSheet isOpen={isSheetOpen} onClose={handleClose} />
    </>
  );
};

export default InquiryFloatingButton;
