import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import type { RefObject } from "react";
import type { ColorPickerPosition } from "@/types/shared/text-editor";
import { debug } from "@/utils/shared/debugger";
import { addTimestampToImage } from "@/utils/shared/image-timestamp";

interface UseTimestampPhotoOptions {
  getToolbarRect: () => DOMRect | null;
  clampPopoverPosition: (
    position: ColorPickerPosition,
    popoverWidth?: number
  ) => ColorPickerPosition;
  onImageUpload?: (file: File) => Promise<string> | string;
  onTimestampPhotoCapture?: (file: File) => Promise<void>;
  insertImageToEditor: (imageUrl: string, clientId?: string) => void;
}

interface UseTimestampPhotoReturn {
  // 상태
  showTimestampMenu: boolean;
  showTimestampPreview: boolean;
  showTimestampGallery: boolean;
  timestampPreviewImage: Blob | null;
  timestampPreviewUrl: string | null;
  timestampMenuPosition: ColorPickerPosition;
  timestampGalleryPosition: ColorPickerPosition;

  // Refs
  timestampButtonRef: RefObject<HTMLButtonElement | null>;
  timestampCameraInputRef: RefObject<HTMLInputElement | null>;
  timestampGalleryInputRef: RefObject<HTMLInputElement | null>;
  timestampMenuRef: RefObject<HTMLDivElement | null>;

  // 핸들러
  handleTimestampMenuToggle: () => void;
  handleTimestampCameraClick: () => void;
  handleTimestampLocalGalleryClick: () => void;
  handleTimestampGalleryClick: () => void;
  handleTimestampCameraCapture: (
    event: ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  handleTimestampLocalGallerySelect: (
    event: ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  handleTimestampUpload: (event?: MouseEvent) => Promise<void>;
  handleTimestampCancel: () => void;
  setShowTimestampGallery: (show: boolean) => void;
  updateTimestampMenuPosition: () => void;
  updateTimestampGalleryPosition: () => void;
}

const TIMESTAMP_MENU_WIDTH = 160;
const TIMESTAMP_MENU_HEIGHT = 100;

/**
 * @description 타임스탬프 사진 관련 로직을 관리하는 커스텀 훅
 */
export const useTimestampPhoto = ({
  getToolbarRect,
  clampPopoverPosition,
  onImageUpload,
  onTimestampPhotoCapture,
  insertImageToEditor,
}: UseTimestampPhotoOptions): UseTimestampPhotoReturn => {
  // 상태 관리
  const [showTimestampMenu, setShowTimestampMenu] = useState(false);
  const [showTimestampPreview, setShowTimestampPreview] = useState(false);
  const [showTimestampGallery, setShowTimestampGallery] = useState(false);
  const [timestampPreviewImage, setTimestampPreviewImage] =
    useState<Blob | null>(null);
  const [timestampPreviewUrl, setTimestampPreviewUrl] = useState<string | null>(
    null
  );
  const [timestampMenuPosition, setTimestampMenuPosition] =
    useState<ColorPickerPosition>({
      top: 0,
      left: 0,
    });
  const [timestampGalleryPosition, setTimestampGalleryPosition] =
    useState<ColorPickerPosition>({
      top: 0,
      left: 0,
    });

  // Refs
  const timestampButtonRef = useRef<HTMLButtonElement>(null);
  const timestampCameraInputRef = useRef<HTMLInputElement>(null);
  const timestampGalleryInputRef = useRef<HTMLInputElement>(null);
  const timestampMenuRef = useRef<HTMLDivElement>(null);

  /**
   * 타임스탬프 메뉴 위치 업데이트
   */
  const updateTimestampMenuPosition = useCallback(() => {
    // 타임스탬프 버튼의 위치를 기준으로 메뉴 위치 계산
    if (timestampButtonRef.current) {
      const buttonRect = timestampButtonRef.current.getBoundingClientRect();

      // 버튼의 뷰포트 기준 위치
      const buttonBottom = buttonRect.bottom;
      const buttonLeft = buttonRect.left;
      const buttonWidth = buttonRect.width;

      // 메뉴 위치 계산 (버튼 중앙 기준)
      let menuTop = buttonBottom + 4; // 버튼 아래 4px
      let menuLeft = buttonLeft + buttonWidth / 2 - TIMESTAMP_MENU_WIDTH / 2; // 버튼 중앙 정렬

      // 뷰포트 경계 체크 및 조정
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;

      // 좌우 경계 체크
      if (menuLeft < margin) {
        menuLeft = margin;
      } else if (menuLeft + TIMESTAMP_MENU_WIDTH > viewportWidth - margin) {
        menuLeft = viewportWidth - TIMESTAMP_MENU_WIDTH - margin;
      }

      // 상하 경계 체크
      if (menuTop + TIMESTAMP_MENU_HEIGHT > viewportHeight - margin) {
        // 메뉴가 화면 밖으로 나가면 버튼 위에 표시
        menuTop = buttonRect.top - TIMESTAMP_MENU_HEIGHT - 4;
        if (menuTop < margin) {
          menuTop = margin;
        }
      }

      // 절대 좌표로 변환 (스크롤 오프셋 추가)
      setTimestampMenuPosition({
        top: menuTop + window.scrollY,
        left: menuLeft + window.scrollX,
      });
    } else {
      // 폴백: 툴바 위치 사용
      const rect = getToolbarRect();
      if (rect) {
        const rawPosition = {
          top: rect.bottom + window.scrollY + 4,
          left: rect.right + window.scrollX - TIMESTAMP_MENU_WIDTH - 10,
        };
        const clampedPosition = clampPopoverPosition(
          rawPosition,
          TIMESTAMP_MENU_WIDTH
        );
        setTimestampMenuPosition(clampedPosition);
      }
    }
  }, [getToolbarRect, clampPopoverPosition]);

  /**
   * 타임스탬프 갤러리 위치 업데이트
   */
  const updateTimestampGalleryPosition = useCallback(() => {
    const rect = getToolbarRect();
    if (rect) {
      const margin = 16;
      const left = Math.max(margin, rect.left + window.scrollX);

      setTimestampGalleryPosition({
        top: rect.bottom + window.scrollY + 4,
        left: left,
      });
    }
  }, [getToolbarRect]);

  /**
   * 타임스탬프 메뉴 토글
   */
  const handleTimestampMenuToggle = useCallback(() => {
    const willShow = !showTimestampMenu;
    setShowTimestampMenu(willShow);

    if (willShow) {
      // 메뉴를 열 때 위치 계산 (상태 업데이트 후 다음 프레임에서 실행)
      requestAnimationFrame(() => {
        updateTimestampMenuPosition();
      });
    }
  }, [showTimestampMenu, updateTimestampMenuPosition]);

  /**
   * 타임스탬프 사진 촬영
   */
  const handleTimestampCameraClick = useCallback(() => {
    setShowTimestampMenu(false);
    timestampCameraInputRef.current?.click();
  }, []);

  /**
   * 타임스탬프 로컬 갤러리 선택
   */
  const handleTimestampLocalGalleryClick = useCallback(() => {
    setShowTimestampMenu(false);
    timestampGalleryInputRef.current?.click();
  }, []);

  /**
   * 타임스탬프 갤러리 선택
   */
  const handleTimestampGalleryClick = useCallback(() => {
    setShowTimestampMenu(false);
    setShowTimestampGallery(true);
    // 갤러리 위치 계산
    requestAnimationFrame(() => {
      updateTimestampGalleryPosition();
    });
  }, [updateTimestampGalleryPosition]);

  /**
   * 타임스탬프 사진 촬영 후 처리
   */
  const handleTimestampCameraCapture = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        // 먼저 타임스탬프를 적용한 이미지 생성
        const timestampedBlob = await addTimestampToImage(file);

        if (onTimestampPhotoCapture) {
          // IndexedDB에 저장 (타임스탬프 적용된 이미지를 File로 변환하여 전달)
          const timestampedFile = new File([timestampedBlob], "timestamp.jpg", {
            type: "image/jpeg",
          });
          await onTimestampPhotoCapture(timestampedFile);
        }

        // 타임스탬프가 적용된 이미지를 미리보기에 표시
        setTimestampPreviewImage(timestampedBlob);
        // Blob URL 생성
        const blobUrl = URL.createObjectURL(timestampedBlob);
        setTimestampPreviewUrl(blobUrl);
        setShowTimestampPreview(true);
      } catch (error) {
        debug.error("타임스탬프 사진 촬영 실패:", error);
      }

      // input 초기화
      event.target.value = "";
    },
    [onTimestampPhotoCapture]
  );

  /**
   * 타임스탬프 로컬 갤러리 선택 후 처리
   */
  const handleTimestampLocalGallerySelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      try {
        // 첫 번째 파일만 처리 (여러 파일 선택 시 첫 번째만)
        const file = files[0];

        // 먼저 타임스탬프를 적용한 이미지 생성
        const timestampedBlob = await addTimestampToImage(file);

        if (onTimestampPhotoCapture) {
          // IndexedDB에 저장 (타임스탬프 적용된 이미지를 File로 변환하여 전달)
          const timestampedFile = new File([timestampedBlob], "timestamp.jpg", {
            type: "image/jpeg",
          });
          await onTimestampPhotoCapture(timestampedFile);
        }

        // 타임스탬프가 적용된 이미지를 미리보기에 표시
        setTimestampPreviewImage(timestampedBlob);
        // Blob URL 생성
        const blobUrl = URL.createObjectURL(timestampedBlob);
        setTimestampPreviewUrl(blobUrl);
        setShowTimestampPreview(true);
      } catch (error) {
        debug.error("타임스탬프 로컬 갤러리 선택 실패:", error);
      }

      // input 초기화
      event.target.value = "";
    },
    [onTimestampPhotoCapture]
  );

  /**
   * 타임스탬프 사진 업로드 (미리보기에서 업로드 버튼)
   * IndexedDB에 저장하고, 텍스트 에디터에 삽입 (게시글 작성 시 API 업로드)
   */
  const handleTimestampUpload = useCallback(
    async (event?: MouseEvent) => {
      // 이벤트 버블링 방지 (폼 제출 방지)
      event?.preventDefault();

      if (timestampPreviewImage && onImageUpload) {
        try {
          const file = new File([timestampPreviewImage], "timestamp.jpg", {
            type: "image/jpeg",
          });

          // clientId 발급받아 텍스트 에디터에 삽입 (게시글 작성 시 API 업로드)
          const clientIdResult = await onImageUpload(file);
          const clientId =
            typeof clientIdResult === "string" ? clientIdResult : undefined;

          // Blob URL 생성하여 이미지 삽입 (clientId 포함 - 게시글 작성 시 업로드)
          const blobUrl = URL.createObjectURL(timestampPreviewImage);
          insertImageToEditor(blobUrl, clientId);

          // 미리보기 URL 정리
          if (timestampPreviewUrl) {
            URL.revokeObjectURL(timestampPreviewUrl);
            setTimestampPreviewUrl(null);
          }
          setShowTimestampPreview(false);
          setTimestampPreviewImage(null);
        } catch (error) {
          debug.error("타임스탬프 사진 업로드 실패:", error);
        }
      }
    },
    [
      timestampPreviewImage,
      timestampPreviewUrl,
      onImageUpload,
      insertImageToEditor,
    ]
  );

  /**
   * 타임스탬프 사진 취소 (미리보기에서 취소 버튼)
   */
  const handleTimestampCancel = useCallback(() => {
    // Blob URL 정리
    if (timestampPreviewUrl) {
      URL.revokeObjectURL(timestampPreviewUrl);
      setTimestampPreviewUrl(null);
    }
    setShowTimestampPreview(false);
    setTimestampPreviewImage(null);
  }, [timestampPreviewUrl]);

  // 미리보기 URL 정리 (컴포넌트 언마운트 시)
  useEffect(() => {
    return () => {
      if (timestampPreviewUrl) {
        URL.revokeObjectURL(timestampPreviewUrl);
      }
    };
  }, [timestampPreviewUrl]);

  return {
    // 상태
    showTimestampMenu,
    showTimestampPreview,
    showTimestampGallery,
    timestampPreviewImage,
    timestampPreviewUrl,
    timestampMenuPosition,
    timestampGalleryPosition,

    // Refs
    timestampButtonRef,
    timestampCameraInputRef,
    timestampGalleryInputRef,
    timestampMenuRef,

    // 핸들러
    handleTimestampMenuToggle,
    handleTimestampCameraClick,
    handleTimestampLocalGalleryClick,
    handleTimestampGalleryClick,
    handleTimestampCameraCapture,
    handleTimestampLocalGallerySelect,
    handleTimestampUpload,
    handleTimestampCancel,
    setShowTimestampGallery,
    updateTimestampMenuPosition,
    updateTimestampGalleryPosition,
  };
};
