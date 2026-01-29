"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

/**
 * @description PWA 가로모드 차단 컴포넌트
 *
 * 두 가지 방법으로 가로모드를 차단합니다:
 * 1. Screen Orientation API - 앱 시작 시 portrait 모드로 잠금 시도 (Android PWA 지원)
 * 2. CSS + JS 폴백 - 가로모드 감지 시 회전 안내 오버레이 표시 (iOS 등 미지원 환경용)
 */
export default function LandscapeBlocker() {
  // 서버/클라이언트 동일하게 false로 시작 (hydration 일치)
  // 마운트 후 실제 orientation 체크하여 업데이트
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null);

  useEffect(() => {
    // 가로모드 감지 함수
    const checkOrientation = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight;
      setIsLandscape(isLandscapeMode);
    };

    // Screen Orientation API로 portrait 잠금 시도 (Android PWA)
    const lockOrientation = async () => {
      try {
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true;

        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };

        if (isStandalone && orientation?.lock) {
          await orientation.lock("portrait");
        }
      } catch {
        // 지원하지 않는 브라우저에서는 무시 (iOS Safari 등)
      }
    };

    // 초기 체크 및 잠금 시도
    checkOrientation();
    lockOrientation();

    // 이벤트 리스너 등록
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // 마운트 전(null)이거나 세로모드면 렌더링하지 않음
  if (isLandscape !== true) return null;

  return (
    <div
      className="from-main-600 via-main-500 to-main-400 fixed inset-0 z-9999 flex flex-col items-center justify-center bg-linear-to-br"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center gap-8 text-white">
        {/* 회전 아이콘 애니메이션 */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
          <RotateCcw className="h-12 w-12 animate-pulse" strokeWidth={1.5} />
        </div>

        {/* 안내 메시지 */}
        <div className="flex flex-col items-center gap-3 px-8 text-center">
          <h2 className="text-2xl font-bold">화면을 세로로 돌려주세요</h2>
          <p className="text-base text-white/80">
            유스잇은 세로 모드에서만 사용할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
