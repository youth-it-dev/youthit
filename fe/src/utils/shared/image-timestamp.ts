/**
 * 이미지에 타임스탬프를 추가하는 유틸리티 함수들
 * 미션 사진 저장용으로 최적화됨
 */

import { formatTimestampTwoLines } from "@/utils/shared/date";
import { compressImage } from "@/utils/shared/image-compress";

// 타임스탬프는 항상 좌측 하단, 흰색으로 고정

/**
 * 이미지 파일에 타임스탬프를 추가하고 압축하여 새로운 Blob을 반환
 * 타임스탬프는 항상 좌측 하단에 흰색으로 표시됩니다.
 * @param file - 원본 이미지 파일
 * @param timestamp - 타임스탬프 문자열 (기본값: 현재 시간)
 * @returns 타임스탬프가 추가되고 압축된 이미지 Blob
 */
export const addTimestampToImage = async (
  file: File,
  timestamp?: string
): Promise<Blob> => {
  try {
    // 먼저 이미지를 압축
    const compressedBlob = await compressImage(file);

    // 압축된 이미지를 Canvas에 로드하여 타임스탬프 추가
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context를 생성할 수 없습니다"));
        return;
      }

      img.onload = () => {
        try {
          // 압축된 이미지로 Canvas 크기 설정
          canvas.width = img.width;
          canvas.height = img.height;

          // 압축된 이미지를 Canvas에 그리기
          ctx.drawImage(img, 0, 0);

          // 타임스탬프 텍스트 설정 (두 줄 형식)
          const timestampLines = timestamp
            ? (() => {
                // timestamp가 제공된 경우 파싱 (기존 형식 지원)
                const parts = timestamp.split(" ");
                if (parts.length >= 2) {
                  const datePart = parts.slice(0, -1).join(" "); // 날짜 부분
                  const timePart = parts[parts.length - 1]; // 시간 부분
                  return { line1: datePart, line2: timePart };
                }
                // 파싱 실패 시 기본 형식 사용
                return formatTimestampTwoLines();
              })()
            : formatTimestampTwoLines();

          // 폰트 크기 설정 (이미지 너비의 1/25, 기존의 1.2배)
          const fontSize = Math.max(12, Math.floor(img.width / 25));
          ctx.font = `${fontSize}px Noto Sans KR, Arial, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";

          // 패딩 설정 (px-4 정도의 효과를 주기 위해 크게 설정)
          const padding = Math.max(16, Math.floor(fontSize * 1.3));
          // 줄 간격 설정
          const lineHeight = fontSize * 1.2;

          // 타임스탬프 텍스트 그리기 (항상 좌측 하단, 흰색, 두 줄)
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          // 두 번째 줄 (시간) 먼저 그리기
          ctx.fillText(timestampLines.line2, padding, img.height - padding);
          // 첫 번째 줄 (날짜) 그리기
          ctx.fillText(
            timestampLines.line1,
            padding,
            img.height - padding - lineHeight
          );

          // Canvas를 Blob으로 변환 (최종 압축)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("이미지 변환에 실패했습니다"));
              }
            },
            "image/jpeg",
            0.95 // 품질 설정 (95%)
          );
        } catch (error) {
          reject(error);
        } finally {
          // 메모리 정리
          URL.revokeObjectURL(img.src);
        }
      };

      img.onerror = () => {
        reject(new Error("압축된 이미지 로드에 실패했습니다"));
      };

      // 압축된 Blob을 Object URL로 설정 (FileReader보다 효율적)
      img.src = URL.createObjectURL(compressedBlob);
    });
  } catch (error) {
    throw error;
  }
};
