/**
 * @description Store 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post } from "@/lib/axios";
import type * as Types from "@/types/generated/store-types";

export const getStoreProducts = (request: Types.TGETStoreProductsReq) => {
  return get<Types.TGETStoreProductsRes>(`/store/products`, {
    params: request,
  });
};

export const getStoreProductsById = (
  request: Types.TGETStoreProductsByIdReq
) => {
  return get<Types.TGETStoreProductsByIdRes>(
    `/store/products/${request.productId}`
  );
};

export const getStorePurchases = (request: Types.TGETStorePurchasesReq) => {
  return get<Types.TGETStorePurchasesRes>(`/store/purchases`, {
    params: request,
  });
};

export const postStorePurchases = (request: Types.TPOSTStorePurchasesReq) => {
  return post<Types.TPOSTStorePurchasesRes>(
    `/store/purchases`,
    request.data ?? request
  );
};
