"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import BottomNavigation from "@/components/shared/layouts/bottom-navigation";
import TopBar from "@/components/shared/layouts/top-bar";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetHome } from "@/hooks/generated/home-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { TGETHomeRes } from "@/types/generated/home-types";

/**
 * @description 하단 네브바 포함 레이아웃
 */
export default function MainLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const isHomePage = pathname === LINK_URL.HOME;
  const isCommunityPage = pathname === LINK_URL.COMMUNITY;
  const isMyPage = pathname === LINK_URL.MY_PAGE;
  const isMissionPage = pathname === LINK_URL.MISSION;
  const hideTopBarState = useTopBarStore((state) => state.hideTopBar);

  // 정적 경로는 본 페이지(Layout)에서 위와같이 pathname 기반으로 처리하고,
  // 동적 조건이 필요한 경우에만 스토어(useTopBarStore)의 hideTopBar를 제어합니다.
  // 커뮤니티 페이지는 탑바를 숨기고 페이지 내부에서 알람 아이콘을 표시합니다.
  const hideTopBar =
    isMyPage || isMissionPage || isCommunityPage || hideTopBarState;

  // 라우트 변경 시 항상 스크롤 최상단으로 이동 (Next.js 15 스크롤 복원 이슈 대응)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname]);

  // 홈 페이지일 때만 홈 데이터 로드 여부 확인 (스플래시 표시용)
  const { data: homeData, isLoading: isHomeLoading } = useGetHome({
    enabled: isHomePage,
    select: (data) => {
      // API 응답이 { data: TGETHomeRes } 형태일 경우 unwrap
      if (data && typeof data === "object" && "data" in data) {
        return (data as { data: TGETHomeRes }).data;
      }
      return data;
    },
  });

  // 스플래시 페이드아웃: 데이터가 준비되면 짧게 opacity 전환 후 제거
  const [isFading, setIsFading] = useState(false);
  const hasShownRef = useRef(false);

  useEffect(() => {
    // 홈에서만 스플래시 관리
    if (!isHomePage) return;

    // 최초 진입에만 페이드아웃 수행
    if (!hasShownRef.current && !isHomeLoading && homeData) {
      hasShownRef.current = true;
      setIsFading(true);
      const t = setTimeout(() => setIsFading(false), 400);
      return () => clearTimeout(t);
    }
  }, [isHomeLoading, homeData, isHomePage]);

  // 오버레이 스플래시: 항상 레이아웃을 렌더하고 위에 얹어서 페이드아웃
  // 표시 여부와 투명도 상태를 분리하여 버벅임 최소화
  const [showOverlay, setShowOverlay] = useState(isHomePage);
  const [overlayOpaque, setOverlayOpaque] = useState(isHomePage);

  useEffect(() => {
    if (!isHomePage) {
      setShowOverlay(false);
      return;
    }

    // 데이터 준비되면 opacity -> 0 전환 후 DOM 제거
    if (!isHomeLoading && homeData) {
      let animationFrameId: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      // 한 프레임 뒤에 opacity 변경하여 CSS 트랜지션 보장
      animationFrameId = requestAnimationFrame(() => {
        setOverlayOpaque(false);
        timeoutId = setTimeout(() => setShowOverlay(false), 500);
      });

      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      };
    } else if (!homeData && isHomeLoading) {
      // '데이터가 전혀 없고' 로딩 중일 때만 스플래시 표시
      setShowOverlay(true);
      setOverlayOpaque(true);
    } else {
      // 데이터가 있으면 스플래시 숨김
      setShowOverlay(false);
    }
  }, [isHomePage, isHomeLoading, homeData]);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center bg-white">
      {showOverlay && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500 will-change-[opacity] ${
            overlayOpaque ? "opacity-100" : "opacity-0"
          }`}
          style={{ backfaceVisibility: "hidden", transform: "translateZ(0)" }}
        >
          <div className="relative h-full w-full max-w-[470px]">
            <img
              src="/imgs/splash/apple-splash-1320-2868.jpg"
              alt="스플래시 화면"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}
      <div className="flex min-h-[100dvh] w-full min-w-[320px] flex-col">
        {hideTopBar ? null : (
          <TopBar
            leftSlot={
              isHomePage ? (
                <div className="relative h-[24px] w-[85px]">
                  <Image
                    src={IMAGE_URL.ICON.logo.youthIt.url}
                    alt="Youth Voice 로고"
                    fill
                    priority
                    loading="eager"
                  />
                </div>
              ) : undefined
            }
          />
        )}
        <main className="w-full flex-1 overflow-x-hidden">{children}</main>
        <BottomNavigation />
      </div>
    </div>
  );
}
