"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import { LINK_URL } from "@/constants/shared/_link-url";

interface MissionCertificationSuccessModalProps {
  isOpen: boolean;
  missionName: string;
  postId?: string;
  onClose: () => void;
}

/**
 * @description 미션 인증 완료 성공 모달 컴포넌트
 */
export const MissionCertificationSuccessModal = ({
  isOpen,
  missionName,
  postId,
  onClose,
}: MissionCertificationSuccessModalProps) => {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 컨텐츠 */}
      <div
        className="relative mx-8 flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 체크마크 아이콘 */}
        <div className="flex justify-center">
          <div className="bg-main-500 flex size-16 items-center justify-center rounded-full">
            <Check className="size-8 text-white" strokeWidth={3.5} />
          </div>
        </div>

        {/* 제목 및 내용 */}
        <div className="flex flex-col gap-3 text-center">
          <Typography
            as="h2"
            id="success-modal-title"
            font="noto"
            variant="heading2B"
            className="text-gray-950"
          >
            미션 인증 완료!
          </Typography>
          <Typography font="noto" variant="body2B" className="text-gray-950">
            {missionName}
          </Typography>
          <div className="flex flex-col">
            <Typography font="noto" variant="body2R" className="text-gray-950">
              미션을 성공적으로 완료했어요.
              <br />
              다음 미션도 시작해 볼까요?
            </Typography>
          </div>
        </div>

        {/* 버튼들 */}
        <div className="flex flex-col gap-3">
          {/* 다음 미션 찾아보기 버튼 */}
          <button
            onClick={() => {
              onClose();
              router.push(LINK_URL.MISSION_LIST);
            }}
            className="bg-main-600 hover:bg-main-700 w-full rounded-lg py-2 text-white transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Typography font="noto" variant="body2B" className="text-white">
              다음 미션 찾아보기
            </Typography>
          </button>

          {/* 작성 글 보러가기 링크 */}
          {postId && (
            <button
              onClick={() => {
                onClose();
                router.push(`${LINK_URL.COMMUNITY_POST}/${postId}`);
              }}
              className="flex items-center justify-center gap-1 text-gray-400 transition-colors hover:text-gray-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <Typography font="noto" variant="label2R">
                작성 글 보러가기
              </Typography>
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
