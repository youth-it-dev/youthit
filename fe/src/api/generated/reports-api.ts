/**
 * @description Reports 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post } from "@/lib/axios";
import type * as Types from "@/types/generated/reports-types";

export const postReportcontent = (request: Types.TPOSTReportContentReq) => {
  return post<Types.TPOSTReportContentRes>(
    `/reportContent`,
    request.data ?? request
  );
};

export const postReportcontentMy = (request: Types.TPOSTReportContentMyReq) => {
  return post<Types.TPOSTReportContentMyRes>(
    `/reportContent/my`,
    request.data ?? request
  );
};

export const getReportcontentSyncNotionReports = () => {
  return get<Types.TGETReportContentSyncNotionReportsRes>(
    `/reportContent/syncNotionReports`
  );
};
