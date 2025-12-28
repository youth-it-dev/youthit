"use client";

import { useEffect } from "react";
import TextEditor from "@/components/shared/text-editor";
import { useStoredPhotos } from "@/hooks/shared/useStoredPhotos";
import { useTopBarStore } from "@/stores/shared/topbar-store";

/**
 * @description 타임스탬프 에디터 테스트 페이지
 * 히든 페이지에서 타임스탬프 기능을 테스트하기 위한 페이지
 */
const TimestampTestPage = () => {
  const { savePhoto } = useStoredPhotos();
  const setTitle = useTopBarStore((state) => state.setTitle);
  const resetTopBar = useTopBarStore((state) => state.reset);

  /**
   * 이미지 업로드 핸들러
   * 테스트 페이지에서는 clientId만 발급하고 반환
   */
  const handleImageUpload = (file: File): string => {
    const clientId = crypto.randomUUID();
    // eslint-disable-next-line no-console
    console.log("이미지 등록:", { clientId, fileName: file.name });
    return clientId;
  };

  /**
   * 파일 업로드 핸들러
   * 테스트 페이지에서는 clientId만 발급하고 반환
   */
  const handleFileUpload = (file: File): string => {
    const clientId = crypto.randomUUID();
    // eslint-disable-next-line no-console
    console.log("파일 등록:", { clientId, fileName: file.name });
    return clientId;
  };

  /**
   * 타임스탬프 사진 촬영 핸들러
   * IndexedDB에 저장
   */
  const handleTimestampPhotoCapture = async (file: File) => {
    try {
      await savePhoto(file);
      // eslint-disable-next-line no-console
      console.log("타임스탬프 사진이 앱 앨범에 저장되었습니다");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("타임스탬프 사진 저장 실패:", error);
    }
  };

  // TopBar 설정
  useEffect(() => {
    setTitle("타임스탬프 테스트");
    return () => {
      resetTopBar();
    };
  }, [setTitle, resetTopBar]);

  return (
    <div className="flex min-h-full w-full flex-col pt-12">
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-2xl bg-white p-4">
          <TextEditor
            onImageUpload={handleImageUpload}
            onFileUpload={handleFileUpload}
            onTimestampPhotoCapture={handleTimestampPhotoCapture}
            showTimestampButton={true}
            minHeight={400}
          />
        </div>
      </main>
    </div>
  );
};

export default TimestampTestPage;
