/**
 * @description Auth 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export interface TDELETEAuthDeleteAccountReq {
  data: {
    kakaoAccessToken?: string;
  };
}

export type TDELETEAuthDeleteAccountRes = {
  message?: string;
};

export type TPOSTAuthLogoutRes = {
  message?: string;
  revokedAt?: string;
};

export type TGETAuthVerifyRes = {
  message?: string;
  user?: {
    uid?: string;
    email?: string;
    emailVerified?: boolean;
  };
};
