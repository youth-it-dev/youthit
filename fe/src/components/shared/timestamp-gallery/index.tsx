"use client";

import { useState, useEffect, useMemo } from "react";
import { useStoredPhotos } from "@/hooks/shared/useStoredPhotos";
import type { StoredPhoto } from "@/types/shared/_photo-storage-types";

interface TimestampGalleryProps {
  onPhotoSelect: (photos: StoredPhoto[]) => void;
  onClose: () => void;
}

/**
 * @description 타임스탬프 갤러리 컴포넌트
 */
export const TimestampGallery = ({
  onPhotoSelect,
  onClose,
}: TimestampGalleryProps) => {
  const [selectedPhoto, setSelectedPhoto] = useState<StoredPhoto | null>(null);
  const { photos, isLoading, isStorageAvailable, error } = useStoredPhotos();

  // Blob URL을 메모이제이션하고 정리
  const photoUrls = useMemo(() => {
    return photos.map((photo) => ({
      id: photo.id,
      url: URL.createObjectURL(photo.blob),
      originalFileName: photo.originalFileName,
      timestamp: photo.timestamp,
    }));
  }, [photos]);

  useEffect(() => {
    // 컴포넌트 언마운트 시 모든 URL 정리
    return () => {
      photoUrls.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [photoUrls]);

  const handlePhotoSelect = (photo: StoredPhoto) => {
    setSelectedPhoto(photo);
  };

  const handleConfirm = () => {
    if (selectedPhoto) {
      onPhotoSelect([selectedPhoto]);
    }
  };

  if (!isStorageAvailable) {
    return (
      <div className="py-4 text-center text-gray-500">
        로컬 저장소를 지원하지 않습니다
      </div>
    );
  }

  if (error) {
    return <div className="py-4 text-center text-red-500">{error}</div>;
  }

  if (isLoading) {
    return <div className="py-4 text-center text-gray-500">로딩 중...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">
        저장된 타임스탬프 사진이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          타임스탬프 사진 선택{" "}
          {selectedPhoto ? "(사진 선택됨)" : "(선택된 사진 없음)"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto">
        {photoUrls.map((photo) => {
          const originalPhoto = photos.find((p) => p.id === photo.id);
          if (!originalPhoto) return null;

          const isSelected = selectedPhoto?.id === photo.id;
          return (
            <div
              key={photo.id}
              onClick={() => handlePhotoSelect(originalPhoto)}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <img
                src={photo.url}
                alt={photo.originalFileName}
                className="h-full w-full object-cover"
              />
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                  <div className="text-lg font-bold text-white">✓</div>
                </div>
              )}
              <div className="absolute right-0 bottom-0 left-0 bg-black/50 p-1">
                <p className="truncate text-xs text-white">
                  {new Date(photo.timestamp).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedPhoto}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          삽입
        </button>
      </div>
    </div>
  );
};
