import { useMutation } from "@tanstack/react-query";
import { fcmApi } from "@/api/fcm";
import { fcmKeys } from "@/constants/shared/_fcm-query-keys";
import { FCMTokenRequest, FCMTokenResponse } from "@/types/shared/fcm";
import { Result } from "@/types/shared/response";
import { debug } from "@/utils/shared/debugger";

/**
 * @description FCM 토큰 저장 Mutation 훅
 */
export const useSaveFCMToken = () =>
  useMutation<Result<FCMTokenResponse>, unknown, FCMTokenRequest>({
    mutationFn: async (variables) => {
      debug.log("[FCM] saveToken 요청 시작", variables);
      try {
        const result = await fcmApi.saveToken(variables);
        debug.log("[FCM] saveToken 성공", result);
        return result;
      } catch (error) {
        debug.error("[FCM] saveToken 실패", error);
        throw error;
      }
    },
    mutationKey: fcmKeys.token(),
  });
