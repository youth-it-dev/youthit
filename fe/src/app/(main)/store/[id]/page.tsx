"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ExtendedRecordMap } from "notion-types";
import { NotionRenderer } from "react-notion-x";
import "react-notion-x/src/styles.css";
import { InquiryFloatingButton } from "@/components/shared/inquiry/InquiryFloatingButton";
import { Typography } from "@/components/shared/typography";
import Icon from "@/components/shared/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { useGetStoreProductsById } from "@/hooks/generated/store-hooks";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { cn } from "@/utils/shared/cn";
import { getNotionCoverImage } from "@/utils/shared/getNotionCoverImage";
import { shareContent } from "@/utils/shared/share";

/**
 * @description 수량 선택 팝업 컴포넌트
 */
const QuantitySelectorPopup = ({
  productName,
  requiredPoints,
  userRewards,
  isOpen,
  onClose,
  onConfirm,
}: {
  productName?: string;
  requiredPoints?: number;
  userRewards?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) => {
  const [quantity, setQuantity] = useState(1);

  const totalRequiredPoints = (requiredPoints || 0) * quantity;
  const availableRewards = userRewards || 0;
  const isInsufficientPoints = totalRequiredPoints > availableRewards;

  // 팝업이 열릴 때 수량을 1로 초기화
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrease = () => {
    const nextQuantity = quantity + 1;
    const nextTotalRequired = (requiredPoints || 0) * nextQuantity;
    // 보유 포인트를 초과하지 않는 경우에만 증가
    if (nextTotalRequired <= availableRewards) {
      setQuantity(nextQuantity);
    }
  };

  const handleConfirm = () => {
    onConfirm(quantity);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 팝업 */}
      <div className="fixed right-0 bottom-18 left-0 z-50 rounded-t-2xl bg-white p-4 shadow-lg">
        <Typography
          as="h3"
          font="noto"
          variant="heading3B"
          className="mb-4 text-gray-900"
        >
          {productName || "상품"}
        </Typography>

        {/* 수량 선택 */}
        <div className="mb-6 flex items-center justify-between">
          <Typography
            font="noto"
            variant="label1B"
            className="mb-3 text-gray-700"
          >
            수량
          </Typography>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDecrease}
              disabled={quantity <= 1}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border border-gray-300",
                quantity <= 1
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              )}
              aria-label="수량 감소"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
            <Typography
              font="noto"
              variant="heading2M"
              className="min-w-[40px] text-center text-gray-900"
            >
              {quantity}
            </Typography>
            <button
              onClick={handleIncrease}
              disabled={
                (requiredPoints || 0) * (quantity + 1) > availableRewards
              }
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border border-gray-300",
                (requiredPoints || 0) * (quantity + 1) > availableRewards
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              )}
              aria-label="수량 증가"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 포인트 정보 및 경고 메시지 */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <Typography font="noto" variant="label1R" className="text-gray-600">
              보유 나다움
            </Typography>
            <Typography font="noto" variant="label1B" className="text-gray-900">
              {availableRewards}N
            </Typography>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <Typography font="noto" variant="label1R" className="text-gray-600">
              필요 나다움
            </Typography>
            <Typography
              font="noto"
              variant="label1B"
              className={cn(
                isInsufficientPoints ? "text-red-600" : "text-gray-900"
              )}
            >
              {totalRequiredPoints}N
            </Typography>
          </div>
          {isInsufficientPoints && (
            <div className="mt-2 rounded-lg bg-red-50 p-3">
              <Typography
                font="noto"
                variant="caption1R"
                className="text-red-600"
              >
                보유 나다움이 부족합니다. (필요: {totalRequiredPoints}N, 보유:{" "}
                {availableRewards}N)
              </Typography>
            </div>
          )}
        </div>

        {/* 신청하기 버튼 */}
        <button
          onClick={handleConfirm}
          disabled={isInsufficientPoints}
          className={cn(
            "w-full rounded-lg px-4 py-3 text-white transition-colors",
            isInsufficientPoints
              ? "cursor-not-allowed bg-gray-400"
              : "bg-main-600 hover:bg-main-700"
          )}
        >
          <Typography font="noto" variant="body3R" className="text-white">
            신청하기
          </Typography>
        </button>
      </div>
    </>
  );
};

/**
 * @description 스토어 상품 상세 페이지
 */
const StoreProductDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [shouldLoadNotion, setShouldLoadNotion] = useState(false);
  const [isQuantityPopupOpen, setIsQuantityPopupOpen] = useState(false);

  // TopBar 제어
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 상품 상세 정보 조회
  const {
    data: productData,
    isLoading,
    error,
  } = useGetStoreProductsById({
    request: { productId },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      return data.product || null;
    },
  });

  // 사용자 리워드 조회 (React Query 캐시에서 재사용)
  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => {
      return data?.user;
    },
  });

  // 공유하기 기능
  const handleShare = useCallback(async () => {
    if (!productData) return;

    const productTitle = productData.name || "상품";
    const shareTitle = `${productTitle}`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareText = productData.description || shareTitle;

    await shareContent({
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    });
  }, [productData]);

  // 상품 데이터 로드 시 TopBar title과 rightSlot 설정
  useEffect(() => {
    if (!productData) return;

    // 공유하기 버튼
    const shareButton = (
      <button
        onClick={handleShare}
        className="flex h-10 w-10 items-center justify-center"
        aria-label="공유하기"
      >
        <Icon
          src={IMAGE_URL.ICON.share.url}
          width={24}
          height={24}
          className="text-gray-600"
        />
      </button>
    );
    setRightSlot(shareButton);

    return () => {
      resetTopBar();
    };
  }, [productData, setRightSlot, resetTopBar, handleShare]);

  // Notion 데이터 지연 로드
  useEffect(() => {
    if (!productData || shouldLoadNotion) return;

    const timer = setTimeout(() => {
      setShouldLoadNotion(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [productData, shouldLoadNotion]);

  // Notion 데이터 조회
  const { data: notionRecordMap } = useQuery<ExtendedRecordMap, Error>({
    queryKey: ["notion-product-blocks", productId],
    queryFn: async () => {
      const response = await fetch(`/api/notion/${productId}/blocks`);
      if (!response.ok) {
        throw new Error(`Notion API 요청 실패: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data as ExtendedRecordMap;
    },
    enabled: shouldLoadNotion && !!productId,
  });

  // 썸네일 이미지 URL 추출 (커버 이미지 우선, 없으면 thumbnail 첫 번째)
  const getThumbnailUrl = (): string | null => {
    // 1. 노션 커버 이미지 우선 확인
    if (notionRecordMap) {
      const coverImage = getNotionCoverImage(notionRecordMap, productId);
      if (coverImage) return coverImage;
    }

    // 2. thumbnail 배열의 첫 번째 이미지
    if (productData?.thumbnail && productData.thumbnail.length > 0) {
      return productData.thumbnail[0]?.url || null;
    }

    return null;
  };

  // 수량 선택 팝업에서 신청하기 클릭 - 구매 페이지로 이동
  const handlePurchaseConfirm = useCallback(
    (quantity: number) => {
      if (!productData?.id) return;
      // 선택한 수량과 함께 구매 페이지로 이동
      router.push(`/store/${productId}/purchase?quantity=${quantity}`);
    },
    [router, productId, productData]
  );

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4 pt-12">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          데이터를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  if (isLoading || !productData) {
    return (
      <div className="mt-12 min-h-screen bg-white">
        <div className="space-y-6 p-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const thumbnailUrl = getThumbnailUrl();
  const userRewards = userData?.rewards || 0;
  const isInsufficientPoints = userRewards < (productData.requiredPoints || 0);

  return (
    <div className="min-h-screen bg-white pt-12">
      {/* 썸네일 영역 */}
      <div className="relative aspect-square w-full max-w-[470px] overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={productData.name || "상품 이미지"}
            fill
            className="object-cover"
            sizes="(max-width: 470px) 100vw, 470px"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <Typography font="noto" variant="body2R" className="text-gray-400">
              이미지 없음
            </Typography>
          </div>
        )}
      </div>

      {/* 제목 및 설명 */}
      <div className="w-full bg-white px-4 pt-4">
        <Typography as="h2" font="noto" variant="title5" className="mb-2">
          {productData.name || "-"}
        </Typography>
        <Typography font="noto" variant="heading3B" className="text-main-500">
          {productData.requiredPoints || 0}N
        </Typography>
      </div>

      {/* 전달 정보 */}
      <div className="w-full bg-white px-4 pt-4 pb-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4">
          <Typography
            font="noto"
            variant="label1B"
            className="mb-2 text-gray-700"
          >
            전달 정보
          </Typography>
          <Typography
            font="noto"
            variant="label1R"
            className="ml-1 text-gray-600"
          >
            영업일 중 5일 내로 전송 예정
          </Typography>
        </div>
      </div>

      {/* 상세 설명 */}
      <div className="pb-24">
        {notionRecordMap ? (
          <div className="notion-page">
            <NotionRenderer
              recordMap={notionRecordMap}
              fullPage={false}
              darkMode={false}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
            <Typography font="noto" variant="body2R" className="text-gray-500">
              컨텐츠를 불러오는 중...
            </Typography>
          </div>
        )}
      </div>

      {/* 문의하기 플로팅 버튼 */}
      <InquiryFloatingButton />

      {/* 하단 고정 버튼 */}
      <div className="pb-safe fixed bottom-0 z-20 w-full max-w-[470px] bg-white p-4">
        <button
          onClick={() => setIsQuantityPopupOpen(true)}
          disabled={isInsufficientPoints}
          className={cn(
            "w-full rounded-lg px-4 py-3 text-white transition-colors",
            isInsufficientPoints
              ? "cursor-not-allowed bg-gray-400"
              : "bg-main-600 hover:bg-main-700"
          )}
        >
          <Typography font="noto" variant="body3R" className="text-white">
            신청하기
          </Typography>
        </button>
      </div>

      {/* 수량 선택 팝업 */}
      <QuantitySelectorPopup
        productName={productData.name}
        requiredPoints={productData.requiredPoints}
        userRewards={userRewards}
        isOpen={isQuantityPopupOpen}
        onClose={() => setIsQuantityPopupOpen(false)}
        onConfirm={handlePurchaseConfirm}
      />
    </div>
  );
};

export default StoreProductDetailPage;
