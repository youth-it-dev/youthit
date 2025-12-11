import { LINK_URL } from "@/constants/shared/_link-url";

/**
 * @description 인증이 필요하지 않은 경로 목록 (공개 경로)
 * 미들웨어와 동일한 로직을 공유하여 일관성 유지
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
 * @description 경로가 공개 경로인지 확인
 * 미들웨어의 isPublicRoute와 동일한 로직
 */
export const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some((route) => {
    if (route.endsWith("/")) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  });
};
