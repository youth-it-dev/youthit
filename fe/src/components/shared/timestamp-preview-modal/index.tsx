"use client";

import Modal from "../ui/modal";

interface TimestampPreviewModalProps {
  isOpen: boolean;
  previewUrl: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * @description 타임스탬프 사진 미리보기 모달 컴포넌트
 */
export const TimestampPreviewModal = ({
  isOpen,
  previewUrl,
  onConfirm,
  onClose,
}: TimestampPreviewModalProps) => {
  if (!isOpen || !previewUrl) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="타임스탬프 사진 미리보기"
      description="타임스탬프가 적용된 사진입니다. 텍스트 에디터에 삽입하시겠습니까?"
      confirmText="업로드"
      cancelText="취소"
      onConfirm={onConfirm}
      onClose={onClose}
      variant="primary"
      closeOnOverlayClick={false}
      closeOnEscape={true}
    >
      <div className="max-h-[70vh] overflow-auto rounded-lg bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="타임스탬프 사진"
          className="h-auto w-full object-contain"
        />
      </div>
    </Modal>
  );
};
