import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import type { RefObject } from "react";
import { FILE_UPLOAD_MESSAGES } from "@/constants/shared/_photo-storage";
import useToggle from "@/hooks/shared/useToggle";
import type { ColorPickerPosition } from "@/types/shared/text-editor";
import { debug } from "@/utils/shared/debugger";
import {
  getCameraErrorMessage,
  getCameraPermissionStatus,
  isCameraAPISupported,
} from "@/utils/shared/device";
import {
  addTimestampToImage,
  getTimestampErrorMessage,
} from "@/utils/shared/image-timestamp";
import { validateImageFile } from "@/utils/shared/image-validation";

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
  showCameraErrorModal: boolean;
  cameraErrorMessage: string;
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
  handleCameraErrorModalClose: () => void;
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
  const {
    isOpen: showCameraErrorModal,
    open: openCameraErrorModal,
    close: closeCameraErrorModal,
  } = useToggle();
  const [cameraErrorMessage, setCameraErrorMessage] = useState("");
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
   * 에러 메시지 설정 및 모달 표시 헬퍼 함수
   * 중복된 에러 처리 로직을 통일하여 유지보수성 향상
   */
  const showCameraError = useCallback(
    (message: string) => {
      setCameraErrorMessage(message);
      openCameraErrorModal();
    },
    [openCameraErrorModal]
  );

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
   * - 카메라 API 지원 확인
   * - 카메라 권한 상태 확인 (가능한 경우)
   * - 카메라 input 클릭
   */
  const handleTimestampCameraClick = useCallback(async () => {
    setShowTimestampMenu(false);

    try {
      debug.log("카메라 촬영 버튼 클릭");

      // 카메라 API 지원 확인
      if (!isCameraAPISupported()) {
        debug.warn("카메라 API 미지원");
        showCameraError(FILE_UPLOAD_MESSAGES.CAMERA_NOT_SUPPORTED);
        return;
      }

      // 카메라 권한 상태 확인 (가능한 경우)
      try {
        const permissionStatus = await getCameraPermissionStatus();
        if (permissionStatus === "denied") {
          debug.warn("카메라 권한 거부됨");
          const errorMessage = getCameraErrorMessage();
          showCameraError(errorMessage);
          return;
        }
        // "prompt" 상태는 사용자가 직접 권한을 허용할 수 있도록 진행
        // "granted" 상태는 바로 진행
        if (permissionStatus === "granted") {
          debug.log("카메라 권한 허용됨");
        } else if (permissionStatus === "prompt") {
          debug.log("카메라 권한 확인 대기 중");
        }
      } catch (permissionError) {
        // Permissions API 미지원 또는 에러 발생 시에도 진행
        // (일부 브라우저에서는 Permissions API를 지원하지 않을 수 있음)
        debug.warn("카메라 권한 확인 실패, 계속 진행:", permissionError);
      }

      // 카메라 input 클릭
      if (!timestampCameraInputRef.current) {
        debug.error("카메라 input ref가 없습니다");
        showCameraError(
          "카메라를 시작할 수 없습니다. 페이지를 새로고침한 후 다시 시도해주세요."
        );
        return;
      }

      debug.log("카메라 input 클릭");
      timestampCameraInputRef.current.click();
    } catch (error) {
      debug.error("카메라 접근 준비 실패:", error);
      const errorMessage = getCameraErrorMessage(error);
      showCameraError(errorMessage);
    }
  }, [showCameraError]);

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
      if (!file) {
        // 파일이 선택되지 않은 경우 (사용자가 취소한 경우)
        debug.log("카메라 촬영 취소됨");
        return;
      }

      // input 초기화 (에러 발생 시에도 정리하기 위해 먼저 실행)
      event.target.value = "";

      let timestampedBlob: Blob | null = null;
      let blobUrl: string | null = null;

      try {
        // 파일 검증
        const validationError = validateImageFile(file);
        if (validationError) {
          showCameraError(validationError);
          return;
        }

        debug.log("카메라 촬영 파일 처리 시작:", {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        // 타임스탬프를 적용한 이미지 생성
        try {
          timestampedBlob = await addTimestampToImage(file);
        } catch (timestampError) {
          debug.error("타임스탬프 추가 실패:", timestampError);
          showCameraError(getTimestampErrorMessage(timestampError));
          return;
        }

        // IndexedDB에 저장 (타임스탬프 적용된 이미지를 File로 변환하여 전달)
        if (onTimestampPhotoCapture && timestampedBlob) {
          try {
            const timestampedFile = new File(
              [timestampedBlob],
              "timestamp.jpg",
              {
                type: "image/jpeg",
              }
            );
            await onTimestampPhotoCapture(timestampedFile);
          } catch (storageError) {
            debug.error("IndexedDB 저장 실패:", storageError);
            // 저장 실패해도 미리보기는 표시 (사용자가 업로드할 수 있도록)
            // 에러는 로그만 남기고 계속 진행
          }
        }

        // Blob URL 생성
        try {
          blobUrl = URL.createObjectURL(timestampedBlob);
        } catch (urlError) {
          debug.error("Blob URL 생성 실패:", urlError);
          // Blob URL 생성 실패 시 메모리 부족 가능성
          showCameraError(
            "이미지를 표시할 수 없습니다. 메모리가 부족할 수 있습니다. 브라우저를 새로고침한 후 다시 시도해주세요."
          );
          return;
        }

        // 타임스탬프가 적용된 이미지를 미리보기에 표시
        setTimestampPreviewImage(timestampedBlob);
        setTimestampPreviewUrl(blobUrl);
        setShowTimestampPreview(true);

        debug.log("카메라 촬영 처리 완료");
      } catch (error) {
        debug.error("타임스탬프 사진 촬영 실패:", error);

        // 생성된 리소스 정리
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }

        // 에러 타입에 따른 구체적인 메시지
        let errorMessage = getCameraErrorMessage(error);

        // 메모리 관련 에러는 별도 처리
        if (error instanceof Error) {
          const errorMessageLower = error.message.toLowerCase();
          if (
            errorMessageLower.includes("quota") ||
            errorMessageLower.includes("memory")
          ) {
            errorMessage =
              "메모리가 부족합니다. 다른 이미지를 삭제한 후 다시 시도해주세요.";
          }
        }

        showCameraError(errorMessage);
      }
    },
    [onTimestampPhotoCapture, showCameraError]
  );

  /**
   * 타임스탬프 로컬 갤러리 선택 후 처리
   * - 파일 검증
   * - 타임스탬프 적용
   * - IndexedDB 저장 (선택적)
   * - 미리보기 표시
   *
   * 주의: Safari에서 event.target.value = ""를 실행하면 files도 비워지므로
   * 파일을 먼저 변수에 저장한 후 input 초기화
   */
  const handleTimestampLocalGallerySelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      debug.log("갤러리 선택 이벤트 발생:", {
        files: event.target.files,
        filesLength: event.target.files?.length,
      });

      const files = event.target.files;
      if (!files || files.length === 0) {
        debug.warn("파일이 선택되지 않았습니다 (사용자가 취소했을 수 있음)");
        // input 초기화
        event.target.value = "";
        return;
      }

      // Safari에서 event.target.value = ""를 실행하면 files도 비워지므로
      // 파일을 먼저 변수에 저장한 후 input 초기화
      const file = files[0];
      if (!file) {
        debug.error("파일 객체가 없습니다:", {
          files,
          filesLength: files.length,
        });
        event.target.value = "";
        showCameraError(
          "파일을 선택할 수 없습니다. 다른 이미지를 선택해주세요."
        );
        return;
      }

      debug.log("선택된 파일:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // input 초기화 (파일을 변수에 저장한 후 실행)
      event.target.value = "";

      let timestampedBlob: Blob | null = null;
      let blobUrl: string | null = null;
      let shouldCleanupBlobUrl = false;

      try {
        // 파일 검증
        const validationError = validateImageFile(file);
        if (validationError) {
          showCameraError(validationError);
          return;
        }

        // 타임스탬프를 적용한 이미지 생성
        try {
          timestampedBlob = await addTimestampToImage(file);
          debug.log("타임스탬프 적용 완료");
        } catch (timestampError) {
          debug.error("타임스탬프 추가 실패:", timestampError);
          showCameraError(getTimestampErrorMessage(timestampError));
          return;
        }

        // IndexedDB에 저장 (타임스탬프 적용된 이미지를 File로 변환하여 전달)
        if (onTimestampPhotoCapture && timestampedBlob) {
          try {
            const timestampedFile = new File(
              [timestampedBlob],
              "timestamp.jpg",
              {
                type: "image/jpeg",
              }
            );
            await onTimestampPhotoCapture(timestampedFile);
            debug.log("IndexedDB 저장 완료");
          } catch (storageError) {
            debug.error("IndexedDB 저장 실패:", storageError);
            // 저장 실패해도 미리보기는 표시 (사용자가 업로드할 수 있도록)
            // 에러는 로그만 남기고 계속 진행
          }
        }

        // Blob URL 생성
        try {
          blobUrl = URL.createObjectURL(timestampedBlob);
        } catch (urlError) {
          debug.error("Blob URL 생성 실패:", urlError);
          showCameraError(
            "이미지를 표시할 수 없습니다. 메모리가 부족할 수 있습니다. 브라우저를 새로고침한 후 다시 시도해주세요."
          );
          return;
        }

        // 타임스탬프가 적용된 이미지를 미리보기에 표시
        setTimestampPreviewImage(timestampedBlob);
        setTimestampPreviewUrl(blobUrl);
        setShowTimestampPreview(true);

        // 성공 시에는 blobUrl을 정리하지 않음 (미리보기에서 사용 중)
        shouldCleanupBlobUrl = false;
        debug.log("갤러리 선택 처리 완료");
      } catch (error) {
        debug.error("타임스탬프 로컬 갤러리 선택 실패:", error);

        // 에러 발생 시 blobUrl 정리 필요
        shouldCleanupBlobUrl = true;

        // 에러 타입에 따른 구체적인 메시지
        let errorMessage = getCameraErrorMessage(error);

        // 메모리 관련 에러는 별도 처리
        if (error instanceof Error) {
          const errorMessageLower = error.message.toLowerCase();
          if (
            errorMessageLower.includes("quota") ||
            errorMessageLower.includes("memory")
          ) {
            errorMessage =
              "메모리가 부족합니다. 다른 이미지를 삭제한 후 다시 시도해주세요.";
          }
        }

        showCameraError(errorMessage);
      } finally {
        // 리소스 정리: 에러 발생 시에만 blobUrl 정리
        // 성공 시에는 미리보기에서 사용 중이므로 정리하지 않음
        if (blobUrl && shouldCleanupBlobUrl) {
          URL.revokeObjectURL(blobUrl);
          debug.log("에러 발생으로 인한 blobUrl 정리");
        }
      }
    },
    [onTimestampPhotoCapture, showCameraError]
  );

  /**
   * 타임스탬프 사진 업로드 (미리보기에서 업로드 버튼)
   * - clientId 발급 (onImageUpload 호출)
   * - 텍스트 에디터에 이미지 삽입
   * - 미리보기 상태 정리
   *
   * 주의: onImageUpload 실패 시에도 이미지는 삽입됨 (나중에 업로드 가능하도록)
   */
  const handleTimestampUpload = useCallback(
    async (event?: MouseEvent) => {
      // 이벤트 버블링 방지 (폼 제출 방지)
      event?.preventDefault();

      if (!timestampPreviewImage) {
        debug.warn("업로드할 이미지가 없습니다");
        return;
      }

      if (!onImageUpload) {
        debug.warn("onImageUpload 콜백이 없습니다");
        return;
      }

      let blobUrl: string | null = null;
      let shouldCleanupPreview = false;

      try {
        debug.log("타임스탬프 사진 업로드 시작");

        const file = new File([timestampPreviewImage], "timestamp.jpg", {
          type: "image/jpeg",
        });

        // clientId 발급받아 텍스트 에디터에 삽입 (게시글 작성 시 API 업로드)
        let clientId: string | undefined;
        try {
          const clientIdResult = await onImageUpload(file);
          clientId =
            typeof clientIdResult === "string" ? clientIdResult : undefined;
          if (clientId) {
            debug.log("clientId 발급 성공:", clientId);
          } else {
            debug.warn("clientId가 발급되지 않았습니다");
          }
        } catch (uploadError) {
          debug.error("이미지 업로드 실패 (계속 진행):", uploadError);
          // 업로드 실패해도 로컬 Blob URL로 삽입 (나중에 업로드 가능하도록)
          // 에러는 로그만 남기고 계속 진행
        }

        // Blob URL 생성하여 이미지 삽입 (clientId 포함 - 게시글 작성 시 업로드)
        try {
          blobUrl = URL.createObjectURL(timestampPreviewImage);
          insertImageToEditor(blobUrl, clientId);
          debug.log("이미지 에디터 삽입 완료", { hasClientId: !!clientId });
        } catch (urlError) {
          debug.error("Blob URL 생성 실패:", urlError);
          showCameraError(
            "이미지를 삽입할 수 없습니다. 메모리가 부족할 수 있습니다."
          );
          return;
        }

        // 성공 시에만 미리보기 정리 플래그 설정
        shouldCleanupPreview = true;
      } catch (error) {
        debug.error("타임스탬프 사진 업로드 실패:", error);

        // 에러 메시지 표시
        let errorMessage = "이미지 업로드에 실패했습니다.";

        if (error instanceof Error) {
          const errorMessageLower = error.message.toLowerCase();
          if (
            errorMessageLower.includes("network") ||
            errorMessageLower.includes("fetch")
          ) {
            errorMessage =
              "네트워크 오류가 발생했습니다. 연결을 확인한 후 다시 시도해주세요.";
          } else if (
            errorMessageLower.includes("quota") ||
            errorMessageLower.includes("memory")
          ) {
            errorMessage =
              "메모리가 부족합니다. 다른 이미지를 삭제한 후 다시 시도해주세요.";
          } else {
            errorMessage = error.message || errorMessage;
          }
        }

        showCameraError(errorMessage);
      } finally {
        // 리소스 정리: 성공/실패 여부와 관계없이 항상 실행

        // 에러 발생 시에만 blobUrl 정리 (에디터에 삽입되지 않았으므로)
        // 성공 시에는 에디터에서 사용 중이므로 정리하지 않음
        if (blobUrl && !shouldCleanupPreview) {
          URL.revokeObjectURL(blobUrl);
          debug.log("에러 발생으로 인한 blobUrl 정리");
        }

        // 성공 시에만 미리보기 상태 정리
        if (shouldCleanupPreview) {
          // 미리보기 URL 정리
          if (timestampPreviewUrl) {
            URL.revokeObjectURL(timestampPreviewUrl);
            setTimestampPreviewUrl(null);
          }
          setShowTimestampPreview(false);
          setTimestampPreviewImage(null);
          debug.log("타임스탬프 사진 업로드 완료 및 정리");
        }
      }
    },
    [
      timestampPreviewImage,
      timestampPreviewUrl,
      onImageUpload,
      insertImageToEditor,
      showCameraError,
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

  /**
   * 카메라 에러 모달 닫기
   */
  const handleCameraErrorModalClose = useCallback(() => {
    closeCameraErrorModal();
    setCameraErrorMessage("");
  }, [closeCameraErrorModal]);

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
    showCameraErrorModal,
    cameraErrorMessage,
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
    handleCameraErrorModalClose,
    setShowTimestampGallery,
    updateTimestampMenuPosition,
    updateTimestampGalleryPosition,
  };
};
