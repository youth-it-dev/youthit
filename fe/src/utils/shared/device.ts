type NavigatorWithStandalone = Navigator & { standalone?: boolean };

/**
 * @description iOS 기기인지 확인
 * iPadOS 13+ 감지: navigator.platform 대신 userAgent 기반 감지 사용
 * - navigator.userAgentData.platform 우선 사용 (최신 브라우저, Chrome 101+, Edge 101+)
 * - userAgent에 "Mac OS X" 또는 "MacOS" 포함 + maxTouchPoints > 1 (iPadOS 13+)
 * - 폴백: navigator.platform 사용 (deprecated이지만 구 버전 브라우저 대응)
 * @returns {boolean} iOS 기기인 경우 true
 */
export const isIOSDevice = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent?.toLowerCase() || "";

  // 1. 기본 iOS 기기 감지 (iPhone, iPad, iPod)
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return true;
  }

  // 2. iPadOS 13+ 감지 (MacIntel로 감지되는 경우)
  // navigator.userAgentData.platform 우선 사용 (최신 브라우저)
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    navigatorWithUserAgentData.userAgentData?.platform?.toLowerCase() ||
    navigator.platform?.toLowerCase() ||
    "";

  // iPadOS 13+는 userAgent에 "Mac OS X" 또는 "MacOS"가 포함되고
  // maxTouchPoints > 1인 경우
  const isMacOSInUserAgent = /mac os x|macos/.test(userAgent);
  const hasMultipleTouchPoints =
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  // iPadOS 13+ 감지: MacOS userAgent + 터치 포인트
  // 또는 navigator.userAgentData.platform이 "macos"이고 터치 포인트가 있는 경우
  if (
    (isMacOSInUserAgent || platform === "macos" || platform === "macintel") &&
    hasMultipleTouchPoints
  ) {
    return true;
  }

  return false;
};

/**
 * @description PWA가 standalone 모드로 설치되어 있는지 확인
 * iOS Safari PWA: navigator.standalone === true (iOS 2.1+ 지원, 구 버전 대응)
 * Android Chrome PWA: matchMedia("(display-mode: standalone)") (Chrome 69+ 지원)
 * 삼성 브라우저 PWA: matchMedia("(display-mode: standalone)") (Samsung Internet 7.2+ 지원)
 * iOS Chrome (CriOS): matchMedia("(display-mode: standalone)") (iOS 18.2+ 기본 브라우저 변경 지원)
 * 구 버전 브라우저: matchMedia 미지원 시 false 반환 (안전한 폴백)
 * @returns {boolean} standalone 모드인 경우 true
 */
export const isStandalone = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;

  // iOS Safari PWA 감지 (navigator.standalone은 iOS Safari에서만 사용 가능)
  // iOS 2.1+부터 지원 (구 버전 대응)
  if (navigatorWithStandalone.standalone === true) {
    return true;
  }

  // Android Chrome (Chrome 69+), 삼성 브라우저 (Samsung Internet 7.2+), iOS Chrome (CriOS), 기타 브라우저 PWA 감지
  // matchMedia는 Chrome 69+, Firefox 64+, Safari 11.1+, Samsung Internet 7.2+부터 지원
  // 구 버전 브라우저에서는 matchMedia가 없을 수 있으므로 안전하게 체크
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }

  return false;
};

/**
 * @description 브라우저별 카메라 capture 속성 값 반환
 * 각 브라우저와 기기의 카메라 지원 상태를 고려하여 최적의 capture 값 반환
 * 2025년 12월 기준 최신 브라우저 버전 반영
 * @returns {"environment" | "user" | undefined} 카메라 capture 속성 값
 */
export const getCameraCaptureValue = (): "environment" | "user" | undefined => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return undefined;
  }

  const userAgent = navigator.userAgent || "";
  const isIOS = isIOSDevice();

  // iOS Safari (Safari 26.1+) - capture 속성 지원이 제한적
  // iOS 26+에서도 여전히 capture 속성을 사용하지 않고 사용자에게 직접 선택하도록 함
  if (isIOS && userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    return undefined; // capture 속성 제거하여 카메라/갤러리 선택지 제공
  }

  // iOS Chrome (CriOS) - iOS에서는 Safari와 동일하게 처리
  // iOS 18.2+에서 기본 브라우저로 변경 가능하지만 동작은 동일
  if (isIOS && userAgent.includes("CriOS")) {
    return undefined; // iOS Chrome도 capture 속성 제거
  }

  // Samsung Internet (최신 버전) - capture="environment"가 제대로 동작하지 않음
  // 삼성 브라우저는 최신 Chromium 엔진을 사용하지만 capture 속성 지원이 불안정
  if (userAgent.includes("SamsungBrowser")) {
    return undefined; // capture 속성 제거하여 기본 카메라 앱 사용
  }

  // Chrome Mobile (Android, Chrome 143+) - capture 속성 완벽 지원
  // Android Chrome은 capture="environment"를 완벽하게 지원
  if (userAgent.includes("Chrome") && userAgent.includes("Mobile") && !isIOS) {
    return "environment"; // 후면 카메라 우선
  }

  // Firefox Mobile - capture 속성 지원하지만 신뢰성이 낮음
  if (userAgent.includes("Firefox") && userAgent.includes("Mobile")) {
    return undefined; // capture 속성 제거하여 안정성 확보
  }

  // 그 외 모바일 브라우저 (Android 기반) - 기본적으로 후면 카메라 시도
  if (/Android|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) && !isIOS) {
    return "environment";
  }

  // 데스크톱 브라우저에서는 capture 속성 불필요
  return undefined;
};

/**
 * @description 카메라 API 지원 여부 확인
 * 지원 브라우저: Chrome 53+, Firefox 36+, Safari 11+, Edge 12+, Samsung Internet 4.0+
 * 구 버전 브라우저: mediaDevices 미지원 시 false 반환 (안전한 폴백)
 * @returns {boolean} 카메라 API 지원 여부
 */
export const isCameraAPISupported = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // 구 버전 브라우저 대응: navigator.mediaDevices가 없을 수 있음
  if (!navigator.mediaDevices) return false;

  // getUserMedia와 enumerateDevices 모두 지원되는지 확인
  return !!(
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof navigator.mediaDevices.enumerateDevices === "function"
  );
};

/**
 * @description 카메라 권한 상태 확인
 * Permissions API 지원 브라우저:
 * - Chrome 43+ (Android, Desktop): 완벽 지원
 * - Samsung Internet 4.0+ (Android 6.0+): 지원
 * - Firefox 46+: 지원
 * - Edge 79+: 지원
 * - iOS Safari: Permissions API 미지원 (항상 null 반환, 구 버전 대응)
 * - iOS Chrome (CriOS): Permissions API 미지원 (항상 null 반환)
 * 구 버전 브라우저: Permissions API 미지원 시 null 반환 (안전한 폴백)
 * @returns {Promise<PermissionState | null>} 카메라 권한 상태 (null: 미지원 또는 에러)
 */
export const getCameraPermissionStatus =
  async (): Promise<PermissionState | null> => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return null;
    }

    try {
      // Permissions API 지원 확인 (구 버전 브라우저 대응)
      // iOS Safari와 iOS Chrome (CriOS)는 Permissions API를 지원하지 않으므로 null 반환
      if (
        "permissions" in navigator &&
        navigator.permissions &&
        typeof navigator.permissions.query === "function"
      ) {
        const permission = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        return permission.state;
      }
    } catch (error) {
      // Permissions API 미지원 또는 에러 발생
      // 구 버전 브라우저, 삼성 브라우저 구버전, iOS Safari, iOS Chrome 등에서 발생할 수 있음
      // eslint-disable-next-line no-console
      console.warn("Camera permission check failed:", error);
    }

    return null;
  };

/**
 * @description 모바일 기기인지 확인
 * iOS (Safari, Chrome), Android (Chrome, Samsung Browser), 기타 모바일 브라우저 감지
 * 구 버전 브라우저: User Agent 기반 감지로 대응 (모든 브라우저에서 동작)
 * @returns {boolean} 모바일 기기 여부
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = (navigator.userAgent || "").toLowerCase();

  // iOS, Android, 기타 모바일 OS 감지 (구 버전 브라우저 대응)
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );

  // 추가적으로 터치 지원 확인 (태블릿 등)
  // iPadOS 13+는 MacIntel로 감지되지만 터치 지원 확인으로 보완
  // 구 버전 브라우저에서도 ontouchstart는 지원되므로 안전
  const hasTouchScreen =
    "ontouchstart" in window ||
    (typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 0);

  // 모바일 OS이거나, 터치 지원 + 매우 작은 화면 크기인 경우만 모바일로 판단
  // PC의 큰 터치스크린은 제외하기 위해 768px로 제한 (태블릿 사이즈)
  const viewportWidth =
    typeof window.innerWidth === "number" ? window.innerWidth : 0;

  // 터치스크린이 있는 경우에도 화면 크기가 작아야 모바일로 판단
  const isSmallTouchScreen = hasTouchScreen && viewportWidth <= 768;

  return isMobile || isSmallTouchScreen;
};

/**
 * 브라우저별 카메라 에러 메시지를 반환
 * @param error - 선택적 에러 객체 (에러 타입에 따른 구체적인 메시지 제공)
 * @returns 사용자 친화적인 에러 메시지
 */
export const getCameraErrorMessage = (error?: unknown): string => {
  // 에러 객체가 제공된 경우 구체적인 메시지 반환
  if (error instanceof Error) {
    const errorMessageLower = error.message.toLowerCase();
    const errorNameLower = error.name.toLowerCase();

    // 권한 관련 에러
    if (
      errorMessageLower.includes("user denied") ||
      errorMessageLower.includes("permission denied") ||
      errorNameLower.includes("notallowederror")
    ) {
      return "카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.";
    }

    // 카메라 차단 에러 (권한 관련과 중복되지만 명시적으로 처리)
    if (
      errorMessageLower.includes("not allowed") ||
      errorNameLower.includes("notallowederror")
    ) {
      return "카메라 접근이 차단되었습니다. 브라우저 설정에서 권한을 확인해주세요.";
    }

    // 카메라 없음 에러
    if (
      errorMessageLower.includes("notfounderror") ||
      errorMessageLower.includes("not found") ||
      errorNameLower.includes("notfounderror")
    ) {
      return "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.";
    }

    // 카메라 사용 중 에러
    if (
      errorMessageLower.includes("notreadableerror") ||
      errorMessageLower.includes("not readable") ||
      errorNameLower.includes("notreadableerror")
    ) {
      return "카메라를 사용할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.";
    }
  }

  // 브라우저별 기본 메시지
  if (typeof navigator === "undefined") {
    return "카메라를 사용할 수 없습니다.";
  }

  const userAgent = navigator.userAgent || "";
  const isIOS = isIOSDevice();
  const isAndroid = /Android/.test(userAgent);

  // iOS Safari (CriOS 제외 - CriOS는 iOS Chrome)
  if (
    isIOS &&
    userAgent.includes("Safari") &&
    !userAgent.includes("Chrome") &&
    !userAgent.includes("CriOS")
  ) {
    return "Safari에서 카메라를 사용할 수 없습니다. 설정 > 개인정보 보호 및 보안 > 카메라 권한을 확인하거나, Chrome 브라우저를 사용해 보세요.";
  }

  // iOS Chrome
  if (
    isIOS &&
    (userAgent.includes("CriOS") ||
      (userAgent.includes("Chrome") && userAgent.includes("Safari")))
  ) {
    return "iOS Chrome에서 카메라 권한을 허용해주세요. 설정 > 개인정보 보호 > 카메라에서 Chrome을 허용하세요.";
  }

  // Samsung Internet
  if (userAgent.includes("SamsungBrowser")) {
    return "삼성 인터넷에서는 카메라 접근이 제한적일 수 있습니다. Chrome 브라우저를 사용하거나 갤러리에서 사진을 선택해 보세요.";
  }

  // Android Chrome
  if (isAndroid && userAgent.includes("Chrome")) {
    return "Chrome에서 카메라 권한을 허용해주세요. 주소창 왼쪽의 잠금 아이콘을 터치하여 권한을 허용하세요.";
  }

  // Firefox Mobile
  if (userAgent.includes("Firefox") && /Mobile|Tablet/.test(userAgent)) {
    return "Firefox에서 카메라 권한을 허용해주세요. 주소창 왼쪽의 방패 아이콘을 터치하여 권한을 설정하세요.";
  }

  // 일반 모바일 브라우저
  if (isIOS || isAndroid) {
    return "카메라 권한을 허용해주세요. 브라우저 설정에서 카메라 접근 권한을 확인하세요.";
  }

  // 데스크톱 브라우저
  return "카메라가 연결되어 있는지 확인해주세요. 웹캠 권한을 허용한 후 다시 시도하세요.";
};
