/**
 * @description Files 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { post, del } from "@/lib/axios";
import type * as Types from "@/types/generated/files-types";

export const deleteFilesById = (request: Types.TDELETEFilesByIdReq) => {
  return del<any>(`/files/${request.filePath}`);
};

export const postFilesUploadMultiple = (formData: FormData) => {
  return post<Types.TPOSTFilesUploadMultipleRes>(
    `/files/upload-multiple`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};
