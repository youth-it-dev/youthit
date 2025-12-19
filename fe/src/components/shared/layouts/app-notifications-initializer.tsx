"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { requestNotificationPermission, useFCM } from "@/hooks/shared/useFCM";
import { auth } from "@/lib/firebase";
import { debug } from "@/utils/shared/debugger";

/**
 * @description Service Worker 등록 완료 대기
 */
const waitForServiceWorker = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  try {
    await navigator.serviceWorker.ready;
    debug.log("[Notifications] Service Worker 준비 완료");
    return true;
  } catch (error) {
    debug.warn("[Notifications] Service Worker 준비 실패:", error);
    return false;
  }
};

/**
 * @description 앱 알림 초기화
 *
 * PWA 알림 요구사항 (MDN 참고):
 * 1. Service Worker 등록 완료 (iOS 필수)
 * 2. 사용자 제스처 내에서 권한 요청 (iOS 필수)
 * 3. iOS 16.4 이상
 *
 * 알림 권한 요청:
 * - 로그인 여부와 무관하게 앱 진입 시점에 수행
 * - 사용자 제스처(클릭/탭)에서 권한 요청 (iOS 필수)
 * - 세션당 1회만 시도
 *
 * FCM 토큰 서버 저장:
 * - 로그인 직후 자동 수행
 * - 알림 권한이 granted 상태여야 함
 *
 * @see https://developer.mozilla.org/ko/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push
 */
const AppNotificationsInitializer = () => {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasRegisteredToken, setHasRegisteredToken] = useState(false);
  const [needsGestureForPermission, setNeedsGestureForPermission] =
    useState(false);

  const { registerFCMToken } = useFCM();

  // Service Worker 등록 상태 확인
  useEffect(() => {
    const checkServiceWorker = async () => {
      const ready = await waitForServiceWorker();
      setIsServiceWorkerReady(ready);
    };

    void checkServiceWorker();
  }, []);

  // 사용자 인증 상태 추적
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 알림 권한 요청 (사용자 제스처 기반)
  const tryRequestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // 이미 결정된 상태면 더 이상 요청하지 않음
    if (Notification.permission !== "default") return;

    // iOS에서는 Service Worker가 준비되어야 함
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isServiceWorkerReady) {
      debug.warn(
        "[Notifications] iOS에서는 Service Worker 준비 후 알림 권한을 요청할 수 있습니다."
      );
      return;
    }

    try {
      const permission = await requestNotificationPermission();
      debug.log("[Notifications] 알림 권한 요청 완료:", permission);

      // 권한 승인 시 토큰 등록은 별도 useEffect에서 처리됨
    } catch (error) {
      debug.error("[Notifications] 알림 권한 요청 실패:", error);
    }
  }, [isServiceWorkerReady]);

  // 알림 권한 요청 (모든 플랫폼에서 즉시 시도 → 실패 시 제스처 기반)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      debug.log("[Notifications] 알림을 지원하지 않는 환경");
      return;
    }

    // 현재 권한 상태 로깅
    debug.log("[Notifications] 현재 알림 권한 상태:", Notification.permission);

    // 이미 결정된 상태면 요청하지 않음
    if (Notification.permission !== "default") {
      debug.log(
        "[Notifications] 알림 권한이 이미 결정됨:",
        Notification.permission
      );
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // iOS에서는 Service Worker가 준비될 때까지 대기
    if (isIOS && !isServiceWorkerReady) {
      debug.log(
        "[Notifications] iOS: Service Worker 등록 대기 중... 준비되면 재시도"
      );
      return;
    }

    // 모든 플랫폼에서 즉시 권한 요청 시도
    debug.log(
      `[Notifications] 즉시 알림 권한 요청 시도 (${isIOS ? "iOS" : "데스크톱/Android"})`
    );

    const attemptImmediateRequest = async () => {
      try {
        await tryRequestPermission();
        const finalPermission = Notification.permission;
        debug.log("[Notifications] 즉시 권한 요청 완료:", finalPermission);

        // default 상태 유지 = 팝업이 표시되지 않음 (제스처 필요)
        if (finalPermission === "default") {
          debug.warn(
            "[Notifications] 권한 팝업이 표시되지 않음, 사용자 제스처 필요"
          );
          setNeedsGestureForPermission(true);
        }
      } catch (error) {
        debug.warn(
          "[Notifications] 즉시 권한 요청 실패, 사용자 제스처 필요:",
          error
        );
        setNeedsGestureForPermission(true);
      }
    };

    void attemptImmediateRequest();
  }, [isServiceWorkerReady, tryRequestPermission]);

  // 제스처가 필요한 경우 리스너 등록 (fallback)
  useEffect(() => {
    if (!needsGestureForPermission) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    // iOS에서는 Service Worker가 준비되어야 함
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isServiceWorkerReady) {
      debug.log(
        "[Notifications] Fallback: iOS Service Worker 대기 중... 준비되면 리스너 등록"
      );
      return;
    }

    debug.log(
      "[Notifications] Fallback: 제스처 필요 - 사용자 제스처 리스너 등록"
    );

    const handleUserGesture = () => {
      if (Notification.permission !== "default") return;

      debug.log("[Notifications] Fallback 제스처 감지! 알림 권한 요청 시작");
      void tryRequestPermission();
      setNeedsGestureForPermission(false);
    };

    window.addEventListener("pointerdown", handleUserGesture, { once: true });
    window.addEventListener("keydown", handleUserGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
    };
  }, [needsGestureForPermission, isServiceWorkerReady, tryRequestPermission]);

  // 로그인 후 FCM 토큰 등록 (사용자 ID가 변경될 때마다 1회만)
  useEffect(() => {
    // 로그인 상태가 아니면 무시
    if (!currentUserId) {
      setHasRegisteredToken(false);
      return;
    }

    // 이미 등록했으면 무시
    if (hasRegisteredToken) return;

    // 알림 권한이 승인되지 않았으면 무시
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    // FCM 토큰 등록
    const register = async () => {
      try {
        debug.log("[FCM] 토큰 등록 시작 - userId:", currentUserId);
        const result = await registerFCMToken();
        if (!result.token) {
          debug.warn("[FCM] 토큰 등록 실패:", result.error);
          return;
        }
        debug.log("[FCM] 토큰 등록 완료:", result.token.substring(0, 20));
        setHasRegisteredToken(true);
      } catch (error) {
        debug.error("[FCM] 토큰 등록 중 예외:", error);
      }
    };

    void register();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, hasRegisteredToken]);

  return null;
};

export default AppNotificationsInitializer;
