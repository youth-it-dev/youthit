"use client";

import { useEffect, useRef } from "react";
import { showToast } from "@/utils/shared/toast";

/**
 * @description 삼성 브라우저 감지 및 사용자 알림
 * - 삼성 인터넷 브라우저 사용 시 크롬 브라우저 최적화 안내 토스트 표시
 */
export const useSamsungBrowserWarning = () => {
  const hasShownWarning = useRef(false);

  useEffect(() => {
    // 이미 표시했으면 다시 표시하지 않음
    if (hasShownWarning.current) return;

    // User Agent 확인
    if (typeof window === "undefined") return;

    const userAgent =
      navigator.userAgent ||
      navigator.vendor ||
      (typeof window !== "undefined" && "opera" in window
        ? (window as Window & { opera?: string }).opera
        : "") ||
      "";

    // 삼성 인터넷 브라우저 감지
    const isSamsungBrowser =
      /SamsungBrowser/i.test(userAgent) ||
      /SAMSUNG/i.test(userAgent) ||
      (/Android/i.test(userAgent) && /Samsung/i.test(userAgent));

    if (isSamsungBrowser) {
      // localStorage에 표시 여부 저장 (하루에 한 번만 표시)
      const lastShownKey = "samsung_browser_warning_last_shown";
      const lastShown = localStorage.getItem(lastShownKey);
      const today = new Date().toDateString();

      if (lastShown !== today) {
        showToast(
          "크롬 브라우저에 최적화되어 있어요. 더 나은 경험을 위해 크롬 브라우저를 사용해주세요.",
          {
            duration: 4000,
          }
        );

        localStorage.setItem(lastShownKey, today);
        hasShownWarning.current = true;
      }
    }
  }, []);
};
