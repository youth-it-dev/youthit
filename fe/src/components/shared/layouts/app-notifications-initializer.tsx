"use client";

import { useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { requestNotificationPermission, useFCM } from "@/hooks/shared/useFCM";
import { auth } from "@/lib/firebase";
import { debug } from "@/utils/shared/debugger";

const NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY =
  "notification-permission-requested-session";

/**
 * @description 앱 진입 시 알림 권한 요청(첫 사용자 제스처 1회) + 로그인 상태에서 FCM 토큰 자동 등록
 * - 권한 요청은 사용자 제스처(클릭/탭/키입력)에서만 호출해 브라우저 차단을 피함
 * - 토큰 등록은 Notification.permission === 'granted' 일 때만 수행
 * - 동일 세션에서 중복 등록/중복 요청 최소화
 */
const AppNotificationsInitializer = () => {
  const { registerFCMToken } = useFCM();
  const isRequestingPermissionRef = useRef(false);
  const isRegisteringRef = useRef(false);
  const lastRegisteredUserIdRef = useRef<string | null>(null);

  const tryRegisterToken = useCallback(
    async (userId: string) => {
      if (isRegisteringRef.current) return;
      if (lastRegisteredUserIdRef.current === userId) return;

      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      isRegisteringRef.current = true;
      try {
        await registerFCMToken();
        lastRegisteredUserIdRef.current = userId;
      } catch (error) {
        debug.error("FCM 토큰 자동 등록 실패:", error);
      } finally {
        isRegisteringRef.current = false;
      }
    },
    [registerFCMToken]
  );

  const tryRequestPermissionOnce = useCallback(async () => {
    if (isRequestingPermissionRef.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // 이미 결정된 상태면(허용/거부) 더 이상 물어볼 수 없거나 불필요
    if (Notification.permission !== "default") return;

    const hasRequestedInSession = sessionStorage.getItem(
      NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY
    );
    if (hasRequestedInSession === "true") return;

    isRequestingPermissionRef.current = true;
    sessionStorage.setItem(
      NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY,
      "true"
    );

    try {
      const permission = await requestNotificationPermission();
      debug.log("알림 권한 요청 완료:", permission);

      // 권한 승인 후 이미 로그인되어 있으면 즉시 토큰 등록
      if (permission === "granted" && auth.currentUser) {
        await tryRegisterToken(auth.currentUser.uid);
      }
    } catch (error) {
      debug.error("알림 권한 요청 실패:", error);
    } finally {
      isRequestingPermissionRef.current = false;
    }
  }, [tryRegisterToken]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        lastRegisteredUserIdRef.current = null;
        return;
      }

      void tryRegisterToken(user.uid);
    });

    return () => unsubscribe();
  }, [tryRegisterToken]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    // 핵심: 권한 팝업은 사용자 제스처(클릭/탭/키입력) 트리거에서 호출해야 안정적으로 뜸
    const handleUserGesture = () => {
      void tryRequestPermissionOnce();
    };

    window.addEventListener("pointerdown", handleUserGesture, {
      passive: true,
      once: true,
    });
    window.addEventListener("keydown", handleUserGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
    };
  }, [tryRequestPermissionOnce]);

  return null;
};

export default AppNotificationsInitializer;
