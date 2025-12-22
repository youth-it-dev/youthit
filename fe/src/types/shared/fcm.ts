/**
 * @description FCM 토큰 관련 타입 정의
 */

/** 디바이스 타입 */
export type DeviceType = "pwa" | "mobile" | "web";

/** FCM 토큰 저장 요청 */
export interface FCMTokenRequest {
  token: string;
  deviceInfo?: string;
  deviceType?: DeviceType;
}

/** FCM 토큰 저장 응답 */
export interface FCMTokenResponse {
  deviceId: string;
  message: string;
}

/** FCM 토큰 정보 */
export interface FCMTokenInfo {
  id: string;
  token: string;
  deviceType: DeviceType;
  deviceInfo: string;
  lastUsed: string;
  createdAt: string;
}

/** FCM 토큰 목록 조회 응답 */
export interface FCMTokenListResponse {
  tokens: FCMTokenInfo[];
}

/** 알림 권한 상태 */
export type NotificationPermission = "default" | "granted" | "denied";

/** FCM 토큰 발급 결과 */
export interface FCMTokenResult {
  token: string | null;
  error?: string;
}
