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
 * @description 알림 권한 요청
 */
export const requestNotificationPermission =
  async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      debug.warn("이 브라우저는 알림을 지원하지 않습니다.");
      return "denied";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      return "denied";
    }

    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  };

/**
 * @description FCM 토큰 발급
 */
export const getFCMToken = async (): Promise<FCMTokenResult> => {
  try {
    // 1. 알림 권한 확인
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return {
        token: null,
        error: `알림 권한이 ${permission} 상태입니다.`,
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
 */
export const getDeviceInfo = (): string => {
  if (typeof window === "undefined") return "";

  return navigator.userAgent;
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
      const deviceInfo = getDeviceInfo();
      const deviceType = getDeviceType();

      // 3. 서버에 토큰 저장
      const tokenRequest: FCMTokenRequest = {
        token: tokenResult.token,
        deviceInfo,
        deviceType,
      };

      await saveTokenMutation.mutateAsync(tokenRequest);

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
