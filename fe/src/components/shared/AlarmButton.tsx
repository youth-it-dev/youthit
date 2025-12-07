"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
/**
 * @description 알람 아이콘 버튼 컴포넌트
 * 추후 알람 히스토리 페이지로 이동하도록 구현되어 있습니다.
 */
const AlarmButton = () => {
  const router = useRouter();

  const handleNotificationClick = () => {
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
