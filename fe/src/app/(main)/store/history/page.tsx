"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as Api from "@/api/generated/store-api";
import CommunityInfiniteScrollTrigger from "@/components/community/CommunityInfiniteScrollTrigger";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { storeKeys } from "@/constants/generated/query-keys";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { TGETStorePurchasesRes } from "@/types/generated/store-types";
import { cn } from "@/utils/shared/cn";
import { formatDateWithDayKorean } from "@/utils/shared/date";

// 🎨 목데이터 모드 활성화 (화면 확인용)
const USE_MOCK_DATA = true;

// 목데이터 생성
const generateMockData = (): TGETStorePurchasesRes => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const formatDate = (date: Date): string => {
    return date.toISOString();
  };

  return {
    purchases: [
      // 오늘 날짜
      {
        purchaseId: "purchase-1",
        title: "스타벅스 아메리카노 기프티콘 - 홍길동 - 2024-01-15",
        userId: "user-1",
        userNickname: "홍길동",
        productId: "product-1",
        quantity: 1,
        requiredPoints: 5000,
        recipientName: "홍길동",
        recipientPhone: "010-1234-5678",
        deliveryCompleted: true,
        orderDate: formatDate(now),
        lastEditedTime: formatDate(now),
      },
      {
        purchaseId: "purchase-2",
        title: "CU 편의점 상품권 1만원 - 김철수 - 2024-01-15",
        userId: "user-2",
        userNickname: "김철수",
        productId: "product-2",
        quantity: 2,
        requiredPoints: 10000,
        recipientName: "김철수",
        recipientPhone: "010-2345-6789",
        deliveryCompleted: false,
        orderDate: formatDate(now),
        lastEditedTime: formatDate(now),
      },
      {
        purchaseId: "purchase-3",
        title: "GS25 편의점 상품권 5천원 - 이영희 - 2024-01-15",
        userId: "user-3",
        userNickname: "이영희",
        productId: "product-3",
        quantity: 1,
        requiredPoints: 3000,
        recipientName: "이영희",
        recipientPhone: "010-3456-7890",
        deliveryCompleted: true,
        orderDate: formatDate(now),
        lastEditedTime: formatDate(now),
      },
      // 어제 날짜
      {
        purchaseId: "purchase-4",
        title: "이마트 상품권 3만원 - 박민수 - 2024-01-14",
        userId: "user-4",
        userNickname: "박민수",
        productId: "product-4",
        quantity: 1,
        requiredPoints: 15000,
        recipientName: "박민수",
        recipientPhone: "010-4567-8901",
        deliveryCompleted: true,
        orderDate: formatDate(yesterday),
        lastEditedTime: formatDate(yesterday),
      },
      {
        purchaseId: "purchase-5",
        title: "올리브영 상품권 2만원 - 최지은 - 2024-01-14",
        userId: "user-5",
        userNickname: "최지은",
        productId: "product-5",
        quantity: 3,
        requiredPoints: 20000,
        recipientName: "최지은",
        recipientPhone: "010-5678-9012",
        deliveryCompleted: false,
        orderDate: formatDate(yesterday),
        lastEditedTime: formatDate(yesterday),
      },
      // 일주일 전
      {
        purchaseId: "purchase-6",
        title: "교보문고 상품권 1만원 - 정수진 - 2024-01-08",
        userId: "user-6",
        userNickname: "정수진",
        productId: "product-6",
        quantity: 1,
        requiredPoints: 8000,
        recipientName: "정수진",
        recipientPhone: "010-6789-0123",
        deliveryCompleted: true,
        orderDate: formatDate(lastWeek),
        lastEditedTime: formatDate(lastWeek),
      },
      {
        purchaseId: "purchase-7",
        title: "CGV 영화관람권 - 강동원 - 2024-01-08",
        userId: "user-7",
        userNickname: "강동원",
        productId: "product-7",
        quantity: 2,
        requiredPoints: 12000,
        recipientName: "강동원",
        recipientPhone: "010-7890-1234",
        deliveryCompleted: true,
        orderDate: formatDate(lastWeek),
        lastEditedTime: formatDate(lastWeek),
      },
      // 2주 전
      {
        purchaseId: "purchase-8",
        title: "롯데마트 상품권 5만원 - 윤서연 - 2024-01-01",
        userId: "user-8",
        userNickname: "윤서연",
        productId: "product-8",
        quantity: 1,
        requiredPoints: 25000,
        recipientName: "윤서연",
        recipientPhone: "010-8901-2345",
        deliveryCompleted: true,
        orderDate: formatDate(twoWeeksAgo),
        lastEditedTime: formatDate(twoWeeksAgo),
      },
    ],
    pagination: {
      hasMore: false,
      nextCursor: undefined,
      currentPageCount: 8,
    },
  };
};

type PurchaseItem = NonNullable<
  NonNullable<TGETStorePurchasesRes["purchases"]>[number]
>;

type PurchaseSection = {
  date: string;
  purchases: PurchaseItem[];
};

/**
 * @description 구매 항목 카드 컴포넌트
 */
const PurchaseItemCard = ({
  purchase,
  isLast,
}: {
  purchase: PurchaseItem;
  isLast?: boolean;
}) => {
  // title에서 상품명 추출 (형식: "상품명 - 주문자닉네임 - 주문일시")
  const getProductName = (title?: string): string => {
    if (!title) return "-";
    const parts = title.split(" - ");
    return parts[0] || "-";
  };

  const productName = getProductName(purchase.title);
  const status = purchase.deliveryCompleted ? "전달 완료" : "신청 완료";
  const points = purchase.requiredPoints || 0;
  const quantity = purchase.quantity || 1;
  const formattedPoints = points.toLocaleString();

  // 이미지 URL 생성 (Unsplash 사용)
  // purchaseId를 seed로 사용하여 각 항목마다 다른 이미지 표시
  const imageSeed = purchase.purchaseId
    ? purchase.purchaseId
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : Math.floor(Math.random() * 1000);
  const imageUrl = `https://images.unsplash.com/photo-${imageSeed}?w=60&h=60&fit=crop`;

  const detailPageUrl = `${LINK_URL.STORE_HISTORY}/${purchase.purchaseId}`;

  return (
    <Link
      href={detailPageUrl}
      className={cn(
        "flex items-center gap-3 py-4",
        !isLast && "border-b border-gray-200"
      )}
    >
      {/* 상품권 썸네일 */}
      <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded bg-gray-200">
        <Image
          src={imageUrl}
          alt={productName}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* 상품 정보 */}
      <div className="flex flex-1 flex-col gap-1">
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
    </Link>
  );
};

/**
 * @description 날짜별 구매 섹션 컴포넌트
 */
const PurchaseSection = ({ section }: { section: PurchaseSection }) => {
  // 섹션의 첫 번째 구매 항목의 상세 페이지로 이동
  const firstPurchaseId = section.purchases[0]?.purchaseId;
  const detailPageUrl = firstPurchaseId
    ? `${LINK_URL.STORE_HISTORY}/${firstPurchaseId}`
    : LINK_URL.STORE_HISTORY;

  return (
    <section key={section.date} className="mb-8">
      {/* 날짜 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <Typography font="noto" variant="body3M" className="text-gray-700">
          {section.date}
        </Typography>
        <Link href={detailPageUrl} className="flex items-center gap-1">
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
        </Link>
      </div>

      {/* 구매 항목 목록 */}
      <div className="rounded-lg border border-gray-200 px-4">
        {section.purchases.map((purchase, index) => (
          <PurchaseItemCard
            key={purchase.purchaseId}
            purchase={purchase}
            isLast={index === section.purchases.length - 1}
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

  const PAGE_SIZE = 20;

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
      cursor: undefined,
    }),
    queryFn: async ({ pageParam }) => {
      // 🎨 목데이터 모드일 경우 목데이터 반환
      if (USE_MOCK_DATA) {
        // 목데이터를 Promise로 감싸서 반환 (실제 API와 동일한 형태)
        return new Promise<TGETStorePurchasesRes>((resolve) => {
          setTimeout(() => {
            resolve(generateMockData());
          }, 500); // 로딩 상태 확인을 위한 약간의 지연
        });
      }

      // 실제 API 호출
      const response = await Api.getStorePurchases({
        pageSize: PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam as string } : {}),
      });
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

  // 모든 페이지의 purchases를 합치기
  const allPurchases = useMemo(() => {
    if (!purchasesPagesData?.pages) return [];
    return purchasesPagesData.pages.flatMap((page) => page?.purchases || []);
  }, [purchasesPagesData]);

  // 날짜별로 그룹화
  const purchaseSections = useMemo(() => {
    if (!allPurchases || allPurchases.length === 0) {
      return [];
    }

    const groupedByDate = allPurchases.reduce(
      (acc, purchase) => {
        if (!purchase.orderDate) return acc;

        const dateKey = formatDateWithDayKorean(purchase.orderDate);
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(purchase);
        return acc;
      },
      {} as Record<string, PurchaseItem[]>
    );

    return Object.entries(groupedByDate).map(([date, purchases]) => ({
      date,
      purchases,
    }));
  }, [allPurchases]);

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
        {purchaseSections.map((section) => (
          <PurchaseSection key={section.date} section={section} />
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
