/** 텍스트 에디터 이미지 업로드 최대 크기 (5MB) */
export const MAX_EDITOR_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// 파일 업로드 관련 메시지
export const FILE_UPLOAD_MESSAGES = {
  SIZE_EXCEEDED: (maxSizeMB: number) =>
    `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`,
  INVALID_TYPE: "이미지 파일만 업로드 가능합니다.",
  UPLOAD_FAILED: "파일 업로드에 실패했습니다.",
  CAMERA_PERMISSION_DENIED:
    "카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.",
  CAMERA_BLOCKED:
    "카메라 접근이 차단되었습니다. 브라우저 설정에서 권한을 확인해주세요.",
  CAMERA_NOT_FOUND:
    "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.",
  CAMERA_BUSY:
    "카메라를 사용할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.",
  CAMERA_NOT_SUPPORTED:
    "이 브라우저에서는 카메라를 지원하지 않습니다. 최신 브라우저를 사용해주세요.",
} as const;

// IndexedDB 설정
export const DB_CONFIG = {
  NAME: "timestamp-photo-storage",
  VERSION: 2,
  STORE_NAME: "photos",
} as const;

// 저장 제한
export const STORAGE_LIMITS = {
  MAX_PHOTOS: 20,
  RETENTION_DAYS: 2, // 2일
  RETENTION_MS: 2 * 24 * 60 * 60 * 1000, // 2일 (밀리초)
} as const;

// 이미지 처리 설정
export const IMAGE_CONFIG = {
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1920,
  QUALITY: 0.75, // 75%
  FORMAT: "image/jpeg" as const,
} as const;

// IndexedDB 스토어 설정
export const STORE_CONFIG = {
  keyPath: "id",
  indexes: [
    { name: "timestamp", keyPath: "timestamp", options: { unique: false } },
  ],
} as const;
