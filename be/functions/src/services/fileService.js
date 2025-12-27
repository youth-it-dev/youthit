const {admin, db, FieldValue} = require("../config/database");
const {nanoid} = require("../utils/helpers");
const FirestoreService = require("./firestoreService");
const fileTypeFromBufferPromise = import("file-type").then((module) => module.fileTypeFromBuffer);
const sharp = require("sharp");

// 파일 형식 검증 관련 상수
const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "svg", "pdf", "heic", "heif", "heix", "avif", "bmp", "tiff", "tif", "ico"
];
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "application/pdf", "image/heic", "image/heif", "image/heix", "image/avif", "image/bmp", "image/tiff", "image/x-icon", "image/vnd.microsoft.icon"
];

const EXPECTED_EXTENSIONS_BY_MIME = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
  "application/pdf": ["pdf"],
  "image/heic": ["heic", "heif", "heix", "avif"],
  "image/heif": ["heic", "heif", "heix", "avif"],
  "image/heix": ["heic", "heif", "heix", "avif"],
  "image/avif": ["avif"],
  "image/bmp": ["bmp"],
  "image/tiff": ["tiff", "tif"],
  "image/x-icon": ["ico"],
  "image/vnd.microsoft.icon": ["ico"],
};

class FileService {
  constructor() {
    this.bucket = admin.storage().bucket();
    this.firestoreService = new FirestoreService("files");
  }

  /**
   * 파일 버퍼에서 실제 파일 타입을 검증합니다 (file-type 라이브러리 사용).
   * @param {Buffer} fileBuffer - 파일 버퍼
   * @param {string} filename - 파일명 (확장자 검증용)
   * @param {string} clientMimeType - 클라이언트가 제공한 MIME 타입
   * @returns {Promise<Object>} { isValid: boolean, detectedMimeType?: string, error?: string }
   */
  async validateFileTypeFromBuffer(fileBuffer, filename, clientMimeType) {
    try {
      if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        return { isValid: false, error: "유효한 파일 버퍼가 필요합니다" };
      }

      let fileType;
      try {
        const fileTypeFromBuffer = await fileTypeFromBufferPromise;
        fileType = await fileTypeFromBuffer(fileBuffer);
      } catch (fileTypeError) {
        console.error("file-type 라이브러리 사용 중 오류:", fileTypeError);
        return {
          isValid: false,
          error: `파일 타입 검증 중 오류가 발생했습니다: ${fileTypeError.message}`,
        };
      }

      const normalizedFilename = (filename || "").toLowerCase();
      const lastDotIndex = normalizedFilename.lastIndexOf(".");
      const fileExtension = lastDotIndex > 0 
        ? normalizedFilename.substring(lastDotIndex + 1)
        : null;

      if (!fileType) {
        if (fileExtension === "svg" || clientMimeType === "image/svg+xml") {
          try {
            const textStart = fileBuffer.toString("utf8", 0, Math.min(1024, fileBuffer.length));
            
            const svgPattern = /<svg[\s>]/i;
            const xmlPattern = /^\s*<\?xml/;
            
            if (svgPattern.test(textStart) || (xmlPattern.test(textStart) && svgPattern.test(textStart))) {
              if (textStart.includes("http://www.w3.org/2000/svg") || svgPattern.test(textStart)) {
                return {
                  isValid: true,
                  detectedMimeType: "image/svg+xml",
                };
              }
            }
          } catch (encodingError) {
            console.error("SVG 내용 파싱 중 인코딩 오류:", encodingError);
          }
        }

        return {
          isValid: false,
          error: "파일 타입을 확인할 수 없습니다. 지원되지 않는 파일 형식이거나 파일이 손상되었을 수 있습니다.",
        };
      }

      let detectedMimeType = fileType.mime;
      const detectedExtension = fileType.ext;

      if (fileExtension === "svg" && (detectedMimeType === "application/xml" || detectedMimeType === "text/xml")) {
        detectedMimeType = "image/svg+xml";
      }

      const normalizedDetectedMime = detectedMimeType.toLowerCase();
      const isAllowedMime = ALLOWED_MIME_TYPES.some(
        (allowed) => allowed.toLowerCase() === normalizedDetectedMime
      );

      if (!isAllowedMime) {
        return {
          isValid: false,
          detectedMimeType,
          error: `허용되지 않은 파일 형식입니다. 감지된 타입: ${detectedMimeType}`,
        };
      }

      if (fileExtension) {
        const normalizedExt = fileExtension.toLowerCase();
        const isAllowedExt = ALLOWED_EXTENSIONS.some(
          (allowed) => allowed.toLowerCase() === normalizedExt
        );

        if (!isAllowedExt) {
          return {
            isValid: false,
            detectedMimeType,
            error: `허용되지 않은 파일 확장자입니다. 확장자: ${fileExtension}, 감지된 타입: ${detectedMimeType}`,
          };
        }

        const expectedExts = EXPECTED_EXTENSIONS_BY_MIME[normalizedDetectedMime] || [];
        if (expectedExts.length > 0 && !expectedExts.includes(normalizedExt)) {
          return {
            isValid: false,
            detectedMimeType,
            error: `파일 확장자(${fileExtension})와 실제 파일 타입(${detectedMimeType})이 일치하지 않습니다.`,
          };
        }
      }

      if (clientMimeType) {
        const normalizedClientMime = clientMimeType.toLowerCase();
        const icoMimeTypes = ["image/vnd.microsoft.icon", "image/x-icon"];
        const isIcoFile = icoMimeTypes.includes(normalizedClientMime) && icoMimeTypes.includes(normalizedDetectedMime);
        
        const heifMimeTypes = ["image/heic", "image/heif", "image/heix", "image/avif"];
        const isHeifFile = heifMimeTypes.includes(normalizedClientMime) && heifMimeTypes.includes(normalizedDetectedMime);
        
        if (!isIcoFile && !isHeifFile && normalizedClientMime !== normalizedDetectedMime) {
          return {
            isValid: false,
            detectedMimeType,
            error: `제공된 MIME 타입(${clientMimeType})과 실제 파일 타입(${detectedMimeType})이 일치하지 않습니다.`,
          };
        }
      }

      return {
        isValid: true,
        detectedMimeType,
      };
    } catch (error) {
      console.error("파일 타입 검증 중 오류:", error);
      return {
        isValid: false,
        error: `파일 타입 검증 중 오류가 발생했습니다: ${error.message}`,
      };
    }
  }

  /**
   * 파일 확장자와 MIME 타입이 허용되는지 검증합니다.
   * @param {string} filename - 파일명
   * @param {string} mimeType - MIME 타입
   * @returns {Object} { isValid: boolean, error?: string }
   */
  validateFileType(filename, mimeType) {
    try {
      if (!filename) {
        return { isValid: false, error: "파일명이 없습니다" };
      }

      const normalizedFilename = filename.toLowerCase();
      const lastDotIndex = normalizedFilename.lastIndexOf(".");

      // 확장자가 없거나 숨김 파일인 경우
      if (lastDotIndex === -1 || lastDotIndex === 0) {
        return { isValid: false, error: "파일 확장자가 없습니다" };
      }

      const extension = normalizedFilename.substring(lastDotIndex + 1);
      const normalizedMimeType = (mimeType || "").toLowerCase();

      const isAllowedExt = ALLOWED_EXTENSIONS.includes(extension);
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(normalizedMimeType);

      // AND 조건: 확장자와 MIME 타입 모두 유효해야 통과
      if (!isAllowedExt || !isAllowedMime) {
        return {
          isValid: false,
          error: `허용되지 않은 파일 형식입니다. 확장자: ${extension}, MIME 타입: ${normalizedMimeType}`
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error("파일 형식 검증 중 오류:", error);
      return { isValid: false, error: "파일 형식 확인 중 오류가 발생했습니다" };
    }
  }

  /**
   * 파일 업로드 (버퍼 방식 - 안정적)
   * @param {Buffer} fileBuffer - 파일 버퍼
   * @param {string} fileName - 원본 파일명
   * @param {string} mimeType - MIME 타입
   * @param {string} folder - 업로드할 폴더 경로
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadFile(fileBuffer, fileName, mimeType, folder = "files", userId = null) {
    try {
      const bufferValidation = await this.validateFileTypeFromBuffer(
        fileBuffer,
        fileName,
        mimeType
      );

      if (!bufferValidation.isValid) {
        const error = new Error(bufferValidation.error);
        error.code = "INVALID_FILE_TYPE";
        throw error;
      }

      // 검증된 실제 MIME 타입 사용 (검증된 타입이 더 정확함)
      const validatedMimeType = bufferValidation.detectedMimeType || mimeType;

      const safeFileName = fileName
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .replace(/\s+/g, "_");

      const uniqueId = nanoid(12);
      const fileExtension = safeFileName.split(".").pop();
      const baseName = safeFileName.replace(/\.[^/.]+$/, "");
      
      const randomFolder = nanoid(12);
      const uniqueFileName = `${folder}/${randomFolder}/${baseName}_${uniqueId}.${fileExtension}`;

      const file = this.bucket.file(uniqueFileName);

      await file.save(fileBuffer, {
        metadata: {
          contentType: validatedMimeType,
          metadata: {
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userId || "anonymous",
          },
        },
        resumable: true,
        validation: true,
        public: true, 
      });

      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${uniqueFileName}`;

      return {
        success: true,
        data: {
          fileUrl: publicUrl,
          fileName: uniqueFileName,
          originalFileName: fileName,
          mimeType: validatedMimeType,
          size: fileBuffer.length,
          bucket: this.bucket.name,
          path: uniqueFileName,
        },
      };
    } catch (error) {
      console.error("File upload error:", error);
      if (error.code === "INVALID_FILE_TYPE") {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 파일 업로드 (스트림 방식 - 메모리 효율적, 큰 파일에 적합)
   * @param {Stream} fileStream - 파일 스트림
   * @param {string} fileName - 원본 파일명
   * @param {string} mimeType - MIME 타입
   * @param {string} folder - 업로드할 폴더 경로
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadFileStream(fileStream, fileName, mimeType, folder = "files", userId = null) {
    try {
      // 스트림을 버퍼로 완전히 읽어서 파일 타입 검증
      const collectStream = () => {
        return new Promise((resolveStream, rejectStream) => {
          const chunks = [];
          let totalSize = 0;

          fileStream.on("data", (chunk) => {
            chunks.push(chunk);
            totalSize += chunk.length;
          });

          fileStream.on("end", () => {
            resolveStream(Buffer.concat(chunks, totalSize));
          });

          fileStream.on("error", rejectStream);
        });
      };

      const fullBuffer = await collectStream();
      
      const bufferValidation = await this.validateFileTypeFromBuffer(
        fullBuffer,
        fileName,
        mimeType
      );

      if (!bufferValidation.isValid) {
        const error = new Error(bufferValidation.error);
        error.code = "INVALID_FILE_TYPE";
        throw error;
      }

      const validatedMimeType = bufferValidation.detectedMimeType || mimeType;

      const { Readable } = require("stream");
      const validatedStream = new Readable();
      validatedStream.push(fullBuffer);
      validatedStream.push(null);

      const safeFileName = fileName
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .replace(/\s+/g, "_");

      const uniqueId = nanoid(12);
      const fileExtension = safeFileName.split(".").pop();
      const baseName = safeFileName.replace(/\.[^/.]+$/, "");
      
      const randomFolder = nanoid(12);
      const uniqueFileName = `${folder}/${randomFolder}/${baseName}_${uniqueId}.${fileExtension}`;

      // 이미지 파일인지 확인 (썸네일 생성 대상)
      // SVG는 벡터 이미지, HEIC/HEIF는 sharp가 제대로 지원하지 않으므로 썸네일 생성 제외
      const isImageFile = validatedMimeType && validatedMimeType.startsWith("image/") && 
                         validatedMimeType !== "image/svg+xml" &&
                         validatedMimeType !== "image/heic" &&
                         validatedMimeType !== "image/heif" &&
                         validatedMimeType !== "image/heix";

      const file = this.bucket.file(uniqueFileName);

      const writeStream = file.createWriteStream({
        metadata: {
          contentType: validatedMimeType,
          metadata: {
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userId || "anonymous",
          },
        },
        resumable: true,
        validation: false,
        public: true,
      });

      let uploadedSize = 0;

      validatedStream.on("data", (chunk) => {
        uploadedSize += chunk.length;
      });

      validatedStream.pipe(writeStream);

      const uploadPromise = new Promise((resolve, reject) => {
        writeStream.on("error", (error) => {
          console.error("File upload stream error:", error);
          reject(new Error(`파일 업로드 중 오류가 발생했습니다: ${error.message}`));
        });

        writeStream.on("finish", async () => {
          try {
            const [meta] = await file.getMetadata();
            const actualSize = Number(meta.size) || uploadedSize;

            const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${uniqueFileName}`;

            const uploadResult = {
              fileUrl: publicUrl,
              fileName: uniqueFileName,
              originalFileName: fileName,
              mimeType: validatedMimeType,
              size: actualSize,
              bucket: this.bucket.name,
              path: uniqueFileName,
            };

            let originalFileDocId = null;
            try {
              const fileDocResult = await this.createFileDocument(
                {
                  filePath: uniqueFileName,
                  fileUrl: publicUrl,
                  originalFileName: fileName,
                  mimeType: validatedMimeType,
                  size: actualSize,
                },
                userId
              );
              originalFileDocId = fileDocResult.id;
              console.log(`[FILE_UPLOAD] 원본 파일 문서 생성 완료: ${originalFileDocId} (${uniqueFileName})`);
            } catch (docError) {
              console.error("파일 문서 생성 실패 (Storage 업로드는 성공):", docError);
              try {
                await file.delete();
              } catch (deleteError) {
                console.error("Storage 파일 롤백 실패:", deleteError);
              }
              reject(new Error(`파일 메타데이터 저장 중 오류가 발생했습니다: ${docError.message}`));
              return;
            }

            // 이미지 파일인 경우 썸네일 생성 및 업로드
            let thumbnailResult = null;
            if (isImageFile) {
              try {
                thumbnailResult = await this.createAndUploadThumbnail(
                  fullBuffer,
                  uniqueFileName,
                  validatedMimeType,
                  userId
                );
              } catch (thumbnailError) {
                // 썸네일 생성 실패해도 원본 업로드는 성공으로 처리 (로그만 남김)
                console.error(`썸네일 생성 실패 (원본 파일은 업로드됨): ${uniqueFileName}`, thumbnailError);
              }
            }

            // 응답에 썸네일 정보 포함 (있을 경우)
            if (thumbnailResult) {
              uploadResult.thumbnailUrl = thumbnailResult.fileUrl;
              uploadResult.thumbnailFileName = thumbnailResult.filePath;
              uploadResult.thumbnailSize = thumbnailResult.size;
            }

            resolve(uploadResult);
          } catch (error) {
            reject(error);
          }
        });

        validatedStream.on("error", (error) => {
          writeStream.destroy();
          reject(new Error(`파일 스트림 처리 중 오류가 발생했습니다: ${error.message}`));
        });
      });

      const uploadResult = await uploadPromise;

      return {
        success: true,
        data: uploadResult,
      };
    } catch (error) {
      console.error("File upload stream error:", error);
      if (error.code === "INVALID_FILE_TYPE") {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error.message || "파일 업로드 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 썸네일 생성 및 업로드
   * @param {Buffer} originalBuffer - 원본 이미지 버퍼
   * @param {string} originalFilePath - 원본 파일 경로
   * @param {string} mimeType - MIME 타입
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 썸네일 업로드 결과
   */
  async createAndUploadThumbnail(originalBuffer, originalFilePath, mimeType, userId) {
    try {
      // 썸네일 생성 (300x300, fit: inside, quality: 80)
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(300, 300, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 썸네일 파일 경로 생성
      // 첫 번째 폴더명을 "thumbnails"로 교체 (예: "files/user123/image.jpg" -> "thumbnails/user123/image.jpg")
      const pathParts = originalFilePath.split("/");
      const fileName = pathParts[pathParts.length - 1];
      if (pathParts.length > 1) {
        pathParts[0] = "thumbnails";
      }
      const thumbnailFileName = pathParts.join("/");

      // 썸네일 파일 업로드
      const thumbnailFile = this.bucket.file(thumbnailFileName);
      const thumbnailWriteStream = thumbnailFile.createWriteStream({
        metadata: {
          contentType: "image/jpeg",
          metadata: {
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userId || "anonymous",
          },
        },
        resumable: false,
        validation: false,
        public: true,
      });

      const thumbnailUploadPromise = new Promise((resolve, reject) => {
        thumbnailWriteStream.on("error", (error) => {
          console.error("썸네일 업로드 스트림 오류:", error);
          reject(new Error(`썸네일 업로드 중 오류가 발생했습니다: ${error.message}`));
        });

        thumbnailWriteStream.on("finish", async () => {
          try {
            const [meta] = await thumbnailFile.getMetadata();
            const thumbnailSize = Number(meta.size) || thumbnailBuffer.length;
            const thumbnailUrl = `https://storage.googleapis.com/${this.bucket.name}/${thumbnailFileName}`;

            // 썸네일 문서 생성
            const thumbnailDocResult = await this.createFileDocument(
              {
                filePath: thumbnailFileName,
                fileUrl: thumbnailUrl,
                originalFileName: fileName,
                mimeType: "image/jpeg",
                size: thumbnailSize,
                originalFilePath: originalFilePath, // 원본 파일 경로 연결
                isUsed: false, // 게시글 연결 시 true로 변경됨
              },
              userId
            );

            console.log(`[FILE_UPLOAD] 썸네일 파일 문서 생성 완료: ${thumbnailDocResult.id} (${thumbnailFileName})`);

            resolve({
              filePath: thumbnailFileName,
              fileUrl: thumbnailUrl,
              size: thumbnailSize,
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      thumbnailWriteStream.end(thumbnailBuffer);
      return await thumbnailUploadPromise;
    } catch (error) {
      console.error("썸네일 생성/업로드 오류:", error);
      throw error;
    }
  }

  /**
   * 여러 파일을 동시에 업로드 (병렬 처리)
   * @param {Array<Object>} files - [{ stream, fileName, mimeType }] 형식의 배열
   * @param {string} folder - 업로드할 폴더 경로
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadMultipleFiles(files, folder = "files", userId = null) {
    try {
      const uploadPromises = files.map((file) =>
        this.uploadFile(file.buffer, file.fileName, file.mimeType, folder, userId),
      );

      const results = await Promise.all(uploadPromises);

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      return {
        success: failed.length === 0,
        data: {
          uploaded: successful.length,
          failed: failed.length,
          files: successful.map((r) => r.data),
          errors: failed.length > 0 ? failed.map((r) => r.error) : [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 파일 존재 여부 확인
   * @param {string} fileName - Cloud Storage 내 파일명 (경로 포함)
   * @returns {Promise<boolean>} 파일 존재 여부
   */
  async fileExists(fileName) {
    try {
      const file = this.bucket.file(fileName);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error("File exists check error:", error);
      return false;
    }
  }

  /**
   * 여러 파일 존재 여부 확인 (병렬 처리)
   * @param {Array<string>} fileNames - 파일 경로 배열
   * @param {string} userId - 사용자 ID (옵션, 제공 시 소유권 검증)
   * @returns {Promise<Object>} 각 파일의 존재 여부 및 소유권 결과
   */
  async filesExist(fileNames, userId = null) {
    try {
      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        return {
          allExist: true,
          allOwned: true,
          results: {},
        };
      }

      const checkPromises = fileNames.map(async (fileName) => {
        const exists = await this.fileExists(fileName);
        let owned = false;

        // userId가 제공되고 파일이 존재하는 경우 소유권 검증
        if (userId && exists) {
          try {
            const file = this.bucket.file(fileName);
            const [metadata] = await file.getMetadata();
            const uploadedBy = metadata?.metadata?.uploadedBy;
            owned = uploadedBy === userId;
          } catch (error) {
            console.error(`File ownership check error for ${fileName}:`, error);
            owned = false;
          }
        }

        return {fileName, exists, owned: userId ? owned : exists};
      });

      const results = await Promise.all(checkPromises);
      const resultsMap = {};
      let allExist = true;
      let allOwned = true;

      results.forEach(({fileName, exists, owned}) => {
        resultsMap[fileName] = userId ? owned : exists;
        if (!exists) {
          allExist = false;
        }
        if (userId && !owned) {
          allOwned = false;
        }
      });

      return {
        allExist,
        allOwned: userId ? allOwned : allExist,
        results: resultsMap,
      };
    } catch (error) {
      console.error("Files exist check error:", error);
      return {
        allExist: false,
        allOwned: false,
        results: {},
      };
    }
  }

  /**
   * Firestore files 컬렉션에 파일 문서 생성
   * @param {Object} fileData - 파일 데이터
   * @param {string} fileData.filePath - 파일 경로 (Storage 경로)
   * @param {string} fileData.fileUrl - 파일 URL
   * @param {string} fileData.originalFileName - 원본 파일명
   * @param {string} fileData.mimeType - MIME 타입
   * @param {number} fileData.size - 파일 크기 (bytes)
   * @param {string} userId - 업로드한 사용자 ID
   * @returns {Promise<Object>} 생성된 문서 데이터
   */
  async createFileDocument(fileData, userId) {
    try {
      const {filePath, fileUrl, originalFileName, mimeType, size, originalFilePath, isUsed} = fileData;

      if (!filePath) {
        const error = new Error("파일 경로가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      const fileDoc = {
        filePath,
        fileUrl,
        originalFileName: originalFileName || filePath,
        mimeType: mimeType || "application/octet-stream",
        size: size || 0,
        uploadedBy: userId,
        attachedTo: null,
        isUsed: isUsed !== undefined ? isUsed : false,
        createdAt: FieldValue.serverTimestamp(),
      };

      // 썸네일인 경우 originalFilePath 추가
      if (originalFilePath) {
        fileDoc.originalFilePath = originalFilePath;
      }

      const result = await this.firestoreService.create(fileDoc);
      return result;
    } catch (error) {
      console.error("파일 문서 생성 오류:", error);
      if (error.code === "BAD_REQUEST" || error.code === "UNAUTHORIZED") {
        throw error;
      }
      const internalError = new Error("파일 문서 생성 중 오류가 발생했습니다");
      internalError.code = "INTERNAL";
      throw internalError;
    }
  }

  /**
   * 파일들을 게시글에 연결하기 전 검증 (게시글 생성 전 호출)
   * @param {Array<string>} filePaths - 파일 경로 배열
   * @param {string} userId - 요청한 사용자 ID (소유권 검증용)
   * @returns {Promise<Array<Object>>} 검증 통과한 파일 문서 배열
   */
  async validateFilesForPost(filePaths, userId) {
    try {
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return []; // 파일이 없으면 빈 배열 반환
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      // 1. 파일 조회 (병렬)
      const filePromises = filePaths.map(async (filePath) => {
        try {
          const files = await this.firestoreService.getWhere(
            "filePath",
            "==",
            filePath
          );
          
          if (!files || files.length === 0) {
            return {filePath, file: null, exists: false};
          }

          return {filePath, file: files[0], exists: true};
        } catch (error) {
          console.error(`파일 조회 오류 (${filePath}):`, error);
          return {filePath, file: null, exists: false};
        }
      });

      const fileResults = await Promise.all(filePromises);

      // 2. 파일 존재 여부 검증
      const missingFiles = fileResults
        .filter((result) => !result.exists)
        .map((result) => result.filePath);

      if (missingFiles.length > 0) {
        const error = new Error(`파일을 찾을 수 없습니다: ${missingFiles.join(", ")}`);
        error.code = "NOT_FOUND";
        throw error;
      }

      // 3. 소유권 검증
      const unauthorizedFiles = fileResults
        .filter((result) => result.file.uploadedBy !== userId)
        .map((result) => result.filePath);

      if (unauthorizedFiles.length > 0) {
        const error = new Error(`이 파일에 대한 권한이 없습니다: ${unauthorizedFiles.join(", ")}`);
        error.code = "FORBIDDEN";
        error.statusCode = 403;
        throw error;
      }

      // 4. 이미 다른 게시글에 연결된 파일 검증
      const alreadyAttachedFiles = fileResults
        .filter((result) => result.file.isUsed || result.file.attachedTo)
        .map((result) => result.filePath);

      if (alreadyAttachedFiles.length > 0) {
        const error = new Error(`이미 다른 게시글에 연결된 파일입니다: ${alreadyAttachedFiles.join(", ")}`);
        error.code = "CONFLICT";
        throw error;
      }
      
      const storageCheckPromises = fileResults.map(async (result) => {
        try {
          const exists = await this.fileExists(result.file.filePath);
          return {filePath: result.filePath, file: result.file, storageExists: exists};
        } catch (error) {
          console.error(`Storage 파일 존재 확인 오류 (${result.filePath}):`, error);
          return {filePath: result.filePath, file: result.file, storageExists: false};
        }
      });

      const storageResults = await Promise.all(storageCheckPromises);
      const missingStorageFiles = storageResults
        .filter((result) => !result.storageExists)
        .map((result) => result.filePath);

      if (missingStorageFiles.length > 0) {
        const error = new Error(`Storage 파일이 존재하지 않습니다: ${missingStorageFiles.join(", ")}`);
        error.code = "NOT_FOUND";
        throw error;
      }

      // 검증 통과한 파일 문서들 반환
      return storageResults.map((result) => result.file);
    } catch (error) {
      console.error("파일 검증 오류:", error);
      if (error.code === "UNAUTHORIZED" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN" || error.code === "CONFLICT") {
        throw error;
      }
      const internalError = new Error("파일 검증 중 오류가 발생했습니다");
      internalError.code = "INTERNAL";
      throw internalError;
    }
  }

  async validateFileForProfile(filePath, userId) {
    try {
      if (!filePath) {
        const error = new Error("파일 경로가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      const files = await this.firestoreService.getWhere(
        "filePath",
        "==",
        filePath
      );

      if (!files || files.length === 0) {
        const error = new Error("파일을 찾을 수 없습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      const fileDoc = files[0];

      if (fileDoc.uploadedBy !== userId) {
        const error = new Error("이 파일에 대한 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      if (fileDoc.profileOwner && fileDoc.profileOwner !== userId) {
        const error = new Error("다른 사용자의 프로필에서 사용 중인 파일입니다");
        error.code = "CONFLICT";
        throw error;
      }

      if (fileDoc.attachedTo) {
        const error = new Error("이미 다른 게시글에 연결된 파일입니다");
        error.code = "CONFLICT";
        throw error;
      }

      const existsInStorage = await this.fileExists(fileDoc.filePath);
      if (!existsInStorage) {
        const error = new Error("Storage 파일이 존재하지 않습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      return fileDoc;
    } catch (error) {
      console.error("프로필 파일 검증 오류:", error);
      if (error.code === "BAD_REQUEST" || error.code === "UNAUTHORIZED" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN" || error.code === "CONFLICT") {
        throw error;
      }
      const internalError = new Error("프로필 파일 검증 중 오류가 발생했습니다");
      internalError.code = "INTERNAL";
      throw internalError;
    }
  }

  /**
   * 파일 URL로 파일 문서 조회 및 소유권 검증
   * @param {string} fileUrl - 파일 퍼블릭 URL
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 파일 문서
   */
  async getFileByUrlForUser(fileUrl, userId) {
    try {
      if (!fileUrl) {
        const error = new Error("파일 URL이 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      const normalizedUrl = fileUrl.trim();
      if (!normalizedUrl) {
        const error = new Error("파일 URL이 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const files = await this.firestoreService.getWhere(
        "fileUrl",
        "==",
        normalizedUrl
      );

      if (!files || files.length === 0) {
        const error = new Error("파일을 찾을 수 없습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      const fileDoc = files.find((file) => file.uploadedBy === userId);
      if (!fileDoc) {
        const error = new Error("이 파일에 대한 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      if (fileDoc.profileOwner && fileDoc.profileOwner !== userId) {
        const error = new Error("다른 사용자의 프로필에서 사용 중인 파일입니다");
        error.code = "CONFLICT";
        throw error;
      }

      if (fileDoc.attachedTo) {
        const error = new Error("이미 다른 게시글에 연결된 파일입니다");
        error.code = "CONFLICT";
        throw error;
      }

      const existsInStorage = await this.fileExists(fileDoc.filePath);
      if (!existsInStorage) {
        const error = new Error("Storage 파일이 존재하지 않습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      return fileDoc;
    } catch (error) {
      console.error("파일 URL 조회 오류:", error);
      if (error.code === "BAD_REQUEST" || error.code === "UNAUTHORIZED" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN" || error.code === "CONFLICT") {
        throw error;
      }
      const internalError = new Error("파일 URL 조회 중 오류가 발생했습니다");
      internalError.code = "INTERNAL";
      throw internalError;
    }
  }

  /**
   * 파일들을 게시글에 연결 (트랜잭션 내에서 사용)
   * @param {Array<Object>} validatedFiles - 검증된 파일 문서 배열 (validateFilesForPost 결과)
   * @param {string} postId - 게시글 ID
   * @param {Function} transaction - Firestore transaction 객체
   * @returns {void}
   */
  attachFilesToPostInTransaction(validatedFiles, postId, transaction) {
    if (!validatedFiles || validatedFiles.length === 0) {
      return; // 파일이 없으면 아무것도 하지 않음
    }

    if (!postId) {
      const error = new Error("게시글 ID가 필요합니다");
      error.code = "BAD_REQUEST";
      throw error;
    }

    validatedFiles.forEach((file) => {
      const fileRef = db.collection("files").doc(file.id);
      transaction.update(fileRef, {
        attachedTo: postId,
        isUsed: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  /**
   * 원본 파일 경로 배열로 썸네일 파일 찾기
   * @param {Array<string>} originalFilePaths - 원본 파일 경로 배열
   * @returns {Promise<Array<Object>>} 썸네일 파일 문서 배열
   */
  async findThumbnailsByOriginalPaths(originalFilePaths) {
    if (!Array.isArray(originalFilePaths) || originalFilePaths.length === 0) {
      return [];
    }

    try {
      const thumbnailPromises = originalFilePaths.map(async (originalPath) => {
        try {
          const thumbnails = await this.firestoreService.getWhere(
            "originalFilePath",
            "==",
            originalPath
          );
          
          // 첫 번째 썸네일만 반환 (일반적으로 1개)
          return thumbnails && thumbnails.length > 0 ? thumbnails[0] : null;
        } catch (error) {
          console.error(`썸네일 조회 실패 (originalPath: ${originalPath}):`, error);
          return null;
        }
      });

      const thumbnails = await Promise.all(thumbnailPromises);
      return thumbnails.filter(thumbnail => thumbnail !== null);
    } catch (error) {
      console.error("썸네일 조회 중 오류:", error);
      return [];
    }
  }

  /**
   * 썸네일 파일들을 게시글에 연결 (isUsed만 업데이트)
   * @param {Array<Object>} thumbnailFiles - 썸네일 파일 문서 배열
   * @param {string} postId - 게시글 ID
   * @param {Object} transaction - Firestore 트랜잭션
   */
  attachThumbnailsToPostInTransaction(thumbnailFiles, postId, transaction) {
    if (!thumbnailFiles || thumbnailFiles.length === 0) {
      return;
    }

    if (!postId) {
      const error = new Error("게시글 ID가 필요합니다");
      error.code = "BAD_REQUEST";
      throw error;
    }

    thumbnailFiles.forEach((thumbnailFile) => {
      const thumbnailRef = db.collection("files").doc(thumbnailFile.id);
      transaction.update(thumbnailRef, {
        isUsed: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  /**
   * 파일 삭제
   * @param {string} fileName - Cloud Storage 내 파일명 (경로 포함)
   * @param {string} userId - 요청한 사용자 ID (소유자 확인용)
   * @returns {Promise<Object>} 삭제 결과
   */
  async deleteFile(fileName, userId = null) {
    try {
      const file = this.bucket.file(fileName);

      const [exists] = await file.exists();
      if (!exists) {
        const error = new Error("파일을 찾을 수 없습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      // userId가 없으면 삭제 불가 (보안상 필수)
      if (!userId) {
        const error = new Error("파일 삭제를 위해서는 사용자 인증이 필요합니다");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      // 메타데이터에서 소유자 확인
      const [metadata] = await file.getMetadata();
      const uploadedBy = metadata?.metadata?.uploadedBy;
      
      if (!uploadedBy) {
        const error = new Error("파일 소유자 정보를 찾을 수 없어 삭제할 수 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }
      
      if (uploadedBy !== userId) {
        const error = new Error("이 파일을 삭제할 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      await file.delete();

      // Firestore files 컬렉션 문서도 삭제
      try {
        const files = await this.firestoreService.getWhere(
          "filePath",
          "==",
          fileName
        );
        
        if (files && files.length > 0) {
          // filePath로 찾은 문서들 삭제 (일반적으로 1개지만 안전을 위해)
          for (const fileDoc of files) {
            await this.firestoreService.delete(fileDoc.id);
          }
        }
      } catch (firestoreError) {
        console.error("Firestore 파일 문서 삭제 실패 (Storage 파일은 삭제됨):", firestoreError);
        const error = new Error("파일은 삭제되었으나 메타데이터 정리에 실패했습니다");
        error.code = "PARTIAL_SUCCESS";
        throw error;
      }

      return { success: true };
    } catch (error) {
      // 이미 에러 객체에 code가 있으면 그대로 재throw
      if (error.code === "NOT_FOUND" || error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN" || error.code === "PARTIAL_SUCCESS") {
        throw error;
      }

      // 예상치 못한 에러
      if (error.code === 404) {
        const notFoundError = new Error("파일을 찾을 수 없습니다");
        notFoundError.code = "NOT_FOUND";
        throw notFoundError;
      }

      const internalError = new Error("파일 삭제 중 오류가 발생했습니다");
      internalError.code = "INTERNAL";
      throw internalError;
    }
  }
}

module.exports = new FileService();

