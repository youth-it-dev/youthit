"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LINK_URL } from "@/constants/shared/_link-url";
import useFcmToken from "@/hooks/shared/useFcmToken";
import { onAuthStateChange, getCurrentUser } from "@/lib/auth";
import {
  setAuthCookie,
  removeAuthCookie,
  hasAuthCookie,
} from "@/utils/auth/auth-cookie";

/**
 * @description Firebase Auth 비로그인 사용자를 로그인 페이지로 리다이렉트
 */
export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  // 초기 렌더링 시점에 동기적으로 쿠키 체크
  // 이렇게 하면 useEffect 실행 전에 페이지가 렌더링되는 것을 방지
  const initialHasCookie =
    typeof document !== "undefined" ? hasAuthCookie() : false;
  const initialCurrentUser =
    typeof window !== "undefined" ? getCurrentUser() : null;

  // 초기 상태: 쿠키가 있거나 사용자가 있으면 체크 완료로 시작
  // 쿠키가 없고 사용자도 없으면 체크 중으로 시작
  const [isChecking, setIsChecking] = useState(() => {
    // 쿠키가 있거나 사용자가 있으면 즉시 통과
    if (initialHasCookie || initialCurrentUser) {
      return false;
    }
    // 쿠키도 없고 사용자도 없으면 체크 필요
    return true;
  });

  // FCM 토큰 관리 (로그인된 사용자만)
  useFcmToken();

  useEffect(() => {
    // 쿠키가 있거나 사용자가 있으면 즉시 통과 (미들웨어에서 이미 체크했을 가능성 높음)
    if (initialHasCookie || initialCurrentUser) {
      if (initialCurrentUser) {
        setAuthCookie(); // 쿠키 동기화
      }
      setIsChecking(false);
      // 쿠키가 있으면 미들웨어에서 이미 체크했으므로 빠르게 통과
      // Firebase Auth 초기화를 기다리지 않음
      return;
    }

    // 쿠키가 없고 사용자도 없으면 즉시 리다이렉트
    if (
      !initialHasCookie &&
      !initialCurrentUser &&
      pathname !== LINK_URL.LOGIN
    ) {
      removeAuthCookie();
      setIsChecking(false);
      router.replace(LINK_URL.LOGIN);
      return;
    }

    // 쿠키도 없고 사용자도 없는 경우에만 Firebase Auth 초기화 대기
    const unsubscribe = onAuthStateChange((user) => {
      // 쿠키 동기화 (미들웨어에서 빠른 체크를 위해)
      if (user) {
        setAuthCookie();
      } else {
        removeAuthCookie();
      }

      setIsChecking(false);
      if (!user && pathname !== LINK_URL.LOGIN) {
        router.replace(LINK_URL.LOGIN);
      }
    });

    return () => unsubscribe();
  }, [pathname, router, initialHasCookie, initialCurrentUser]);

  // 체크 중이면 아무것도 렌더링하지 않음 (스켈레톤도 보이지 않음)
  if (isChecking) {
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
