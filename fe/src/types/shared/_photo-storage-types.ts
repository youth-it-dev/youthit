/**
 * @description 저장된 사진 데이터 타입
 */
export interface StoredPhoto {
  /** UUID */
  id: string;
  /** 이미지 Blob */
  blob: Blob;
  /** 저장 시각 (밀리초) */
  timestamp: number;
  /** 원본 파일명 */
  originalFileName: string;
  /** 파일 크기 (바이트 단위) */
  size: number;
}
