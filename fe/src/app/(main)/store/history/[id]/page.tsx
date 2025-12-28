"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Typography } from "@/components/shared/typography";
import { useTopBarStore } from "@/stores/shared/topbar-store";

// 🎨 목데이터
const MOCK_PURCHASE_DATA = {
  purchaseId: "purchase-1",
  orderNumber: "C1234567890",
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  productName: "온라인 상품권 2만원권",
  productImage: "/imgs/warranty.png", // 임시 이미지 경로
  status: "신청 완료",
  requiredPoints: 200,
  quantity: 1,
  totalPoints: 200,
};

/**
 * @description 스토어 신청내역 상세 페이지
 */
const StoreHistoryDetailPage = () => {
  const setTitle = useTopBarStore((state) => state.setTitle);

  // 목데이터 사용 (실제로는 purchaseId로 API 호출)
  const purchaseData = MOCK_PURCHASE_DATA;

  useEffect(() => {
    setTitle("신청 내역 상세");
    return () => {
      setTitle("");
    };
  }, [setTitle]);

  return (
    <div className="min-h-screen bg-white pt-12">
      <div className="px-4 py-6">
        {/* 주문번호 */}
        <div className="mb-5 rounded-lg bg-gray-50 p-4">
          <Typography font="noto" variant="body1M" className="text-gray-600">
            주문번호 {purchaseData.orderNumber}
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
                {purchaseData.recipientName}
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
                {purchaseData.recipientPhone}
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
              <div className="relative h-20 w-20 shrink-0 self-start overflow-hidden rounded bg-white">
                <Image
                  src={purchaseData.productImage}
                  alt={purchaseData.productName}
                  fill
                  className="object-cover"
                />
              </div>

              {/* 상품 상세 정보 */}
              <div className="flex h-full flex-1 flex-col justify-evenly">
                <Typography
                  font="noto"
                  variant="label2B"
                  className="text-main-500"
                >
                  {purchaseData.status}
                </Typography>
                <Typography
                  font="noto"
                  variant="body2B"
                  className="text-gray-900"
                >
                  {purchaseData.productName}
                </Typography>
                <Typography
                  font="noto"
                  variant="label1B"
                  className="text-gray-500"
                >
                  {purchaseData.requiredPoints}N | {purchaseData.quantity}개
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
                {purchaseData.totalPoints} N
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
