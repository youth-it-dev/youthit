"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Input from "@/components/shared/input";
import { Typography } from "@/components/shared/typography";
import Modal from "@/components/shared/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import {
  useGetStoreProductsById,
  usePostStorePurchases,
} from "@/hooks/generated/store-hooks";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { cn } from "@/utils/shared/cn";
import { getErrorMessage } from "@/utils/shared/error";

/**
 * @description 구매 단계 타입
 */
type PurchaseStep = "recipient-info" | "review" | "complete";

/**
 * @description 구매 폼 데이터 타입
 */
interface PurchaseFormData {
  recipientName: string;
  recipientPhone: string;
  quantity: number;
}

/**
 * @description 수령인 이름 유효성 검사
 */
const validateRecipientName = (
  name: string
): { isValid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: "수령인 이름을 입력해주세요." };
  }
  if (name.trim().length < 2) {
    return {
      isValid: false,
      error: "수령인 이름은 최소 2자 이상이어야 합니다.",
    };
  }
  if (name.length > 20) {
    return {
      isValid: false,
      error: "수령인 이름은 최대 20자까지 입력 가능합니다.",
    };
  }
  // 한글, 영문, 공백만 허용
  const nameRegex = /^[가-힣a-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    return { isValid: false, error: "한글, 영문, 공백만 입력 가능합니다." };
  }
  return { isValid: true };
};

/**
 * @description 전화번호 포맷팅 (010-1234-5678)
 */
const formatPhoneNumber = (phone: string): string => {
  if (phone.length !== 11) return phone;
  return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7, 11)}`;
};

/**
 * @description 상품 구매 페이지
 */
const StorePurchasePage = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = params.id as string;

  // URL에서 수량 정보 가져오기
  const quantityFromUrl = parseInt(searchParams.get("quantity") || "1", 10);

  // TopBar 제어
  const setTitle = useTopBarStore((state) => state.setTitle);
  const setLeftSlot = useTopBarStore((state) => state.setLeftSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 현재 단계
  const [currentStep, setCurrentStep] =
    useState<PurchaseStep>("recipient-info");

  // localStorage 키
  const STORAGE_KEY = `purchase-form-${productId}`;

  // 폼 데이터 초기화 (localStorage에서 복원)
  const getInitialFormData = useCallback((): PurchaseFormData => {
    if (typeof window === "undefined") {
      return {
        recipientName: "",
        recipientPhone: "",
        quantity: quantityFromUrl,
      };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          recipientName: parsed.recipientName || "",
          recipientPhone: parsed.recipientPhone || "",
          quantity: quantityFromUrl, // URL에서 받은 수량을 사용
        };
      }
    } catch (error) {
      console.error("폼 데이터 복원 실패:", error);
    }
    return {
      recipientName: "",
      recipientPhone: "",
      quantity: quantityFromUrl,
    };
  }, [STORAGE_KEY, quantityFromUrl]);

  // 폼 데이터 상태
  const [formData, setFormData] =
    useState<PurchaseFormData>(getInitialFormData());

  // 필드별 에러 상태
  const [fieldErrors, setFieldErrors] = useState<{
    recipientName?: string;
    recipientPhone?: string;
  }>({});

  // 에러 모달 상태
  const {
    isOpen: isErrorModalOpen,
    open: openErrorModal,
    close: closeErrorModal,
  } = useToggle();
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 상품 상세 정보 조회
  const {
    data: productData,
    isLoading: isProductLoading,
    error: productError,
  } = useGetStoreProductsById({
    request: { productId },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      return data.product || null;
    },
  });

  // 사용자 정보 조회
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => data?.user,
  });

  // QueryClient 가져오기
  const queryClient = useQueryClient();

  // 구매 mutation
  const purchaseMutation = usePostStorePurchases({
    onSuccess: () => {
      // localStorage 정리
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }

      // 스토어 신청내역 목록 조회 캐시 무효화 (모든 pageSize, cursor 변형 포함)
      queryClient.invalidateQueries({
        queryKey: ["store", "getStorePurchases"],
      });

      setCurrentStep("complete");
    },
    onError: (error: unknown) => {
      console.error("주문 실패:", error);
      const message = getErrorMessage(error, "주문 중 오류가 발생했습니다.");
      setErrorMessage(message);
      openErrorModal();
    },
  });

  // 폼 데이터 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== "undefined" && currentStep !== "complete") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      } catch (error) {
        console.error("폼 데이터 저장 실패:", error);
      }
    }
  }, [formData, STORAGE_KEY, currentStep]);

  // 수령인 이름 입력 핸들러
  const handleRecipientNameChange = useCallback((value: string) => {
    const limitedValue = value.slice(0, 20);
    setFormData((prev) => ({ ...prev, recipientName: limitedValue }));

    if (!limitedValue.trim()) {
      setFieldErrors((prev) => ({ ...prev, recipientName: undefined }));
      return;
    }

    const validationResult = validateRecipientName(limitedValue);
    setFieldErrors((prev) => ({
      ...prev,
      recipientName: validationResult.isValid
        ? undefined
        : validationResult.error,
    }));
  }, []);

  // 수령인 전화번호 입력 핸들러
  const handleRecipientPhoneChange = useCallback(
    (value: string) => {
      const numbersOnly = value.replace(/[^0-9]/g, "");
      setFormData((prev) => ({ ...prev, recipientPhone: numbersOnly }));

      if (fieldErrors.recipientPhone) {
        setFieldErrors((prev) => ({ ...prev, recipientPhone: undefined }));
      }
    },
    [fieldErrors.recipientPhone]
  );

  // 이전 단계로 이동
  const goToPreviousStep = useCallback(() => {
    if (currentStep === "recipient-info") {
      router.back();
      return;
    }

    const stepOrder: PurchaseStep[] = ["recipient-info", "review", "complete"];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }, [currentStep, router]);

  // TopBar 설정
  useEffect(() => {
    setTitle("주문하기");

    // 완료 단계에서는 뒤로가기 버튼 숨김
    if (currentStep !== "complete") {
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
    } else {
      setLeftSlot(null);
    }

    return () => {
      resetTopBar();
    };
  }, [setTitle, setLeftSlot, resetTopBar, goToPreviousStep, currentStep]);

  // 수령인 정보 다음 버튼
  const handleRecipientInfoNext = useCallback(() => {
    const nameValidation = validateRecipientName(formData.recipientName);
    const isPhoneValid = formData.recipientPhone.length === 11;

    const errors: { recipientName?: string; recipientPhone?: string } = {};

    if (!nameValidation.isValid) {
      errors.recipientName = nameValidation.error;
    }

    if (!isPhoneValid) {
      errors.recipientPhone = "전화번호 11자리를 입력해주세요.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      return;
    }

    setCurrentStep("review");
  }, [formData.recipientName, formData.recipientPhone]);

  // 주문하기 버튼
  const handlePurchase = useCallback(() => {
    if (!productData?.id) return;

    purchaseMutation.mutate({
      data: {
        productId: productData.id,
        quantity: formData.quantity,
        recipientName: formData.recipientName,
        recipientPhone: formData.recipientPhone,
      },
    });
  }, [productData, formData, purchaseMutation]);

  // 주문 완료 후 확인
  const handleComplete = useCallback(() => {
    // 히스토리를 지우고 상품 상세 페이지로 이동
    router.replace(`/store/${productId}`);
  }, [router, productId]);

  const totalRequiredPoints =
    (productData?.requiredPoints || 0) * formData.quantity;
  const userRewards = userData?.rewards || 0;

  // 하단 버튼 렌더링
  const renderBottomButton = useCallback(() => {
    const buttonBaseClass =
      "w-full rounded-lg bg-main-600 px-4 py-3 text-white transition-colors hover:bg-main-700 disabled:bg-gray-300 disabled:hover:bg-gray-300";

    switch (currentStep) {
      case "recipient-info": {
        const isNameValid = validateRecipientName(
          formData.recipientName
        ).isValid;
        const isPhoneValid = formData.recipientPhone.length === 11;
        const isRecipientInfoValid = isNameValid && isPhoneValid;
        return (
          <button
            onClick={handleRecipientInfoNext}
            disabled={!isRecipientInfoValid}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              다음
            </Typography>
          </button>
        );
      }

      case "review": {
        const isInsufficientPoints = totalRequiredPoints > userRewards;
        return (
          <button
            onClick={handlePurchase}
            disabled={purchaseMutation.isPending || isInsufficientPoints}
            className={buttonBaseClass}
          >
            <Typography font="noto" variant="body3R" className="text-white">
              {purchaseMutation.isPending
                ? "처리 중..."
                : isInsufficientPoints
                  ? "나다움이 부족합니다"
                  : "주문하기"}
            </Typography>
          </button>
        );
      }

      case "complete": {
        return (
          <button onClick={handleComplete} className={buttonBaseClass}>
            <Typography font="noto" variant="body3R" className="text-white">
              확인
            </Typography>
          </button>
        );
      }

      default:
        return null;
    }
  }, [
    currentStep,
    formData,
    handleRecipientInfoNext,
    handlePurchase,
    handleComplete,
    purchaseMutation.isPending,
    totalRequiredPoints,
    userRewards,
  ]);

  // 로딩 상태
  if (isProductLoading || !productData) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <div className="mx-auto max-w-[470px] p-5 pb-24">
          <Skeleton className="mb-3 h-8 w-full" />
          <Skeleton className="mb-6 h-4 w-full" />
        </div>
      </div>
    );
  }

  // 에러 상태
  if (productError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4 pt-12">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          상품 정보를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  // 수량 유효성 검사
  if (!quantityFromUrl || quantityFromUrl < 1 || isNaN(quantityFromUrl)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4 pt-12">
        <div className="text-center">
          <Typography
            font="noto"
            variant="body2R"
            className="mb-4 text-gray-500"
          >
            올바르지 않은 수량입니다.
          </Typography>
          <button
            onClick={() => router.push(`/store/${productId}`)}
            className="bg-main-600 rounded-lg px-4 py-2 text-white"
          >
            <Typography font="noto" variant="body3R" className="text-white">
              상품 페이지로 돌아가기
            </Typography>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-12">
      <div className="mx-auto max-w-[470px] pb-24">
        {/* 수령인 정보 입력 단계 */}
        {currentStep === "recipient-info" && (
          <div className="p-5">
            <Typography
              as="h2"
              font="noto"
              variant="heading2B"
              className="mb-3"
            >
              수령인 정보를 알려주세요
            </Typography>
            <Typography
              font="noto"
              variant="body2R"
              className="mb-6 text-gray-600"
            >
              상품을 받으실 분의 이름과 전화번호를 입력해주세요.
            </Typography>

            {/* 수령인 이름 */}
            <div className="mb-4">
              <Typography
                font="noto"
                variant="label1B"
                className="mb-2 text-gray-700"
              >
                수령인 이름
              </Typography>
              <div className="relative">
                <Input
                  type="text"
                  value={formData.recipientName}
                  onChange={(e) => handleRecipientNameChange(e.target.value)}
                  placeholder="수령인 이름 (2-20자)"
                  maxLength={20}
                  className={cn(
                    "pr-10",
                    fieldErrors.recipientName && "border-red-500"
                  )}
                />
                {formData.recipientName && (
                  <button
                    onClick={() => handleRecipientNameChange("")}
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
              {fieldErrors.recipientName && (
                <Typography
                  font="noto"
                  variant="caption1R"
                  className="mt-1 text-red-500"
                >
                  {fieldErrors.recipientName}
                </Typography>
              )}
            </div>

            {/* 수령인 전화번호 */}
            <div>
              <Typography
                font="noto"
                variant="label1B"
                className="mb-2 text-gray-700"
              >
                수령인 전화번호
              </Typography>
              <div className="relative">
                <Input
                  type="tel"
                  value={formData.recipientPhone}
                  onChange={(e) => handleRecipientPhoneChange(e.target.value)}
                  placeholder="01012345678"
                  maxLength={11}
                  className={cn(
                    "pr-10",
                    fieldErrors.recipientPhone && "border-red-500"
                  )}
                />
                {formData.recipientPhone && (
                  <button
                    onClick={() => handleRecipientPhoneChange("")}
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
              {fieldErrors.recipientPhone && (
                <Typography
                  font="noto"
                  variant="caption1R"
                  className="mt-1 text-red-500"
                >
                  {fieldErrors.recipientPhone}
                </Typography>
              )}
              <Typography
                font="noto"
                variant="caption1R"
                className="mt-1 text-gray-400"
              >
                {formData.recipientPhone.length}/11
              </Typography>
            </div>
          </div>
        )}

        {/* 주문 정보 확인 단계 */}
        {currentStep === "review" && (
          <div className="p-5">
            <Typography
              as="h2"
              font="noto"
              variant="heading2B"
              className="mb-4"
            >
              주문 정보를 확인해주세요
            </Typography>

            <div className="space-y-4">
              {/* 상품 정보 */}
              <div>
                <Typography
                  font="noto"
                  variant="label1B"
                  className="mb-2 text-gray-700"
                >
                  주문 상품
                </Typography>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Typography
                    font="noto"
                    variant="body2B"
                    className="text-gray-900"
                  >
                    {productData.name}
                  </Typography>
                  <div className="mt-2 flex items-center justify-between">
                    <Typography
                      font="noto"
                      variant="body3R"
                      className="text-gray-600"
                    >
                      수량: {formData.quantity}개
                    </Typography>
                    <Typography
                      font="noto"
                      variant="body3B"
                      className="text-main-500"
                    >
                      {totalRequiredPoints}N
                    </Typography>
                  </div>
                </div>
              </div>

              {/* 수령인 정보 */}
              <div>
                <Typography
                  font="noto"
                  variant="label1B"
                  className="text-gray-700"
                >
                  수령인 정보
                </Typography>
                <button
                  onClick={() => setCurrentStep("recipient-info")}
                  className="mt-3 w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <Typography
                        font="noto"
                        variant="body2R"
                        className="text-gray-900"
                      >
                        {formData.recipientName}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <Typography
                        font="noto"
                        variant="body2R"
                        className="text-gray-900"
                      >
                        {formatPhoneNumber(formData.recipientPhone)}
                      </Typography>
                    </div>
                  </div>
                </button>
              </div>

              {/* 포인트 정보 */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Typography
                    font="noto"
                    variant="label1R"
                    className="text-gray-600"
                  >
                    보유 나다움
                  </Typography>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className="text-gray-900"
                  >
                    {userRewards}N
                  </Typography>
                </div>
                <div className="flex items-center justify-between">
                  <Typography
                    font="noto"
                    variant="label1R"
                    className="text-gray-600"
                  >
                    필요 나다움
                  </Typography>
                  <Typography
                    font="noto"
                    variant="label1B"
                    className={cn(
                      totalRequiredPoints > userRewards
                        ? "text-red-600"
                        : "text-gray-900"
                    )}
                  >
                    {totalRequiredPoints}N
                  </Typography>
                </div>
                {totalRequiredPoints > userRewards && (
                  <div className="mt-3 rounded-lg bg-red-50 p-3">
                    <Typography
                      font="noto"
                      variant="caption1R"
                      className="text-red-600"
                    >
                      보유 나다움이 부족합니다. (필요: {totalRequiredPoints}N,
                      보유: {userRewards}N)
                    </Typography>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 주문 완료 단계 */}
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
                주문이 완료되었어요
              </Typography>
              <Typography
                font="noto"
                variant="body2R"
                className="text-center text-gray-600"
              >
                영업일 중 5일 내로 전송 예정입니다.
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* 하단 고정 버튼 영역 */}
      <div className="fixed right-0 bottom-0 left-0 z-40 mx-auto max-w-[470px] px-4 py-4">
        {renderBottomButton()}
      </div>

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
    </div>
  );
};

export default StorePurchasePage;
