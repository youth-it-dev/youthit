import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/users-api";
import type * as Types from "@/types/generated/users-types";
import { getFCMToken } from "./useFCM";

/**
 * @description 사용자 정보 조회 훅 (FCM 토큰 자동 포함)
 * - FCM 토큰을 자동으로 가져와서 쿼리 파라미터에 추가
 * - pushTermsAgreed 조회를 위해 사용
 */
export const useGetUsersMeWithToken = <TData = Types.TGETUsersMeRes>(
  options?: Omit<
    UseQueryOptions<Types.TGETUsersMeRes, Error, TData>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<Types.TGETUsersMeRes, Error, TData>({
    queryKey: ["users", "getUsersMe", "withToken"],
    queryFn: async () => {
      // FCM 토큰 가져오기 (없으면 undefined)
      const tokenResult = await getFCMToken();
      const token = tokenResult.token || undefined;

      const request: Types.TGETUsersMeReq = token ? { token } : {};

      const response = await Api.getUsersMe(request);
      return response.data;
    },
    ...options,
  });
};
