import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/users-api";
import type * as Types from "@/types/generated/users-types";
import { getFCMToken } from "./useFCM";

/**
 * @description 푸시 알림 설정 토글 훅 (FCM 토큰 자동 포함)
 * - FCM 토큰을 자동으로 가져와서 요청 바디에 추가
 */
export const usePostUsersMePushNotificationToggleWithToken = <
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof Api.postUsersMePushNotificationToggle>>,
      Error,
      void,
      TContext
    >,
    "mutationFn"
  >
) => {
  return useMutation<
    Awaited<ReturnType<typeof Api.postUsersMePushNotificationToggle>>,
    Error,
    void,
    TContext
  >({
    mutationFn: async () => {
      // FCM 토큰 가져오기 (필수)
      const tokenResult = await getFCMToken();
      if (!tokenResult.token) {
        throw new Error("FCM 토큰을 가져올 수 없습니다.");
      }

      const request: Types.TPOSTUsersMePushNotificationToggleReq = {
        data: {
          token: tokenResult.token,
        },
      };

      return Api.postUsersMePushNotificationToggle(request);
    },
    ...options,
  });
};
