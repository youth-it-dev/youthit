import { useCallback, useRef } from "react";

/**
 * @description 주어진 콜백 호출을 지정한 주기(throttleMs)마다 한 번만 실행하도록 제한하는 훅
 */
export const useThrottle = <T extends (...args: never[]) => void>(
  callback: T,
  throttleMs: number
) => {
  const lastCalledAtRef = useRef<number | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (
        lastCalledAtRef.current !== null &&
        now - lastCalledAtRef.current < throttleMs
      ) {
        return;
      }

      lastCalledAtRef.current = now;
      callback(...args);
    },
    [callback, throttleMs]
  );
};
