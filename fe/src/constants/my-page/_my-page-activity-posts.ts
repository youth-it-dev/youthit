/**
 * @description 마이페이지 "전체 활동 관리" 탭 관련 상수
 */

export const ALL_ACTIVITY_FILTERS = [
  { id: "all", label: "전체" },
  { id: "post", label: "게시글" },
  { id: "commented", label: "댓글단 글" },
  { id: "liked", label: "좋아요한 글" },
] as const;

export type AllActivityFilterType = (typeof ALL_ACTIVITY_FILTERS)[number]["id"];

const DEFAULT_ACTIVITY_POSTS_PAGE = 1;
const DEFAULT_ACTIVITY_POSTS_PAGE_SIZE = 20;

export const DEFAULT_ACTIVITY_POSTS_REQUEST = {
  page: DEFAULT_ACTIVITY_POSTS_PAGE,
  size: DEFAULT_ACTIVITY_POSTS_PAGE_SIZE,
} as const;
