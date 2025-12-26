import {
  DB_CONFIG,
  STORAGE_LIMITS,
  STORE_CONFIG,
} from "@/constants/shared/_photo-storage";
import type { StoredPhoto } from "@/types/shared/_photo-storage-types";
import { debug } from "@/utils/shared/debugger";

/**
 * IndexedDB 데이터베이스 연결 및 초기화
 */
class MissionPhotoDB {
  private db: IDBDatabase | null = null;

  /**
   * 데이터베이스 초기화
   */
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

      request.onerror = () => {
        debug.error("IndexedDB 초기화 실패:", request.error);
        reject(new Error("IndexedDB를 초기화할 수 없습니다"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("IndexedDB 초기화 성공");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 기존 스토어가 있다면 삭제
        if (db.objectStoreNames.contains(DB_CONFIG.STORE_NAME)) {
          db.deleteObjectStore(DB_CONFIG.STORE_NAME);
        }

        // 새 스토어 생성
        const store = db.createObjectStore(DB_CONFIG.STORE_NAME, {
          keyPath: STORE_CONFIG.keyPath,
        });

        // 인덱스 생성
        STORE_CONFIG.indexes.forEach(({ name, keyPath, options }) => {
          store.createIndex(name, keyPath, options);
        });

        debug.log("IndexedDB 스토어 생성 완료");
      };
    });
  }

  /**
   * 데이터베이스 인스턴스 가져오기
   */
  private getDB(): IDBDatabase {
    if (!this.db) {
      throw new Error("데이터베이스가 초기화되지 않았습니다");
    }
    return this.db;
  }

  /**
   * 트랜잭션 생성
   */
  private createTransaction(
    mode: IDBTransactionMode = "readonly"
  ): IDBTransaction {
    const db = this.getDB();
    return db.transaction([DB_CONFIG.STORE_NAME], mode);
  }

  /**
   * 모든 사진 가져오기
   */
  getAllPhotos(): Promise<StoredPhoto[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction("readonly");
      const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const photos = request.result as StoredPhoto[];
        resolve(photos);
      };

      request.onerror = () => {
        debug.error("사진 조회 실패:", request.error);
        reject(new Error("사진을 불러올 수 없습니다"));
      };
    });
  }

  /**
   * 특정 사진 가져오기
   */
  getPhoto(id: string): Promise<StoredPhoto | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction("readonly");
      const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        debug.error("사진 조회 실패:", request.error);
        reject(new Error("사진을 불러올 수 없습니다"));
      };
    });
  }

  /**
   * 사진 저장
   */
  savePhoto(photo: StoredPhoto): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // 저장 제한 확인 및 정리
        await this.cleanupOldPhotos();

        const transaction = this.createTransaction("readwrite");
        const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
        const request = store.put(photo);

        request.onsuccess = () => {
          debug.log(`사진 저장 완료: ${photo.id}`);
          resolve();
        };

        request.onerror = () => {
          debug.error("사진 저장 실패:", request.error);
          reject(new Error("사진을 저장할 수 없습니다"));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 사진 삭제
   */
  deletePhoto(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction("readwrite");
      const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        debug.log(`사진 삭제 완료: ${id}`);
        resolve();
      };

      request.onerror = () => {
        debug.error("사진 삭제 실패:", request.error);
        reject(new Error("사진을 삭제할 수 없습니다"));
      };
    });
  }

  /**
   * 오래된 사진 정리 (2일 이상 된 사진 삭제)
   */
  cleanupOldPhotos(): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - STORAGE_LIMITS.RETENTION_MS;

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction("readwrite");
      const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
      const index = store.index("timestamp");
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            debug.log(`오래된 사진 ${deletedCount}장 삭제 완료`);
          }
          resolve();
        }
      };

      request.onerror = () => {
        debug.error("오래된 사진 정리 실패:", request.error);
        reject(new Error("오래된 사진을 정리할 수 없습니다"));
      };
    });
  }

  /**
   * 저장된 사진 개수 확인 및 제한
   */
  async enforceStorageLimit(): Promise<void> {
    const photos = await this.getAllPhotos();

    if (photos.length >= STORAGE_LIMITS.MAX_PHOTOS) {
      // 가장 오래된 사진부터 삭제
      const sortedPhotos = photos.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = sortedPhotos.slice(
        0,
        photos.length - STORAGE_LIMITS.MAX_PHOTOS + 1
      );

      for (const photo of toDelete) {
        await this.deletePhoto(photo.id);
      }

      debug.log(`저장 제한 초과로 ${toDelete.length}장 삭제`);
    }
  }

  /**
   * 저장소 정보 조회
   */
  async getStorageInfo(): Promise<{
    totalPhotos: number;
    totalSize: number;
    oldestPhoto?: number;
    newestPhoto?: number;
  }> {
    const photos = await this.getAllPhotos();

    const info = {
      totalPhotos: photos.length,
      totalSize: photos.reduce((sum, photo) => sum + photo.size, 0),
      oldestPhoto:
        photos.length > 0
          ? Math.min(...photos.map((p) => p.timestamp))
          : undefined,
      newestPhoto:
        photos.length > 0
          ? Math.max(...photos.map((p) => p.timestamp))
          : undefined,
    };

    return info;
  }

  /**
   * 데이터베이스 닫기
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      debug.log("IndexedDB 연결 종료");
    }
  }
}

// 싱글톤 인스턴스
let dbInstance: MissionPhotoDB | null = null;

/**
 * MissionPhotoDB 인스턴스 가져오기
 */
export const getMissionPhotoDB = async (): Promise<MissionPhotoDB> => {
  if (!dbInstance) {
    dbInstance = new MissionPhotoDB();
    await dbInstance.init();
  }
  return dbInstance;
};

/**
 * IndexedDB 지원 여부 확인
 */
export const isIndexedDBSupported = (): boolean => {
  return typeof indexedDB !== "undefined";
};

/**
 * 저장소 사용 가능 여부 확인
 */
export const isStorageAvailable = async (): Promise<boolean> => {
  try {
    if (!isIndexedDBSupported()) {
      return false;
    }

    const db = await getMissionPhotoDB();
    await db.getAllPhotos();
    return true;
  } catch (error) {
    debug.error("저장소 사용 불가:", error);
    return false;
  }
};
