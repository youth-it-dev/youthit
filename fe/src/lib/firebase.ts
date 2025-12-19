"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  // connectAuthEmulator
} from "firebase/auth";
import {
  // connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  getFunctions,
  // connectFunctionsEmulator
} from "firebase/functions";
import { debug } from "@/utils/shared/debugger";

/**
 * authDomain 설정
 * iOS PWA에서 firebaseapp.com → 앱 도메인 redirect 시 쿼리스트링이 유실되는 문제를 해결하기 위해
 * 앱 도메인을 authDomain으로 사용하고, /__/auth/* 경로를 reverse proxy로 firebaseapp.com으로 전달
 *
 * 참고: https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
const getAuthDomain = () => {
  if (typeof window !== "undefined") {
    // 개발 환경에서는 localhost 사용
    if (window.location.hostname === "localhost") {
      return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    }
    // 프로덕션에서는 현재 도메인 사용
    return window.location.host;
  }

  // SSR 환경에서는 환경 변수 사용 (fallback)
  return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: getAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// 기본 SDK 인스턴스
export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-northeast3");

// // 로컬 개발 시 에뮬레이터 연결 (로컬 개발 시 주석처리)
// if (typeof window !== "undefined") {
//   const isLocalhost =
//     window.location.hostname === "localhost" ||
//     window.location.hostname === "127.0.0.1";
//   if (isLocalhost) {
//     try {
//       connectAuthEmulator(auth, "http://127.0.0.1:9099");
//       connectFirestoreEmulator(db, "127.0.0.1", 8080);
//       // eslint-disable-next-line no-console
//       console.log("[Emu] Connected to Auth@9099 and Firestore@8080");
//     } catch (e) {
//       // eslint-disable-next-line no-console
//       console.warn("[Emu] Emulator connect skipped or already connected:", e);
//     }
//   }
// }

export const getClientMessaging = async () => {
  try {
    // 브라우저 전용 Firebase Messaging을 동적 import로 변경해 SSR 번들에서 배제
    if (typeof window === "undefined") return null;
    const messagingMod = await import("firebase/messaging");
    const supported = await messagingMod.isSupported();
    return supported ? messagingMod.getMessaging(app) : null;
  } catch (error) {
    debug.error("Failed to get messaging instance:", error);
    return null;
  }
};

/**
 * @description FCM 토큰 가져오기
 *
 * iOS Safari/PWA에서는 Service Worker가 등록되어 있어야 토큰을 발급할 수 있습니다.
 */
export const fetchToken = async () => {
  try {
    // iOS에서는 Service Worker가 등록되어 있어야 함
    const isIOS =
      typeof window !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      if (!("serviceWorker" in navigator)) {
        debug.warn("[FCM] Service Worker를 지원하지 않는 환경입니다.");
        return null;
      }

      try {
        await navigator.serviceWorker.ready;
        debug.log("[FCM] Service Worker가 준비되었습니다.");
      } catch (error) {
        debug.warn("[FCM] Service Worker가 준비되지 않았습니다:", error);
        return null;
      }
    }

    const fcmMessaging = await getClientMessaging();
    if (!fcmMessaging) return null;

    const { getToken } = await import("firebase/messaging");
    const token = await getToken(fcmMessaging, {
      vapidKey: process.env.FCM_VAPID_KEY,
    });

    if (token) {
      debug.log("[FCM] 토큰 발급 성공:", token.substring(0, 20) + "...");
    }

    return token;
  } catch (error) {
    debug.error("[FCM] 토큰 발급 실패:", error);
    return null;
  }
};

export { app };
