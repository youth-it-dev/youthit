"use client";

import { useMemo, type ReactNode } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
import { TOPBAR_TITLE_MAP } from "@/constants/shared/_topbar-title-map";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import AlarmButton from "../AlarmButton";
import { Typography } from "../typography";

/**
 * @description 상단 고정바
 */
type TopBarProps = {
  title?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

const TopBar = ({ title, leftSlot, rightSlot }: TopBarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const isScrolled = useTopBarStore((state) => state.isScrolled);
  const storeTitle = useTopBarStore((state) => state.title);
  const storeLeftSlot = useTopBarStore((state) => state.leftSlot);
  const storeRightSlot = useTopBarStore((state) => state.rightSlot);

  const currentTitle =
    title ||
    storeTitle ||
    TOPBAR_TITLE_MAP.find((item) => pathname?.startsWith(item.prefix))?.label ||
    "\n";

  const handleClick = () => {
    // 로그인 페이지에서 뒤로가기 시 홈으로 이동
    if (pathname === LINK_URL.LOGIN) {
      router.replace(LINK_URL.HOME);
      return;
    }
    // 커뮤니티 상세 페이지에서 작성 페이지로 돌아가지 않도록 커뮤니티 목록으로 리다이렉트
    if (pathname?.startsWith(`${LINK_URL.COMMUNITY_POST}/`)) {
      router.replace(LINK_URL.COMMUNITY);
      return;
    }
    // 스토어 상품 상세 페이지에서 뒤로가기 시 주문 페이지로 돌아가지 않도록 스토어 메인으로 이동
    // "history" 경로는 제외하여 구매 내역 페이지에서는 정상적인 뒤로가기 동작 유지
    if (pathname?.match(/^\/store\/(?!history)[^/]+$/)) {
      router.replace(LINK_URL.STORE);
      return;
    }
    router.back();
  };

  // 홈 페이지 체크
  const isHomePage = pathname === LINK_URL.HOME;

  const isCommunityPage = pathname === LINK_URL.COMMUNITY;
  const isMyPage = pathname === LINK_URL.MY_PAGE;
  const showBackButton = !isCommunityPage && !isMyPage && !isHomePage;
  const showAlarmButton = isHomePage;

  const alarmButtonEl = useMemo(() => {
    return <AlarmButton />;
  }, []);

  const rightSlotEl = useMemo(() => {
    if (showAlarmButton) return alarmButtonEl;
    return storeRightSlot || rightSlot;
  }, [showAlarmButton, alarmButtonEl, rightSlot, storeRightSlot]);

  return (
    <div
      className={
        "fixed top-0 z-50 mx-auto flex h-12 w-full max-w-[470px] items-center border-b px-5 py-3 transition-all duration-500 ease-out " +
        (isHomePage && !isScrolled
          ? "border-b-transparent bg-transparent"
          : "border-b-gray-200 bg-white shadow-sm")
      }
    >
      {/* Left Slot (홈 페이지 로고 등): leftSlot 지정사항이 없을 때 기본 Back Button 표시 */}
      <div className="absolute top-1/2 left-5 flex -translate-y-1/2 items-center">
        {leftSlot || storeLeftSlot || !showBackButton ? (
          <div>{leftSlot || storeLeftSlot}</div>
        ) : (
          <button onClick={handleClick} className="hover:cursor-pointer">
            <Image
              src={IMAGE_URL.ICON.chevron.left.url}
              alt={IMAGE_URL.ICON.chevron.left.alt}
              width={24}
              height={24}
            />
          </button>
        )}
      </div>

      {/* Center Slot - 가장 큰 비율 선점 */}
      <div className="flex flex-1 justify-center px-2">
        <Typography
          font="noto"
          variant="body1M"
          className="overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {currentTitle}
        </Typography>
      </div>

      {/* Right Slot */}
      <div className="absolute top-1/2 right-5 flex -translate-y-1/2 items-center">
        {rightSlotEl}
      </div>
    </div>
  );
};

export default TopBar;
