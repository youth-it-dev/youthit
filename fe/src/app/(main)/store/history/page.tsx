"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import * as Api from "@/api/generated/store-api";
import CommunityInfiniteScrollTrigger from "@/components/community/CommunityInfiniteScrollTrigger";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { storeKeys } from "@/constants/generated/query-keys";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { StorePurchase } from "@/types/generated/api-schema";
import type {
  TGETStorePurchasesRes,
  TGETStorePurchasesReq,
} from "@/types/generated/store-types";
import { cn } from "@/utils/shared/cn";
import { getDeliveryStatusText, getProductName } from "@/utils/store/purchase";

const PAGE_SIZE = 20;
const DETAIL_BUTTON_WIDTH = 80; // 상세 보기 버튼 영역 너비 (px)

type PurchaseSection = NonNullable<
  TGETStorePurchasesRes["purchasesByDate"]
>[number];

/**
 * @description 구매 항목 카드 컴포넌트
 */
const PurchaseItemCard = ({
  purchase,
  isLast,
}: {
  purchase: StorePurchase;
  isLast?: boolean;
}) => {
  const productName = getProductName(purchase.title);
  const status = getDeliveryStatusText(purchase.deliveryCompleted);
  const points = purchase.requiredPoints || 0;
  const quantity = purchase.quantity || 1;
  const formattedPoints = points.toLocaleString();

  // 이미지 URL 추출
  const imageUrl = purchase.productImage?.[0]?.url;
  const hasImage = !!imageUrl;

  const detailPageUrl = `${LINK_URL.STORE_HISTORY}/${purchase.purchaseId}`;

  return (
    <Link
      href={detailPageUrl}
      className={cn(
        "relative flex items-center gap-3 py-4",
        !isLast && "border-b border-gray-200"
      )}
    >
      {/* 상품권 썸네일 */}
      <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
        {hasImage ? (
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <Package className="h-6 w-6 text-gray-400" strokeWidth={1.5} />
        )}
      </div>

      {/* 상품 정보 */}
      <div
        className="flex flex-1 flex-col gap-1"
        style={{ paddingRight: `${DETAIL_BUTTON_WIDTH}px` }}
      >
        <div className="flex items-start">
          <Typography font="noto" variant="label2B" className="text-blue-500">
            {status}
          </Typography>
        </div>
        <Typography font="noto" variant="body2B" className="text-gray-900">
          {productName}
        </Typography>
        <Typography font="noto" variant="label1B" className="text-gray-500">
          {formattedPoints}N | {quantity}개
        </Typography>
      </div>

      {/* 상세 보기 버튼 (우측 하단) */}
      <div className="pointer-events-none absolute right-4 bottom-4 flex shrink-0 items-center gap-1">
        <Typography font="noto" variant="body3R" className="text-gray-400">
          상세 보기
        </Typography>
        <svg
          className="h-4 w-4 text-gray-400"
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
      </div>
    </Link>
  );
};

/**
 * @description 날짜별 구매 섹션 컴포넌트
 */
const PurchaseSection = ({ section }: { section: PurchaseSection }) => {
  const dateLabel = section.dateLabel || section.date || "";
  const purchases = section.items || [];

  return (
    <section className="mb-8">
      {/* 날짜 헤더 */}
      <div className="mb-3">
        <Typography font="noto" variant="body3M" className="text-gray-700">
          {dateLabel}
        </Typography>
      </div>

      {/* 구매 항목 목록 */}
      <div className="rounded-lg border border-gray-200 px-4">
        {purchases.map((purchase, index) => (
          <PurchaseItemCard
            key={purchase.purchaseId ?? `purchase-fallback-${index}`}
            purchase={purchase}
            isLast={index === purchases.length - 1}
          />
        ))}
      </div>
    </section>
  );
};

/**
 * @description 로딩 스켈레톤 컴포넌트
 */
const LoadingSkeleton = () => {
  return (
    <div className="px-4 py-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="mb-6">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * @description 빈 상태 컴포넌트
 */
const EmptyState = () => {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Typography font="noto" variant="body2R" className="text-gray-500">
        신청 내역이 없습니다.
      </Typography>
    </div>
  );
};

/**
 * @description 스토어 신청 내역 목록 페이지
 */
const StoreHistoryPage = () => {
  const setTitle = useTopBarStore((state) => state.setTitle);

  // 무한 스크롤 API 호출
  const {
    data: purchasesPagesData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<TGETStorePurchasesRes, Error>({
    queryKey: storeKeys.getStorePurchases({
      pageSize: PAGE_SIZE,
    }),
    queryFn: async ({ pageParam }) => {
      const request: TGETStorePurchasesReq = {
        pageSize: PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam as string } : {}),
      };
      const response = await Api.getStorePurchases(request);
      return response.data;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.hasMore && lastPage.pagination.nextCursor) {
        return lastPage.pagination.nextCursor;
      }
      return undefined;
    },
  });

  // 모든 페이지의 purchasesByDate를 합치기
  const purchaseSections = useMemo(() => {
    if (!purchasesPagesData?.pages) return [];

    return purchasesPagesData.pages.flatMap(
      (page) => page?.purchasesByDate || []
    );
  }, [purchasesPagesData]);

  useEffect(() => {
    setTitle("신청내역");
    return () => {
      setTitle("");
    };
  }, [setTitle]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4 pt-12">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          데이터를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <LoadingSkeleton />
      </div>
    );
  }

  if (purchaseSections.length === 0) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-12">
      <div className="px-4 py-6">
        {purchaseSections.map((section, index) => (
          <PurchaseSection
            key={section.date || `section-${index}`}
            section={section}
          />
        ))}

        {/* 무한 스크롤 트리거 */}
        <CommunityInfiniteScrollTrigger
          hasNextPage={hasNextPage ?? false}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />

        {/* 로딩 중 표시 */}
        {isFetchingNextPage && (
          <div className="py-4 text-center">
            <Typography font="noto" variant="body2R" className="text-gray-400">
              로딩 중...
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreHistoryPage;
