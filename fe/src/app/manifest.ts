import type { MetadataRoute } from "next";

/**
 * @description iOS PWA 매니페스트 설정
 *
 * iOS PWA에서 로그인 상태 유지 방법:
 * - iOS 14+에서는 Safari와 PWA가 cacheStorage를 공유
 * - cacheStorage를 활용하여 인증 정보를 저장하고 복원
 * - start_url을 "/"로 설정하여 기본 경로에서 시작
 *
 * 참고:
 * - https://stackoverflow.com/questions/62669966/how-to-maintain-login-status-in-a-pwa-initially-loaded-via-safari-14-ios-14
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "유스잇",
    short_name: "유스잇",
    description: "유스잇",
    // PWA 시작 URL - 홈 화면에서 앱을 열 때 로드되는 기본 경로
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    scope: "/",
    lang: "ko",
    background_color: "#0055FF",
    theme_color: "#0055FF",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/favicon/16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/icons/favicon/32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icons/favicon/48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icons/app/app-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app/app-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/app/app-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app/app-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
