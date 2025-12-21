"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { requestNotificationPermission, useFCM } from "@/hooks/shared/useFCM";
import { auth } from "@/lib/firebase";
import { debug } from "@/utils/shared/debugger";
import { isIOSDevice } from "@/utils/shared/device";
import { waitForServiceWorker } from "@/utils/shared/service-worker";
import NotificationPermissionModal from "./notification-permission-modal";

const NOTIFICATION_PERMISSION_MODAL_SHOWN_SESSION_KEY =
  "notification-permission-modal-shown-session";

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
  const previousUserIdRef = useRef<string | null>(null);
  const registerFCMTokenRef = useRef<
    (() => Promise<{ token: string | null; error?: string }>) | null
  >(null);
  const isRegisteringRef = useRef(false);

  const { registerFCMToken } = useFCM();

  // registerFCMToken을 ref에 저장하여 안정적인 참조 유지
  useEffect(() => {
    registerFCMTokenRef.current = registerFCMToken;
  }, [registerFCMToken]);

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
      // 첫 번째 체크는 적절한 타임아웃으로 확인
      // iOS PWA에서는 Service Worker 등록이 더 오래 걸릴 수 있으므로 3초 사용
      const ready = await waitForServiceWorker(3000);
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

        debug.log(
          `[Notifications] Service Worker 재확인 시작 (최대 ${maxAttempts}회)`
        );

        retryInterval = setInterval(async () => {
          if (!isMounted) {
            cleanup();
            return;
          }

          attempts++;
          // 재확인 시에는 더 긴 타임아웃 사용 (iOS PWA 고려)
          const ready = await waitForServiceWorker(5000);

          if (ready && isMounted) {
            setIsServiceWorkerReady(true);
            debug.log(
              `[Notifications] Service Worker 준비 완료 (재확인, ${attempts}회 시도)`
            );
            cleanup();
          } else if (attempts >= maxAttempts) {
            debug.warn(
              `[Notifications] Service Worker 재확인 중단 (최대 시도 횟수 도달: ${maxAttempts}회)`
            );
            cleanup();
          } else {
            debug.log(
              `[Notifications] Service Worker 재확인 중... (${attempts}/${maxAttempts})`
            );
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
      const previousUserId = previousUserIdRef.current;
      const newUserId = user?.uid ?? null;

      // 이전 userId 업데이트
      previousUserIdRef.current = newUserId;
      setCurrentUserId(newUserId);

      // 로그인한 경우 (이전에 로그인하지 않았고, 지금 로그인함)
      // 토큰 등록은 별도 useEffect에서 처리하므로 여기서는 상태만 업데이트
      if (!previousUserId && newUserId) {
        debug.log("[Notifications] 사용자 로그인 감지");
        // hasRegisteredToken을 false로 리셋하여 토큰 등록을 다시 시도할 수 있도록 함
        setHasRegisteredToken(false);
      }
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
    const isIOS = isIOSDevice();
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
    const isIOS = isIOSDevice();

    debug.log(
      `[Notifications] 현재 알림 권한 상태: ${currentPermission}, Service Worker 준비: ${isServiceWorkerReady}, iOS: ${isIOS}`
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

    // iOS가 아닌 환경에서는 Service Worker 준비를 기다리지 않고 즉시 모달 표시
    // iOS에서만 Service Worker가 필수입니다.
    if (!isIOS) {
      debug.log(
        "[Notifications] iOS가 아닌 환경이므로 Service Worker 준비 없이 모달 표시"
      );
      setShowPermissionModal(true);
      return;
    }

    // iOS에서는 Service Worker가 준비될 때까지 대기
    // Service Worker가 준비되면 useEffect가 다시 실행되어 모달을 표시합니다.
    if (!isServiceWorkerReady) {
      debug.log(
        "[Notifications] iOS 환경: Service Worker 등록 대기 중... 준비되면 모달을 표시합니다."
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
      isRegisteringRef.current = false;
      return;
    }

    // 이미 등록했으면 무시
    if (hasRegisteredToken) {
      debug.log("[FCM] 토큰이 이미 등록되어 있습니다.");
      return;
    }

    // 이미 등록 중이면 무시 (중복 실행 방지)
    if (isRegisteringRef.current) {
      debug.log("[FCM] 토큰 등록이 이미 진행 중입니다.");
      return;
    }

    // 알림 권한이 승인되지 않았으면 무시
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      debug.log(
        "[FCM] 알림 권한이 granted 상태가 아니어서 토큰 등록을 건너뜁니다."
      );
      return;
    }

    // FCM 토큰 등록
    let isMounted = true;
    isRegisteringRef.current = true;

    const register = async () => {
      // ref에서 최신 함수 가져오기
      const registerFn = registerFCMTokenRef.current;
      if (!registerFn) {
        debug.warn("[FCM] registerFCMToken 함수가 아직 준비되지 않았습니다.");
        isRegisteringRef.current = false;
        return;
      }

      try {
        debug.log("[FCM] 토큰 등록 시작 - userId:", currentUserId);
        const result = await registerFn();

        // 컴포넌트가 unmount된 경우 상태 업데이트하지 않음
        if (!isMounted) {
          debug.log(
            "[FCM] 컴포넌트가 unmount되어 토큰 등록 결과를 무시합니다."
          );
          isRegisteringRef.current = false;
          return;
        }

        if (!result.token) {
          debug.warn("[FCM] 토큰 등록 실패:", result.error);
          // 실패해도 hasRegisteredToken을 true로 설정하여 무한 루프 방지
          // 다음 로그인 시 다시 시도할 수 있도록 currentUserId 변경 시 리셋됨
          setHasRegisteredToken(true);
          isRegisteringRef.current = false;
          return;
        }
        debug.log("[FCM] 토큰 등록 완료:", result.token.substring(0, 20));
        setHasRegisteredToken(true);
        isRegisteringRef.current = false;
      } catch (error) {
        if (isMounted) {
          debug.error("[FCM] 토큰 등록 중 예외:", error);
          // 예외 발생 시에도 무한 루프 방지를 위해 true로 설정
          setHasRegisteredToken(true);
        }
        isRegisteringRef.current = false;
      }
    };

    void register();

    return () => {
      isMounted = false;
      isRegisteringRef.current = false;
    };
    // registerFCMToken은 ref를 통해 접근하므로 의존성 배열에서 제외
  }, [currentUserId, hasRegisteredToken]);

  return (
    <NotificationPermissionModal
      isOpen={showPermissionModal}
      onAllow={handleAllowClick}
      onLater={handleLaterClick}
    />
  );
};

export default AppNotificationsInitializer;
