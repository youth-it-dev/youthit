import { SPLASH_IMAGES } from "@/app/splash-images";

/**
 * 스플래시 이미지 URL에서 크기 정보 추출
 * 파일명 패턴: apple-splash-{width}-{height}.jpg
 */
const parseImageSize = (
  url: string
): { width: number; height: number } | null => {
  const match = url.match(/apple-splash-(\d+)-(\d+)\.jpg/);
  if (!match) return null;
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
};

/**
 * 스플래시 이미지 목록을 파싱하여 사용 가능한 이미지 정보 생성
 */
const getAvailableSplashImages = () => {
  return SPLASH_IMAGES.map((item) => {
    const size = parseImageSize(item.url);
    if (!size) {
      // 파싱 실패 시 기본값 (하지만 실제로는 모든 이미지가 패턴을 따름)
      return {
        url: item.url,
        ratio: 1,
        width: 0,
      };
    }
    return {
      url: item.url,
      ratio: size.width / size.height,
      width: size.width,
      height: size.height,
    };
  }).filter((img) => img.width > 0); // 유효한 이미지만 필터링
};

/**
 * 디바이스 크기에 맞는 스플래시 이미지와 스타일 정보 반환
 */
export const getSplashConfig = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  // 논리 픽셀 계산
  const logicalWidth = width;
  const logicalHeight = height;
  const aspectRatio = logicalWidth / logicalHeight;
  const isDesktop = logicalWidth >= 768;

  // splash-images.ts에서 정의된 이미지 목록 사용
  const allSplashImages = getAvailableSplashImages();

  // 비율과 해상도를 함께 고려하는 점수 시스템
  const scoredImages = allSplashImages.map((img) => {
    const ratioDiff = Math.abs(img.ratio - aspectRatio);
    // 해상도 점수 (0~1 정규화): 최대 해상도 기준
    const maxWidth = Math.max(...allSplashImages.map((i) => i.width));
    const resolutionScore = img.width / maxWidth;
    // 비율 차이 점수 (0~1 정규화): 차이가 작을수록 높은 점수
    const ratioScore =
      ratioDiff < 0.6
        ? 1 - ratioDiff / 0.6
        : Math.max(0, 1 - (ratioDiff - 0.6) / 0.4);
    // 최종 점수: 해상도 80%, 비율 20% 가중치 (화질 최우선)
    const score = resolutionScore * 0.8 + ratioScore * 0.2;
    return { ...img, score, ratioDiff };
  });

  // 비율 차이가 0.6 이내인 이미지가 있으면 그 중에서 선택
  const acceptableImages = scoredImages.filter((img) => img.ratioDiff < 0.6);

  let imageUrl: string;
  if (acceptableImages.length > 0) {
    // 비율이 허용 범위 내인 이미지 중 해상도가 가장 높은 것 우선 선택
    const bestImage = acceptableImages.reduce((prev, current) => {
      if (current.width > prev.width) return current;
      if (current.width === prev.width && current.score > prev.score)
        return current;
      return prev;
    });
    imageUrl = bestImage.url;
  } else {
    // 비율이 허용 범위를 벗어나면 해상도가 가장 높은 이미지 선택
    const bestImage = scoredImages.reduce((prev, current) =>
      current.width > prev.width ? current : prev
    );
    imageUrl = bestImage.url;
  }

  // iPhone XR 특별 처리 (414x896 @2x) - 여백 문제 해결을 위한 스타일
  const isIPhoneXR =
    logicalWidth === 414 && logicalHeight === 896 && pixelRatio === 2;
  if (isIPhoneXR) {
    return {
      imageUrl,
      isDesktop: false,
      imageStyle: {
        objectFit: "cover" as const,
        objectPosition: "center" as const,
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        transform: "scale(1.01)", // 미세한 여백을 가리기 위해 약간 확대
      },
    };
  }

  return {
    imageUrl,
    isDesktop,
    imageStyle: {
      objectFit: "cover" as const,
      objectPosition: "center" as const,
      width: isDesktop ? "472px" : "100%",
      height: "100%",
      maxWidth: isDesktop ? "472px" : "100%",
    },
  };
};
