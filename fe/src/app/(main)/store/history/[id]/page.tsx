"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { storeKeys } from "@/constants/generated/query-keys";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { StorePurchase } from "@/types/generated/api-schema";
import type { TGETStorePurchasesRes } from "@/types/generated/store-types";
import {
  formatOrderNumber,
  getDeliveryStatusText,
  getProductName,
} from "@/utils/store/purchase";

const PAGE_SIZE = 20; // 목록 페이지와 동일한 페이지 크기

/**
 * @description 스토어 신청내역 상세 페이지
 */
const StoreHistoryDetailPage = () => {
  const params = useParams();
  const purchaseId = params.id as string;
  const setTitle = useTopBarStore((state) => state.setTitle);
  const queryClient = useQueryClient();

  // 목록 페이지에서 사용하는 쿼리 키로 캐시된 데이터 가져오기
  const queryKey = storeKeys.getStorePurchases({
    pageSize: PAGE_SIZE,
  });

  // React Query 캐시에서 목록 데이터 가져오기 (useInfiniteQuery 구조)
  const purchasesPagesData =
    queryClient.getQueryData<InfiniteData<TGETStorePurchasesRes>>(queryKey);

  // 모든 페이지에서 해당 purchaseId 찾기
  const currentPurchase = useMemo<StorePurchase | null>(() => {
    if (!purchasesPagesData?.pages) return null;

    for (const page of purchasesPagesData.pages) {
      if (!page?.purchasesByDate) continue;
      for (const section of page.purchasesByDate) {
        if (!section.items) continue;
        const found = section.items.find(
          (item) => item.purchaseId === purchaseId
        );
        if (found) {
          return found;
        }
      }
    }
    return null;
  }, [purchasesPagesData, purchaseId]);

  // 총 사용 나다움 계산 (개별 아이템의 requiredPoints * quantity)
  const totalRequiredPoints = currentPurchase
    ? (currentPurchase.requiredPoints || 0) * (currentPurchase.quantity || 1)
    : 0;

  useEffect(() => {
    setTitle("신청 내역 상세");
    return () => {
      setTitle("");
    };
  }, [setTitle]);

  // 로딩 상태 (캐시에 데이터가 없을 때)
  if (!purchasesPagesData) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <div className="px-4 py-6">
          <Skeleton className="mb-5 h-12 w-full rounded-lg" />
          <Skeleton className="mb-8 h-32 w-full rounded-lg" />
          <Skeleton className="mb-8 h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // 데이터를 찾지 못한 경우
  if (!currentPurchase) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Typography font="noto" variant="body2R" className="text-gray-500">
            신청 내역을 찾을 수 없습니다.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-12">
      <div className="px-4 py-6">
        {/* 주문번호 */}
        <div className="mb-5 rounded-lg bg-gray-50 p-4">
          <Typography font="noto" variant="body1M" className="text-gray-600">
            주문번호 {formatOrderNumber(currentPurchase.purchaseId)}
          </Typography>
        </div>

        {/* 신청자 정보 */}
        <section className="mb-8">
          <Typography
            font="noto"
            variant="heading3B"
            className="mb-[10px] block text-gray-700"
          >
            신청자 정보
          </Typography>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center">
              <Typography
                font="noto"
                variant="body3M"
                className="w-20 text-gray-500"
              >
                이름
              </Typography>
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-950"
              >
                {currentPurchase.recipientName || "-"}
              </Typography>
            </div>
            <div className="flex items-center">
              <Typography
                font="noto"
                variant="body3M"
                className="w-20 text-gray-500"
              >
                휴대폰 번호
              </Typography>
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-950"
              >
                {currentPurchase.recipientPhone || "-"}
              </Typography>
            </div>
          </div>
        </section>

        {/* 결제 정보 */}
        <section className="mb-8">
          <Typography
            font="noto"
            variant="heading3B"
            className="mb-[10px] block text-gray-700"
          >
            결제 정보
          </Typography>
          <div className="rounded-lg border border-gray-200 p-4">
            {/* 상품 정보 */}
            <div className="mb-4 flex items-stretch gap-3">
              {/* 상품 이미지 */}
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
                {currentPurchase.productImage?.[0]?.url ? (
                  <Image
                    src={currentPurchase.productImage[0].url}
                    alt={getProductName(currentPurchase.title)}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <Package
                    className="h-8 w-8 text-gray-400"
                    strokeWidth={1.5}
                  />
                )}
              </div>

              {/* 상품 상세 정보 */}
              <div className="flex flex-1 flex-col justify-between self-stretch">
                <Typography
                  font="noto"
                  variant="label2B"
                  className="text-main-500"
                >
                  {getDeliveryStatusText(currentPurchase.deliveryCompleted)}
                </Typography>
                <Typography
                  font="noto"
                  variant="body2B"
                  className="text-gray-900"
                >
                  {getProductName(currentPurchase.title)}
                </Typography>
                <Typography
                  font="noto"
                  variant="label1B"
                  className="text-gray-500"
                >
                  {(currentPurchase.requiredPoints || 0).toLocaleString()}N |{" "}
                  {currentPurchase.quantity || 1}개
                </Typography>
              </div>
            </div>

            {/* 구분선 */}
            <div className="mb-4 border-t border-gray-200" />

            {/* 총 사용 나다움 */}
            <div className="flex items-center justify-between">
              <Typography
                font="noto"
                variant="body2B"
                className="text-gray-950"
              >
                총 사용 나다움
              </Typography>
              <Typography
                font="noto"
                variant="body2B"
                className="text-gray-950"
              >
                {totalRequiredPoints.toLocaleString()} N
              </Typography>
            </div>
          </div>
        </section>

        {/* TODO: API 완료 시 연동 */}
        {/* <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <Typography font="noto" variant="label1R" className="text-gray-400">
            관련 문의는 선물 상세 페이지에 남겨주세요.
          </Typography>
          <button
            onClick={handleInquiryClick}
            className="flex items-center gap-1 text-blue-600"
          >
            <Typography font="noto" variant="label1M" className="text-gray-700">
              문의 남기기
            </Typography>
            <svg
              className="h-4 w-4 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default StoreHistoryDetailPage;
