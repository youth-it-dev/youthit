// IndexedDB 설정
export const DB_CONFIG = {
  NAME: "timestamp-photo-storage",
  VERSION: 1,
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
