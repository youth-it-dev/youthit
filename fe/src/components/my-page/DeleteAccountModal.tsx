"use client";

import { useEffect, useRef, useState } from "react";
import { Typography } from "@/components/shared/typography";

interface DeleteAccountModalProps {
  /** 모달 열림/닫힘 상태 */
  isOpen: boolean;
  /** 로딩 상태 (탈퇴 진행 중) */
  isLoading: boolean;
  /** 사용자 닉네임 (입력 비교용) */
  nickname: string | null | undefined;
  /** 확인 버튼 클릭 핸들러 */
  onConfirm: () => void;
  /** 닫기 핸들러 (취소/오버레이/ESC) */
  onClose: () => void;
}

/**
 * @description 회원 탈퇴 확인 모달 컴포넌트
 * - 붉은색 강조 스타일 적용
 * - 로딩 중에는 모달을 닫을 수 없음 (외부 클릭/ESC 방지)
 * - 취소 버튼 없음
 */
const DeleteAccountModal = ({
  isOpen,
  isLoading,
  nickname,
  onConfirm,
  onClose,
}: DeleteAccountModalProps) => {
  const previousOverflow = useRef<string>("");
  const [userName, setUserName] = useState("");
  const [nameError, setNameError] = useState("");

  // 모달이 닫힐 때 입력값 초기화
  useEffect(() => {
    if (!isOpen) {
      setUserName("");
      setNameError("");
    }
  }, [isOpen]);

  // Body 스크롤 방지 (모달 열릴 때)
  useEffect(() => {
    if (isOpen) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow.current;
      };
    }

    return () => {
      document.body.style.overflow = previousOverflow.current;
    };
  }, [isOpen]);

  // ESC 로 닫기 (로딩 중에는 동작하지 않음)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={() => {
        if (isLoading) return; // 로딩 중에는 닫기 금지
        onClose();
      }}
    >
      {/* 오버레이: #000 60% 투명도 */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* 모달 컨텐츠 */}
      <div
        className="relative mx-8 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 제목 */}
        <Typography
          as="h2"
          id="modal-title"
          font="noto"
          variant="heading2B"
          className="mb-4 text-left text-black"
        >
          탈퇴할까요?
        </Typography>

        {/* 경고 문구 */}
        <Typography
          as="p"
          font="noto"
          variant="body2R"
          className="mb-4 text-gray-700"
        >
          계정 정보는 모두 삭제되며 이는 다시 가입하더라도 복구되지 않습니다.
        </Typography>

        {/* 이름 입력 필드 */}
        <div className="mb-4 flex flex-col gap-2">
          <input
            id="userName"
            name="userName"
            type="text"
            value={userName}
            onChange={(e) => {
              const value = e.target.value;
              setUserName(value);

              // 실시간 닉네임 검증
              if (
                nickname &&
                value.trim() !== "" &&
                value.trim() !== nickname
              ) {
                setNameError("사용 중인 닉네임과 다릅니다.");
              } else {
                setNameError("");
              }
            }}
            placeholder={`${nickname ?? ""}`}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm shadow-sm focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50"
          />
          {nameError && (
            <div className="flex items-center gap-2">
              <Typography
                font="noto"
                variant="label1R"
                className="text-red-500"
              >
                {nameError}
              </Typography>
            </div>
          )}
        </div>

        {/* 버튼 영역: 취소 / 확인 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (isLoading) return;
              onClose();
            }}
            disabled={isLoading}
            className="rounded-xl bg-white px-4 py-3 shadow-md transition-colors hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="취소"
          >
            <Typography font="noto" variant="body2M" className="text-black">
              취소
            </Typography>
          </button>
          <button
            onClick={onConfirm}
            disabled={
              isLoading ||
              !userName.trim() ||
              nameError !== "" ||
              !nickname ||
              userName.trim() !== nickname
            }
            className="bg-primary-pink hover:bg-primary-pink/80 rounded-xl px-4 py-3 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:bg-gray-300"
            aria-label={isLoading ? "탈퇴 진행 중..." : "탈퇴"}
          >
            <Typography font="noto" variant="body2M" className="text-white">
              {isLoading ? "탈퇴 진행 중..." : "탈퇴"}
            </Typography>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
