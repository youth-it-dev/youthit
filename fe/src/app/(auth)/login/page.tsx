"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import { onAuthStateChanged } from "firebase/auth";
import ButtonBase from "@/components/shared/base/button-base";
import { Typography } from "@/components/shared/typography";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { signInWithKakao, handleKakaoRedirectResult } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { triggerSuspensionDialog } from "@/contexts/shared/suspension-dialog";
import { setKakaoAccessToken } from "@/utils/auth/kakao-access-token";
import { debug } from "@/utils/shared/debugger";

/**
 * @description 로그인 페이지 콘텐츠 (useSearchParams 사용)
 */
const LoginPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터와 해시 확인하여 redirect 후 돌아왔는지 즉시 감지
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") return false;

    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const hasAuthParams =
      urlParams.has("code") ||
      urlParams.has("error") ||
      urlParams.has("state") ||
      hashParams.has("code") ||
      hashParams.has("error") ||
      hashParams.has("state");

    // redirect 후 돌아온 경우 로딩 상태로 시작
    return hasAuthParams;
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 로그인 후 돌아갈 경로 (next 쿼리 파라미터)
  const rawNext = searchParams.get("next") || null;
  // /community/write로 가는 것은 막고 /community로 변경
  // (글쓰기는 바텀시트에서 카테고리를 선택하고 가야 함)
  const returnTo = rawNext?.startsWith(LINK_URL.COMMUNITY_WRITE)
    ? LINK_URL.COMMUNITY
    : rawNext;

  const { refetch: refetchUserDataRaw } = useGetUsersMe({
    request: {},
    enabled: false, // 자동 실행 비활성화
    select: (data) => {
      return data?.user;
    },
  });

  /**
   * @description 사용자 정보 조회 (423 에러 자동 처리)
   * refetchUserData를 래핑하여 423 에러 발생 시 자동으로 모달을 띄웁니다.
   */
  const refetchUserData = async () => {
    try {
      return await refetchUserDataRaw();
    } catch (error) {
      // 423 에러(자격정지) 처리
      if (error instanceof AxiosError && error.response?.status === 423) {
        setIsLoading(false);
        // SuspensionDialogProvider의 모달 표시
        triggerSuspensionDialog();
        throw error; // 에러를 다시 throw하여 호출부에서 처리할 수 있도록
      }
      throw error; // 다른 에러는 그대로 전파
    }
  };

  /**
   * @description 카카오 redirect 결과 처리 (페이지 로드 시 즉시 호출)
   *
   * Firebase 공식 문서에 따르면, getRedirectResult는 페이지가 로드되자마자 즉시 호출해야 합니다.
   * onAuthStateChanged를 기다리면 안 되며, redirect 후 결과가 소비될 수 있습니다.
   *
   * 참고: https://firebase.google.com/docs/auth/web/redirect-best-practices
   */
  useEffect(() => {
    let isProcessing = false;

    const processRedirectResult = async () => {
      // 이미 처리 중이면 무시
      if (isProcessing) return;
      isProcessing = true;

      // redirect 후 돌아왔는지 확인 (URL 파라미터 체크)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hasAuthParams =
        urlParams.has("code") ||
        urlParams.has("error") ||
        urlParams.has("state") ||
        hashParams.has("code") ||
        hashParams.has("error") ||
        hashParams.has("state");

      // redirect로 돌아온 경우, auth 파라미터만 제거하여 깔끔한 URL 유지
      if (hasAuthParams && typeof window !== "undefined") {
        const originalNext = urlParams.get("next") || searchParams.get("next");
        const cleanSearchParams = new URLSearchParams();
        if (originalNext) {
          cleanSearchParams.set("next", originalNext);
        }
        const cleanQuery = cleanSearchParams.toString();
        const cleanUrl = `${window.location.origin}${LINK_URL.LOGIN}${cleanQuery ? `?${cleanQuery}` : ""}`;

        // 현재 히스토리 엔트리를 교체하여 auth 파라미터 제거
        window.history.replaceState(
          { ...window.history.state, as: cleanUrl, url: cleanUrl },
          "",
          cleanUrl
        );
      }

      try {
        // 페이지 로드 시 즉시 getRedirectResult 호출 (Firebase 권장 방식)
        // authDomain을 앱 도메인으로 설정하고 reverse proxy를 통해 cross-origin redirect 방지
        const redirectResult = await handleKakaoRedirectResult();

        if (redirectResult) {
          const { kakaoAccessToken, isNewUser } = redirectResult;

          setIsLoading(true);
          debug.log("로그인 결과 처리 시작", { isNewUser });

          // 신규 회원 처리
          if (isNewUser) {
            if (!kakaoAccessToken) {
              debug.error("신규 회원인데 카카오 액세스 토큰이 없습니다.");
              setIsLoading(false);
              setErrorMessage(
                "카카오 로그인 권한이 필요합니다. 다시 시도해 주세요."
              );
              return;
            }

            setKakaoAccessToken(kakaoAccessToken);

            // 인증 쿠키 설정 (미들웨어에서 빠른 체크를 위해)
            const { setAuthCookie } = await import("@/utils/auth/auth-cookie");
            setAuthCookie();

            setIsLoading(false);

            debug.log("신규 회원 처리 완료, 온보딩 페이지로 이동");
            router.replace(LINK_URL.MY_PAGE_EDIT);
            return;
          }

          // 기존 사용자 처리
          try {
            const { data: userData } = await refetchUserData();
            const hasNickname = !!userData?.nickname;

            // 인증 쿠키 설정 (미들웨어에서 빠른 체크를 위해)
            const { setAuthCookie } = await import("@/utils/auth/auth-cookie");
            setAuthCookie();

            setIsLoading(false);

            debug.log("기존 사용자 처리 완료", { hasNickname });
            handlePostLoginRouting(hasNickname);
          } catch (error) {
            // 423 에러(자격정지) 처리
            if (error instanceof AxiosError && error.response?.status === 423) {
              // 이미 모달이 띄워졌으므로 종료
              // Firebase Auth 로그아웃은 모달 확인 시 처리됨
              return;
            }
            throw error;
          }
        } else {
          debug.log("redirectResult가 null - 일반 로그인 화면");
        }
      } catch (error) {
        // handleKakaoRedirectResult는 user/me를 호출하지 않으므로 423 에러가 발생할 수 없음
        // 여기서는 카카오 로그인 자체의 에러만 처리
        debug.error("카카오 redirect 결과 처리 실패:", error);
        setIsLoading(false);
        setErrorMessage("카카오 로그인 처리에 실패했습니다.");
      } finally {
        isProcessing = false;
      }
    };

    // 페이지 로드 시 즉시 redirect 결과 확인
    processRedirectResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @description 일반 인증 상태 관찰 (redirect 결과가 없을 때 사용)
   *
   * 이미 로그인된 사용자가 로그인 페이지에 접근한 경우를 처리합니다.
   * redirect 결과 처리는 위의 useEffect에서 먼저 처리되므로,
   * 여기서는 일반적인 인증 상태만 확인합니다.
   */
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    unsubscribe = onAuthStateChanged(auth, (user) => {
      // redirect 결과 처리는 위의 useEffect에서 처리하므로,
      // 여기서는 redirect 파라미터가 없고 이미 로그인된 경우만 처리
      if (!user) return;

      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const hasAuthParams =
        urlParams.has("code") ||
        urlParams.has("error") ||
        urlParams.has("state") ||
        hashParams.has("code") ||
        hashParams.has("error") ||
        hashParams.has("state");

      // redirect 파라미터가 없고 이미 로그인된 사용자인 경우
      if (!hasAuthParams) {
        debug.log("이미 로그인된 사용자:", user.uid);

        // 인증 쿠키 설정 (미들웨어에서 빠른 체크를 위해)
        void import("@/utils/auth/auth-cookie").then(({ setAuthCookie }) => {
          setAuthCookie();
        });

        // 로딩 상태는 설정하지 않음 (이미 로그인된 상태이므로)
        refetchUserData()
          .then(({ data: userData }) => {
            const hasNickname = !!userData?.nickname;
            handlePostLoginRouting(hasNickname);
          })
          .catch((error) => {
            // 423 에러(자격정지) 처리
            if (error instanceof AxiosError && error.response?.status === 423) {
              // 이미 모달이 띄워졌으므로 종료
              // Firebase Auth 로그아웃은 모달 확인 시 처리됨
              return;
            }
            debug.error("사용자 정보 조회 실패:", error);
          });
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @description 로그인 성공 후 라우팅 처리
   * @param hasNickname - 닉네임 존재 여부
   */
  const handlePostLoginRouting = (hasNickname: boolean) => {
    if (hasNickname) {
      // 닉네임이 있으면 next 파라미터가 있으면 해당 경로로, 없으면 홈으로
      router.replace(returnTo || LINK_URL.HOME);
    } else {
      // 온보딩이 필요한 경우 next 파라미터 무시하고 온보딩 페이지로
      router.replace(LINK_URL.MY_PAGE_EDIT);
    }
  };

  /**
   * @description 카카오 로그인
   * 흐름:
   * 1. 카카오 회원가입/로그인 진행
   * 2. 신규 회원인 경우:
   *    2-1. 카카오 액세스 토큰을 sessionStorage에 저장
   *    2-2. FCM 토큰 등록 (실패해도 계속 진행)
   *    2-3. 온보딩 페이지로 이동 (온보딩 페이지에서 syncKakaoProfile 호출)
   * 3. 기존 사용자인 경우:
   *    3-1. 사용자 정보 조회
   *    3-2. FCM 토큰 등록 (실패해도 계속 진행)
   *    3-3. 닉네임 여부에 따라 온보딩 페이지 또는 홈으로 이동
   *
   * iOS PWA 쿼리스트링 유실 문제 해결:
   * - authDomain을 앱 도메인으로 설정 (firebase.ts)
   * - /__/auth/* 경로를 reverse proxy로 firebaseapp.com으로 전달 (next.config.ts)
   * - cross-origin redirect가 발생하지 않아 쿼리스트링 유실 방지
   *
   * 로그인 방식:
   * - signInWithPopup() 먼저 시도
   * - 실패 시 signInWithRedirect()로 자동 폴백
   * - redirect 후 getRedirectResult()가 자동으로 처리
   */
  const handleKakaoLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. 카카오 로그인
      const { kakaoAccessToken, isNewUser } = await signInWithKakao();

      // 1-1. 카카오 액세스 토큰이 있으면 세션에 저장 (신규/기존 회원 공통)
      if (kakaoAccessToken) {
        setKakaoAccessToken(kakaoAccessToken);
      }

      // 2. 신규 회원 처리
      if (isNewUser) {
        // 2-0. 신규 회원인데 토큰이 없는 경우 (권한 미동의, 프로바이더 오류 등)
        if (!kakaoAccessToken) {
          debug.error("신규 회원인데 카카오 액세스 토큰이 없습니다.");
          setIsLoading(false);
          setErrorMessage(
            "카카오 로그인 권한이 필요합니다. 다시 시도해 주세요."
          );
          return;
        }

        // 2-2. 신규 회원은 항상 온보딩 페이지로 (next 파라미터 무시)
        setIsLoading(false);
        router.replace(LINK_URL.MY_PAGE_EDIT);
      }

      // 3. 기존 사용자 처리
      if (!isNewUser) {
        try {
          // 3-1. 사용자 정보 조회
          const { data: userData } = await refetchUserData();
          const hasNickname = !!userData?.nickname;

          // 3-3. 닉네임 여부에 따라 라우팅
          setIsLoading(false);
          handlePostLoginRouting(hasNickname);
        } catch (error) {
          // 423 에러(자격정지) 처리
          if (error instanceof AxiosError && error.response?.status === 423) {
            // 이미 모달이 띄워졌으므로 종료
            // Firebase Auth 로그아웃은 모달 확인 시 처리됨
            return;
          }
          debug.error("사용자 정보 조회 실패:", error);
          setIsLoading(false);
          setErrorMessage("사용자 정보 조회에 실패했습니다.");
        }
      }
    } catch (error) {
      debug.error("카카오 로그인 실패:", error);
      setIsLoading(false);
      setErrorMessage("카카오 로그인에 실패했어요. 다시 시도해 주세요.");
    }
  };

  return (
    <main className="relative mt-12 flex h-screen flex-col items-center justify-center">
      <div className="relative z-0 h-full max-h-[572px] w-full max-w-[470px]">
        <Image
          src={IMAGE_URL.IMG.login.mainImage.url}
          alt={IMAGE_URL.IMG.login.mainImage.alt}
          width={470}
          height={572}
          priority
        />
      </div>
      <div className="z-10 mt-auto flex w-full flex-col gap-19 px-4 pb-8">
        <div className="flex w-full flex-col gap-3">
          <ButtonBase
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="bg-kakao flex h-11 w-full items-center justify-center gap-2 rounded-lg py-3 disabled:opacity-60"
          >
            <Image
              src={IMAGE_URL.ICON.logo.kakao.url}
              alt={IMAGE_URL.ICON.logo.kakao.alt}
              width={18}
              height={18}
            />
            <Typography font="noto" variant="body2B">
              {isLoading ? "카카오로 접속 중..." : "카카오로 시작하기"}
            </Typography>
          </ButtonBase>
        </div>
        {errorMessage && (
          <div className="mt-3 text-center">
            <Typography font="noto" variant="label1M" className="text-red-500">
              {errorMessage}
            </Typography>
          </div>
        )}
        <div className="flex items-center justify-center gap-4">
          <Link
            href={LINK_URL.TERMS_OF_SERVICE}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Typography font="noto" variant="label1M" className="text-gray-400">
              이용약관
            </Typography>
          </Link>
          <Link
            href={LINK_URL.PRIVACY_POLICY}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Typography font="noto" variant="label1M" className="text-gray-400">
              개인정보 처리방침
            </Typography>
          </Link>
        </div>
      </div>
    </main>
  );
};

/**
 * @description 로그인 페이지 (Suspense로 감싸기)
 */
const LoginPage = () => {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;
