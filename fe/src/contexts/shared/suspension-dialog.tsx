"use client";

import { createContext, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Modal from "@/components/shared/ui/modal";
import { LINK_URL } from "@/constants/shared/_link-url";
import useToggle from "@/hooks/shared/useToggle";
import { signOut } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { removeKakaoAccessToken } from "@/utils/auth/kakao-access-token";
import { debug } from "@/utils/shared/debugger";

interface SuspensionDialogContextValue {
  /** 자격정지 다이얼로그 표시 */
  showSuspensionDialog: () => void;
}

const SuspensionDialogContext = createContext<
  SuspensionDialogContextValue | undefined
>(undefined);

/**
 * @description 자격정지 다이얼로그 Context Provider
 * 423 에러 발생 시 사용자에게 자격정지 상태를 알리고 로그아웃 처리
 */
export const SuspensionDialogProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { isOpen, open, close } = useToggle();
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 전역 함수로 등록할 showSuspensionDialog 함수
  // useRef를 사용하여 최신 open 함수를 항상 참조하도록 함
  const openRef = useRef(open);
  const isOpenRef = useRef(isOpen);

  // 최신 상태와 함수를 ref에 동기화
  useEffect(() => {
    openRef.current = open;
    isOpenRef.current = isOpen;
  }, [open, isOpen]);

  // 안정적인 showSuspensionDialog 함수 생성 (의존성 없음)
  const showSuspensionDialog = useCallback(() => {
    // 이미 다이얼로그가 열려있으면 중복 표시 방지
    if (isOpenRef.current) {
      return;
    }
    openRef.current();
  }, []);

  // Provider 마운트 시 전역 함수 등록
  useEffect(() => {
    setShowSuspensionDialog(showSuspensionDialog);
    // cleanup: Provider 언마운트 시 전역 함수 제거
    return () => {
      setShowSuspensionDialog(() => {});
    };
  }, [showSuspensionDialog]);

  /**
   * @description 로그아웃 처리 및 메인페이지로 리다이렉트
   * 자격정지 회원은 비회원처럼 사용 가능하도록 메인페이지로 이동
   */
  const handleLogout = useCallback(async () => {
    // 다이얼로그 닫기
    close();

    // 브라우저 환경에서만 실행
    if (typeof window === "undefined") {
      return;
    }

    // 로그아웃 시작 플래그 설정 (중복 다이얼로그 방지)
    setLoggingOut(true);

    try {
      // React Query 캐시 정리 (로그아웃 전에 정리하여 불필요한 요청 방지)
      const queryClient = getQueryClient();
      queryClient.clear();

      // Zustand store 초기화
      resetTopBar();

      // 카카오 액세스 토큰 제거
      removeKakaoAccessToken();

      // 로그아웃 처리
      await signOut();
    } catch (error) {
      debug.error("자격정지 로그아웃 처리 중 오류:", error);
      // 에러가 발생해도 React Query 캐시는 정리
      const queryClient = getQueryClient();
      queryClient.clear();
    } finally {
      // 성공/실패 여부와 관계없이 메인페이지로 리다이렉트
      // 자격정지 회원은 비회원처럼 사용 가능하도록
      window.location.replace(LINK_URL.HOME);
    }
  }, [close, resetTopBar]);

  const value: SuspensionDialogContextValue = {
    showSuspensionDialog,
  };

  return (
    <SuspensionDialogContext.Provider value={value}>
      {children}
      <Modal
        isOpen={isOpen}
        title="자격정지"
        description="관리자에 의해 계정이 자격정지되었습니다. 자세한 사항은 관리자에게 문의해주세요."
        confirmText="확인"
        onConfirm={handleLogout}
        onClose={() => {
          // 취소 버튼이 없으므로 onClose는 호출되지 않지만, 타입을 위해 제공
          // 실제로는 모달을 닫을 수 없도록 설정됨
        }}
        variant="danger"
        closeOnOverlayClick={false}
        closeOnEscape={false}
      />
    </SuspensionDialogContext.Provider>
  );
};

/**
 * @description 자격정지 다이얼로그 표시 함수 (axios 인터셉터에서 사용)
 * window 객체에 함수를 등록하여 어디서든 호출 가능하도록 함
 */
let showSuspensionDialogRef: (() => void) | null = null;

/**
 * @description 로그아웃 진행 중 플래그 (중복 다이얼로그 방지)
 */
let isLoggingOut = false;

/**
 * @description 자격정지 다이얼로그 표시 함수 등록
 * SuspensionDialogProvider에서 호출하여 함수를 등록
 */
export const setShowSuspensionDialog = (fn: () => void) => {
  showSuspensionDialogRef = fn;
};

/**
 * @description 로그아웃 시작 플래그 설정
 */
export const setLoggingOut = (value: boolean) => {
  isLoggingOut = value;
};

/**
 * @description 자격정지 다이얼로그 표시 함수 호출
 * axios 인터셉터에서 사용
 */
export const triggerSuspensionDialog = () => {
  // 로그아웃 진행 중이면 다이얼로그를 표시하지 않음
  if (isLoggingOut) {
    return;
  }

  if (showSuspensionDialogRef) {
    showSuspensionDialogRef();
  } else {
    debug.warn("SuspensionDialogProvider가 아직 초기화되지 않았습니다.");
  }
};
