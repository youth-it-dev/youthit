/**
 * 이미지에 타임스탬프를 추가하는 유틸리티 함수들
 * 미션 사진 저장용으로 최적화됨
 */

import { IMAGE_URL } from "@/constants/shared/_image-url";
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

    // 로고 이미지 로드
    const logoImg = new Image();
    const logoLoaded = new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () =>
        reject(new Error("로고 이미지 로드에 실패했습니다"));
      logoImg.src = IMAGE_URL.ICON.logo.youthIt.url;
    });

    // 압축된 이미지를 Canvas에 로드하여 타임스탬프 추가
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context를 생성할 수 없습니다"));
        return;
      }

      // 로고도 함께 로드될 때까지 대기
      Promise.all([
        new Promise<void>((resolveImg) => {
          img.onload = () => resolveImg();
          img.src = URL.createObjectURL(compressedBlob);
        }),
        logoLoaded,
      ])
        .then(() => {
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

            // 폰트 크기 설정 (이미지 너비의 1/20으로 더 크게, 최소 16px)
            const fontSize = Math.max(16, Math.floor(img.width / 20));
            ctx.font = `bold ${fontSize}px Noto Sans KR, Arial, sans-serif`;
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

            // 로고 그리기 (우측 상단, 원래 비율 유지)
            const maxLogoWidth = Math.max(80, Math.floor(img.width / 5)); // 최대 너비 (더 크게)
            const maxLogoHeight = Math.max(50, Math.floor(img.height / 8)); // 최대 높이 (더 크게)

            // 로고의 원래 비율 유지
            const logoAspectRatio = logoImg.width / logoImg.height;
            let logoWidth = maxLogoWidth;
            let logoHeight = logoWidth / logoAspectRatio;

            // 높이가 최대 높이를 초과하면 높이에 맞춤
            if (logoHeight > maxLogoHeight) {
              logoHeight = maxLogoHeight;
              logoWidth = logoHeight * logoAspectRatio;
            }

            const logoPadding = padding;
            const logoX = img.width - logoWidth - logoPadding;
            const logoY = logoPadding;

            // 로고 이미지 그리기 (배경 없음)
            ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);

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
        })
        .catch(reject);

      img.onerror = () => {
        reject(new Error("압축된 이미지 로드에 실패했습니다"));
      };
    });
  } catch (error) {
    throw error;
  }
};
