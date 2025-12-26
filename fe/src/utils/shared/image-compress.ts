import { IMAGE_CONFIG } from "@/constants/shared/_photo-storage";
import { debug } from "@/utils/shared/debugger";

/**
 * 이미지 파일을 압축하고 리사이즈
 * @param file - 원본 이미지 파일
 * @returns 압축된 이미지 Blob
 */
export const compressImage = (file: File): Promise<Blob> => {
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
        // 원본 크기
        const { width: originalWidth, height: originalHeight } = img;

        // 리사이즈 계산 (비율 유지)
        const { width, height } = (() => {
          // 이미 최대 크기보다 작으면 그대로 반환
          if (
            originalWidth <= IMAGE_CONFIG.MAX_WIDTH &&
            originalHeight <= IMAGE_CONFIG.MAX_HEIGHT
          ) {
            return { width: originalWidth, height: originalHeight };
          }

          const aspectRatio = originalWidth / originalHeight;

          // 너비 기준으로 리사이즈
          let width = IMAGE_CONFIG.MAX_WIDTH;
          let height = width / aspectRatio;

          // 높이가 최대 높이를 초과하면 높이 기준으로 리사이즈
          if (height > IMAGE_CONFIG.MAX_HEIGHT) {
            height = IMAGE_CONFIG.MAX_HEIGHT;
            width = height * aspectRatio;
          }

          // 정수로 변환
          return {
            width: Math.floor(width),
            height: Math.floor(height),
          };
        })();

        // Canvas 크기 설정
        canvas.width = width;
        canvas.height = height;

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);

        // Blob으로 변환 (압축)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              debug.log(
                `이미지 압축 완료: ${originalWidth}x${originalHeight} → ${width}x${height}, ${(blob.size / 1024).toFixed(1)}KB`
              );
              resolve(blob);
            } else {
              reject(new Error("이미지 압축에 실패했습니다"));
            }
          },
          IMAGE_CONFIG.FORMAT,
          IMAGE_CONFIG.QUALITY
        );
      } catch (error) {
        debug.error("이미지 압축 실패:", error);
        reject(error);
      } finally {
        // 메모리 정리
        URL.revokeObjectURL(img.src);
      }
    };

    img.onerror = () => {
      reject(new Error("이미지 로드에 실패했습니다"));
    };

    // 파일을 Object URL로 설정 (FileReader보다 효율적)
    img.src = URL.createObjectURL(file);
  });
};
