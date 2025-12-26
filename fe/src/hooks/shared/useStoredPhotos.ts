import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { StoredPhoto } from "@/types/shared/_photo-storage-types";
import { debug } from "@/utils/shared/debugger";
import { getPhotoDB, isStorageAvailable } from "@/utils/shared/indexed-db";

export interface UseStoredPhotosReturn {
  /** 저장된 사진 목록 */
  photos: StoredPhoto[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 저장소 사용 가능 여부 */
  isStorageAvailable: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 사진 저장 */
  savePhoto: (file: File) => Promise<void>;
  /** 사진 삭제 */
  deletePhoto: (id: string) => Promise<void>;
  /** 모든 사진 삭제 */
  clearAllPhotos: () => Promise<void>;
  /** 저장소 정보 */
  storageInfo: {
    totalPhotos: number;
    totalSize: number;
    oldestPhoto?: number;
    newestPhoto?: number;
  } | null;
  /** 사진 새로고침 */
  refreshPhotos: () => Promise<void>;
}

/**
 * IndexedDB에 저장된 타임스탬프 사진들을 관리하는 훅
 */
export const useStoredPhotos = (): UseStoredPhotosReturn => {
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStorageSupported, setIsStorageSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] =
    useState<UseStoredPhotosReturn["storageInfo"]>(null);

  // 저장소 초기화 및 사진 로드
  const loadPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 저장소 지원 확인
      const available = await isStorageAvailable();
      setIsStorageSupported(available);

      if (!available) {
        setError("이 브라우저는 로컬 저장소를 지원하지 않습니다");
        return;
      }

      const db = await getPhotoDB();
      const allPhotos = await db.getAllPhotos();
      const storageData = await db.getStorageInfo();

      // 타임스탬프 기준 내림차순 정렬 (최신 사진이 먼저)
      const sortedPhotos = allPhotos.sort((a, b) => b.timestamp - a.timestamp);

      setPhotos(sortedPhotos);
      setStorageInfo(storageData);

      debug.log(`사진 로드 완료: ${sortedPhotos.length}장`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "사진을 불러올 수 없습니다";
      setError(errorMessage);
      debug.error("사진 로드 실패:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 사진 저장
  const savePhoto = useCallback(
    async (file: File) => {
      try {
        setError(null);

        // 저장소 지원 여부를 실시간으로 확인
        const available = await isStorageAvailable();
        if (!available) {
          throw new Error("저장소가 지원되지 않습니다");
        }

        // 전달된 파일을 그대로 저장 (호출자가 필요한 경우 타임스탬프 적용)
        const photo: StoredPhoto = {
          id: uuidv4(),
          blob: file,
          timestamp: Date.now(),
          originalFileName: file.name,
          size: file.size,
        };

        // DB에 저장
        const db = await getPhotoDB();
        await db.savePhoto(photo);

        // 저장소 제한 확인
        await db.enforceStorageLimit();

        // 목록 새로고침
        await loadPhotos();

        debug.log(`사진 저장 완료: ${photo.id}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "사진을 저장할 수 없습니다";
        setError(errorMessage);
        debug.error("사진 저장 실패:", err);
        throw err;
      }
    },
    [loadPhotos]
  );

  // 사진 삭제
  const deletePhoto = useCallback(
    async (id: string) => {
      try {
        setError(null);

        // 저장소 지원 여부를 실시간으로 확인
        const available = await isStorageAvailable();
        if (!available) {
          throw new Error("저장소가 지원되지 않습니다");
        }

        const db = await getPhotoDB();
        await db.deletePhoto(id);

        // 목록 새로고침
        await loadPhotos();

        debug.log(`사진 삭제 완료: ${id}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "사진을 삭제할 수 없습니다";
        setError(errorMessage);
        debug.error("사진 삭제 실패:", err);
        throw err;
      }
    },
    [loadPhotos]
  );

  // 모든 사진 삭제
  const clearAllPhotos = useCallback(async () => {
    try {
      setError(null);

      // 저장소 지원 여부를 실시간으로 확인
      const available = await isStorageAvailable();
      if (!available) {
        throw new Error("저장소가 지원되지 않습니다");
      }

      const db = await getPhotoDB();
      const allPhotos = await db.getAllPhotos();

      // 모든 사진 삭제
      for (const photo of allPhotos) {
        await db.deletePhoto(photo.id);
      }

      // 목록 새로고침
      await loadPhotos();

      debug.log(`모든 사진 삭제 완료: ${allPhotos.length}장`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "사진을 삭제할 수 없습니다";
      setError(errorMessage);
      debug.error("모든 사진 삭제 실패:", err);
      throw err;
    }
  }, [loadPhotos]);

  // 사진 새로고침
  const refreshPhotos = useCallback(async () => {
    await loadPhotos();
  }, [loadPhotos]);

  // 초기 로드
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // 주기적으로 오래된 사진 정리 (앱이 활성화되어 있을 때만)
  useEffect(() => {
    if (!isStorageSupported) return;

    const cleanupInterval = setInterval(async () => {
      try {
        const db = await getPhotoDB();
        await db.cleanupOldPhotos();
        await loadPhotos(); // 정리 후 목록 새로고침
      } catch (err) {
        debug.error("자동 정리 실패:", err);
      }
    }, 60000); // 1분마다 확인

    return () => clearInterval(cleanupInterval);
  }, [isStorageSupported, loadPhotos]);

  return {
    photos,
    isLoading,
    isStorageAvailable: isStorageSupported,
    error,
    savePhoto,
    deletePhoto,
    clearAllPhotos,
    storageInfo,
    refreshPhotos,
  };
};
