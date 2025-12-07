/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { ExtendedRecordMap } from "notion-types";
import "react-notion-x/src/styles.css";
import { CustomPageLink, CustomImage } from "@/components/shared/notion";
import { useGetHome } from "@/hooks/generated/home-hooks";
import { useMounted } from "@/hooks/shared/useMounted";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { cn } from "@/utils/shared/cn";
import { isS3UrlExpired } from "@/utils/shared/s3-url-parser";

const INITIAL_HEIGHT = 950;

// NotionRenderer는 클라이언트 전용으로 렌더링하여 hydration 불일치 방지
const NotionRenderer = dynamic(
  () => import("react-notion-x").then((m) => m.NotionRenderer),
  { ssr: false }
);

/**
 * @description 홈 페이지 - Notion 기반 홈 화면
 * 서버에서 가져온 Notion 데이터를 나열식으로 렌더링
 */
const HomePage = () => {
  const { data: homeData } = useGetHome({
    select: (data): ExtendedRecordMap => {
      // API 응답이 { data: { data: recordMap } } 형태일 경우 unwrap
      if (data && typeof data === "object" && "data" in data) {
        const innerData = (data as { data: { data: ExtendedRecordMap } }).data;
        if (innerData && typeof innerData === "object" && "data" in innerData) {
          return innerData.data;
        }
        return innerData as unknown as ExtendedRecordMap;
      }
      return data as unknown as ExtendedRecordMap;
    },
  });

  const setIsScrolled = useTopBarStore((state) => state.setIsScrolled);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [imageHeights, setImageHeights] = useState<number[]>([]);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [defaultHeight, setDefaultHeight] = useState<number>(INITIAL_HEIGHT);
  const isMounted = useMounted();

  // recordMap에서 배경 이미지 추출
  const backgroundImages = useMemo(() => {
    if (!homeData?.block) return [];

    // recordMap에서 페이지 블록 찾기
    const pageBlock = Object.values(homeData.block).find(
      (block: any) => (block as any)?.value?.type === "page"
    );

    if (!pageBlock) return [];

    // 페이지의 properties에서 배경화면 필드 찾기
    const properties = (pageBlock as any).value?.properties;
    if (!properties) return [];

    // "배경화면" 필드 찾기 (필드 ID는 "o|d}"로 보임)
    const backgroundImageField = properties["o|d}"] || properties["배경화면"];
    if (!backgroundImageField || !Array.isArray(backgroundImageField))
      return [];

    // 파일 정보 추출
    const files: Array<{ name?: string; url?: string; type?: string }> = [];
    backgroundImageField.forEach((fileData: any) => {
      if (Array.isArray(fileData) && fileData.length > 0) {
        const fileName = fileData[0];
        const fileInfo = fileData[1];
        if (Array.isArray(fileInfo) && fileInfo.length > 0) {
          const attachmentInfo = fileInfo[0];
          if (Array.isArray(attachmentInfo) && attachmentInfo[0] === "a") {
            const attachmentUrl = attachmentInfo[1];

            if (
              typeof attachmentUrl === "string" &&
              attachmentUrl.startsWith("attachment:")
            ) {
              const parts = attachmentUrl.split(":");
              const fileId = parts[1];
              let signedUrl: string | null = null;

              // 1. signed_urls에서 파일 ID로 직접 찾기
              if (fileId && homeData.signed_urls) {
                signedUrl = homeData.signed_urls[fileId] || null;
              }

              // 2. 파일 ID로 직접 찾지 못한 경우, 페이지 블록의 file_ids를 확인하여 해당 파일을 참조하는 블록 찾기
              if (!signedUrl && fileId && homeData.block) {
                const pageValue = (pageBlock as any).value;
                const fileIds = pageValue?.file_ids || [];

                // file_ids에 해당 파일 ID가 있는 경우, 해당 파일을 참조하는 블록 찾기
                if (fileIds.includes(fileId)) {
                  // 모든 블록을 순회하여 해당 파일 ID를 참조하는 블록 찾기
                  const fileBlock = Object.values(homeData.block).find(
                    (block: any) => {
                      const blockFileIds = block?.value?.file_ids || [];
                      return blockFileIds.includes(fileId);
                    }
                  );

                  if (fileBlock) {
                    const blockId = (fileBlock as any).value?.id;
                    if (blockId && homeData.signed_urls) {
                      signedUrl = homeData.signed_urls[blockId] || null;
                    }
                  }
                }
              }

              // 3. signed_urls에서 찾지 못한 경우, Notion 이미지 URL 생성
              if (!signedUrl && fileId) {
                const pageId = (pageBlock as any).value?.id;
                signedUrl = `https://www.notion.so/image/${encodeURIComponent(attachmentUrl)}?table=block&id=${pageId}&cache=v2`;
              }

              files.push({
                name: fileName,
                url: signedUrl || attachmentUrl,
                type: "file",
              });
            }
          }
        }
      }
    });

    // 만료된 URL 필터링
    return files.filter((img) => {
      if (!img.url) return false;
      const expired = isS3UrlExpired(img.url);
      return expired !== true;
    });
  }, [homeData]);

  // 클라이언트에서만 window.innerHeight 설정
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDefaultHeight(window.innerHeight);
    }
  }, []);

  // TopBar 스크롤 감지 (Intersection Observer)
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "-60px 0px 0px 0px",
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
      setIsScrolled(false);
    };
  }, [setIsScrolled]);

  // 배경 이미지 높이 계산
  useEffect(() => {
    if (backgroundImages.length === 0 || typeof window === "undefined") return;

    let active = true;
    const heights: number[] = [];
    let loadedCount = 0;

    backgroundImages.forEach((bgImage, index: number) => {
      const imageUrl = bgImage?.url;
      if (!imageUrl) {
        heights[index] = 0;
        loadedCount++;
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        if (!active) return;
        const containerMaxWidth = 470;
        const actualWidth = Math.min(window.innerWidth, containerMaxWidth);
        const imageAspectRatio = img.height / img.width;
        const containerHeight = actualWidth * imageAspectRatio;
        heights[index] = containerHeight;
        loadedCount++;

        if (loadedCount === backgroundImages.length && active) {
          setImageHeights(heights);
        }
      };
      img.onerror = () => {
        if (!active) return;
        heights[index] = 0;
        loadedCount++;
        if (loadedCount === backgroundImages.length && active) {
          setImageHeights(heights);
        }
      };
      img.src = imageUrl;
    });

    return () => {
      active = false;
    };
  }, [backgroundImages]);

  // 누적 높이 계산 (이전 이미지들의 높이 합계)
  const getCumulativeHeight = (index: number): number => {
    let cumulativeHeight = 0;
    for (let i = 0; i < index; i++) {
      cumulativeHeight += imageHeights[i] || 0;
    }
    return cumulativeHeight;
  };

  // 모든 배경 이미지의 총 높이 계산
  const totalBackgroundHeight = useMemo(() => {
    if (backgroundImages.length === 0) return 0;
    return imageHeights.reduce((sum, height) => sum + (height || 0), 0);
  }, [backgroundImages.length, imageHeights]);

  // 콘텐츠 높이 계산 및 배경 이미지 컨테이너 높이 업데이트
  useEffect(() => {
    if (!contentRef.current) return;

    const updateContentHeight = () => {
      const height = contentRef.current?.scrollHeight || 0;
      setContentHeight(height);
    };

    // 초기 높이 계산
    updateContentHeight();

    // ResizeObserver로 콘텐츠 높이 변경 감지
    const resizeObserver = new ResizeObserver(updateContentHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [homeData]);

  // 배경 이미지 컨테이너의 최종 높이 계산
  const backgroundContainerHeight = useMemo(() => {
    // 총 배경 이미지 높이와 콘텐츠 높이 중 큰 값 사용
    const fallbackHeight = defaultHeight;
    return Math.max(
      totalBackgroundHeight || fallbackHeight,
      contentHeight || fallbackHeight,
      fallbackHeight
    );
  }, [totalBackgroundHeight, contentHeight, defaultHeight]);

  return (
    <div className="relative w-full">
      {/* 배경 이미지 레이어 - 콘텐츠 높이에 맞춰 스크롤 가능 */}
      {/* isMounted 체크로 서버/클라이언트 렌더링 일치 보장 */}
      {isMounted && backgroundImages.length > 0 && (
        <div
          className="absolute z-1 mx-auto w-full max-w-[470px]"
          style={{
            height: `${backgroundContainerHeight}px`,
          }}
        >
          <div
            className="relative w-full"
            style={{
              height: `${backgroundContainerHeight}px`,
            }}
          >
            {backgroundImages.map((bgImage, index: number) => {
              const imageUrl = bgImage?.url;
              if (!imageUrl) return null;

              const imageHeight = imageHeights[index] || defaultHeight;
              const cumulativeTop = getCumulativeHeight(index);

              return (
                <div
                  key={index}
                  className="absolute right-0 left-0 bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundSize: "contain",
                    top: `${cumulativeTop}px`,
                    height: `${imageHeight}px`,
                    width: "100%",
                    pointerEvents: "none",
                  }}
                >
                  <Image
                    src={imageUrl}
                    alt=""
                    fill
                    className="object-contain"
                    priority={index === 0}
                    unoptimized={!imageUrl.startsWith("/")}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 콘텐츠 레이어 */}
      <div ref={contentRef} className="relative min-h-screen">
        <div
          ref={sentinelRef}
          className="pointer-events-none absolute top-[80px] left-0 h-px w-full"
          aria-hidden="true"
        />

        <div className="relative mx-auto w-full max-w-[470px] px-1">
          <div className="relative z-10 mx-auto my-0 pt-[40px]">
            {isMounted && homeData && (
              <NotionRenderer
                recordMap={homeData}
                fullPage={false}
                darkMode={false}
                forceCustomImages
                components={{
                  Image: CustomImage,
                  PageLink: CustomPageLink,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
