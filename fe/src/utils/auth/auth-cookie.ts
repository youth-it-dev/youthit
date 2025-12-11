/**
 * @description 인증 상태 쿠키 관리 유틸리티
 * 미들웨어에서 빠른 인증 체크를 위해 사용
 */

const AUTH_COOKIE_NAME = "auth-status";
const AUTH_COOKIE_VALUE = "authenticated";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

/**
 * @description 인증 상태 쿠키 설정
 * 로그인 성공 시 호출
 */
export const setAuthCookie = (): void => {
  if (typeof document === "undefined") return;

  const expires = new Date();
  expires.setTime(expires.getTime() + COOKIE_MAX_AGE * 1000);

  document.cookie = `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; ${
    process.env.NODE_ENV === "production" ? "Secure;" : ""
  }`;
};

/**
 * @description 인증 상태 쿠키 삭제
 * 로그아웃 시 호출
 */
export const removeAuthCookie = (): void => {
  if (typeof document === "undefined") return;

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax; ${
    process.env.NODE_ENV === "production" ? "Secure;" : ""
  }`;
};

/**
 * @description 인증 상태 쿠키 확인
 * 클라이언트에서 현재 인증 상태 확인
 */
export const hasAuthCookie = (): boolean => {
  if (typeof document === "undefined") return false;

  return document.cookie
    .split("; ")
    .some((cookie) =>
      cookie.startsWith(`${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}`)
    );
};
