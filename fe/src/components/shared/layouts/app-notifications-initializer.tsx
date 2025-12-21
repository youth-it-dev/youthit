"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { requestNotificationPermission, useFCM } from "@/hooks/shared/useFCM";
import { auth } from "@/lib/firebase";
import { debug } from "@/utils/shared/debugger";
import NotificationPermissionModal from "./notification-permission-modal";

const NOTIFICATION_PERMISSION_MODAL_SHOWN_SESSION_KEY =
  "notification-permission-modal-shown-session";

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
 * 알림 권한 요청 (브라우저 권한):
 * - 로그인 여부와 무관하게 서비스워커 등록 시점 이후에 수행
 * - 사용자 제스처(클릭/탭)에서 권한 요청 (iOS 필수, 데스크톱/Android는 시도 후 제스처로 폴백)
 * - 세션당 1회만 시도
 * - 브라우저 권한은 로그인 전에 받아야 함
 *
 * FCM 토큰 서버 저장:
 * - 로그인 직후 자동 수행
 * - 알림 권한이 granted 상태여야 함
 * - 푸시 알림을 실제로 받을지 말지는 user 레코드 값으로 결정 (브라우저 권한과 별개)
 *
 * @see https://developer.mozilla.org/ko/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push
 */
const AppNotificationsInitializer = () => {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasRegisteredToken, setHasRegisteredToken] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const { registerFCMToken } = useFCM();

  // Service Worker 등록 상태 확인
  useEffect(() => {
    let isMounted = true;
    let retryInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
      }
    };

    const checkServiceWorker = async () => {
      const ready = await waitForServiceWorker();
      if (isMounted) {
        setIsServiceWorkerReady(ready);
        debug.log(
          `[Notifications] Service Worker 상태 업데이트: ${ready ? "준비됨" : "준비 안 됨"}`
        );
      }
      return ready;
    };

    // 첫 번째 체크
    void checkServiceWorker().then((ready) => {
      // 첫 번째 체크에서 준비되지 않았을 경우에만 재확인 시작
      if (!ready && isMounted) {
        const maxAttempts = 10;
        let attempts = 0;

        retryInterval = setInterval(async () => {
          if (!isMounted) {
            cleanup();
            return;
          }

          attempts++;
          const ready = await waitForServiceWorker();

          if (ready && isMounted) {
            setIsServiceWorkerReady(true);
            debug.log("[Notifications] Service Worker 준비 완료 (재확인)");
            cleanup();
          } else if (attempts >= maxAttempts) {
            debug.warn(
              "[Notifications] Service Worker 재확인 중단 (최대 시도 횟수 도달)"
            );
            cleanup();
          }
        }, 1000);
      }
    });

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []); // 의존성 배열을 비워서 마운트 시 한 번만 실행

  // 사용자 인증 상태 추적
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 알림 권한 요청 (사용자 제스처 기반 - 모달 버튼 클릭 시 호출)
  const tryRequestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      debug.log("[Notifications] 알림을 지원하지 않는 환경입니다.");
      return;
    }

    // 이미 결정된 상태면 더 이상 요청하지 않음
    if (Notification.permission !== "default") {
      debug.log(
        `[Notifications] 알림 권한이 이미 결정됨: ${Notification.permission}`
      );
      setShowPermissionModal(false);
      return;
    }

    // iOS에서는 Service Worker가 준비되어야 함
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isServiceWorkerReady) {
      debug.warn(
        "[Notifications] iOS에서는 Service Worker 준비 후 알림 권한을 요청할 수 있습니다."
      );
      return;
    }

    try {
      debug.log("[Notifications] 사용자 제스처 기반 알림 권한 요청 시작");
      const permission = await requestNotificationPermission();
      debug.log("[Notifications] 알림 권한 요청 완료:", permission);

      // 모달 닫기
      setShowPermissionModal(false);

      // 권한 승인 시 토큰 등록은 별도 useEffect에서 처리됨
    } catch (error) {
      debug.error("[Notifications] 알림 권한 요청 실패:", error);
      setShowPermissionModal(false);
      // 에러 발생 시에도 sessionStorage에서 제거하여 다음에 다시 시도할 수 있도록 함
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(
          NOTIFICATION_PERMISSION_MODAL_SHOWN_SESSION_KEY
        );
        debug.log(
          "[Notifications] 권한 요청 실패. 다음에 다시 시도할 수 있습니다."
        );
      }
    }
  }, [isServiceWorkerReady]);

  // 모달의 "알림 허용" 버튼 클릭 핸들러
  const handleAllowClick = useCallback(() => {
    void tryRequestPermission();
  }, [tryRequestPermission]);

  // 모달의 "나중에" 버튼 클릭 핸들러
  const handleLaterClick = useCallback(() => {
    setShowPermissionModal(false);
    // 세션 동안 다시 표시하지 않음
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        NOTIFICATION_PERMISSION_MODAL_SHOWN_SESSION_KEY,
        "true"
      );
    }
  }, []);

  // 알림 권한 요청 모달 표시 (서비스워커 준비 후, 세션당 1회)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      debug.log("[Notifications] 알림을 지원하지 않는 환경");
      return;
    }

    // 현재 권한 상태 로깅
    // 주의: 권한 요청은 로그인 여부와 무관하게 서비스워커 준비 후 수행
    const currentPermission = Notification.permission;
    debug.log(
      `[Notifications] 현재 알림 권한 상태: ${currentPermission}, Service Worker 준비: ${isServiceWorkerReady}`
    );

    // 이미 결정된 상태면 모달 표시하지 않음
    if (currentPermission !== "default") {
      debug.log(
        `[Notifications] 알림 권한이 이미 결정됨: ${currentPermission}`
      );
      return;
    }

    // 세션 동안 이미 모달을 표시했으면 다시 표시하지 않음
    const hasShownModal = sessionStorage.getItem(
      NOTIFICATION_PERMISSION_MODAL_SHOWN_SESSION_KEY
    );
    if (hasShownModal === "true") {
      debug.log("[Notifications] 이번 세션에서 이미 모달을 표시했습니다.");
      return;
    }

    // Service Worker가 준비될 때까지 대기
    // Service Worker가 준비되면 useEffect가 다시 실행되어 모달을 표시합니다.
    if (!isServiceWorkerReady) {
      debug.log(
        "[Notifications] Service Worker 등록 대기 중... 준비되면 모달을 표시합니다."
      );
      return;
    }

    // Service Worker 준비 완료 후 모달 표시
    debug.log(
      "[Notifications] Service Worker 준비 완료, 알림 권한 요청 모달 표시"
    );
    setShowPermissionModal(true);
    // 주의: sessionStorage는 모달이 실제로 표시된 후에 저장하도록 별도 useEffect에서 처리
  }, [isServiceWorkerReady]);

  // 모달이 실제로 표시된 후 sessionStorage에 저장 (중복 표시 방지)
  useEffect(() => {
    if (showPermissionModal && typeof window !== "undefined") {
      sessionStorage.setItem(
        NOTIFICATION_PERMISSION_MODAL_SHOWN_SESSION_KEY,
        "true"
      );
      debug.log("[Notifications] 모달 표시 완료, sessionStorage에 저장");
    }
  }, [showPermissionModal]);

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
    // registerFCMToken은 useFCM 훅에서 useCallback으로 감싸져 있어 안정적이지만,
    // 명시적으로 의존성 배열에 포함하여 React의 exhaustive-deps 규칙을 준수합니다.
  }, [currentUserId, hasRegisteredToken, registerFCMToken]);

  return (
    <NotificationPermissionModal
      isOpen={showPermissionModal}
      onAllow={handleAllowClick}
      onLater={handleLaterClick}
    />
  );
};

export default AppNotificationsInitializer;
