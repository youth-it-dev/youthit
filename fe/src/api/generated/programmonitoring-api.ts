/**
 * @description ProgramMonitoring 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { get } from "@/lib/axios";
import type * as Types from "@/types/generated/programmonitoring-types";

export const getProgrammonitoringExport = (
  request: Types.TGETProgramMonitoringExportReq
) => {
  return get<any>(`/programMonitoring/export`, { params: request });
};
