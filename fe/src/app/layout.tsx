import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Noto_Sans_KR } from "next/font/google";
import AppNotificationsInitializer from "@/components/shared/layouts/app-notifications-initializer";
import LandscapeBlocker from "@/components/shared/layouts/landscape-blocker";
import PwaInstallPrompt from "@/components/shared/layouts/pwa-install-prompt";
import { Toaster } from "@/components/shared/ui/sonner";
import { SuspensionDialogProvider } from "@/contexts/shared/suspension-dialog";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { cn } from "@/utils/shared/cn";
import { SPLASH_IMAGES } from "./splash-images";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  variable: "--font-noto-sans-kr",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "유스-잇",
  description: "유스-잇 앱입니다.",
  manifest: "/manifest.webmanifest",
  icons: [
    { rel: "icon", url: "/icons/favicon/16x16.png", sizes: "16x16" },
    { rel: "icon", url: "/icons/favicon/32x32.png", sizes: "32x32" },
    { rel: "icon", url: "/icons/favicon/48x48.png", sizes: "48x48" },
    { rel: "icon", url: "/icons/favicon/180x180.png", sizes: "192x192" },
    { rel: "icon", url: "/icons/favicon/180x180.png", sizes: "512x512" },
    {
      rel: "apple-touch-icon",
      url: "/icons/favicon/180x180.png",
      sizes: "180x180",
    },
  ],

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "유스잇",
    startupImage: SPLASH_IMAGES,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko" className={cn(notoSansKr.variable, "light")}>
      <body
        className={cn(
          notoSansKr.className,
          "mx-auto flex h-screen w-full max-w-[472px] flex-col min-[470px]:border-x min-[470px]:border-gray-200"
        )}
      >
        <ThemeProvider>
          <QueryProvider>
            <SuspensionDialogProvider>
              <Toaster />
              <AppNotificationsInitializer />
              <LandscapeBlocker />
              <div className="flex h-screen w-full flex-col bg-white">
                {children}
              </div>
              <PwaInstallPrompt />
            </SuspensionDialogProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
