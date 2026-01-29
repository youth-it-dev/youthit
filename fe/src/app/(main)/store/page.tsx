"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { LINK_URL } from "@/constants/shared/_link-url";
import { useGetStoreProducts } from "@/hooks/generated/store-hooks";
import { useGetUsersMe } from "@/hooks/generated/users-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";

/**
 * @description 스토어 메인 페이지
 */
const StorePage = () => {
  const router = useRouter();
  const setTitle = useTopBarStore((state) => state.setTitle);
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);

  useEffect(() => {
    const handleHistoryButtonClick = () => {
      router.push(LINK_URL.STORE_HISTORY);
    };

    setTitle("나다움 스토어");
    setRightSlot(
      <button
        onClick={handleHistoryButtonClick}
        className="flex h-10 w-10 items-center justify-center bg-white"
        aria-label="스토어 내역 보기"
      >
        <ReceiptText className="h-5 w-5 stroke-2 text-gray-950" />
      </button>
    );
    return () => {
      setTitle("");
      setRightSlot(null);
    };
  }, [setTitle, setRightSlot, router]);

  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => {
      return data?.user;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const {
    data: productsData,
    isLoading,
    error,
  } = useGetStoreProducts({
    request: {
      onSale: true,
      pageSize: 20,
    },
    select: (data) => {
      if (!data || typeof data !== "object") {
        return null;
      }
      return data.products || [];
    },
  });

  // 썸네일 이미지 URL 추출
  const getThumbnailUrl = (
    thumbnail?: Array<{ name?: string; url?: string; type?: string }>
  ): string | null => {
    if (!thumbnail || thumbnail.length === 0) return null;
    return thumbnail[0]?.url || null;
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4 pt-12">
        <Typography font="noto" variant="body2R" className="text-gray-500">
          데이터를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-12">
      {/* 사용 가능한 나다움 포인트 */}
      <div className="px-4 pt-4">
        <Link
          href={LINK_URL.STORE_HISTORY_NADAUM}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
        >
          <Typography font="noto" variant="label1M" className="text-gray-500">
            사용 가능한 나다움
          </Typography>
          <div className="flex items-center gap-2">
            <Typography
              font="noto"
              variant="heading3B"
              className="text-main-500"
            >
              {userData?.rewards || 0}N
            </Typography>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>
      </div>

      {/* 선물 목록 */}
      <div className="px-4 pt-6">
        <Typography
          as="h2"
          font="noto"
          variant="heading2B"
          className="mb-2 text-gray-900"
        >
          선물 목록
        </Typography>
        <Typography font="noto" variant="body2R" className="text-gray-600">
          여러분의 나다움을 원하는 선물로 교환해요.
        </Typography>
      </div>

      {/* 상품 그리드 */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      ) : productsData && productsData.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 p-4">
          {productsData.map((product) => {
            const thumbnailUrl = getThumbnailUrl(product.thumbnail);
            return (
              <Link
                key={product.id}
                href={`/store/${product.id}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                {/* 썸네일 이미지 */}
                <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                  {thumbnailUrl ? (
                    <Image
                      src={thumbnailUrl}
                      alt={product.name || "상품 이미지"}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100">
                      <Typography
                        font="noto"
                        variant="body3R"
                        className="text-gray-400"
                      >
                        이미지 없음
                      </Typography>
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <Typography
                      as="h3"
                      font="noto"
                      variant="body3B"
                      className="mb-1 line-clamp-2 text-gray-900"
                    >
                      {product.name || "-"}
                    </Typography>
                    <Typography
                      font="noto"
                      variant="label1B"
                      className="text-main-600"
                    >
                      {product.requiredPoints || 0}N
                    </Typography>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Typography font="noto" variant="body2R" className="text-gray-500">
            등록된 상품이 없습니다.
          </Typography>
        </div>
      )}
    </div>
  );
};

export default StorePage;
