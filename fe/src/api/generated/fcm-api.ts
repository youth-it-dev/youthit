/**
 * @description FCM 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post, del } from "@/lib/axios";
import type * as Types from "@/types/generated/fcm-types";

export const postFcmToken = (request: Types.TPOSTFcmTokenReq) => {
  return post<Types.TPOSTFcmTokenRes>(`/fcm/token`, request.data ?? request);
};

export const deleteFcmTokenById = (request: Types.TDELETEFcmTokenByIdReq) => {
  return del<Types.TDELETEFcmTokenByIdRes>(`/fcm/token/${request.deviceId}`);
};

export const getFcmTokens = () => {
  return get<Types.TGETFcmTokensRes>(`/fcm/tokens`);
};
