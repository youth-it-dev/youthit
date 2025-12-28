/**
 * @description Store 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import type * as Schema from "./api-schema";

export interface TGETStoreProductsReq {
  onSale?: boolean;
  pageSize?: number;
  cursor?: string;
}

export type TGETStoreProductsRes = {
  message?: string;
  products?: Schema.ProductListItem[];
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string;
    currentPageCount?: number;
  };
};

export interface TGETStoreProductsByIdReq {
  productId: string;
}

export type TGETStoreProductsByIdRes = {
  message?: string;
  product?: Schema.Product;
};

export interface TGETStorePurchasesReq {
  pageSize?: number;
  cursor?: string;
}

export type TGETStorePurchasesRes = {
  message?: string;
  purchasesByDate?: {
    date?: string;
    dateLabel?: string;
    count?: number;
    items?: Schema.StorePurchase[];
  }[];
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string;
  };
};

export interface TPOSTStorePurchasesReq {
  data: {
    productId: string;
    quantity?: number;
    recipientName?: string;
    recipientPhone?: string;
  };
}

export type TPOSTStorePurchasesRes = {
  purchaseId?: string;
  title?: string;
  userId?: string;
  userNickname?: string;
  productId?: string;
  quantity?: number;
  requiredPoints?: number;
  recipientName?: string;
  recipientPhone?: string;
  orderDate?: string;
  deliveryCompleted?: boolean;
  lastEditedTime?: string;
};
