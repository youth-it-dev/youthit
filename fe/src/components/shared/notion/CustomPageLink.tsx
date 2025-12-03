"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

interface CustomPageLinkProps {
  href?: string | null;
  target?: string | null;
  style?: React.CSSProperties;
  children: ReactNode;
  className?: string;
}

/**
 * @description Notion의 PageLink를 커스터마이징한 컴포넌트
 * 내부 링크는 router.push로 서비스 내 페이지 이동, 외부 링크는 새 탭에서 열기
 */
export const CustomPageLink = ({
  href,
  target,
  style,
  children,
  className = "",
}: CustomPageLinkProps) => {
  const router = useRouter();

  if (!href) {
    return (
      <div style={style} className={className}>
        {children}
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const urlObj = new URL(
        href.startsWith("http") ? href : `https://${href}`
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
        window.open(href, "_blank", "noopener,noreferrer");
      }
    } catch {
      // URL 파싱 실패 시 경로로 직접 사용
      const path = href.startsWith("/") ? href : `/${href}`;
      router.push(path);
    }
  };

  // href가 youth-it 도메인인 경우 내부 링크로 처리
  const isInternalLink =
    href &&
    (href.includes("youth-it") ||
      href.includes("localhost") ||
      href.startsWith("/"));

  // 내부 링크인 경우 항상 onClick 핸들러 사용 (target 무시)
  if (isInternalLink) {
    return (
      <a href={href} onClick={handleClick} style={style} className={className}>
        {children}
      </a>
    );
  }

  // 외부 링크이고 target이 blank인 경우
  if (target === "blank_" || target === "_blank") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        className={className}
      >
        {children}
      </a>
    );
  }

  // 내부 링크는 클릭 핸들러 사용
  return (
    <a href={href} onClick={handleClick} style={style} className={className}>
      {children}
    </a>
  );
};
