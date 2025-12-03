const {
  KAKAO_API_TIMEOUT,
  KAKAO_API_RETRY_DELAY,
  KAKAO_API_MAX_RETRIES,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  ERROR_CODE_KAKAO_API_FAILED,
  ERROR_CODE_KAKAO_API_TIMEOUT,
} = require("../constants/kakaoConstants");

/**
 * URL에서 민감한 쿼리 파라미터 값을 마스킹
 * @param {string} urlString - 원본 URL
 * @return {string} 마스킹된 URL
 */
function sanitizeUrl(urlString) {
  try {
    const urlObj = new URL(urlString);
    const sanitized = urlObj.origin + urlObj.pathname;
    
    // 쿼리 파라미터가 있으면 키는 유지하되 값은 마스킹
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      const maskedParams = [];
      for (const [key] of params) {
        maskedParams.push(`${key}=****`);
      }
      return sanitized + (maskedParams.length > 0 ? "?" + maskedParams.join("&") : "");
    }
    
    return sanitized;
  } catch (error) {
    // URL 파싱 실패 시 안전하게 처리
    return "[invalid URL]";
  }
}

/**
 * 카카오 API 호출 헬퍼 (타임아웃, 재시도, 에러 핸들링)
 * 
 * @param {string} url - 카카오 API URL
 * @param {string} accessToken - 카카오 액세스 토큰
 * @param {Object} options - 옵션
 * @param {number} [options.maxRetries] - 최대 재시도 횟수 (기본값: KAKAO_API_MAX_RETRIES)
 * @param {number} [options.retryDelay] - 재시도 지연 시간 (기본값: KAKAO_API_RETRY_DELAY)
 * @param {number} [options.timeout] - 타임아웃 시간 (기본값: KAKAO_API_TIMEOUT)
 * @param {boolean} [options.throwOnError] - 에러 발생 시 throw 여부 (기본값: true, false일 경우 null 반환)
 * @param {string} [options.serviceName] - 로그용 서비스명 (기본값: "KakaoAPI")
 * @return {Promise<Response|null>} fetch Response 객체 또는 null (throwOnError=false일 때)
 */
async function fetchKakaoAPI(url, accessToken, options = {}) {
  const {
    method = "GET",
    body = null,
    maxRetries = KAKAO_API_MAX_RETRIES,
    retryDelay = KAKAO_API_RETRY_DELAY,
    timeout = KAKAO_API_TIMEOUT,
    throwOnError = true,
    serviceName = "KakaoAPI",
  } = options;

  // URL 민감 정보 마스킹 (로그용)
  const sanitizedUrl = sanitizeUrl(url);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let timeoutId = null;

    try {
      // 타임아웃 설정
      timeoutId = setTimeout(() => controller.abort(), timeout);

      console.log(`[${serviceName}] 카카오 API 호출 시도 ${attempt}/${maxRetries}: ${method} ${sanitizedUrl}`);

      // fetch 옵션 구성
      const fetchOptions = {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      };

      // POST 요청일 때 Content-Type과 body 추가
      if (method === "POST" && body) {
        fetchOptions.headers["Content-Type"] = "application/x-www-form-urlencoded;charset=utf-8";
        fetchOptions.body = body;
      }

      // fetch 호출
      const response = await fetch(url, fetchOptions);

      // 성공
      if (response.ok) {
        console.log(`[${serviceName}] 카카오 API 성공 (${attempt}번째 시도)`);
        return response;
      }

      // 401/403은 토큰 활성화 지연 가능성 → 재시도
      if ((response.status === HTTP_STATUS_UNAUTHORIZED || response.status === HTTP_STATUS_FORBIDDEN) && attempt < maxRetries) {
        console.warn(`[${serviceName}] 카카오 API ${response.status}, ${retryDelay}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // 그 외 에러 처리
      if (throwOnError) {
        // 응답 body 길이만 로깅 (민감 정보 노출 방지)
        const contentLength = response.headers.get("content-length") || "unknown";
        console.error(`[${serviceName}] 카카오 API 실패: ${response.status} (response size: ${contentLength} bytes)`);
        const e = new Error(`카카오 API 호출 실패 (${response.status})`);
        e.code = ERROR_CODE_KAKAO_API_FAILED;
        throw e;
      } else {
        console.warn(`[${serviceName}] 카카오 API 실패: ${response.status} (null 반환)`);
        return null;
      }

    } catch (fetchError) {
      // 타임아웃
      if (fetchError.name === "AbortError") {
        if (attempt < maxRetries) {
          console.warn(`[${serviceName}] 카카오 API 타임아웃, 재시도 ${attempt}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        if (throwOnError) {
          const e = new Error(`카카오 서버 응답 시간 초과 (${timeout}ms)`);
          e.code = ERROR_CODE_KAKAO_API_TIMEOUT;
          throw e;
        } else {
          console.warn(`[${serviceName}] 카카오 API 타임아웃 (모든 재시도 소진, null 반환)`);
          return null;
        }
      }

      // 이미 생성된 에러 (throwOnError=true일 때)
      if (fetchError.code) {
        throw fetchError;
      }

      // 네트워크 에러 등
      if (attempt < maxRetries) {
        console.warn(`[${serviceName}] 카카오 API 네트워크 에러, 재시도 ${attempt}/${maxRetries}:`, fetchError.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      if (throwOnError) {
        console.error(`[${serviceName}] 카카오 API 호출 실패 (모든 재시도 소진):`, fetchError);
        const e = new Error("카카오 API 호출 실패: 네트워크 오류");
        e.code = ERROR_CODE_KAKAO_API_FAILED;
        throw e;
      } else {
        console.warn(`[${serviceName}] 카카오 API 호출 실패 (null 반환):`, fetchError.message);
        return null;
      }
    } finally {
      // 타임아웃 타이머 정리 (메모리 누수 방지)
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  // 루프 종료 시 (정상적으로는 도달하지 않음)
  return null;
}

module.exports = {
  fetchKakaoAPI,
};

