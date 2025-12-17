/**
 * @description Reports 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

export interface TPOSTReportContentReq {
  data: {
    targetType: "post" | "comment";
    targetId: string;
    targetUserId: string;
    reportReason: string;
    communityId?: string;
    missionId?: string;
  };
}

export type TPOSTReportContentRes = {
  message?: string;
};

export interface TPOSTReportContentMyReq {
  data: {
    size?: number;
    cursor?: string;
  };
}

export type TPOSTReportContentMyRes = {
  reports?: {
    id?: string;
    targetType?: string;
    targetId?: string;
    reporterId?: string;
    reporterName?: string;
    reportReason?: string;
    status?: string;
    createdAt?: string;
    targetUserId?: string;
    communityId?: string;
    firebaseUpdatedAt?: string;
    notionUpdatedAt?: string;
  }[];
  hasMore?: boolean;
  nextCursor?: string;
};

export type TGETReportContentSyncNotionReportsRes = {
  message?: string;
  count?: number;
};
