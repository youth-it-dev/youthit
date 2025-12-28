"use client";

import { useState } from "react";
import Modal from "../ui/modal";

interface TimestampPreviewModalProps {
  isOpen: boolean;
  previewUrl: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const MAX_IMAGE_SIZE = 400;
const VIEWPORT_MARGIN = 80;

/**
 * @description 타임스탬프 사진 미리보기 모달 컴포넌트
 */
export const TimestampPreviewModal = ({
  isOpen,
  previewUrl,
  onConfirm,
  onClose,
}: TimestampPreviewModalProps) => {
  const [imageError, setImageError] = useState(false);

  // previewUrl이 없으면 모달을 렌더링하지 않음
  // Modal 컴포넌트가 이미 isOpen을 처리하므로 여기서는 previewUrl만 체크
  if (!previewUrl) return null;

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      title="타임스탬프 사진 미리보기"
      description="텍스트 에디터에 추가하시겠어요? (정사각형 사진을 권장해요)"
      confirmText="업로드"
      cancelText="취소"
      onConfirm={onConfirm}
      onClose={onClose}
      variant="primary"
      closeOnOverlayClick={false}
      closeOnEscape={true}
    >
      <div className="flex items-center justify-center rounded-lg bg-gray-100 p-4">
        {imageError ? (
          <div className="flex h-32 items-center justify-center text-gray-500">
            이미지를 불러올 수 없습니다
          </div>
        ) : (
          <div
            className="relative flex items-center justify-center"
            style={{
              maxWidth: `min(${MAX_IMAGE_SIZE}px, calc(100vw - ${VIEWPORT_MARGIN}px))`,
              maxHeight: `min(${MAX_IMAGE_SIZE}px, calc(100vh - ${VIEWPORT_MARGIN * 2}px))`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="타임스탬프 사진 미리보기"
              className="max-h-full max-w-full rounded-lg object-contain"
              onError={handleImageError}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
