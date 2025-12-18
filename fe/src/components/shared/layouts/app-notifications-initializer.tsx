"use client";

import { useCallback, useEffect, useRef } from "react";
import { requestNotificationPermission } from "@/hooks/shared/useFCM";
import { debug } from "@/utils/shared/debugger";

const NOTIFICATION_PERMISSION_REQUESTED_SESSION_KEY =
  "notification-permission-requested-session";

/**
 * @description 앱(서비스) 진입 시 알림 권한 요청
 * - 일부 브라우저는 사용자 제스처 없이 requestPermission을 무시/차단할 수 있어
 *   "진입 즉시 1회(auto) 시도" + "첫 사용자 제스처에서 1회(backup) 시도"로 안정성 확보
 * - 동일 세션에서 backup 시도는 1회로 제한
 */
const AppNotificationsInitializer = () => {
  const isRequestingPermissionRef = useRef(false);
  const hasAutoAttemptedRef = useRef(false);

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

  return null;
};

export default AppNotificationsInitializer;
