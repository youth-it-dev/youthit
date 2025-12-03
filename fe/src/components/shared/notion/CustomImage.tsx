"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

interface CustomImageProps {
  src?: string | null;
  alt?: string | null;
  href?: string | null;
  target?: string | null;
  style?: React.CSSProperties;
  className?: string;
  width?: number | string;
  height?: number | string;
  [key: string]: unknown;
}

/**
 * @description Notion의 Image를 커스터마이징한 컴포넌트
 * next/image를 활용하고, 링크가 있는 경우 CustomPageLink와 동일한 로직으로 처리
 */
export const CustomImage = ({
  src,
  alt,
  href,
  target,
  style,
  className = "",
  width,
  height,
  ...rest
}: CustomImageProps) => {
  const router = useRouter();

  if (!src) {
    return null;
  }

  // alt에서 링크 추출 (alt가 URL인 경우)
  const linkUrl =
    alt && (alt.startsWith("http") || alt.startsWith("/")) ? alt : href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!linkUrl) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      const urlObj = new URL(
        linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`
      );

      // 같은 도메인인지 확인 (내부 링크인 경우)
      // youth-it 도메인은 모두 내부 링크로 처리
      if (
        urlObj.hostname === window.location.hostname ||
        urlObj.hostname.includes("youth-it") ||
        urlObj.hostname.includes("localhost")
      ) {
        // 경로만 추출하여 router.push 사용 (서비스 내 페이지 이동)
        router.push(urlObj.pathname + urlObj.search);
      } else {
        // 외부 링크는 새 탭에서 열기
        window.open(linkUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // URL 파싱 실패 시 경로로 직접 사용
      const path = linkUrl.startsWith("/") ? linkUrl : `/${linkUrl}`;
      router.push(path);
    }
  };

  // width와 height가 숫자인지 확인
  const numericWidth =
    typeof width === "number"
      ? width
      : typeof width === "string"
        ? parseInt(width, 10) || 800
        : 800;
  const numericHeight =
    typeof height === "number"
      ? height
      : typeof height === "string"
        ? parseInt(height, 10) || 600
        : 600;

  // style에서 height가 "100%" 같은 경우 fill 옵션 사용
  const useFill =
    (style?.height === "100%" || style?.width === "100%") &&
    (!numericWidth ||
      !numericHeight ||
      numericWidth === 800 ||
      numericHeight === 600);

  // style에서 height/width를 제거 (next/image에 직접 전달하지 않음)
  const imageStyle = { ...style };
  if (useFill) {
    delete imageStyle.height;
    delete imageStyle.width;
  }

  // linkUrl이 유효한 링크인지 확인 (빈 문자열, "#", "javascript:" 등은 무시)
  const isValidLink =
    linkUrl &&
    linkUrl.trim() !== "" &&
    linkUrl !== "#" &&
    !linkUrl.startsWith("javascript:") &&
    !linkUrl.startsWith("mailto:") &&
    linkUrl !== src; // linkUrl이 src와 같으면 실제 링크가 아님

  // alt가 URL인 경우 실제 alt 텍스트는 빈 문자열로 설정
  const imageAlt =
    alt && (alt.startsWith("http") || alt.startsWith("/")) ? "" : alt || "";

  const imageElement = useFill ? (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        ...imageStyle,
      }}
      className={className}
    >
      <Image
        src={src}
        alt={imageAlt}
        fill
        className="object-contain"
        unoptimized={!src.startsWith("/")}
        loading="lazy"
      />
    </div>
  ) : (
    <Image
      src={src}
      alt={imageAlt}
      width={numericWidth}
      height={numericHeight}
      style={imageStyle}
      className={className}
      unoptimized={!src.startsWith("/")}
      loading="lazy"
    />
  );

  // 유효한 링크가 없는 경우 이미지만 렌더링
  if (!isValidLink) {
    return imageElement;
  }

  // linkUrl이 youth-it 도메인인 경우 내부 링크로 처리
  const isInternalLink =
    linkUrl &&
    (linkUrl.includes("youth-it") ||
      linkUrl.includes("localhost") ||
      linkUrl.startsWith("/"));

  // 내부 링크인 경우 항상 onClick 핸들러 사용 (target 무시)
  if (isInternalLink) {
    return (
      <a
        href={linkUrl}
        onClick={handleClick}
        style={style}
        className={className}
      >
        {imageElement}
      </a>
    );
  }

  // 외부 링크이고 target이 blank인 경우
  if (target === "blank_" || target === "_blank") {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        className={className}
      >
        {imageElement}
      </a>
    );
  }

  // 내부 링크는 클릭 핸들러 사용
  return (
    <a href={linkUrl} onClick={handleClick} style={style} className={className}>
      {imageElement}
    </a>
  );
};
