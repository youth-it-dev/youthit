import { showToast } from "./toast";

/**
 * @description 클립보드 유틸리티 함수
 */

/**
 * @description 텍스트를 클립보드에 복사
 * @param text 복사할 텍스트
 * @returns 성공 여부
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * @description URL을 클립보드에 복사하고 사용자에게 알림 표시
 * @param url 복사할 URL
 * @param options 알림 메시지 옵션
 */
export const copyUrlToClipboard = async (
  url: string,
  options?: {
    onSuccess?: () => void;
    onError?: () => void;
  }
): Promise<void> => {
  const success = await copyToClipboard(url);

  if (success) {
    if (options?.onSuccess) {
      options.onSuccess();
    } else {
      showToast("링크가 클립보드에 복사되었습니다.");
    }
  } else {
    if (options?.onError) {
      options.onError();
    } else {
      showToast("링크 복사에 실패했습니다.");
    }
  }
};
