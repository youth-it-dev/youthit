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
import { useSamsungBrowserWarning } from "@/hooks/shared/useSamsungBrowserWarning";
import { AuthGuard } from "@/contexts/shared/guard";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { TGETHomeRes } from "@/types/generated/home-types";
import { isPublicRoute } from "@/utils/auth/is-public-route";
import { getSplashConfig } from "@/utils/shared/get-splash-config";

/**
 * @description 하단 네브바 포함 레이아웃
 */
export default function MainLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // 삼성 브라우저 경고 표시
  useSamsungBrowserWarning();

  const pathname = usePathname();
  const isHomePage = pathname === LINK_URL.HOME;
  const isCommunityPage = pathname === LINK_URL.COMMUNITY;
  const isMyPage = pathname === LINK_URL.MY_PAGE;
  const isMissionPage = pathname === LINK_URL.MISSION;
  const hideTopBarState = useTopBarStore((state) => state.hideTopBar);

  // 공개 경로가 아니면 AuthGuard 적용 (미들웨어와 동일한 로직)
  const requiresAuth = !isPublicRoute(pathname);

  // 정적 경로는 본 페이지(Layout)에서 위와같이 pathname 기반으로 처리하고,
  // 동적 조건이 필요한 경우에만 스토어(useTopBarStore)의 hideTopBar를 제어합니다.
  // 커뮤니티 페이지는 탑바를 숨기고 페이지 내부에서 알람 아이콘을 표시합니다.
  const hideTopBar =
    isMyPage || isMissionPage || isCommunityPage || hideTopBarState;

  // 라우트 변경 시 스크롤 최상단으로 이동
  // /community 페이지는 자체적으로 스크롤 위치를 관리하므로 제외
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const prevPathname = prevPathnameRef.current;

    // 이전 경로와 현재 경로가 같으면 실행하지 않음 (초기 마운트)
    if (prevPathname === pathname) {
      return;
    }

    // /community 페이지로 돌아오는 경우 스크롤 리셋하지 않음
    if (pathname === LINK_URL.COMMUNITY) {
      prevPathnameRef.current = pathname;
      return;
    }

    // 다른 페이지로 이동 시 main 요소의 스크롤을 최상단으로 이동
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.scrollTop = 0;
    }

    prevPathnameRef.current = pathname;
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

  // 오버레이 스플래시: 항상 레이아웃을 렌더하고 위에 얹어서 표시
  const [showOverlay, setShowOverlay] = useState(isHomePage);
  const [overlayOpacity, setOverlayOpacity] = useState(1);

  useEffect(() => {
    if (!isHomePage) {
      setShowOverlay(false);
      return;
    }

    // 데이터 준비되면 페이드아웃 후 DOM 제거
    if (!isHomeLoading && homeData) {
      let animationFrameId: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      // 페이드아웃 시작
      animationFrameId = requestAnimationFrame(() => {
        setOverlayOpacity(0);
        // 트랜지션 완료 후 DOM에서 제거
        timeoutId = setTimeout(() => {
          setShowOverlay(false);
        }, 500); // duration-500과 동일한 시간
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
      setOverlayOpacity(1);
    } else {
      // 데이터가 있으면 스플래시 숨김
      setShowOverlay(false);
    }
  }, [isHomePage, isHomeLoading, homeData]);

  const [splashConfig, setSplashConfig] = useState<ReturnType<
    typeof getSplashConfig
  > | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0);

  useEffect(() => {
    setSplashConfig(getSplashConfig());
  }, []);

  // splashConfig가 할당된 후 img 페이드인 트랜지션
  useEffect(() => {
    if (splashConfig) {
      // 다음 프레임에서 opacity를 1로 변경하여 페이드인 효과
      const animationFrameId = requestAnimationFrame(() => {
        setImageOpacity(1);
      });
      return () => cancelAnimationFrame(animationFrameId);
    } else {
      setImageOpacity(0);
    }
  }, [splashConfig]);

  const layoutContent = (
    <div className="flex min-h-[100dvh] w-full flex-col items-center bg-white">
      {showOverlay && (
        <div
          className="bg-main-500 fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500"
          style={{
            opacity: overlayOpacity,
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
          }}
        >
          {splashConfig && (
            <img
              src={splashConfig.imageUrl}
              alt="스플래시 화면"
              className="transition-opacity duration-1000"
              style={{
                opacity: imageOpacity,
                ...splashConfig.imageStyle,
              }}
              onError={(e) => {
                // 이미지 로드 실패 시 기본 배경색만 표시
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          )}
        </div>
      )}
      <div className="flex min-h-[100dvh] w-full min-w-[320px] flex-col">
        {hideTopBar ? null : (
          <TopBar
            leftSlot={
              isHomePage ? (
                <div className="relative h-[33px] w-[99px]">
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

  // 보호가 필요한 경로에만 AuthGuard 적용
  return requiresAuth ? <AuthGuard>{layoutContent}</AuthGuard> : layoutContent;
}
