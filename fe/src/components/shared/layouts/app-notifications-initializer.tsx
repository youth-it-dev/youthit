"use client";

import { useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { requestNotificationPermission, useFCM } from "@/hooks/shared/useFCM";
import { auth } from "@/lib/firebase";
import { debug } from "@/utils/shared/debugger";

const NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY =
  "notification-permission-requested-session";

/**
 * @description 앱 알림 초기화
 * 1. 알림 권한 요청: 로그인 여부와 무관하게 앱 진입 시점에 수행
 *    - 일부 브라우저는 사용자 제스처 없이 requestPermission을 무시/차단할 수 있어
 *      "진입 즉시 1회(auto) 시도" + "첫 사용자 제스처에서 1회(backup) 시도"로 안정성 확보
 *    - 동일 세션에서 backup 시도는 1회로 제한
 * 2. FCM 토큰 서버 저장: 로그인 직후 onAuthStateChanged에서만 수행
 */
const AppNotificationsInitializer = () => {
  const isRequestingPermissionRef = useRef(false);
  const hasAutoAttemptedRef = useRef(false);
  const isRegisteringTokenRef = useRef(false);

  const { registerFCMToken } = useFCM();

  const tryRegisterTokenIfPossible = useCallback(async () => {
    if (isRegisteringTokenRef.current) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    isRegisteringTokenRef.current = true;

    try {
      const result = await registerFCMToken();
      if (!result.token) {
        debug.warn("[FCM] 토큰 등록 실패:", result.error);
        return;
      }

      debug.log("[FCM] 토큰 등록 완료");
    } catch (error) {
      debug.error("[FCM] 토큰 등록 중 예외:", error);
    } finally {
      isRegisteringTokenRef.current = false;
    }
  }, [registerFCMToken]);

  const tryRequestPermission = useCallback(async () => {
    if (isRequestingPermissionRef.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // 이미 결정된 상태면(허용/거부) 더 이상 물어볼 수 없거나 불필요
    if (Notification.permission !== "default") return;

    isRequestingPermissionRef.current = true;

    try {
      const permission = await requestNotificationPermission();
      debug.log("알림 권한 요청 완료:", permission);
    } catch (error) {
      debug.error("알림 권한 요청 실패:", error);
    } finally {
      isRequestingPermissionRef.current = false;
    }
  }, []);

  // 1. 알림 권한 요청 (로그인 여부와 무관)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    // 1) 진입 즉시 1회 시도 (사용자 제스처가 없어 막히는 브라우저가 있어도 안전)
    if (!hasAutoAttemptedRef.current) {
      hasAutoAttemptedRef.current = true;
      void tryRequestPermission();
    }

    // 2) backup: 첫 사용자 제스처에서 1회 더 시도
    const handleUserGesture = () => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "default") return;

      const hasRequestedInSession = sessionStorage.getItem(
        NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY
      );
      if (hasRequestedInSession === "true") return;

      sessionStorage.setItem(
        NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY,
        "true"
      );
      void tryRequestPermission();
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
  }, [tryRequestPermission]);

  // 2. FCM 토큰 서버 저장 (로그인 직후에만 수행)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      void tryRegisterTokenIfPossible();
    });

    return () => {
      unsubscribe();
    };
  }, [tryRegisterTokenIfPossible]);

  return null;
};

export default AppNotificationsInitializer;
