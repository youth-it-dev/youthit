"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "../ui/modal";

interface TimestampPreviewModalProps {
  isOpen: boolean;
  previewUrl: string | null;
  onConfirm: (croppedImage?: Blob) => void;
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
  const [imageError, setImageError] = useState(false);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);
  const [finalImageBlob, setFinalImageBlob] = useState<Blob | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  // previewUrl이 변경될 때마다 미리보기 준비 (이미 크롭 + 타임스탬프 완료된 상태)
  useEffect(() => {
    if (!previewUrl) {
      // 기존 URL 정리
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = null;
      }
      setFinalPreviewUrl(null);
      setFinalImageBlob(null);
      setImageError(false);
      return;
    }

    // 이미 크롭 + 타임스탬프가 적용된 previewUrl을 그대로 사용
    // Blob URL에서 실제 Blob을 추출하기 위해 fetch 사용
    fetch(previewUrl)
      .then((response) => response.blob())
      .then((blob) => {
        // 기존 URL 정리
        if (previousUrlRef.current) {
          URL.revokeObjectURL(previousUrlRef.current);
        }

        // 새로운 URL 생성 및 상태 업데이트 (동일한 Blob으로)
        const finalUrl = URL.createObjectURL(blob);
        previousUrlRef.current = finalUrl;
        setFinalPreviewUrl(finalUrl);
        setFinalImageBlob(blob);
        setImageError(false);
      })
      .catch(() => {
        setImageError(true);
        setFinalPreviewUrl(null);
        setFinalImageBlob(null);
      });
  }, [previewUrl]);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

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
      description="이대로 텍스트 에디터에 추가하시겠어요?"
      confirmText="업로드"
      cancelText="취소"
      onConfirm={() => onConfirm(finalImageBlob || undefined)}
      onClose={onClose}
      variant="primary"
      closeOnOverlayClick={false}
      closeOnEscape={false}
    >
      <div className="flex items-center justify-center rounded-lg bg-gray-100 p-3">
        {imageError ? (
          <div className="flex h-32 items-center justify-center text-gray-500">
            이미지를 불러올 수 없습니다
          </div>
        ) : finalPreviewUrl ? (
          <div className="flex flex-col items-center gap-2">
            {/* 크롭 + 타임스탬프가 적용된 최종 미리보기 */}
            <div className="relative flex size-[280px] items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={originalImageRef}
                src={finalPreviewUrl}
                alt="최종 타임스탬프 사진 미리보기"
                className="h-full w-full rounded-lg object-cover"
                onError={handleImageError}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center">
            <div className="text-gray-500">크롭 처리 중...</div>
          </div>
        )}
      </div>
    </Modal>
  );
};
