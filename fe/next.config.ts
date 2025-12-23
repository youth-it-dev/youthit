import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { loadEnvConfig } from "@next/env";
import { LINK_URL } from "@/constants/shared/_link-url";

// Next.js 공식 환경 변수 로더 사용
loadEnvConfig(process.cwd());

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  cacheOnFrontEndNav: true, // 페이지 네비게이션 시 캐싱 활성화
  cacheStartUrl: true, // start_url 캐싱
  workboxOptions: {
    disableDevLogs: true, // 프로덕션 로그 최소화
    skipWaiting: true, // Service Worker 즉시 활성화
    clientsClaim: true, // 모든 클라이언트에서 즉시 활성화
    runtimeCaching: [
      {
        // API 프록시 요청은 제외 (네트워크로 직접 요청)
        urlPattern: /^https?:\/\/.*\/api-proxy\/.*/i,
        handler: "NetworkOnly",
      },
      {
        // Firebase Auth 도메인은 제외
        urlPattern:
          /^https?:\/\/.*\.(firebaseapp\.com|firebasestorage\.app|googleapis\.com)\/.*/i,
        handler: "NetworkOnly",
      },
      {
        // 카카오 OAuth 도메인은 제외
        urlPattern: /^https?:\/\/.*\.(kakao\.com|kauth\.kakao\.com)\/.*/i,
        handler: "NetworkOnly",
      },
      {
        // 나머지 요청은 NetworkFirst 전략 사용
        urlPattern: /^https?.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "offlineCache",
          expiration: {
            maxEntries: 200,
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.notion.so",
      },
      {
        protocol: "https",
        hostname: "**.s3.**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.firebasestorage.app",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "example.com",
      },
    ],
  },
  // TEMP: 브라우저 캐시 무효화 (인수인계 완료 후 제거 에정)
  // eslint-disable-next-line require-await
  async headers() {
    return [
      {
        // favicon 파일들
        source: "/icons/favicon/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        // splash 이미지들
        source: "/imgs/splash/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        // 앱 아이콘들
        source: "/icons/app/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
  // eslint-disable-next-line require-await
  async redirects() {
    return [
      {
        source: LINK_URL.ROOT,
        destination: LINK_URL.HOME,
        permanent: false,
      },
    ];
  },
  // API 프록시 설정 - HTTPS에서 HTTP 백엔드로 안전하게 요청
  // eslint-disable-next-line require-await
  async rewrites() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

    const rewrites = [];

    // Firebase Auth 프록시 설정 (iOS PWA 쿼리스트링 유실 문제 해결)
    // Firebase Auth Helper를 앱 도메인으로 프록시하여 cross-origin redirect 방지
    if (authDomain) {
      rewrites.push(
        {
          source: "/__/auth/:path*",
          destination: `https://${authDomain}/__/auth/:path*`,
        },
        {
          source: "/__/firebase/:path*",
          destination: `https://${authDomain}/__/firebase/:path*`,
        }
      );
    }

    // API 프록시
    if (baseUrl) {
      rewrites.push({
        source: "/api-proxy/:path*",
        destination: `${baseUrl}/:path*`,
      });
    } else {
      console.warn("⚠️ NEXT_PUBLIC_BASE_URL is not set. API proxy disabled.");
    }

    return rewrites;
  },
};

export default withPWA(nextConfig);
