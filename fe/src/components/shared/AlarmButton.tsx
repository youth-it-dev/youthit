"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
import { getCurrentUser } from "@/lib/auth";

/**
 * @description 알람 아이콘 버튼 컴포넌트
 * 로그인된 사용자는 알림 페이지로, 로그인하지 않은 사용자는 로그인 페이지로 이동합니다.
 */
const AlarmButton = () => {
  const router = useRouter();

  const handleNotificationClick = () => {
    const user = getCurrentUser();

    // 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
    if (!user) {
      const redirectUrl = `${LINK_URL.LOGIN}?next=${encodeURIComponent(LINK_URL.NOTIFICATIONS)}`;
      router.push(redirectUrl);
      return;
    }

    // 로그인된 사용자는 알림 페이지로 이동
    router.push(LINK_URL.NOTIFICATIONS);
  };

  return (
    <button
      onClick={handleNotificationClick}
      className="relative size-6 hover:cursor-pointer"
      aria-label="알림"
    >
      <Image
        src={IMAGE_URL.ICON.alarm.url}
        alt="알림"
        fill
        priority
        loading="eager"
      />
    </button>
  );
};

export default AlarmButton;
