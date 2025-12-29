"use client";

interface PullToRefreshProps {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
}

// 최대 당김 거리 (스피너가 완전히 표시되는 거리)
const MAX_PULL_DISTANCE = 60;

/**
 * @description Pull-to-refresh 시각적 피드백 컴포넌트
 * 당김 거리에 따라 점진적으로 로딩 스피너가 표시됨
 */
export const PullToRefresh = ({
  pullDistance,
  isRefreshing,
  isPulling,
}: PullToRefreshProps) => {
  // 당김 거리에 따른 스피너 크기 (최소 16px, 최대 24px)
  const spinnerSize = Math.min(
    24,
    Math.max(16, 16 + (pullDistance / MAX_PULL_DISTANCE) * 8)
  );

  // 당김 거리에 따른 opacity (점진적 표시)
  const opacity = isRefreshing
    ? 1
    : Math.min(1, pullDistance / MAX_PULL_DISTANCE);

  // 표시 여부 결정
  const isVisible = (isPulling && pullDistance > 5) || isRefreshing;

  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-50 flex items-center justify-center"
      style={{
        top: `-${MAX_PULL_DISTANCE}px`,
        opacity: isVisible ? opacity : 0,
        transition: isRefreshing
          ? "opacity 0.2s ease-out"
          : "opacity 0.1s ease-out",
      }}
    >
      <div
        className="border-main-400 animate-spin rounded-full border-2 border-t-transparent"
        style={{
          width: `${spinnerSize}px`,
          height: `${spinnerSize}px`,
        }}
      />
    </div>
  );
};
