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
 * registerFCMToken 디듀프(탭 단위, in-memory)
 * - Dev StrictMode / 중복 마운트 / auth 리스너 중복 등으로 동일 uid에서 여러 번 호출되는 것을 방지
 * - localStorage 없이도 "현재 탭"에서는 충분히 중복 폭주를 막을 수 있습니다.
 */
const REGISTER_DEDUPE_WINDOW_MS = 60_000;
const inFlightRegistrationByUid = new Map<string, Promise<FCMTokenResult>>();
const lastSavedTokenByUid = new Map<string, string>();
const lastSavedAtByUid = new Map<string, number>();

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
    try {
      if (typeof window === "undefined") return "denied";

      if (!("Notification" in window)) {
        debug.warn("이 브라우저는 알림을 지원하지 않습니다.");
        return "denied";
      }

      // 이미 결정된 상태면 추가 요청 불가/불필요
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";

      // 주의: 많은 브라우저에서 사용자 제스처(클릭/탭) 없이 호출하면 팝업이 무시될 수 있음
      const permission = await Notification.requestPermission();
      return permission as NotificationPermission;
    } catch (error) {
      debug.error("알림 권한 요청 실패:", error);
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

      // uid 기준 in-flight 디듀프 (동시에 여러 곳에서 호출되더라도 1회만 수행)
      const existingInFlight = inFlightRegistrationByUid.get(user.uid);
      if (existingInFlight) {
        return await existingInFlight;
      }

      const promise = (async (): Promise<FCMTokenResult> => {
        // 1. FCM 토큰 발급
        const tokenResult = await getFCMToken();
        if (!tokenResult.token) {
          return tokenResult;
        }

        // 최근 성공 디듀프 (짧은 시간 내 동일 토큰 재저장 방지)
        const now = Date.now();
        const lastToken = lastSavedTokenByUid.get(user.uid);
        const lastSavedAt = lastSavedAtByUid.get(user.uid) ?? 0;
        if (
          lastToken === tokenResult.token &&
          now - lastSavedAt < REGISTER_DEDUPE_WINDOW_MS
        ) {
          return { token: tokenResult.token };
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

        lastSavedTokenByUid.set(user.uid, tokenResult.token);
        lastSavedAtByUid.set(user.uid, now);

        return { token: tokenResult.token };
      })();

      inFlightRegistrationByUid.set(user.uid, promise);
      try {
        return await promise;
      } finally {
        inFlightRegistrationByUid.delete(user.uid);
      }
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
