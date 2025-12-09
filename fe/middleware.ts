import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LINK_URL } from "@/constants/shared/_link-url";

/**
 * @description 인증이 필요하지 않은 경로 목록 (공개 경로)
 * 이 목록에 포함된 경로는 인증 체크를 건너뜁니다.
 */
const PUBLIC_ROUTES = [
  LINK_URL.LOGIN,
  LINK_URL.DOWNLOAD,
  LINK_URL.ROOT,
  LINK_URL.HOME,
  LINK_URL.COMMUNITY,
  LINK_URL.COMMUNITY_MISSION,
  LINK_URL.PROGRAMS,
  LINK_URL.ANNOUNCEMENTS,
];

/**
 * @description 로그인한 사용자가 접근하면 안 되는 경로 (Guest 전용)
 */
const GUEST_ONLY_ROUTES = [LINK_URL.LOGIN];

/**
 * @description 경로가 공개 경로인지 확인
 */
const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some((route) => {
    if (route.endsWith("/")) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  });
};

/**
 * @description 경로가 Guest 전용인지 확인
 */
const isGuestOnlyRoute = (pathname: string): boolean => {
  return GUEST_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
};

/**
 * @description 쿠키에서 인증 상태 확인
 * 클라이언트에서 설정한 쿠키를 읽어서 빠르게 체크
 */
const isAuthenticated = (request: NextRequest): boolean => {
  const authCookie = request.cookies.get("auth-status");
  return authCookie?.value === "authenticated";
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth = isAuthenticated(request);

  // 공개 경로는 인증 체크 건너뛰기
  if (isPublicRoute(pathname)) {
    // Guest 전용 경로 체크는 계속 수행
    if (isGuestOnlyRoute(pathname) && isAuth) {
      // 홈으로 리다이렉트
      return NextResponse.redirect(new URL(LINK_URL.HOME, request.url));
    }
    return NextResponse.next();
  }

  // 보호된 경로 접근 시 인증 체크
  if (!isAuth) {
    // 로그인 페이지로 리다이렉트 (현재 경로를 next 파라미터로 전달)
    const loginUrl = new URL(LINK_URL.LOGIN, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * @description 미들웨어가 실행될 경로 설정
 */
export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 요청 경로에 매칭:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public 폴더의 파일들)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
