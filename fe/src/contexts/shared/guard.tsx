"use client";

import {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LINK_URL } from "@/constants/shared/_link-url";
import { onAuthStateChange, getCurrentUser } from "@/lib/auth";
import {
  setAuthCookie,
  removeAuthCookie,
  hasAuthCookie,
} from "@/utils/auth/auth-cookie";
import { isPublicRoute } from "@/utils/auth/is-public-route";

/**
 * @description Firebase Auth 비로그인 사용자를 로그인 페이지로 리다이렉트
 */
export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);

  // 초기 렌더링 시점에 동기적으로 쿠키 체크
  const initialHasCookie =
    typeof document !== "undefined" ? hasAuthCookie() : false;
  const initialCurrentUser =
    typeof window !== "undefined" ? getCurrentUser() : null;

  // 공개 경로 체크 (pathname이 없으면 안전하게 보호된 경로로 간주)
  const isPublic = pathname ? isPublicRoute(pathname) : false;

  // 초기 인증 상태: 공개 경로이거나 쿠키/사용자가 있으면 인증됨
  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (isPublic) return true;
    return initialHasCookie || !!initialCurrentUser;
  });

  // 리다이렉트 필요 여부 계산
  // pathname이 없으면 아직 경로가 설정되지 않았으므로 리다이렉트하지 않음
  const shouldRedirect =
    pathname !== null &&
    pathname !== undefined &&
    !isPublic &&
    !initialHasCookie &&
    !initialCurrentUser &&
    pathname !== LINK_URL.LOGIN;

  // useLayoutEffect로 브라우저 페인트 전에 리다이렉트
  useLayoutEffect(() => {
    // pathname이 없으면 아직 경로가 설정되지 않았으므로 리다이렉트하지 않음
    if (
      !pathname ||
      !shouldRedirect ||
      typeof window === "undefined" ||
      hasRedirectedRef.current
    ) {
      return;
    }

    // 공개 경로인지 다시 한 번 확인 (pathname이 변경되었을 수 있음)
    const currentIsPublic = isPublicRoute(pathname);
    if (currentIsPublic) {
      return;
    }

    hasRedirectedRef.current = true;
    removeAuthCookie();
    window.location.replace(LINK_URL.LOGIN);
  }, [shouldRedirect, pathname]);

  // Firebase Auth 상태 변경 감지 및 쿠키 동기화
  useEffect(() => {
    // pathname이 없으면 아직 경로가 설정되지 않았으므로 처리하지 않음
    if (!pathname) {
      return;
    }

    // 공개 경로인지 다시 한 번 확인 (pathname이 변경되었을 수 있음)
    const currentIsPublic = isPublicRoute(pathname);

    // 공개 경로이거나 리다이렉트할 경우 처리하지 않음
    if (currentIsPublic || shouldRedirect) {
      return;
    }

    // 초기 인증 상태가 있으면 쿠키 동기화만 수행
    if (initialHasCookie || initialCurrentUser) {
      if (initialCurrentUser) {
        setAuthCookie();
      }
      return;
    }

    // 인증 상태가 없는 경우에만 리스너 등록
    const unsubscribe = onAuthStateChange((user) => {
      // 리스너 내부에서 최신 pathname을 다시 가져옴
      const latestPathname = pathname;
      const isLatestPathPublic = latestPathname
        ? isPublicRoute(latestPathname)
        : false;

      if (user) {
        setAuthCookie();
        setIsAuthorized(true);
      } else {
        removeAuthCookie();
        setIsAuthorized(false);
        // 공개 경로가 아닐 때만 로그인 페이지로 리다이렉트
        if (
          latestPathname &&
          latestPathname !== LINK_URL.LOGIN &&
          !isLatestPathPublic
        ) {
          router.replace(LINK_URL.LOGIN);
        }
      }
    });

    return () => unsubscribe();
  }, [
    isPublic,
    shouldRedirect,
    initialHasCookie,
    initialCurrentUser,
    router,
    pathname,
  ]);

  // 보호된 경로이고 인증되지 않았으면 렌더링하지 않음
  if (!isPublic && (!isAuthorized || shouldRedirect)) {
    return null;
  }

  return <>{children}</>;
};

/**
 * @description Firebase Auth 로그인된 사용자를 홈으로 리다이렉트
 */
export const GuestGuard = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Firebase Auth가 이미 초기화된 경우 즉시 체크하여 빠른 리다이렉트
    const currentUser = getCurrentUser();
    if (currentUser && pathname !== LINK_URL.HOME) {
      // 쿠키 동기화 (미들웨어에서 빠른 체크를 위해)
      setAuthCookie();
      setIsChecking(false);
      router.replace(LINK_URL.HOME);
      return;
    }

    // Auth 상태 변경 리스너로 이후 상태 변경 감지
    const unsubscribe = onAuthStateChange((user) => {
      // 쿠키 동기화 (미들웨어에서 빠른 체크를 위해)
      if (user) {
        setAuthCookie();
      } else {
        removeAuthCookie();
      }

      setIsChecking(false);
      if (user && pathname !== LINK_URL.HOME) {
        router.replace(LINK_URL.HOME);
      }
    });

    // currentUser가 없는 경우 즉시 체크 완료 처리
    if (!currentUser) {
      removeAuthCookie();
      setIsChecking(false);
    }

    return () => unsubscribe();
  }, [pathname, router]);

  if (isChecking) {
    return null;
  }
  return <>{children}</>;
};
