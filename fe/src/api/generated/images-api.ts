/**
 * @description Images 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { post } from "@/lib/axios";
import type * as Types from "@/types/generated/images-types";

export const postImagesUploadImage = (formData: FormData) => {
  return post<Types.TPOSTImagesUploadImageRes>(
    `/images/upload-image`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};
