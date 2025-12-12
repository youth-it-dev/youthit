"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Theme Provider
 *
 * Next.js 15 App Router에서 hydration 에러를 방지하기 위해
 * ThemeProvider를 별도의 클라이언트 컴포넌트로 분리
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  return (
    <NextThemesProvider
      attribute="class"
      forcedTheme="light"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
};
