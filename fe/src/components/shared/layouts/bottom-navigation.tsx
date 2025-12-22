"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import Icon from "@/components/shared/ui/icon";
import { BOTTOM_NAV_TABS } from "@/constants/shared/_bottom-nav-tabs";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { onAuthStateChange } from "@/lib/auth";
import { cn } from "@/utils/shared/cn";

const isDev = process.env.NODE_ENV === "development";

/**
 * @description 하단 네비게이션 바
 */
const BottomNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Firebase Auth 상태 추적
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // 로그인된 사용자일 때만 API 호출
  const {
    data: userData,
    isFetched,
    isLoading,
    isError,
  } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(currentUser), // 로그인된 사용자일 때만 API 호출
  });

  const hasNickname = Boolean(userData?.nickname?.trim());
  // 로그인되지 않은 사용자는 마이페이지 접근만 차단 (홈/피드 접근 가능)
  // 로그인된 사용자 중 닉네임이 없는 경우에만 마이페이지 편집으로 리다이렉트
  const shouldBlockMyTab =
    currentUser && ((isFetched && !hasNickname) || isLoading || isError);

  // 최상단 뎁스 경로 목록 (개발 환경에서만 미션 경로 포함)
  const topLevelPaths = [
    LINK_URL.HOME,
    LINK_URL.MISSION,
    LINK_URL.COMMUNITY,
    LINK_URL.MY_PAGE,
    LINK_URL.COMMUNITY_MISSION,
    LINK_URL.MISSION_LIST,
    ...(isDev ? [LINK_URL.MISSION] : []),
  ] as const;

  // 현재 경로가 최상단 뎁스 경로 중 하나와 정확히 일치하는지 확인
  const shouldShow = topLevelPaths.some((path) => pathname === path);

  // 최상단 뎁스 경로가 아니면 렌더링하지 않음
  if (!shouldShow) {
    return null;
  }

  return (
    <nav className="pb-safe fixed bottom-0 left-1/2 z-50 flex h-20 w-full max-w-[470px] -translate-x-1/2 items-center justify-center gap-14 border-t border-gray-200 bg-white/90 pt-3 backdrop-blur-sm">
      {BOTTOM_NAV_TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const isMyTab = tab.key === "myPage";

        // 로그인되지 않은 사용자가 마이페이지 탭 클릭 시 로그인 페이지로 리다이렉트
        const isNotLoggedIn = isAuthReady && !currentUser;
        const targetHref =
          isMyTab && shouldBlockMyTab ? LINK_URL.MY_PAGE_EDIT : tab.href;

        return (
          <Link
            key={tab.key}
            href={targetHref}
            className="flex flex-col items-center justify-center gap-1 hover:cursor-pointer"
            onClick={
              isMyTab
                ? (event) => {
                    // 로그인되지 않은 사용자는 로그인 페이지로 리다이렉트
                    if (isNotLoggedIn) {
                      event.preventDefault();
                      router.replace(LINK_URL.LOGIN);
                      return;
                    }
                    // 로그인된 사용자 중 닉네임이 없는 경우 마이페이지 편집으로 리다이렉트
                    if (shouldBlockMyTab) {
                      event.preventDefault();
                      router.replace(LINK_URL.MY_PAGE_EDIT);
                    }
                  }
                : undefined
            }
          >
            <Icon
              src={tab.icon}
              width={28}
              height={28}
              className={cn(isActive ? "text-main-500" : "text-gray-400")}
              aria-label={tab.label}
              role="img"
            />
            <span
              className={cn(
                "text-xs leading-none font-semibold text-gray-400",
                isActive && "text-main-500"
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNavigation;
