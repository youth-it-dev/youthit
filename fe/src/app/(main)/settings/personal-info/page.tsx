"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import DeleteAccountModal from "@/components/my-page/DeleteAccountModal";
import { Typography } from "@/components/shared/typography";
import {
  GENDER_MAPPING,
  type GenderKey,
} from "@/constants/my-page/_gender-mapping";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useDeleteAccount } from "@/hooks/auth/useDeleteAccount";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { getCurrentUser } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { debug } from "@/utils/shared/debugger";
import { InfoItem } from "../components/InfoItem";

/**
 * @description 계정 관리 페이지
 * 읽기 전용으로 사용자 정보를 표시
 */
const PersonalInfoPage = () => {
  const user = getCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setTitle = useTopBarStore((state) => state.setTitle);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);

  useEffect(() => {
    setTitle("계정 관리");
  }, [setTitle]);

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

  const { mutate: deleteAccountMutate, isPending: isDeleting } =
    useDeleteAccount();
  const handleDeleteAccount = () => {
    setIsDeleteAccountModalOpen(true);
  };

  /**
   * @description 회원 탈퇴 확인 버튼 클릭 시
   */
  const handleDeleteAccountConfirm = () => {
    deleteAccountMutate(undefined, {
      onSuccess: () => {
        debug.log("회원 탈퇴 성공");

        try {
          // 1. React Query 캐시 모두 제거
          queryClient.clear();

          // 2. LocalStorage 정리 (Firebase 관련)
          const allKeys = Object.keys(localStorage);
          allKeys.forEach((key) => {
            if (
              key.startsWith("firebase:authUser:") ||
              key.startsWith("firebase:refreshToken:") ||
              key.startsWith("firebase:host:") ||
              key.startsWith("firebase:heartbeat:")
            ) {
              localStorage.removeItem(key);
            }
          });

          // 3. 쿠키 정리
          const clearCookie = (name: string) => {
            const paths = ["/", window.location.pathname];
            const domains = [
              window.location.hostname,
              "." + window.location.hostname,
            ];

            paths.forEach((path) => {
              domains.forEach((domain) => {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain};`;
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
              });
            });
          };

          document.cookie.split(";").forEach((c) => {
            const name = c.split("=")[0].trim();
            clearCookie(name);
          });
        } catch (cleanupError) {
          // cleanup 실패 시에도 로그만 남기고 계속 진행
          debug.error("회원 탈퇴 후 cleanup 중 오류 발생:", cleanupError);
        } finally {
          // cleanup 성공/실패 여부와 관계없이 항상 실행
          // 4. 모달 닫기
          setIsDeleteAccountModalOpen(false);

          // 5. 홈 페이지로 리다이렉트 (히스토리 정리)
          router.replace(LINK_URL.HOME);
        }
      },
      onError: (error) => {
        debug.error("회원 탈퇴 오류:", error);
        // 에러 발생 시 모달은 열어두어 재시도 가능하도록 함
      },
    });
  };

  return (
    <div className="flex min-h-full w-full flex-col pt-12">
      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <InfoItem label="이름" value={displayName} />
        <InfoItem label="생년월일" value={birthDate || "-"} />
        <InfoItem
          label="성별"
          value={gender ? (GENDER_MAPPING[gender as GenderKey] ?? gender) : "-"}
        />
        <InfoItem label="휴대폰 번호" value={phoneNumber || "-"} />
        <InfoItem label="이메일 주소" value={email || "-"} />

        <div className="px-1">
          <Typography font="noto" variant="label1M" className="text-gray-400">
            계정 정보는 카카오와 연동되어 있어 수정할 수 없어요.
          </Typography>
        </div>

        <button
          onClick={handleDeleteAccount}
          className="px-1 text-left"
          type="button"
        >
          <Typography
            font="noto"
            variant="label2M"
            className="text-gray-400 underline"
          >
            유스-잇 떠나기
          </Typography>
        </button>
      </main>

      {/* 회원 탈퇴 모달 */}
      <DeleteAccountModal
        isOpen={isDeleteAccountModalOpen}
        isLoading={isDeleting}
        nickname={userData?.nickname}
        onConfirm={handleDeleteAccountConfirm}
        onClose={() => {
          if (isDeleting) return;
          setIsDeleteAccountModalOpen(false);
        }}
      />
    </div>
  );
};

export default PersonalInfoPage;
