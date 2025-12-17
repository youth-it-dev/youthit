/**
 * @description Auth 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post, del } from "@/lib/axios";
import type * as Types from "@/types/generated/auth-types";

export const deleteAuthDeleteAccount = (
  request: Types.TDELETEAuthDeleteAccountReq
) => {
  return del<Types.TDELETEAuthDeleteAccountRes>(`/auth/delete-account`, {
    data: request.data ?? request,
  });
};

export const postAuthLogout = () => {
  return post<Types.TPOSTAuthLogoutRes>(`/auth/logout`);
};

export const getAuthVerify = () => {
  return get<Types.TGETAuthVerifyRes>(`/auth/verify`);
};
