import {
  MAX_EDITOR_IMAGE_SIZE_BYTES,
  FILE_UPLOAD_MESSAGES,
} from "@/constants/shared/_photo-storage";

/**
 * 파일 검증 (크기 및 타입)
 * @param file - 검증할 파일
 * @returns 에러 메시지 (검증 통과 시 null)
 */
export const validateImageFile = (
  file: File | null | undefined
): string | null => {
  if (!file) {
    return "파일을 선택할 수 없습니다. 다시 시도해주세요.";
  }
  if (file.size > MAX_EDITOR_IMAGE_SIZE_BYTES) {
    return FILE_UPLOAD_MESSAGES.SIZE_EXCEEDED(5);
  }
  if (!file.type.startsWith("image/")) {
    return FILE_UPLOAD_MESSAGES.INVALID_TYPE;
  }
  return null;
};
