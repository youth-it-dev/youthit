import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { onAuthStateChanged } from "firebase/auth";
import { AXIOS_INSTANCE_TIME_OUT } from "@/constants/shared/_axios";
import { triggerSuspensionDialog } from "@/contexts/shared/suspension-dialog";
import { LINK_URL } from "@/constants/shared/_link-url";
import { isPublicRoute } from "@/utils/auth/is-public-route";
import { auth } from "./firebase";

const getBaseURL = () => {
  return "/api-proxy";
};

/**
 * @description Firebase Auth 초기화 대기 함수
 * 새로고침 시 Firebase Auth가 완전히 초기화되기 전에 API 요청이 나가는 것을 방지
 */
let authInitialized = false;
let authInitPromise: Promise<void> | null = null;

const waitForAuthInit = (): Promise<void> => {
  // 이미 초기화되었으면 즉시 반환
  if (authInitialized) {
    return Promise.resolve();
  }

  // auth.currentUser가 이미 있으면 즉시 초기화 완료로 처리
  if (auth.currentUser !== null) {
    authInitialized = true;
    return Promise.resolve();
  }

  // 이미 초기화 대기 중이면 같은 Promise 반환
  if (authInitPromise) {
    return authInitPromise;
  }

  // Auth 초기화 대기 Promise 생성
  // onAuthStateChanged는 Firebase SDK가 이미 초기화된 경우 즉시 현재 상태를 반환
  authInitPromise = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      authInitialized = true;
      unsubscribe();
      resolve();
    });
  });

  return authInitPromise;
};

/**
 * @description axios api instance
 * Next.js rewrites를 통해 /api-proxy -> 백엔드 HTTP로 프록시
 */
const instance = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // 쿠키 포함
  headers: {
    "Content-Type": "application/json",
    _retry: "0",
  },
  timeout: AXIOS_INSTANCE_TIME_OUT,
});

// api 요청 시 accessToken 있는지 확인해서, authorization header에 첨부
instance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Firebase Auth 초기화 대기 (새로고침 시 Auth 초기화 전에 요청이 나가는 것을 방지)
    await waitForAuthInit();

    const user = auth.currentUser;
    if (user) {
      // getIdToken()이 자동으로 만료 체크 + 갱신
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => {
    // response.data는 Result<TData> = { status: 200, data: TData } 형태
    // response.data.data가 실제 데이터이므로 이를 반환
    if (
      response.data &&
      typeof response.data === "object" &&
      "data" in response.data
    ) {
      return {
        ...response,
        data: response.data.data,
      };
    }
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;

    // 401 에러 발생 시 로그인 화면으로 리다이렉트
    if (status === 401) {
      // Firebase Auth 초기화 대기 후 다시 확인
      // (새로고침 시 Auth가 아직 초기화되지 않아 일시적으로 currentUser가 null일 수 있음)
      waitForAuthInit().then(() => {
        const user = auth.currentUser;
        if (!user && typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          // 공개 경로이거나 로그인 페이지인 경우 리다이렉트하지 않음
          const isCurrentPathPublic = isPublicRoute(currentPath);
          if (currentPath !== LINK_URL.LOGIN && !isCurrentPathPublic) {
            window.location.replace(LINK_URL.LOGIN);
          }
        }
      });
    }

    // 423 에러 발생 시 자격정지 다이얼로그 표시
    if (status === 423) {
      // 브라우저/PWA 환경에서 다이얼로그 표시
      triggerSuspensionDialog();
    }

    return Promise.reject(error);
  }
);

export const get = <T>(...args: Parameters<typeof instance.get>) => {
  return instance.get<T, AxiosResponse<T>>(...args);
};

export const post = <T>(...args: Parameters<typeof instance.post>) => {
  return instance.post<T, AxiosResponse<T>>(...args);
};

export const put = <T>(...args: Parameters<typeof instance.put>) => {
  return instance.put<T, AxiosResponse<T>>(...args);
};

export const patch = <T>(...args: Parameters<typeof instance.patch>) => {
  return instance.patch<T, AxiosResponse<T>>(...args);
};

export const del = <T>(...args: Parameters<typeof instance.delete>) => {
  return instance.delete<T, AxiosResponse<T>>(...args);
};
