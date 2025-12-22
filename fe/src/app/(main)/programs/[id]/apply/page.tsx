"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ActivityApplicationForm,
  useActivityApplicationForm,
} from "@/components/shared/activity-application-form";
import {
  ActivityPickerBottomSheet,
  type PickerType,
} from "@/components/shared/activity-application-form/ActivityPickerBottomSheet";
import Input from "@/components/shared/input";
import { Typography } from "@/components/shared/typography";
import Modal from "@/components/shared/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetCommunitiesNicknameAvailabilityById } from "@/hooks/generated/communities-hooks";
import {
  useGetProgramsById,
  usePostProgramsApplyById,
} from "@/hooks/generated/programs-hooks";
import {
  useGetUsersMe,
  useGetUsersMeParticipatingCommunities,
} from "@/hooks/generated/users-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { getCurrentUser } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { ProgramDetailResponse } from "@/types/generated/api-schema";
import * as Schema from "@/types/generated/api-schema";
import { hasAuthCookie, removeAuthCookie } from "@/utils/auth/auth-cookie";
import { cn } from "@/utils/shared/cn";
import {
  formatDateRange,
  formatDateTimeWithDay,
  formatDateSlash,
} from "@/utils/shared/date";
import { validateNickname } from "@/utils/shared/nickname-validator";

/**
 * @description 참여 동기 직접 입력 최소 글자 수
 */
const MIN_MOTIVATION_LENGTH = 10;

/**
 * @description 활동 신청 단계 타입
 */
type ApplicationStep =
  | "schedule-confirm"
  | "nickname"
  | "phone"
  | "region"
  | "situation"
  | "source"
  | "motivation"
  | "review"
  | "terms"
  | "complete";

/**
 * @description 신청 폼 데이터 타입
 */
interface ApplicationFormData {
  canAttendEvents: boolean;
  nickname: string;
  phoneNumber: string;
  region: {
    city: string;
    district: string;
  } | null;
  currentSituation: string;
  applicationSource: string;
  applicationMotivation: string;
  customMotivation: string;
  agreedToTerms: boolean;
}

/**
 * @description 활동 신청 페이지 콘텐츠
 */
const ProgramApplyPageContent = () => {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  // 유효한 스텝 목록
  const validSteps: ApplicationStep[] = useMemo(
    () => [
      "schedule-confirm",
      "nickname",
      "phone",
      "region",
      "situation",
      "source",
      "motivation",
      "review",
      "terms",
      "complete",
    ],
    []
  );

  // TopBar 제어
  const setTitle = useTopBarStore((state) => state.setTitle);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 프로그램 상세 정보 조회
  const { data: programDetailData, isLoading } = useGetProgramsById({
    request: { programId },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      const responseData = data as ProgramDetailResponse["data"];
      return responseData?.program || null;
    },
  });

  // 사용자 정보 조회
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
  });

  // localStorage 키
  const STORAGE_KEY = `apply-form-${programId}`;

  // 폼 데이터 초기화 (localStorage에서 복원)
  const getInitialFormData = useCallback((): ApplicationFormData => {
    if (typeof window === "undefined") {
      return {
        canAttendEvents: false,
        nickname: "",
        phoneNumber: "",
        region: null,
        currentSituation: "",
        applicationSource: "",
        applicationMotivation: "",
        customMotivation: "",
        agreedToTerms: false,
      };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          canAttendEvents: parsed.canAttendEvents || false,
          nickname: parsed.nickname || "",
          phoneNumber: parsed.phoneNumber || "",
          region: parsed.region || null,
          currentSituation: parsed.currentSituation || "",
          applicationSource: parsed.applicationSource || "",
          applicationMotivation: parsed.applicationMotivation || "",
          customMotivation: parsed.customMotivation || "",
          agreedToTerms: parsed.agreedToTerms || false,
        };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("폼 데이터 복원 실패:", error);
    }
    return {
      canAttendEvents: false,
      nickname: userData?.nickname || "",
      phoneNumber: userData?.phoneNumber || "",
      region: null,
      currentSituation: "",
      applicationSource: "",
      applicationMotivation: "",
      customMotivation: "",
      agreedToTerms: false,
    };
  }, [STORAGE_KEY, userData]);

  // 현재 단계 (내부 상태로 관리)
  const [currentStep, setCurrentStep] =
    useState<ApplicationStep>("schedule-confirm");

  // 폼 데이터 관리 (공통 hook 사용)
  const formHook = useActivityApplicationForm(getInitialFormData());
  const formData = formHook.formData;

  const { refetch: refetchNicknameAvailability } =
    useGetCommunitiesNicknameAvailabilityById({
      request: {
        communityId: programId,
        nickname: formData.nickname.trim(),
      },
      enabled: false,
      retry: false,
    });

  // 폼 데이터 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("폼 데이터 저장 실패:", error);
      }
    }
  }, [formData, STORAGE_KEY]);

  // 스텝 변경 시 상태 업데이트
  const updateStep = useCallback((step: ApplicationStep) => {
    setCurrentStep(step);
  }, []);

  // 필드별 에러 상태 관리
  const [fieldErrors, setFieldErrors] = useState<{
    nickname?: string;
    phoneNumber?: string;
    region?: string;
    currentSituation?: string;
    applicationSource?: string;
    applicationMotivation?: string;
  }>({});

  const { data, refetch: refetchParticipatingCommunities } =
    useGetUsersMeParticipatingCommunities({
      enabled: false,
    });

  // 신청하기 mutation
  const applyMutation = usePostProgramsApplyById({
    onSuccess: () => {
      // localStorage 정리
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      // 참여 중인 커뮤니티 목록 refetch (신청 상태 업데이트 반영)
      refetchParticipatingCommunities();

      updateStep("complete");
    },
    onError: (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error("신청 실패:", error);

      // 에러 응답에서 필드별 에러 메시지 추출
      const errorResponse =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response
          ? (error.response as {
              data?: { message?: string; [key: string]: unknown };
            })
          : null;
      const errorMessage =
        errorResponse?.data?.message ||
        (error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "");
      const errorData = errorResponse?.data;

      // 타입 가드 헬퍼 함수
      const getStringValue = (value: unknown): string | undefined => {
        return typeof value === "string" ? value : undefined;
      };

      // 필드별 에러 처리
      const newFieldErrors: typeof fieldErrors = {};

      // 닉네임 중복 체크
      if (
        errorMessage.includes("닉네임") ||
        errorMessage.includes("nickname") ||
        errorData?.nickname
      ) {
        newFieldErrors.nickname =
          getStringValue(errorData?.nickname) || "이미 사용 중인 닉네임입니다.";
        updateStep("nickname");
      }
      // 휴대폰 번호 에러
      else if (
        errorMessage.includes("휴대폰") ||
        errorMessage.includes("phone") ||
        errorData?.phoneNumber
      ) {
        newFieldErrors.phoneNumber =
          getStringValue(errorData?.phoneNumber) ||
          "올바른 휴대폰 번호를 입력해주세요.";
        updateStep("phone");
      }
      // 지역 에러
      else if (
        errorMessage.includes("지역") ||
        errorMessage.includes("region") ||
        errorData?.region
      ) {
        newFieldErrors.region =
          getStringValue(errorData?.region) || "지역을 선택해주세요.";
        updateStep("region");
      }
      // 현재 상황 에러
      else if (
        errorMessage.includes("상황") ||
        errorMessage.includes("situation") ||
        errorData?.currentSituation
      ) {
        newFieldErrors.currentSituation =
          getStringValue(errorData?.currentSituation) ||
          "현재 상황을 선택해주세요.";
        updateStep("situation");
      }
      // 참여 경로 에러
      else if (
        errorMessage.includes("경로") ||
        errorMessage.includes("source") ||
        errorData?.applicationSource
      ) {
        newFieldErrors.applicationSource =
          getStringValue(errorData?.applicationSource) ||
          "참여 경로를 선택해주세요.";
        updateStep("source");
      }
      // 참여 동기 에러
      else if (
        errorMessage.includes("동기") ||
        errorMessage.includes("motivation") ||
        errorData?.applicationMotivation
      ) {
        newFieldErrors.applicationMotivation =
          getStringValue(errorData?.applicationMotivation) ||
          "참여 동기를 선택해주세요.";
        updateStep("motivation");
      }
      // 일반 에러
      else {
        setErrorMessage(
          errorMessage || "신청 중 오류가 발생했습니다. 다시 시도해주세요."
        );
        openErrorModal();
      }

      setFieldErrors(newFieldErrors);
      // 에러 발생 시 약관 동의 상태 초기화하여 다시 시도 가능하도록
      formHook.updateFormData({ agreedToTerms: false });
    },
  });

  // 모달/바텀시트 상태 (hook에서 관리)
  const {
    showNicknameConfirm,
    setShowNicknameConfirm,
    showRegionPicker,
    setShowRegionPicker,
    showSituationPicker,
    setShowSituationPicker,
    showSourcePicker,
    setShowSourcePicker,
    showMotivationPicker,
    setShowMotivationPicker,
    showTermsSheet,
    setShowTermsSheet,
    selectedRegionCode,
    setSelectedRegionCode,
  } = formHook;

  // 에러 모달 상태
  const {
    isOpen: isErrorModalOpen,
    open: openErrorModal,
    close: closeErrorModal,
  } = useToggle();
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 로그인 필요 모달 상태
  const {
    isOpen: isLoginRequiredModalOpen,
    open: openLoginRequiredModal,
    close: closeLoginRequiredModal,
  } = useToggle();

  // 통합 바텀시트 타입 결정
  const activePickerType = useMemo<PickerType | null>(() => {
    if (showRegionPicker) return "region";
    if (showSituationPicker) return "situation";
    if (showSourcePicker) return "source";
    if (showMotivationPicker) return "motivation";
    if (showTermsSheet) return "terms";
    return null;
  }, [
    showRegionPicker,
    showSituationPicker,
    showSourcePicker,
    showMotivationPicker,
    showTermsSheet,
  ]);

  // 통합 바텀시트 닫기 핸들러
  const handlePickerClose = useCallback(() => {
    switch (activePickerType) {
      case "region":
        setShowRegionPicker(false);
        break;
      case "situation":
        setShowSituationPicker(false);
        break;
      case "source":
        setShowSourcePicker(false);
        break;
      case "motivation":
        setShowMotivationPicker(false);
        break;
      case "terms":
        setShowTermsSheet(false);
        break;
    }
  }, [
    activePickerType,
    setShowRegionPicker,
    setShowSituationPicker,
    setShowSourcePicker,
    setShowMotivationPicker,
    setShowTermsSheet,
  ]);

  // 이전 스텝으로 이동
  const goToPreviousStep = useCallback(() => {
    if (
      !currentStep ||
      currentStep === "schedule-confirm" ||
      currentStep === "complete"
    ) {
      router.replace(`${LINK_URL.PROGRAMS}/${programId}`);
      return;
    }

    const stepOrderList: ApplicationStep[] = [
      "schedule-confirm",
      "nickname",
      "phone",
      "region",
      "situation",
      "source",
      "motivation",
      "review",
      "terms",
      "complete",
    ];
    const currentIndex = stepOrderList.indexOf(currentStep);
    if (currentIndex > 0) {
      const previousStep = stepOrderList[currentIndex - 1];
      updateStep(previousStep);
    }
  }, [currentStep, updateStep, router, programId]);

  // TopBar 설정 및 뒤로가기 커스텀
  const setLeftSlot = useTopBarStore((state) => state.setLeftSlot);
  useEffect(() => {
    setTitle("신청하기");
    // TopBar의 뒤로가기 버튼 커스텀
    const customLeftSlot = (
      <button
        onClick={goToPreviousStep}
        className="hover:cursor-pointer"
        aria-label="이전 단계"
      >
        <svg
          className="h-6 w-6 text-gray-900"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
    );
    setLeftSlot(customLeftSlot);
    return () => {
      resetTopBar();
    };
  }, [
    setTitle,
    resetTopBar,
    goToPreviousStep,
    currentStep,
    setLeftSlot,
    router,
    programId,
  ]);

  // 일정 확인 완료
  const handleScheduleConfirm = useCallback(() => {
    formHook.updateFormData({ canAttendEvents: true });
    updateStep("nickname");
  }, [updateStep, formHook]);

  const handleNicknameChange = useCallback(
    (value: string) => {
      const limitedValue = value.slice(0, 8);
      formHook.handleNicknameChange(limitedValue);

      if (!limitedValue.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          nickname: undefined,
        }));
        return;
      }

      const validationResult = validateNickname(limitedValue);
      setFieldErrors((prev) => ({
        ...prev,
        nickname: validationResult.isValid
          ? undefined
          : validationResult.error || "닉네임을 확인해주세요.",
      }));
    },
    [formHook, setFieldErrors]
  );

  // 닉네임 확인 모달 확인 (커뮤니티 members 닉네임 중복 검사)
  const handleNicknameConfirm = useCallback(async () => {
    const trimmedNickname = formData.nickname.trim();

    if (!trimmedNickname) {
      return;
    }

    try {
      const { data, error } = await refetchNicknameAvailability();
      if (error) {
        throw error;
      }
      const available = data?.available ?? false;

      if (!available) {
        setFieldErrors((prev) => ({
          ...prev,
          nickname: "이미 사용 중인 닉네임입니다. 다른 닉네임을 선택해주세요.",
        }));
        setShowNicknameConfirm(false);
        return;
      }

      setFieldErrors((prev) => ({
        ...prev,
        nickname: undefined,
      }));
      setShowNicknameConfirm(false);
      updateStep("phone");
    } catch (error) {
      console.error("닉네임 중복 검사 실패:", error);
      setFieldErrors((prev) => ({
        ...prev,
        nickname:
          "닉네임 중복 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      }));
      setShowNicknameConfirm(false);
    }
  }, [
    formData.nickname,
    refetchNicknameAvailability,
    setFieldErrors,
    setShowNicknameConfirm,
    updateStep,
  ]);

  // 닉네임 다음 버튼 클릭
  const handleNicknameNext = useCallback(() => {
    if (formData.nickname.trim() && !fieldErrors.nickname) {
      setShowNicknameConfirm(true);
    }
  }, [formData.nickname, fieldErrors.nickname, setShowNicknameConfirm]);

  // 휴대폰 번호 입력 완료 (자동 다음 단계 이동 포함)
  const handlePhoneChangeWithAutoNext = useCallback(
    (value: string) => {
      // 숫자만 허용
      const numbersOnly = value.replace(/[^0-9]/g, "");
      formHook.handlePhoneChange(numbersOnly);
      // 에러 초기화
      if (fieldErrors.phoneNumber) {
        setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
      }
      // 11자리 입력 시 자동 다음 단계 이동
      if (numbersOnly.length === 11) {
        updateStep("region");
      }
    },
    [updateStep, formHook, fieldErrors.phoneNumber]
  );

  // 지역 선택 (자동 다음 단계 이동 포함)
  const handleRegionSelectWithAutoNext = useCallback(
    (city: string, district: string) => {
      formHook.handleRegionSelect(city, district);
      updateStep("situation");
    },
    [updateStep, formHook]
  );

  // 현재 상황 선택 (자동 다음 단계 이동 포함)
  const handleSituationSelectWithAutoNext = useCallback(
    (value: string) => {
      formHook.handleSituationSelect(value);
      updateStep("source");
    },
    [updateStep, formHook]
  );

  // 참여 경로 선택 (자동 다음 단계 이동 포함)
  const handleSourceSelectWithAutoNext = useCallback(
    (value: string) => {
      formHook.handleSourceSelect(value);
      updateStep("motivation");
    },
    [updateStep, formHook]
  );

  // 참여 동기 선택 (자동 다음 단계 이동 포함)
  const handleMotivationSelectWithAutoNext = useCallback(
    (value: string) => {
      formHook.handleMotivationSelect(value);
      if (value !== "직접 입력하기") {
        updateStep("review");
      }
    },
    [updateStep, formHook]
  );

  // 신청 정보 확인 후 다음
  const handleReviewNext = useCallback(() => {
    updateStep("terms");
    setShowTermsSheet(true);
  }, [updateStep]);

  // 약관 동의
  const handleTermsAgree = useCallback(() => {
    formHook.updateFormData({ agreedToTerms: true });
    // 신청 API 호출
    const currentUser = getCurrentUser();
    const applicantId = currentUser?.uid || userData?.id || "";

    if (!applicantId) {
      openLoginRequiredModal();
      return;
    }

    // 신청 시작 시 바텀시트 닫기 (로딩 상태 표시를 위해)
    setShowTermsSheet(false);

    // TPOSTProgramsApplyByIdReq 타입에 맞춰 요청 body 구성
    // BE에서는 실제로 더 많은 필드를 받지만, 타입 정의는 applicantId와 nickname만 있음
    // 실제 BE 코드를 참고하여 모든 필드를 전송
    // API 함수는 data.data ?? data로 처리하므로, data 객체 안에 모든 필드를 넣어야 함
    applyMutation.mutate({
      programId: programId,
      data: {
        applicantId,
        nickname: formData.nickname,
        // BE에서 실제로 받는 추가 필드들 (타입 정의는 업데이트되지 않았을 수 있음)
        activityNickname: formData.nickname,
        activityPhoneNumber: formData.phoneNumber,
        region: formData.region
          ? {
              city: formData.region.city,
              district: formData.region.district,
            }
          : undefined,
        currentSituation: formData.currentSituation || undefined,
        applicationSource: formData.applicationSource || undefined,
        applicationMotivation:
          formData.applicationMotivation === "직접 입력하기"
            ? formData.customMotivation
            : formData.applicationMotivation || undefined,
        canAttendEvents: formData.canAttendEvents,
      } as Schema.ProgramApplicationRequest & Record<string, unknown>, // BE에서 실제로 받는 추가 필드들 포함
    });
  }, [formData, programId, applyMutation, userData, formHook]);

  // 신청 완료 후 확인
  const handleComplete = useCallback(() => {
    // 홈화면으로 이동하고 히스토리 정리 (뒤로가기 방지)
    router.replace(LINK_URL.PROGRAMS + `/${programId}`);
  }, [router]);

  // 스텝 순서 정의
  const stepOrder: ApplicationStep[] = useMemo(
    () => [
      "schedule-confirm",
      "nickname",
      "phone",
      "region",
      "situation",
      "source",
      "motivation",
      "review",
      "terms",
      "complete",
    ],
    []
  );

  // 현재 스텝의 인덱스
  const currentStepIndex = useMemo(
    () => stepOrder.indexOf(currentStep),
    [currentStep, stepOrder]
  );

  // 현재 스텝의 타이틀 가져오기 (stepIndex 기반)
  const getStepTitle = useCallback(
    (stepIndex: number, programNameValue: string): string => {
      switch (stepIndex) {
        case 1: // nickname
          return `이번 [${programNameValue}]에서 사용할 닉네임을 알려주세요`;
        case 2: // phone
          return "휴대폰 번호를 알려주세요";
        case 3: // region
          return "어느 지역에 거주 중인가요?";
        case 4: // situation
          return "현재 어떤 상황인가요?";
        case 5: // source
          return `[${programNameValue}]을 어떻게 알게 되었나요?`;
        case 6: // motivation
          return `[${programNameValue}]에 왜 참여하고 싶은가요?`;
        default:
          return "";
      }
    },
    []
  );

  // 하단 버튼 렌더링
  const renderBottomButton = useCallback(() => {
    const buttonBaseClass =
      "w-full rounded-lg bg-main-600 px-4 py-3 text-white transition-colors hover:bg-pink-600 disabled:bg-gray-300 disabled:hover:bg-gray-300";

    switch (currentStep) {
      case "schedule-confirm":
        return (
          <button onClick={handleScheduleConfirm} className={buttonBaseClass}>
            <Typography font="noto" variant="body3R" className="text-white">
              확인했습니다
            </Typography>
          </button>
        );
      case "nickname":
        return (
          <button
            onClick={handleNicknameNext}
            disabled={!formData.nickname.trim()}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        );
      case "phone":
        const isPhoneValid =
          formData.phoneNumber.replace(/-/g, "").length === 11;
        return (
          <button
            onClick={() => isPhoneValid && updateStep("region")}
            disabled={!isPhoneValid}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        );
      case "region":
        return formData.region ? (
          <button
            onClick={() => updateStep("situation")}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        ) : null;
      case "situation":
        return formData.currentSituation ? (
          <button
            onClick={() => updateStep("source")}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        ) : null;
      case "source":
        return formData.applicationSource ? (
          <button
            onClick={() => updateStep("motivation")}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        ) : null;
      case "motivation":
        const isMotivationValid =
          formData.applicationMotivation === "직접 입력하기"
            ? formData.customMotivation.trim().length >= MIN_MOTIVATION_LENGTH
            : !!formData.applicationMotivation;
        return (
          <button
            onClick={() => updateStep("review")}
            disabled={!isMotivationValid}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        );
      case "review":
        return (
          <button
            onClick={handleReviewNext}
            disabled={applyMutation.isPending}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              {applyMutation.isPending ? "신청 중..." : "다음"}
            </Typography>
          </button>
        );
      case "terms":
        // 바텀시트가 열려있을 때도 버튼 표시 (바텀시트를 닫을 수 있도록)
        // 신청 중에는 버튼 비활성화
        return (
          <button
            onClick={() => setShowTermsSheet(true)}
            disabled={applyMutation.isPending}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              {applyMutation.isPending ? "신청 중..." : "약관 동의하기"}
            </Typography>
          </button>
        );
      case "complete":
        return (
          <button onClick={handleComplete} className={buttonBaseClass}>
            <Typography font="noto" variant="body3R" className="text-white">
              확인
            </Typography>
          </button>
        );
      default:
        return null;
    }
  }, [
    currentStep,
    formData,
    handleScheduleConfirm,
    handleNicknameNext,
    handleReviewNext,
    updateStep,
    applyMutation.isPending,
    setShowTermsSheet,
  ]);

  if (isLoading || !programDetailData) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <div className="mx-auto max-w-[470px] pb-24">
          {/* 프로그램 정보 카드 스켈레톤 */}
          <div className="border border-gray-300 bg-gray-50 p-4">
            <div className="flex gap-4">
              <Skeleton className="h-[110px] w-[110px] shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
          <div className="p-5">
            {/* 질문 스켈레톤 */}
            <Skeleton className="mb-3 h-8 w-full" />
            <Skeleton className="mb-6 h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const program = programDetailData;
  const programName =
    program?.programName ||
    program?.notionPageTitle ||
    program?.title ||
    "활동";

  return (
    <div className="min-h-screen bg-white pt-12">
      <div className="mx-auto max-w-[470px] pb-24">
        {/* 일정 확인 단계 */}
        {currentStep === "schedule-confirm" && (
          <div>
            {/* 프로그램 정보 카드 */}
            <div className="border-b border-gray-300 p-4">
              <div className="flex gap-4">
                {/* 이미지 영역 */}
                <div className="relative h-[110px] w-[110px] shrink-0 overflow-hidden rounded-lg bg-gray-200">
                  {(program.thumbnail?.[0]?.url || program.coverImage) && (
                    <Image
                      src={
                        program.thumbnail?.[0]?.url || program.coverImage || ""
                      }
                      alt={program.programName || "프로그램 이미지"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                {/* 텍스트 영역 */}
                <div className="flex flex-1 flex-col gap-1">
                  <div className="mb-2 line-clamp-1">
                    <Typography
                      font="noto"
                      variant="label1R"
                      className="text-main-500 bg-main-100 mr-[11px] mb-1 inline-block rounded-[2px] p-1"
                    >
                      {program.programType}
                    </Typography>
                    <Typography
                      font="noto"
                      variant="heading3B"
                      className="mb-1 text-gray-700"
                    >
                      {program.programName || "-"}
                    </Typography>
                  </div>
                  <div className="flex flex-col gap-2">
                    {program.startDate && program.endDate && (
                      <Typography
                        font="noto"
                        variant="label1R"
                        className="text-gray-950"
                      >
                        활동 기간:{" "}
                        {formatDateRange(program.startDate, program.endDate)}
                      </Typography>
                    )}
                    {program.orientationDate && (
                      <Typography
                        font="noto"
                        variant="label1R"
                        className="text-gray-950"
                      >
                        오티: {formatDateTimeWithDay(program.orientationDate)}
                      </Typography>
                    )}
                    {program.shareMeetingDate && (
                      <Typography
                        font="noto"
                        variant="label1R"
                        className="text-gray-950"
                      >
                        공유회:{" "}
                        {formatDateTimeWithDay(program.shareMeetingDate)}
                      </Typography>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {Boolean(program.orientationDate && program.shareMeetingDate) && (
              <div className="p-5">
                <Typography
                  as="h2"
                  font="noto"
                  variant="heading2B"
                  className="mb-3"
                >
                  {`오티(${formatDateSlash(program.orientationDate)}), 공유회(${formatDateSlash(program.shareMeetingDate)}) 일정을 확인하셨나요?`}
                </Typography>
                <Typography
                  font="noto"
                  variant="body2R"
                  className="mb-6 text-gray-600"
                >
                  오티와 공유회 참석은 필수입니다. 참석 불가능한 경우 프로그램
                  참여가 어렵습니다.
                </Typography>
              </div>
            )}
          </div>
        )}

        {/* 통합된 폼 구조 (nickname ~ motivation 단계) */}
        {currentStepIndex >= 1 && currentStepIndex <= 6 && program && (
          <ActivityApplicationForm
            currentStepIndex={currentStepIndex}
            programName={programName}
            formData={formData}
            handlers={formHook}
            getStepTitle={getStepTitle}
            onPhoneChangeComplete={handlePhoneChangeWithAutoNext}
            onNicknameChange={handleNicknameChange}
            fieldErrors={fieldErrors}
          />
        )}

        {/* 신청 정보 확인 단계 */}
        {(currentStep === "review" || currentStep === "terms") && (
          <div className="p-5">
            <div className="mb-6">
              <Typography
                as="h2"
                font="noto"
                variant="heading2B"
                className="mb-4"
              >
                신청 정보를 확인해주세요
              </Typography>
              <div className="space-y-4">
                {/* 참여 동기 */}
                <div>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className="text-gray-700"
                  >
                    참여 동기
                  </Typography>
                  <button
                    onClick={() => updateStep("motivation")}
                    className="mt-3 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left"
                  >
                    <Typography
                      font="noto"
                      variant="body2R"
                      className={cn(
                        formData.applicationMotivation
                          ? "text-gray-900"
                          : "text-gray-400"
                      )}
                    >
                      {formData.applicationMotivation === "직접 입력하기"
                        ? formData.customMotivation || "직접 입력하기"
                        : formData.applicationMotivation ||
                          "참여 동기를 선택해주세요"}
                    </Typography>
                  </button>
                  {formData.applicationMotivation === "직접 입력하기" && (
                    <div className="mt-2">
                      <textarea
                        value={formData.customMotivation}
                        onChange={(e) =>
                          formHook.handleCustomMotivationChange(e.target.value)
                        }
                        placeholder={`최소 ${MIN_MOTIVATION_LENGTH}자 이상 입력해주세요`}
                        maxLength={200}
                        rows={4}
                        className={cn(
                          "font-noto focus:ring-main-400 focus:outline-main-400 focus:border-main-600 w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-base font-normal shadow-xs focus:outline-3",
                          formData.customMotivation.length >=
                            MIN_MOTIVATION_LENGTH && "border-pink-500"
                        )}
                      />
                      <Typography
                        font="noto"
                        variant="caption1R"
                        className="mt-1 text-right text-gray-400"
                      >
                        {formData.customMotivation.length}/200
                      </Typography>
                    </div>
                  )}
                </div>

                {/* 참여 경로 */}
                <div>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className="text-gray-700"
                  >
                    참여 경로
                  </Typography>
                  <button
                    onClick={() => updateStep("source")}
                    className="mt-3 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left"
                  >
                    <Typography
                      font="noto"
                      variant="body2R"
                      className={cn(
                        formData.applicationSource
                          ? "text-gray-900"
                          : "text-gray-400"
                      )}
                    >
                      {formData.applicationSource || "참여 경로를 선택해주세요"}
                    </Typography>
                  </button>
                </div>

                {/* 현재 상황 */}
                <div>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className="text-gray-700"
                  >
                    현재 상황
                  </Typography>
                  <button
                    onClick={() => updateStep("situation")}
                    className="mt-3 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left"
                  >
                    <Typography
                      font="noto"
                      variant="body2R"
                      className={cn(
                        formData.currentSituation
                          ? "text-gray-900"
                          : "text-gray-400"
                      )}
                    >
                      {formData.currentSituation || "현재 상황을 선택해주세요"}
                    </Typography>
                  </button>
                </div>

                {/* 거주 지역 */}
                {formData.region && (
                  <div>
                    <Typography
                      font="noto"
                      variant="label1B"
                      className="text-gray-700"
                    >
                      거주 지역
                    </Typography>
                    <button
                      onClick={() => updateStep("region")}
                      className="mt-3 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left"
                    >
                      <Typography
                        font="noto"
                        variant="body2R"
                        className="text-gray-900"
                      >
                        {formData.region.city} {formData.region.district}
                      </Typography>
                    </button>
                  </div>
                )}

                {/* 휴대폰 번호 */}
                <div>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className="text-gray-700"
                  >
                    휴대폰 번호
                  </Typography>
                  <div className="relative mt-3">
                    <Input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => {
                        // 숫자만 입력 허용
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        formHook.handlePhoneChange(value);
                        // 에러 초기화
                        if (fieldErrors.phoneNumber) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            phoneNumber: undefined,
                          }));
                        }
                      }}
                      placeholder="01012345678"
                      maxLength={11}
                      className={cn(
                        fieldErrors.phoneNumber && "border-red-500"
                      )}
                    />
                    {formData.phoneNumber && (
                      <button
                        onClick={() => formHook.handlePhoneChange("")}
                        className="absolute top-1/2 right-3 -translate-y-1/2"
                      >
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  {fieldErrors.phoneNumber && (
                    <Typography
                      font="noto"
                      variant="caption1R"
                      className="mt-1 text-red-500"
                    >
                      {fieldErrors.phoneNumber}
                    </Typography>
                  )}
                </div>

                {/* 닉네임 */}
                <div>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className="text-gray-700"
                  >
                    닉네임
                  </Typography>
                  <div className="relative mt-3">
                    <Input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) => handleNicknameChange(e.target.value)}
                      placeholder="닉네임을 입력하세요"
                      maxLength={8}
                      className={cn(
                        "pr-10",
                        fieldErrors.nickname && "border-red-500"
                      )}
                    />
                    {formData.nickname && (
                      <button
                        onClick={() => handleNicknameChange("")}
                        className="absolute top-1/2 right-3 -translate-y-1/2"
                      >
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  {fieldErrors.nickname && (
                    <Typography
                      font="noto"
                      variant="caption1R"
                      className="mt-1 text-red-500"
                    >
                      {fieldErrors.nickname}
                    </Typography>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 신청 완료 단계 */}
        {currentStep === "complete" && (
          <div className="p-5">
            <div className="flex min-h-[60vh] flex-col items-center">
              <div className="mt-[174px] mb-[22px] flex h-[120px] w-[120px] items-center justify-center">
                <Image
                  src={IMAGE_URL.ICON.checkComplete.url}
                  alt={IMAGE_URL.ICON.checkComplete.alt}
                  width={100}
                  height={100}
                />
              </div>
              <Typography
                as="h2"
                font="noto"
                variant="heading2B"
                className="mb-4"
              >
                신청이 완료되었어요
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* 하단 고정 버튼 영역 */}
      <div className="fixed right-0 bottom-0 left-0 z-40 mx-auto max-w-[470px] px-4 py-4">
        {renderBottomButton()}
      </div>

      {/* 닉네임 확인 모달 */}
      <Modal
        isOpen={showNicknameConfirm}
        title="닉네임 설정 안내"
        description={`닉네임을 [${formData.nickname}](으)로 설정합니다. 신청 이후 활동 닉네임은 변경 불가합니다.`}
        confirmText="확인"
        cancelText="취소"
        onConfirm={handleNicknameConfirm}
        onClose={() => setShowNicknameConfirm(false)}
      />
      {/* 통합 바텀시트 */}
      <ActivityPickerBottomSheet
        pickerType={activePickerType}
        isOpen={activePickerType !== null}
        onClose={handlePickerClose}
        formData={formData}
        onRegionSelect={handleRegionSelectWithAutoNext}
        onSituationSelect={handleSituationSelectWithAutoNext}
        onSourceSelect={handleSourceSelectWithAutoNext}
        onMotivationSelect={handleMotivationSelectWithAutoNext}
        onTermsAgree={handleTermsAgree}
        onTermsCheckChange={(checked) =>
          formHook.updateFormData({ agreedToTerms: checked })
        }
        isTermsAgreeLoading={applyMutation.isPending}
        selectedRegionCode={selectedRegionCode}
        onRegionCodeSelect={setSelectedRegionCode}
      />

      {/* 에러 모달 */}
      <Modal
        isOpen={isErrorModalOpen}
        title="오류가 발생했어요"
        description={errorMessage}
        confirmText="확인"
        onConfirm={closeErrorModal}
        onClose={closeErrorModal}
        variant="primary"
      />

      {/* 로그인 필요 모달 */}
      <Modal
        isOpen={isLoginRequiredModalOpen}
        title="로그인이 필요해요"
        description="로그인이 필요합니다."
        confirmText="확인"
        onConfirm={closeLoginRequiredModal}
        onClose={closeLoginRequiredModal}
        variant="primary"
      />
    </div>
  );
};

/**
 * @description 활동 신청 페이지
 */
const ProgramApplyPage = () => {
  const hasRedirectedRef = useRef(false);

  const initialHasCookie =
    typeof document !== "undefined" ? hasAuthCookie() : false;
  const initialCurrentUser =
    typeof window !== "undefined" ? getCurrentUser() : null;

  const shouldRedirect = !initialHasCookie && !initialCurrentUser;

  useLayoutEffect(() => {
    if (
      shouldRedirect &&
      typeof window !== "undefined" &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      removeAuthCookie();
      window.location.replace(LINK_URL.LOGIN);
    }
  }, [shouldRedirect]);

  if (shouldRedirect) {
    return null;
  }

  return <ProgramApplyPageContent />;
};

export default ProgramApplyPage;
