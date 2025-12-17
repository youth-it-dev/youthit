/**
 * @description 커뮤니티 글 작성 페이지 상수 정의
 */
export const MAX_FILES = 5;

/**
 * @description 허용되는 이미지 확장자
 * jpg, jpeg, png, gif, webp, svg, heic, heif, heix, avif, bmp, tiff, tif, ico
 */
export const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".heic",
  ".heif",
  ".heix",
  ".avif",
  ".bmp",
  ".tiff",
  ".tif",
  ".ico",
] as const;

/**
 * @description 허용되는 문서 확장자
 * pdf
 */
export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf"] as const;

/**
 * @description 허용되는 모든 파일 확장자 (이미지 + 문서)
 */
export const ALLOWED_FILE_EXTENSIONS = [
  ...ALLOWED_IMAGE_EXTENSIONS,
  ...ALLOWED_DOCUMENT_EXTENSIONS,
] as const;

/**
 * @description input accept 속성용 이미지 확장자 문자열
 */
export const ACCEPT_IMAGE_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS.join(",");

/**
 * @description input accept 속성용 전체 파일 확장자 문자열
 */
export const ACCEPT_FILE_EXTENSIONS = ALLOWED_FILE_EXTENSIONS.join(",");

/**
 * @description 커뮤니티 글 작성 페이지 에러 메시지
 */
export const WRITE_MESSAGES = {
  IMAGE_UPLOAD_FAILED:
    "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
  IMAGE_URL_REPLACE_FAILED:
    "이미지 URL 교체에 실패했습니다. 잠시 후 다시 시도해주세요.",
  IMAGE_UPLOAD_PARTIAL_FAILED: (count: number) =>
    `이미지 업로드에 실패했습니다. (${count}개 실패) 잠시 후 다시 시도해주세요.`,
  FILE_UPLOAD_FAILED: "파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
  POST_CREATE_FAILED: "등록에 실패했습니다. 잠시 후 다시 시도해주세요.",
  POST_CREATE_SUCCESS: "게시물이 등록되었습니다.",
  POST_RESPONSE_INVALID: "응답에서 postId 또는 communityId를 찾을 수 없습니다.",
} as const;

/**
 * @description 게시글 수정 관련 상수
 */
export const POST_EDIT_CONSTANTS = {
  DEFAULT_CATEGORY: "한끗루틴",
  NO_CATEGORY: "선택된 카테고리 없음",
  UNKNOWN_ERROR: "알 수 없는 오류",
  POST_NOT_FOUND: "게시글 정보를 찾을 수 없습니다.",
  UPDATE_SUCCESS: "게시물이 수정되었습니다.",
  UPDATE_FAILED: "수정에 실패했습니다:",
  DELETE_SUCCESS: "게시물이 삭제되었습니다.",
  DELETE_FAILED: "게시글 삭제에 실패했습니다.",
} as const;

/**
 * @description 에러 메시지 상수
 */
export const ERROR_MESSAGES = {
  IMAGE_UPLOAD_FAILED: "IMAGE_UPLOAD_FAILED",
  IMAGE_URL_REPLACE_FAILED: "IMAGE_URL_REPLACE_FAILED",
  FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",
} as const;
