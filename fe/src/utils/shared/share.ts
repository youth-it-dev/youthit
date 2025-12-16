/**
 * @description 공유 유틸리티 함수
 */

import { copyUrlToClipboard } from "./clipboard";

/**
 * @description 공유 옵션 타입
 */
export type ShareOptions = {
  /** 공유 제목 */
  title: string;
  /** 공유 텍스트 */
  text?: string;
  /** 공유 URL */
  url: string;
};

/**
 * @description Web Share API를 사용하여 공유하고, 실패 시 클립보드로 대체
 * @param options 공유 옵션
 * @returns 공유 성공 여부
 */
export const shareContent = async (options: ShareOptions): Promise<void> => {
  const { url } = options;

  // Web Share API 지원 확인
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ url });
      return;
    } catch (shareError) {
      // 사용자가 공유를 취소한 경우(AbortError)는 무시
      if ((shareError as Error).name !== "AbortError") {
        // 공유 실패 시 클립보드로 대체
        await copyUrlToClipboard(url);
      }
      return;
    }
  }

  // Web Share API를 지원하지 않는 경우 클립보드에 복사
  await copyUrlToClipboard(url);
};
