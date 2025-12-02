"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LINK_URL } from "@/constants/shared/_link-url";
import useFcmToken from "@/hooks/shared/useFcmToken";
import { onAuthStateChange } from "@/lib/auth";

/**
 * @description Firebase Auth 비로그인 사용자를 로그인 페이지로 리다이렉트
 */
export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  // FCM 토큰 관리 (로그인된 사용자만)
  useFcmToken();

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setIsChecking(false);
      if (!user && pathname !== LINK_URL.LOGIN) {
        router.replace(LINK_URL.LOGIN);
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

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
    const unsubscribe = onAuthStateChange((user) => {
      setIsChecking(false);
      if (user && pathname !== LINK_URL.HOME) {
        router.replace(LINK_URL.HOME);
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

  if (isChecking) {
    return null;
  }
  return <>{children}</>;
};
