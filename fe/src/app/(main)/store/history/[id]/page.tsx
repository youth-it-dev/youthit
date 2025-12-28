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

const PAGE_SIZE = 20; // 목록 페이지와 동일한 페이지 크기

/**
 * @description title에서 상품명 추출
 */
const getProductName = (title?: string): string => {
  if (!title) return "-";
  const parts = title.split(" - ");
  return parts[0] || "-";
};

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

  // 모든 페이지에서 해당 purchaseId가 속한 날짜 섹션 찾기
  const purchaseSection = useMemo<{
    dateLabel?: string;
    items: StorePurchase[];
  } | null>(() => {
    if (!purchasesPagesData?.pages) return null;

    for (const page of purchasesPagesData.pages) {
      if (!page?.purchasesByDate) continue;
      for (const section of page.purchasesByDate) {
        if (!section.items) continue;
        const found = section.items.find(
          (item) => item.purchaseId === purchaseId
        );
        if (found) {
          return {
            dateLabel: section.dateLabel,
            items: section.items,
          };
        }
      }
    }
    return null;
  }, [purchasesPagesData, purchaseId]);

  // 총 사용 나다움 계산 (모든 아이템의 requiredPoints * quantity 합계)
  const totalRequiredPoints = useMemo(() => {
    if (!purchaseSection?.items) return 0;
    return purchaseSection.items.reduce((sum, item) => {
      return sum + (item.requiredPoints || 0) * (item.quantity || 1);
    }, 0);
  }, [purchaseSection]);

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
  if (!purchaseSection) {
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

  // 현재 선택된 아이템 찾기 (주문번호 등에 사용)
  const currentPurchase =
    purchaseSection.items.find((item) => item.purchaseId === purchaseId) ||
    purchaseSection.items[0];

  return (
    <div className="min-h-screen bg-white pt-12">
      <div className="px-4 py-6">
        {/* 주문번호 */}
        <div className="mb-5 rounded-lg bg-gray-50 p-4">
          <Typography font="noto" variant="body1M" className="text-gray-600">
            주문번호{" "}
            {currentPurchase.purchaseId
              ? `C${currentPurchase.purchaseId.slice(-10).toUpperCase()}`
              : "-"}
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
            {/* 상품 정보 리스트 */}
            <div className="mb-4 space-y-4">
              {purchaseSection.items.map((item, index) => (
                <div key={item.purchaseId || index}>
                  <div className="flex items-stretch gap-3">
                    {/* 상품 이미지 */}
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
                      {item.productImage?.[0]?.url ? (
                        <Image
                          src={item.productImage[0].url}
                          alt={getProductName(item.title)}
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
                        {item.deliveryCompleted ? "전달 완료" : "신청 완료"}
                      </Typography>
                      <Typography
                        font="noto"
                        variant="body2B"
                        className="text-gray-900"
                      >
                        {getProductName(item.title)}
                      </Typography>
                      <Typography
                        font="noto"
                        variant="label1B"
                        className="text-gray-500"
                      >
                        {(item.requiredPoints || 0).toLocaleString()}N |{" "}
                        {item.quantity || 1}개
                      </Typography>
                    </div>
                  </div>
                  {/* 마지막 아이템이 아니면 구분선 추가 */}
                  {index < purchaseSection.items.length - 1 && (
                    <div className="mt-4 border-t border-gray-200" />
                  )}
                </div>
              ))}
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
