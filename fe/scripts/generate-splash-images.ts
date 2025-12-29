import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const SPLASH_COLOR = "#0055FF";
const SOURCE_IMAGE = path.join(
  process.cwd(),
  "public",
  "imgs",
  "splash-logo.png"
);
const OUTPUT_DIR = path.join(process.cwd(), "public", "imgs", "splash");

/**
 * Apple splash screen 이미지 사이즈 목록
 * layout.tsx의 startupImage 설정과 동일한 사이즈
 */
const SPLASH_SIZES = [
  // iPad Pro 12.9" (2048x2732)
  { width: 2048, height: 2732, name: "apple-splash-2048-2732.jpg" },
  { width: 2732, height: 2048, name: "apple-splash-2732-2048.jpg" },
  // iPad Pro 11" (1668x2388)
  { width: 1668, height: 2388, name: "apple-splash-1668-2388.jpg" },
  { width: 2388, height: 1668, name: "apple-splash-2388-1668.jpg" },
  // iPad Pro 10.5" (1536x2048)
  { width: 1536, height: 2048, name: "apple-splash-1536-2048.jpg" },
  { width: 2048, height: 1536, name: "apple-splash-2048-1536.jpg" },
  // iPad 9.7" (768x1024)
  { width: 768, height: 1024, name: "apple-splash-768-1024.jpg" },
  { width: 1024, height: 768, name: "apple-splash-1024-768.jpg" },
  // iPad Air 10.9" (1640x2360)
  { width: 1640, height: 2360, name: "apple-splash-1640-2360.jpg" },
  { width: 2360, height: 1640, name: "apple-splash-2360-1640.jpg" },
  // iPad Mini 8.3" (1668x2224)
  { width: 1668, height: 2224, name: "apple-splash-1668-2224.jpg" },
  { width: 2224, height: 1668, name: "apple-splash-2224-1668.jpg" },
  // iPad 10.2" (1620x2160)
  { width: 1620, height: 2160, name: "apple-splash-1620-2160.jpg" },
  { width: 2160, height: 1620, name: "apple-splash-2160-1620.jpg" },
  // iPad Mini 8.3" (1488x2266)
  { width: 1488, height: 2266, name: "apple-splash-1488-2266.jpg" },
  { width: 2266, height: 1488, name: "apple-splash-2266-1488.jpg" },
  // iPhone 16 Pro Max (1320x2868)
  { width: 1320, height: 2868, name: "apple-splash-1320-2868.jpg" },
  { width: 2868, height: 1320, name: "apple-splash-2868-1320.jpg" },
  // iPhone 16 Pro (1206x2622)
  { width: 1206, height: 2622, name: "apple-splash-1206-2622.jpg" },
  { width: 2622, height: 1206, name: "apple-splash-2622-1206.jpg" },
  // iPhone 16 Plus (1260x2736)
  { width: 1260, height: 2736, name: "apple-splash-1260-2736.jpg" },
  { width: 2736, height: 1260, name: "apple-splash-2736-1260.jpg" },
  // iPhone 16 (1290x2796)
  { width: 1290, height: 2796, name: "apple-splash-1290-2796.jpg" },
  { width: 2796, height: 1290, name: "apple-splash-2796-1290.jpg" },
  // iPhone 15 Pro Max, 14 Pro Max (1179x2556)
  { width: 1179, height: 2556, name: "apple-splash-1179-2556.jpg" },
  { width: 2556, height: 1179, name: "apple-splash-2556-1179.jpg" },
  // iPhone 15 Pro, 15, 14 Pro (1170x2532)
  { width: 1170, height: 2532, name: "apple-splash-1170-2532.jpg" },
  { width: 2532, height: 1170, name: "apple-splash-2532-1170.jpg" },
  // iPhone 14 Plus, 13 Pro Max (1284x2778)
  { width: 1284, height: 2778, name: "apple-splash-1284-2778.jpg" },
  { width: 2778, height: 1284, name: "apple-splash-2778-1284.jpg" },
  // iPhone 13, 12, X, XS (1125x2436)
  { width: 1125, height: 2436, name: "apple-splash-1125-2436.jpg" },
  { width: 2436, height: 1125, name: "apple-splash-2436-1125.jpg" },
  // iPhone 11 Pro Max, XS Max (1242x2688)
  { width: 1242, height: 2688, name: "apple-splash-1242-2688.jpg" },
  { width: 2688, height: 1242, name: "apple-splash-2688-1242.jpg" },
  // iPhone XR, 11 (828x1792)
  { width: 828, height: 1792, name: "apple-splash-828-1792.jpg" },
  { width: 1792, height: 828, name: "apple-splash-1792-828.jpg" },
  // iPhone 8 Plus, 7 Plus, 6s Plus (1242x2208)
  { width: 1242, height: 2208, name: "apple-splash-1242-2208.jpg" },
  { width: 2208, height: 1242, name: "apple-splash-2208-1242.jpg" },
  // iPhone 8, 7, 6s (750x1334)
  { width: 750, height: 1334, name: "apple-splash-750-1334.jpg" },
  { width: 1334, height: 750, name: "apple-splash-1334-750.jpg" },
  // iPhone SE (640x1136)
  { width: 640, height: 1136, name: "apple-splash-640-1136.jpg" },
  { width: 1136, height: 640, name: "apple-splash-1136-640.jpg" },
];

/**
 * 원본 이미지를 중앙에 배치하고 나머지 영역을 배경색으로 채운 이미지 생성
 */
const generateSplashImage = async (
  sourceImagePath: string,
  targetWidth: number,
  targetHeight: number,
  backgroundColor: string
): Promise<Buffer> => {
  // 원본 이미지 메타데이터 가져오기
  const sourceImage = sharp(sourceImagePath);
  const metadata = await sourceImage.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("원본 이미지의 크기를 가져올 수 없습니다.");
  }

  // 원본 이미지의 비율 계산
  const sourceRatio = metadata.width / metadata.height;
  const targetRatio = targetWidth / targetHeight;
  const ratioDiff = Math.abs(sourceRatio - targetRatio);

  // 타겟 크기에 맞게 원본 이미지를 리사이즈
  let resizedWidth: number;
  let resizedHeight: number;

  // 프로젝트의 논리적 최대 컨텐츠 너비: 472px (모바일만 적용)
  const LOGICAL_MAX_WIDTH = 472;

  // 하단부 필수 보존 높이 (논리적 86px)
  const LOGICAL_BOTTOM_MIN_HEIGHT = 86;

  // 디바이스 pixel ratio 추정
  // 논리 픽셀 기준으로 계산: 물리 / 비율 = 논리
  // @1x: 768x1024
  // @2x: 640-828 (320-414 논리), 1488-2732 (태블릿)
  // @3x: 1125-1320 (375-440 논리)
  let pixelRatio: number;
  if (
    (targetWidth === 768 && targetHeight === 1024) ||
    (targetWidth === 1024 && targetHeight === 768)
  ) {
    pixelRatio = 1;
  } else if (targetWidth >= 1488 || targetHeight >= 2000) {
    pixelRatio = 2; // 태블릿은 @2x
  } else if (targetWidth >= 1125 && targetWidth < 1488) {
    pixelRatio = 3; // 최신 iPhone은 @3x
  } else {
    pixelRatio = 2; // iPhone XR (828), SE (640), 8 (750)
  }
  const MAX_CONTENT_WIDTH = LOGICAL_MAX_WIDTH * pixelRatio;
  const BOTTOM_MIN_HEIGHT = LOGICAL_BOTTOM_MIN_HEIGHT * pixelRatio;

  // 태블릿 크기 감지
  const isTablet =
    (targetWidth === 768 && targetHeight === 1024) ||
    (targetWidth === 1024 && targetHeight === 768) ||
    targetWidth >= 1500 ||
    targetHeight >= 2000;

  // 모바일: 472px 제한, 태블릿: 전체 너비 사용
  const effectiveWidth = isTablet
    ? targetWidth
    : Math.min(targetWidth, MAX_CONTENT_WIDTH);

  // 하단 여백을 확보하기 위해 실제 사용 가능한 높이 계산
  const availableHeight = targetHeight - BOTTOM_MIN_HEIGHT;

  // 너비 기준으로 이미지 크기 계산
  const widthBasedHeight = Math.floor(effectiveWidth / sourceRatio);

  // 높이 기준으로 이미지 크기 계산
  const heightBasedWidth = Math.floor(availableHeight * sourceRatio);

  // 모든 디바이스: 이미지를 availableHeight 안에 들어가도록 축소
  // 전체 이미지가 보이도록 contain 방식, 위아래 여백은 배경색
  if (widthBasedHeight <= availableHeight) {
    // 너비 기준이 availableHeight 안에 들어감
    resizedWidth = Math.floor(effectiveWidth);
    resizedHeight = widthBasedHeight;
  } else {
    // 너비 기준으로 하면 높이가 넘침: 높이 기준으로 축소 (전체 이미지 표시)
    resizedWidth = heightBasedWidth;
    resizedHeight = availableHeight;
  }

  // 최종 확인: resizedHeight가 availableHeight를 절대 초과하지 않도록
  if (resizedHeight > availableHeight) {
    const scale = availableHeight / resizedHeight;
    resizedWidth = Math.floor(resizedWidth * scale);
    resizedHeight = availableHeight;
  }

  let processedImageBuffer: Buffer;
  let finalWidth: number;
  let finalHeight: number;
  let left: number;
  let top: number;

  // 전체 이미지 사용
  processedImageBuffer = await sourceImage
    .resize(resizedWidth, resizedHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // 모든 디바이스: 이미지를 축소해서 전체 표시, 하단 여백 확보
  // resizedHeight는 이미 availableHeight 이하로 보장됨
  left = Math.floor((targetWidth - resizedWidth) / 2);
  const idealTop = targetHeight - resizedHeight - BOTTOM_MIN_HEIGHT;

  if (idealTop < 0) {
    // 이미지가 여전히 너무 큰 경우: 추가 축소 (이론적으로 발생하지 않아야 함)
    const maxAllowedHeight = targetHeight - BOTTOM_MIN_HEIGHT;
    const scale = maxAllowedHeight / resizedHeight;
    resizedWidth = Math.floor(resizedWidth * scale);
    resizedHeight = maxAllowedHeight;

    processedImageBuffer = await sourceImage
      .resize(resizedWidth, resizedHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    finalWidth = resizedWidth;
    finalHeight = resizedHeight;
    left = Math.floor((targetWidth - resizedWidth) / 2);
    top = 0; // 하단 여백 확보
  } else {
    // 이미지가 화면에 들어감: 하단 여백 확보하여 배치
    finalWidth = resizedWidth;
    finalHeight = resizedHeight;
    top = idealTop;
  }

  // 배경색으로 채워진 캔버스 생성
  const canvas = sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 4,
      background: backgroundColor,
    },
  });

  // 배경 위에 처리된 이미지 합성
  const result = await canvas
    .composite([
      {
        input: processedImageBuffer,
        left,
        top,
      },
    ])
    .flatten({ background: backgroundColor }) // 투명 영역을 배경색으로 변환
    .jpeg({ quality: 90 })
    .toBuffer();

  return result;
};

/**
 * 모든 splash screen 이미지 생성
 */
const generateAllSplashImages = async () => {
  console.log("🚀 Splash screen 이미지 생성 시작...");
  console.log(`📁 원본 이미지: ${SOURCE_IMAGE}`);
  console.log(`📁 출력 디렉토리: ${OUTPUT_DIR}`);
  console.log(`🎨 배경색: ${SPLASH_COLOR}\n`);

  // 원본 이미지 존재 확인
  if (!existsSync(SOURCE_IMAGE)) {
    console.error(`❌ 원본 이미지를 찾을 수 없습니다: ${SOURCE_IMAGE}`);
    process.exit(1);
  }

  // 출력 디렉토리 확인
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const size of SPLASH_SIZES) {
    try {
      console.log(`⏳ 생성 중: ${size.name} (${size.width}x${size.height})`);

      const imageBuffer = await generateSplashImage(
        SOURCE_IMAGE,
        size.width,
        size.height,
        SPLASH_COLOR
      );

      const outputPath = path.join(OUTPUT_DIR, size.name);
      await writeFile(outputPath, imageBuffer);

      console.log(`✅ 완료: ${size.name}`);
      successCount++;
    } catch (error) {
      console.error(`❌ 실패: ${size.name}`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 생성 완료!`);
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${errorCount}개`);

  if (errorCount === 0) {
    console.log(`\n🎉 모든 splash screen 이미지가 성공적으로 생성되었습니다!`);
  }
};

// 스크립트 실행
generateAllSplashImages().catch((error) => {
  console.error("💥 스크립트 실행 중 오류 발생:", error);
  process.exit(1);
});
