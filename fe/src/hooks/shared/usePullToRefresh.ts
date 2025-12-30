import { useEffect, useRef, useState, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<unknown> | void;
  enabled?: boolean; // pull-to-refresh 활성화 여부
}

interface UsePullToRefreshReturn {
  pullDistance: number; // 현재 당김 거리
  isRefreshing: boolean; // 새로고침 중인지 여부
  isPulling: boolean; // 당기고 있는지 여부
}

/**
 * @description Pull-to-refresh 기능을 제공하는 커스텀 훅
 * React Native의 RefreshControl과 유사한 동작을 구현
 */
export const usePullToRefresh = ({
  onRefresh,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef<number | null>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  // ref 동기화 (이벤트 핸들러에서 최신 값 참조용)
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
    pullDistanceRef.current = pullDistance;
  }, [isRefreshing, pullDistance]);

  // isPulling 또는 isRefreshing 중일 때 페이지 스크롤 방지
  useEffect(() => {
    if (isPulling || isRefreshing) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  }, [isPulling, isRefreshing]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    // await 전에 현재 pullDistance를 최대값으로 고정
    const maxPullDistance = pullDistanceRef.current;
    setPullDistance(maxPullDistance);

    try {
      await onRefresh();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      // 페칭 완료 후 스크롤 위치 복원
      setPullDistance(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // main 요소 찾기 (캐싱)
      if (!scrollElementRef.current) {
        scrollElementRef.current = document.querySelector("main");
      }
      const mainElement = scrollElementRef.current;
      if (!mainElement) return;

      const scrollTop = mainElement.scrollTop;

      // 스크롤이 맨 위에 있고, 새로고침 중이 아닐 때만 동작
      if (scrollTop <= 0 && !isRefreshingRef.current) {
        startYRef.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || !scrollElementRef.current) return;
      if (isRefreshingRef.current) return;

      const mainElement = scrollElementRef.current;
      const scrollTop = mainElement.scrollTop;

      // 스크롤이 맨 위에 있고 아래로 당기는 경우만 처리
      if (scrollTop <= 0) {
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startYRef.current;

        // 아래로 당기는 경우만 (양수)
        if (deltaY > 0) {
          // 기본 스크롤 동작 방지
          e.preventDefault();

          // 당김 거리 계산 (저항감 적용)
          const distance = deltaY * 0.5; // 저항 계수
          setPullDistance(distance);
        } else {
          setPullDistance(0);
          setIsPulling(false);
        }
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    const handleTouchEnd = () => {
      if (startYRef.current === null) return;

      // 당기기만 하면 바로 새로고침 실행 (임계값 없음)
      // pullDistance는 이벤트 핸들러가 생성될 때의 최신 값을 참조
      if (pullDistance > 10 && !isRefreshingRef.current) {
        // 최소 10px 이상 당겼을 때만 새로고침 (실수 방지)
        handleRefresh();
      } else {
        // 당기지 않았으면 원래 위치로 복귀
        setPullDistance(0);
      }

      setIsPulling(false);
      startYRef.current = null;
    };

    // passive: false로 설정하여 preventDefault 사용 가능
    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleRefresh, pullDistance]);

  return {
    pullDistance,
    isRefreshing,
    isPulling,
  };
};
