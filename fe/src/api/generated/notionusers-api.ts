/**
 * @description NotionUsers 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get } from "@/lib/axios";
import type * as Types from "@/types/generated/notionusers-types";

export const getNotionusersSyncActive = () => {
  return get<Types.TGETNotionUsersSyncActiveRes>(`/notionUsers/sync/active`);
};

export const getNotionusersSyncAllUsersRollback = () => {
  return get<Types.TGETNotionUsersSyncAllUsersRollbackRes>(
    `/notionUsers/sync/allUsersRollback`
  );
};

export const getNotionusersSyncFull = () => {
  return get<Types.TGETNotionUsersSyncFullRes>(`/notionUsers/sync/full`);
};

export const getNotionusersSyncPenalty = () => {
  return get<Types.TGETNotionUsersSyncPenaltyRes>(`/notionUsers/sync/penalty`);
};

export const getNotionusersSyncSelected = () => {
  return get<Types.TGETNotionUsersSyncSelectedRes>(
    `/notionUsers/sync/selected`
  );
};
