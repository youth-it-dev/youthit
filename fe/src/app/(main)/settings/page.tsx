"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import DeleteAccountModal from "@/components/my-page/DeleteAccountModal";
import LogoutModal from "@/components/my-page/LogoutModal";
import SettingsSection from "@/components/my-page/SettingsSection";
import { usersKeys } from "@/constants/generated/query-keys";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useDeleteAccount } from "@/hooks/auth/useDeleteAccount";
import { useLogout } from "@/hooks/auth/useLogout";
import {
  useGetUsersMe,
  usePostUsersMeMarketingTermsToggle,
  usePostUsersMePushNotificationToggle,
} from "@/hooks/generated/users-hooks";
import { getKakaoAccessToken } from "@/utils/auth/kakao-access-token";
import { debug } from "@/utils/shared/debugger";
import { useThrottle } from "@/utils/shared/useThrottle";

/**
 * @description 설정 페이지
 */
const SettingsPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [isMarketingConsentEnabled, setIsMarketingConsentEnabled] =
    useState(false);

  const { mutate: logoutMutate } = useLogout();
  const { mutate: deleteAccountMutate, isPending: isDeleting } =
    useDeleteAccount();
  const { mutate: pushNotificationToggleMutate } =
    usePostUsersMePushNotificationToggle();
  const { mutate: marketingTermsToggleMutate } =
    usePostUsersMeMarketingTermsToggle();

  // 사용자 정보 가져오기
  const { data: userData, isLoading: isUsersMeLoading } = useGetUsersMe({
    select: (data) => {
      return data?.user;
    },
  });

  const pushTermsAgreed = userData?.pushTermsAgreed;
  const marketingTermsAgreed = (
    userData as { marketingTermsAgreed?: boolean } | undefined
  )?.marketingTermsAgreed;

  useEffect(() => {
    if (typeof pushTermsAgreed === "boolean") {
      setIsNotificationEnabled(pushTermsAgreed);
    }
  }, [pushTermsAgreed]);

  useEffect(() => {
    if (typeof marketingTermsAgreed === "boolean") {
      setIsMarketingConsentEnabled(marketingTermsAgreed);
    }
  }, [marketingTermsAgreed]);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const cleanupAndRedirectToHome = () => {
    if (typeof window === "undefined") return;
    queryClient.clear();
    window.location.replace(LINK_URL.HOME);
  };

  /**
   * @description 로그아웃 모달 '확인' 클릭 시
   */
  const handleLogoutConfirm = () => {
    logoutMutate(undefined, {
      onSuccess: () => {
        cleanupAndRedirectToHome();
      },
      onError: (error) => {
        debug.error("로그아웃 오류 발생:", error);
        cleanupAndRedirectToHome();
      },
      onSettled: () => {
        setIsLogoutModalOpen(false);
      },
    });
  };

  const handleLogoutCancel = () => {
    setIsLogoutModalOpen(false);
  };

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

        // 4. 모달 닫기
        setIsDeleteAccountModalOpen(false);

        // 5. 홈 페이지로 리다이렉트 (히스토리 정리)
        router.replace(LINK_URL.HOME);
      },
      onError: (error) => {
        debug.error("회원 탈퇴 오류:", error);
        // 에러 발생 시 모달은 열어두어 재시도 가능하도록 함
      },
    });
  };

  const handlePersonalInfoClick = () => {
    router.push(LINK_URL.PERSONAL_INFO);
  };

  const handleHistoryClick = () => {
    // TODO: 나다움 내역 페이지로 이동
    debug.log("나다움 내역 클릭");
  };

  const handleNotificationToggle = useThrottle((checked: boolean) => {
    const previousValue = isNotificationEnabled;
    setIsNotificationEnabled(checked);

    pushNotificationToggleMutate(undefined, {
      onSuccess: (response) => {
        const nextPushTermsAgreed = response.data?.pushTermsAgreed;

        if (typeof nextPushTermsAgreed === "boolean") {
          setIsNotificationEnabled(nextPushTermsAgreed);
        }

        queryClient.invalidateQueries({ queryKey: usersKeys.getUsersMe });
      },
      onError: (error) => {
        debug.error("알림 설정 변경 오류:", error);
        setIsNotificationEnabled(previousValue);
      },
    });
  }, 2000);

  const handleMarketingConsentToggle = useThrottle((checked: boolean) => {
    const previousValue = isMarketingConsentEnabled;
    setIsMarketingConsentEnabled(checked);

    const kakaoAccessToken = getKakaoAccessToken();

    if (!kakaoAccessToken) {
      setIsMarketingConsentEnabled(previousValue);
      return;
    }

    marketingTermsToggleMutate(
      { data: { accessToken: kakaoAccessToken } },
      {
        onSuccess: (response) => {
          const nextMarketingTermsAgreed = response.data?.marketingTermsAgreed;

          if (typeof nextMarketingTermsAgreed === "boolean") {
            setIsMarketingConsentEnabled(nextMarketingTermsAgreed);
          }

          queryClient.invalidateQueries({ queryKey: usersKeys.getUsersMe });
        },
        onError: (error) => {
          debug.error("마케팅 정보 수신 동의 변경 오류:", error);
          setIsMarketingConsentEnabled(previousValue);
        },
      }
    );
  }, 2000);

  const settingsItems = [
    {
      text: "개인 정보 관리",
      iconUrl: IMAGE_URL.ICON.settings.userRound.url,
      onClick: handlePersonalInfoClick,
      showArrow: true,
    },
    {
      text: "나다움 내역",
      iconUrl: IMAGE_URL.ICON.settings.wallet.url,
      onClick: handleHistoryClick,
      showArrow: true,
    },
    {
      text: "활동 푸시 알림 (게시글/댓글/활동 신청)",
      iconUrl: IMAGE_URL.ICON.settings.bell.url,
      toggle: {
        checked: isNotificationEnabled,
        onCheckedChange: handleNotificationToggle,
        disabled: isUsersMeLoading,
      },
    },
    {
      text: "마케팅 푸시 알림 (이벤트/기타 정보)",
      iconUrl: IMAGE_URL.ICON.settings.megaphone.url,
      toggle: {
        checked: isMarketingConsentEnabled,
        onCheckedChange: handleMarketingConsentToggle,
        disabled: isUsersMeLoading,
      },
    },
    {
      text: "로그아웃",
      iconUrl: IMAGE_URL.ICON.settings.arrowRightFromLine.url,
      onClick: handleLogout,
      showArrow: true,
    },
    {
      text: "유스-잇 떠나기",
      iconUrl: IMAGE_URL.ICON.settings.doorOpen.url,
      onClick: handleDeleteAccount,
      showArrow: true,
    },
  ];

  return (
    <div className="flex min-h-full w-full flex-col pt-12">
      {/* 메인 컨텐츠 */}
      <main className="flex flex-1 flex-col gap-6">
        {/* 설정 메뉴 */}
        <SettingsSection title="" items={settingsItems} />
      </main>

      {/* 로그아웃 모달 */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
      />

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

export default SettingsPage;
