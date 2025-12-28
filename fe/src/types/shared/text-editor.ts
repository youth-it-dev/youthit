/**
 * @description 텍스트 에디터 관련 타입 정의
 */

export interface TextEditorProps {
  className?: string;
  minHeight?: number;
  /**
   * 초기 제목/내용 HTML
   * - 수정 페이지 등에서 기본값 렌더링 용도로 사용
   */
  initialTitleHtml?: string;
  initialContentHtml?: string;
  /**
   * 이미지 선택 시, 업로드는 하지 않고 clientId를 발급/등록해 반환합니다.
   * 에디터는 받은 clientId를 img의 data-client-id 속성에 넣어 둡니다.
   * 실제 업로드는 제출 시 한 번에 수행하고, 그 응답의 fileUrl을 매칭시켜 src로 교체합니다.
   */
  onImageUpload?: (file: File) => Promise<string> | string;
  /**
   * 파일 선택 시, 업로드는 하지 않고 clientId를 발급/등록해 반환합니다.
   * 에디터는 받은 clientId를 a의 data-file-id 속성에 넣어 둡니다.
   * 실제 업로드는 제출 시 한 번에 수행하고, 그 응답의 fileUrl을 매칭시켜 href로 교체합니다.
   */
  onFileUpload?: (file: File) => Promise<string> | string;
  /**
   * 타임스탬프 사진 촬영 핸들러
   * - 사진 촬영 시 타임스탬프를 추가하여 IndexedDB에 저장
   */
  onTimestampPhotoCapture?: (file: File) => Promise<void>;
  /**
   * 타임스탬프 버튼 표시 여부
   * - 기본값: false (프로덕션에서는 숨김)
   * - 테스트 페이지 등에서 true로 설정하여 활성화
   */
  showTimestampButton?: boolean;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
}

export type FormatCommand = "bold" | "italic" | "underline";

export type AlignCommand = "justifyLeft" | "justifyCenter" | "justifyRight";

export type EditorType = "title" | "content" | null;

export interface ColorOption {
  name: string;
  value: string;
}

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface ColorPickerPosition {
  top: number;
  left: number;
}
