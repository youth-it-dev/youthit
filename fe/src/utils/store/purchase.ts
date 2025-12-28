/**
 * @description 스토어 구매 관련 유틸리티 함수
 */

/**
 * @description title에서 상품명 추출
 * @param title - "상품명 - 주문자닉네임 - 주문일시" 형식의 문자열
 * @returns 상품명 또는 "-"
 */
export const getProductName = (title?: string): string => {
  if (!title) return "-";
  const parts = title.split(" - ");
  return parts[0] || "-";
};

/**
 * @description 주문번호 포맷팅
 * @param purchaseId - 구매 ID
 * @returns 포맷팅된 주문번호 (예: "C1234567890")
 */
export const formatOrderNumber = (purchaseId?: string): string => {
  if (!purchaseId) return "-";
  return `C${purchaseId.slice(-10).toUpperCase()}`;
};

/**
 * @description 배송 상태 텍스트 반환
 * @param deliveryCompleted - 배송 완료 여부
 * @returns "전달 완료" 또는 "신청 완료"
 */
export const getDeliveryStatusText = (deliveryCompleted?: boolean): string => {
  return deliveryCompleted ? "전달 완료" : "신청 완료";
};
