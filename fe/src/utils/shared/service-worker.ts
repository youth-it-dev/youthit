import { debug } from "./debugger";

/**
 * @description Service Worker 등록 완료 대기
 *
 * 타임아웃을 추가하여 무한 대기를 방지합니다.
 * Service Worker가 등록되지 않았을 경우에도 타임아웃 후 false를 반환합니다.
 *
 * @param timeoutMs - 대기 시간 (밀리초), 기본값 5000ms
 * @returns Service Worker가 준비되었는지 여부
 */
export const waitForServiceWorker = async (
  timeoutMs = 5000
): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) {
    debug.warn("[ServiceWorker] Service Worker를 지원하지 않는 환경입니다.");
    return false;
  }

  try {
    // 이미 등록된 Service Worker가 있는지 먼저 확인
    if (navigator.serviceWorker.controller) {
      debug.log("[ServiceWorker] Service Worker가 이미 활성화되어 있습니다.");
      return true;
    }

    // Service Worker 등록 상태 확인
    // getRegistrations()는 등록 중인 Service Worker도 포함할 수 있음
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      debug.log("[ServiceWorker] Service Worker가 등록되지 않았습니다.");
      return false;
    }

    // Service Worker ready 대기 (타임아웃 포함)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        debug.warn(
          `[ServiceWorker] Service Worker 준비 대기 시간 초과 (${timeoutMs}ms)`
        );
        resolve(false);
      }, timeoutMs);

      navigator.serviceWorker.ready
        .then(() => {
          clearTimeout(timeout);
          debug.log("[ServiceWorker] Service Worker 준비 완료");
          resolve(true);
        })
        .catch((error) => {
          clearTimeout(timeout);
          debug.warn("[ServiceWorker] Service Worker 준비 실패:", error);
          resolve(false);
        });
    });
  } catch (error) {
    debug.error("[ServiceWorker] Service Worker 확인 중 에러:", error);
    return false;
  }
};
