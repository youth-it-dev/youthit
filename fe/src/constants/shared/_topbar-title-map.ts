import { LINK_URL } from "./_link-url";

export const TOPBAR_TITLE_MAP: Array<{ prefix: string; label: string }> = [
  { prefix: LINK_URL.LOGIN, label: "로그인" },
  { prefix: LINK_URL.HOME, label: "" },
  { prefix: LINK_URL.MISSION, label: "미션" },
  { prefix: LINK_URL.COMMUNITY_POST, label: "" }, // 게시글 상세 페이지는 레이블 없음
  { prefix: LINK_URL.COMMUNITY_WRITE, label: "글 작성" },
  { prefix: LINK_URL.PROGRAMS, label: "프로그램" },
  { prefix: LINK_URL.PROGRAMS_APPLY, label: "신청하기" },
  { prefix: LINK_URL.MY_PAGE, label: "마이" },
  { prefix: LINK_URL.ANNOUNCEMENTS, label: "공지사항" },
  { prefix: LINK_URL.SETTINGS, label: "설정" },
  { prefix: LINK_URL.PERSONAL_INFO, label: "개인 정보 관리" },
  { prefix: LINK_URL.MY_PAGE_EDIT, label: "프로필 설정" },
  { prefix: LINK_URL.NOTIFICATIONS, label: "알림" },
  { prefix: LINK_URL.MISSION_LIST, label: "전체 미션 보기" },
  { prefix: LINK_URL.MISSION_CERTIFY, label: "인증하기" },
];
