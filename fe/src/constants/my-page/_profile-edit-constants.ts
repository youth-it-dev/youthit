/**
 * @description 프로필 편집 페이지 관련 상수
 */

/** 파일 크기 제한 (5MB) */
export const MAX_PROFILE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** 자기소개 최대 길이 */
export const MAX_BIO_LENGTH = 150;

/** Alert 메시지 */
export const PROFILE_EDIT_MESSAGES = {
  INVALID_IMAGE_FILE: "이미지 파일만 선택할 수 있습니다.",
  IMAGE_SIZE_EXCEEDED: "파일 크기는 5MB 이하여야 합니다.",
  NICKNAME_DUPLICATED: "이미 존재하는 닉네임입니다",
  NICKNAME_REQUIRED: "닉네임을 입력해주세요.",
  IMAGE_UPLOAD_FAILED: "프로필 이미지 업로드 실패",
  IMAGE_URL_FETCH_FAILED: "이미지 URL을 가져올 수 없습니다",
  PROFILE_UPDATE_SUCCESS: "프로필 편집 완료",
  PROFILE_UPDATE_FAILED: "프로필 편집 실패",
} as const;

/** Validation 에러 메시지 */
export const PROFILE_EDIT_ERRORS = {
  NICKNAME_MAX_LENGTH: "닉네임은 최대 8자까지 입력 가능합니다.",
  NICKNAME_INVALID_CHARACTERS:
    "닉네임은 한글, 영어, 숫자만 사용 가능하며,\n최대 8자까지 입력 가능합니다.",
  NICKNAME_DUPLICATED: "중복된 이름입니다. 다른 이름을 선택해주세요.",
} as const;

/** Placeholder 텍스트 */
export const PROFILE_EDIT_PLACEHOLDERS = {
  NICKNAME: "닉네임을 입력해주세요 (최대 8자)",
  BIO: "자기소개를 입력하세요",
} as const;

/** Helper 텍스트 */
export const PROFILE_EDIT_HELPERS = {
  NICKNAME: "한글, 영어, 숫자만 사용 가능 (최대 8자)",
} as const;

/** UI 라벨 텍스트 */
export const PROFILE_EDIT_LABELS = {
  PAGE_TITLE: "프로필 편집",
  COMPLETE_BUTTON: "완료",
  NICKNAME: "닉네임",
  BIO: "자기소개",
  BACK_BUTTON: "뒤로가기",
  PROFILE_IMAGE_ALT: "프로필 이미지",
  PROFILE_IMAGE_CHANGE: "프로필 이미지 변경",
} as const;
