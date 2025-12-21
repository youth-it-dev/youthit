/**
 * @description FCM 토큰 관리 훅
 */
import { useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { fetchToken } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import {
  FCMTokenRequest,
  FCMTokenResult,
  NotificationPermission,
  DeviceType,
} from "@/types/shared/fcm";
import { debug } from "@/utils/shared/debugger";
import { waitForServiceWorker } from "@/utils/shared/service-worker";
import { useSaveFCMToken } from "./useSaveFCMToken";

/**
 * @description Firebase Auth가 초기화될 때까지 대기
 *
 * redirect 직후나 최초 로그인 직후에는 auth.currentUser가 잠시 null일 수 있어
 * 이 경우 FCM 토큰 등록이 조기에 종료되면서 권한 팝업이 표시되지 않는 문제가 발생할 수 있습니다.
 * onAuthStateChanged 리스너로 최대 1초까지 초기화를 기다린 뒤 다시 currentUser를 확인합니다.
 */
const waitForAuthReady = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      unsubscribe();
      resolve();
    });

    // 안전장치: 1초가 지나도 콜백이 오지 않으면 그대로 진행
    setTimeout(() => {
      unsubscribe();
      resolve();
    }, 1000);
  });
};

/**
 * @description iOS 버전 확인
 *
 * iOS 16.4 이상에서만 PWA 알림이 지원됩니다.
 *
 * @returns iOS 버전이 알림을 지원하는지 여부
 */
const isIOSVersionSupported = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  if (!isIOS) return true; // iOS가 아니면 지원됨

  // iOS 버전 추출
  const match = userAgent.match(/OS (\d+)_(\d+)/);
  if (!match) return false;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);

  // iOS 16.4 이상 체크
  if (major > 16) return true;
  if (major === 16 && minor >= 4) return true;

  debug.warn(
    `[FCM] iOS ${major}.${minor}는 PWA 알림을 지원하지 않습니다. iOS 16.4 이상이 필요합니다.`
  );
  return false;
};

/**
 * @description 알림 권한 요청
 *
 * iOS Safari/PWA에서는 다음 조건이 모두 충족되어야 합니다:
 * 1. iOS 16.4 이상
 * 2. Service Worker 등록 완료
 * 3. 사용자 제스처(클릭/탭) 컨텍스트 내에서 호출
 *
 * 참고: https://developer.mozilla.org/ko/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push
 */
export const requestNotificationPermission =
  async (): Promise<NotificationPermission> => {
    try {
      if (typeof window === "undefined") return "denied";

      if (!("Notification" in window)) {
        debug.warn("[FCM] 이 브라우저는 알림을 지원하지 않습니다.");
        return "denied";
      }

      // iOS 버전 체크
      if (!isIOSVersionSupported()) {
        return "denied";
      }

      // 이미 결정된 상태면 추가 요청 불가/불필요
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";

      // iOS에서는 Service Worker가 등록되어 있어야 알림 권한 요청이 가능
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        const swReady = await waitForServiceWorker();
        if (!swReady) {
          debug.warn(
            "[FCM] Service Worker가 등록되지 않아 알림 권한을 요청할 수 없습니다. 나중에 다시 시도할 수 있습니다."
          );
          // Service Worker 준비 실패를 "denied"로 간주하지 않고 "default" 상태 유지
          // 이렇게 하면 나중에 Service Worker가 준비되면 다시 권한 요청을 시도할 수 있습니다.
          return "default";
        }
        debug.log(
          "[FCM] iOS에서 Service Worker 준비 완료, 알림 권한 요청 진행"
        );
      }

      // 주의: 많은 브라우저에서 사용자 제스처(클릭/탭) 없이 호출하면 팝업이 무시될 수 있음
      debug.log("[FCM] 알림 권한 요청 시작");
      const permission = await Notification.requestPermission();
      debug.log("[FCM] 알림 권한 요청 결과:", permission);
      return permission as NotificationPermission;
    } catch (error) {
      debug.error("[FCM] 알림 권한 요청 실패:", error);
      return "denied";
    }
  };

/**
 * @description FCM 토큰 발급
 */
export const getFCMToken = async (): Promise<FCMTokenResult> => {
  try {
    // 1. 알림 권한 확인
    // 토큰 발급 함수에서는 권한 팝업(사이드 이펙트)을 발생시키지 않도록 유지합니다.
    // 권한 요청은 앱 최초 진입 시점(사용자 제스처 기반)에서 별도로 처리합니다.
    if (typeof window === "undefined") {
      return {
        token: null,
        error: "클라이언트 환경에서만 FCM 토큰을 발급할 수 있습니다.",
      };
    }

    if (!("Notification" in window)) {
      return {
        token: null,
        error: "이 브라우저는 알림을 지원하지 않습니다.",
      };
    }

    if (Notification.permission !== "granted") {
      return {
        token: null,
        error: `알림 권한이 ${Notification.permission} 상태입니다.`,
      };
    }

    // 2. FCM 토큰 발급
    const token = await fetchToken();
    if (!token) {
      return {
        token: null,
        error: "FCM 토큰 발급에 실패했습니다.",
      };
    }

    return { token };
  } catch (error) {
    debug.error("FCM 토큰 발급 실패:", error);
    return {
      token: null,
      error:
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.",
    };
  }
};

/**
 * @description 디바이스 정보 생성
 *
 * FCM 토큰 저장 시 Firestore document ID로 사용될 deviceInfo를 생성합니다.
 *
 * **형식**: `{deviceType}_{token 앞 6자리}`
 *
 * **예시**:
 * - `mobile_c2OmA4` (모바일 디바이스)
 * - `pwa_d3PnB5` (PWA 설치)
 * - `web_e4QoC6` (웹 브라우저)
 *
 * **주의사항**:
 * - userAgent 전체를 사용하지 않고 간결한 형식 사용
 * - Firestore document ID 규칙 준수 (슬래시 등 특수문자 방지)
 * - 토큰 앞 6자리로 동일 사용자의 여러 디바이스 구분
 *
 * @param token - FCM 토큰
 * @param deviceType - 디바이스 타입 (pwa, mobile, web)
 * @returns Firestore document ID로 사용 가능한 deviceInfo 문자열
 */
export const getDeviceInfo = (
  token: string,
  deviceType: DeviceType
): string => {
  const tokenPrefix = token.substring(0, 6);
  return `${deviceType}_${tokenPrefix}`;
};

/**
 * @description 디바이스 타입 감지
 */
export const getDeviceType = (): DeviceType => {
  if (typeof window === "undefined") return "web";

  const userAgent = navigator.userAgent.toLowerCase();

  // PWA 감지 (standalone 모드)
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return "pwa";
  }

  // 모바일 감지
  if (
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
  ) {
    return "mobile";
  }

  return "web";
};

/**
 * @description FCM 토큰 관리 훅 (토큰 저장만)
 */
export const useFCM = () => {
  // FCM 토큰 저장 뮤테이션
  const saveTokenMutation = useSaveFCMToken();

  // FCM 토큰 발급 및 저장
  const registerFCMToken = useCallback(async (): Promise<FCMTokenResult> => {
    try {
      // 0. 사용자 인증 상태 확인
      //    redirect 직후에는 currentUser가 바로 설정되지 않을 수 있으므로 한 번 더 대기
      let user = auth.currentUser;
      if (!user) {
        await waitForAuthReady();
        user = auth.currentUser;
      }

      if (!user) {
        return {
          token: null,
          error: "사용자가 로그인되지 않았습니다.",
        };
      }

      // 1. FCM 토큰 발급
      const tokenResult = await getFCMToken();
      if (!tokenResult.token) {
        return tokenResult;
      }

      // 2. 디바이스 정보 수집
      const deviceType = getDeviceType();
      const deviceInfo = getDeviceInfo(tokenResult.token, deviceType);

      // 3. 서버에 토큰 저장
      const tokenRequest: FCMTokenRequest = {
        token: tokenResult.token,
        deviceInfo,
        deviceType,
      };

      await saveTokenMutation.mutateAsync(tokenRequest);

      debug.log("[FCM] 토큰 등록 완료:", tokenResult.token.substring(0, 20));
      return { token: tokenResult.token };
    } catch (error) {
      return {
        token: null,
        error:
          error instanceof Error ? error.message : "토큰 등록에 실패했습니다.",
      };
    }
  }, [saveTokenMutation]);

  return {
    // 액션
    registerFCMToken,

    // 유틸리티
    getFCMToken,
    requestNotificationPermission,
    getDeviceInfo,
    getDeviceType,

    // 뮤테이션 상태
    isSaving: saveTokenMutation.isPending,
    saveError: saveTokenMutation.error,
  };
};
