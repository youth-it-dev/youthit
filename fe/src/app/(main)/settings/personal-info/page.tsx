"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/shared/input";
import { Typography } from "@/components/shared/typography";
import {
  GENDER_MAPPING,
  type GenderKey,
} from "@/constants/my-page/_gender-mapping";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { getCurrentUser } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";

/**
 * @description 개인 정보 관리 페이지
 * 읽기 전용으로 사용자 정보를 표시
 */
const PersonalInfoPage = () => {
  const router = useRouter();
  const user = getCurrentUser();
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => {
      return data?.user;
    },
  });

  // Firebase User에서 가져올 수 있는 정보
  const displayName = user?.displayName || userData?.nickname || "";
  const email = user?.email || "";
  const phoneNumber = userData?.phoneNumber || "";
  const birthDate = userData?.birthDate || "";
  const gender = userData?.gender || "";

  // 투명한 히든 버튼 생성
  const hiddenButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => router.push("/settings/timestamp-test")}
        className="h-8 w-8 opacity-0"
        aria-label="타임스탬프 에디터 열기"
      />
    ),
    [router]
  );

  // TopBar rightSlot 설정
  useEffect(() => {
    setRightSlot(hiddenButton);
    return () => {
      resetTopBar();
    };
  }, [hiddenButton, setRightSlot, resetTopBar]);

  return (
    <div className="flex min-h-full w-full flex-col pt-12">
      <main className="flex flex-1 flex-col gap-2 px-4">
        <div className="overflow-hidden rounded-2xl bg-white">
          {/* 이름 */}
          <div className="flex flex-col gap-3 p-4">
            <Typography font="noto" variant="body2M" className="text-gray-950">
              이름
            </Typography>
            <Input
              value={displayName}
              readOnly
              className="bg-gray-50 text-gray-900"
            />
          </div>

          {/* 생년월일 */}
          <div className="flex flex-col gap-3 p-4">
            <Typography font="noto" variant="body2M" className="text-gray-950">
              생년월일
            </Typography>
            <Input
              value={birthDate || "-"}
              readOnly
              className="bg-gray-50 text-gray-900"
              placeholder="생년월일 정보가 없습니다"
            />
          </div>

          {/* 성별 */}
          <div className="flex flex-col gap-3 p-4">
            <Typography font="noto" variant="body2M" className="text-gray-950">
              성별
            </Typography>
            <Input
              value={
                gender ? (GENDER_MAPPING[gender as GenderKey] ?? gender) : "-"
              }
              readOnly
              className="bg-gray-50 text-gray-900"
              placeholder="성별 정보가 없습니다"
            />
          </div>

          {/* 휴대폰 번호 */}
          <div className="flex flex-col gap-3 p-4">
            <div className="mb-2">
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-950"
              >
                휴대폰 번호
              </Typography>
            </div>
            <Input
              value={phoneNumber || "-"}
              readOnly
              className="bg-gray-50 text-gray-900"
              placeholder="휴대폰 번호 정보가 없습니다"
            />
          </div>

          {/* 이메일 주소 */}
          <div className="p-4">
            <div className="mb-2">
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-950"
              >
                이메일 주소
              </Typography>
            </div>
            <Input
              value={email || "-"}
              readOnly
              className="bg-gray-50 text-gray-900"
              placeholder="이메일 주소 정보가 없습니다"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default PersonalInfoPage;
