/**
 * @description Swagger에서 자동 생성된 Query Keys
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type * as adminlogsTypes from "@/types/generated/adminlogs-types";
import type * as announcementsTypes from "@/types/generated/announcements-types";
import type * as authTypes from "@/types/generated/auth-types";
import type * as commentsTypes from "@/types/generated/comments-types";
import type * as communitiesTypes from "@/types/generated/communities-types";
import type * as faqsTypes from "@/types/generated/faqs-types";
import type * as fcmTypes from "@/types/generated/fcm-types";
import type * as filesTypes from "@/types/generated/files-types";
import type * as homeTypes from "@/types/generated/home-types";
import type * as imagesTypes from "@/types/generated/images-types";
import type * as missionsTypes from "@/types/generated/missions-types";
import type * as notificationsTypes from "@/types/generated/notifications-types";
import type * as notionmissionsTypes from "@/types/generated/notionmissions-types";
import type * as notionrewardhistoryTypes from "@/types/generated/notionrewardhistory-types";
import type * as notionusersTypes from "@/types/generated/notionusers-types";
import type * as programsTypes from "@/types/generated/programs-types";
import type * as qnaTypes from "@/types/generated/qna-types";
import type * as reportsTypes from "@/types/generated/reports-types";
import type * as storeTypes from "@/types/generated/store-types";
import type * as usersTypes from "@/types/generated/users-types";

function __normalizeQuery(obj: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  Object.keys(obj).forEach((k) => {
    const val = (obj as any)[k];
    if (val === undefined) return;
    normalized[k] = val instanceof Date ? val.toISOString() : val;
  });
  return normalized;
}

function __buildKey(
  tag: string,
  name: string,
  parts?: { path?: Record<string, unknown>; query?: Record<string, unknown> }
) {
  if (!parts) return [tag, name] as const;
  const { path, query } = parts;
  return [tag, name, path ?? {}, __normalizeQuery(query ?? {})] as const;
}

// AdminLogs Query Keys
export const adminlogsKeys = {
  getAdminlogsSyncAdminLogs: __buildKey(
    "adminlogs",
    "getAdminlogsSyncAdminLogs"
  ),
} as const;

// Announcements Query Keys
export const announcementsKeys = {
  getAnnouncements: (request: announcementsTypes.TGETAnnouncementsReq) =>
    __buildKey("announcements", "getAnnouncements", {
      path: {},
      query: { pageSize: request.pageSize, cursor: request.cursor },
    }),
  getAnnouncementsById: (
    request: announcementsTypes.TGETAnnouncementsByIdReq
  ) =>
    __buildKey("announcements", "getAnnouncementsById", {
      path: { pageId: request.pageId },
      query: {},
    }),
} as const;

// Auth Query Keys
export const authKeys = {
  getAuthVerify: __buildKey("auth", "getAuthVerify"),
} as const;

// Comments Query Keys
export const commentsKeys = {
  getCommentsCommunitiesPostsByTwoIds: (
    request: commentsTypes.TGETCommentsCommunitiesPostsByTwoIdsReq
  ) =>
    __buildKey("comments", "getCommentsCommunitiesPostsByTwoIds", {
      path: { communityId: request.communityId, postId: request.postId },
      query: { page: request.page, size: request.size },
    }),
} as const;

// Communities Query Keys
export const communitiesKeys = {
  getCommunities: (request: communitiesTypes.TGETCommunitiesReq) =>
    __buildKey("communities", "getCommunities", {
      path: {},
      query: { type: request.type, page: request.page, size: request.size },
    }),
  getCommunitiesMembersByTwoIds: (
    request: communitiesTypes.TGETCommunitiesMembersByTwoIdsReq
  ) =>
    __buildKey("communities", "getCommunitiesMembersByTwoIds", {
      path: { communityId: request.communityId, userId: request.userId },
      query: {},
    }),
  getCommunitiesNicknameAvailabilityById: (
    request: communitiesTypes.TGETCommunitiesNicknameAvailabilityByIdReq
  ) =>
    __buildKey("communities", "getCommunitiesNicknameAvailabilityById", {
      path: { communityId: request.communityId },
      query: { nickname: request.nickname },
    }),
  getCommunitiesPostsByTwoIds: (
    request: communitiesTypes.TGETCommunitiesPostsByTwoIdsReq
  ) =>
    __buildKey("communities", "getCommunitiesPostsByTwoIds", {
      path: { communityId: request.communityId, postId: request.postId },
      query: {},
    }),
  getCommunitiesPosts: (request: communitiesTypes.TGETCommunitiesPostsReq) =>
    __buildKey("communities", "getCommunitiesPosts", {
      path: {},
      query: {
        page: request.page,
        size: request.size,
        programType: request.programType,
        programState: request.programState,
        sort: request.sort,
      },
    }),
} as const;

// FAQs Query Keys
export const faqsKeys = {
  getFaqs: (request: faqsTypes.TGETFaqsReq) =>
    __buildKey("faqs", "getFaqs", {
      path: {},
      query: {
        category: request.category,
        pageSize: request.pageSize,
        startCursor: request.startCursor,
      },
    }),
  getFaqsBlocksById: (request: faqsTypes.TGETFaqsBlocksByIdReq) =>
    __buildKey("faqs", "getFaqsBlocksById", {
      path: { pageId: request.pageId },
      query: { pageSize: request.pageSize, startCursor: request.startCursor },
    }),
} as const;

// FCM Query Keys
export const fcmKeys = {
  getFcmTokens: __buildKey("fcm", "getFcmTokens"),
} as const;

// Files Query Keys
export const filesKeys = {} as const;

// Home Query Keys
export const homeKeys = {
  getHome: __buildKey("home", "getHome"),
} as const;

// Images Query Keys
export const imagesKeys = {} as const;

// Missions Query Keys
export const missionsKeys = {
  getMissions: (request: missionsTypes.TGETMissionsReq) =>
    __buildKey("missions", "getMissions", {
      path: {},
      query: {
        sortBy: request.sortBy,
        category: request.category,
        excludeParticipated: request.excludeParticipated,
        pageSize: request.pageSize,
        startCursor: request.startCursor,
        likedOnly: request.likedOnly,
      },
    }),
  getMissionsById: (request: missionsTypes.TGETMissionsByIdReq) =>
    __buildKey("missions", "getMissionsById", {
      path: { missionId: request.missionId },
      query: {},
    }),
  getMissionsFaqsById: (request: missionsTypes.TGETMissionsFaqsByIdReq) =>
    __buildKey("missions", "getMissionsFaqsById", {
      path: { missionId: request.missionId },
      query: {},
    }),
  getMissionsCategories: __buildKey("missions", "getMissionsCategories"),
  getMissionsMe: (request: missionsTypes.TGETMissionsMeReq) =>
    __buildKey("missions", "getMissionsMe", {
      path: {},
      query: { limit: request.limit },
    }),
  getMissionsPosts: (request: missionsTypes.TGETMissionsPostsReq) =>
    __buildKey("missions", "getMissionsPosts", {
      path: {},
      query: {
        sort: request.sort,
        missionId: request.missionId,
        categories: request.categories,
        onlyMyMissions: request.onlyMyMissions,
        pageSize: request.pageSize,
        startCursor: request.startCursor,
      },
    }),
  getMissionsPostsById: (request: missionsTypes.TGETMissionsPostsByIdReq) =>
    __buildKey("missions", "getMissionsPostsById", {
      path: { postId: request.postId },
      query: {},
    }),
  getMissionsPostsCommentsById: (
    request: missionsTypes.TGETMissionsPostsCommentsByIdReq
  ) =>
    __buildKey("missions", "getMissionsPostsCommentsById", {
      path: { postId: request.postId },
      query: { pageSize: request.pageSize, startCursor: request.startCursor },
    }),
  getMissionsStats: __buildKey("missions", "getMissionsStats"),
} as const;

// Notifications Query Keys
export const notificationsKeys = {
  getNotifications: (request: notificationsTypes.TGETNotificationsReq) =>
    __buildKey("notifications", "getNotifications", {
      path: {},
      query: { page: request.page, size: request.size },
    }),
  getNotificationsSendAllPending: __buildKey(
    "notifications",
    "getNotificationsSendAllPending"
  ),
} as const;

// NotionMissions Query Keys
export const notionmissionsKeys = {
  getNotionmissionsReactionsSync: __buildKey(
    "notionmissions",
    "getNotionmissionsReactionsSync"
  ),
} as const;

// NotionRewardHistory Query Keys
export const notionrewardhistoryKeys = {
  getNotionrewardhistorySync: __buildKey(
    "notionrewardhistory",
    "getNotionrewardhistorySync"
  ),
} as const;

// NotionUsers Query Keys
export const notionusersKeys = {
  getNotionusersSyncActive: __buildKey(
    "notionusers",
    "getNotionusersSyncActive"
  ),
  getNotionusersSyncAllUsersRollback: __buildKey(
    "notionusers",
    "getNotionusersSyncAllUsersRollback"
  ),
  getNotionusersSyncFull: __buildKey("notionusers", "getNotionusersSyncFull"),
  getNotionusersSyncPenalty: __buildKey(
    "notionusers",
    "getNotionusersSyncPenalty"
  ),
  getNotionusersSyncSelected: __buildKey(
    "notionusers",
    "getNotionusersSyncSelected"
  ),
} as const;

// Programs Query Keys
export const programsKeys = {
  getPrograms: (request: programsTypes.TGETProgramsReq) =>
    __buildKey("programs", "getPrograms", {
      path: {},
      query: {
        recruitmentStatus: request.recruitmentStatus,
        programStatus: request.programStatus,
        programType: request.programType,
        pageSize: request.pageSize,
        cursor: request.cursor,
      },
    }),
  getProgramsById: (request: programsTypes.TGETProgramsByIdReq) =>
    __buildKey("programs", "getProgramsById", {
      path: { programId: request.programId },
      query: {},
    }),
  getProgramsApplicationsApproveByTwoIds: (
    request: programsTypes.TGETProgramsApplicationsApproveByTwoIdsReq
  ) =>
    __buildKey("programs", "getProgramsApplicationsApproveByTwoIds", {
      path: {
        programId: request.programId,
        applicationId: request.applicationId,
      },
      query: {},
    }),
  getProgramsApplicationsRejectByTwoIds: (
    request: programsTypes.TGETProgramsApplicationsRejectByTwoIdsReq
  ) =>
    __buildKey("programs", "getProgramsApplicationsRejectByTwoIds", {
      path: {
        programId: request.programId,
        applicationId: request.applicationId,
      },
      query: {},
    }),
  getProgramsSearch: (request: programsTypes.TGETProgramsSearchReq) =>
    __buildKey("programs", "getProgramsSearch", {
      path: {},
      query: {
        q: request.q,
        recruitmentStatus: request.recruitmentStatus,
        programStatus: request.programStatus,
        programType: request.programType,
        pageSize: request.pageSize,
        cursor: request.cursor,
      },
    }),
} as const;

// QnA Query Keys
export const qnaKeys = {
  getQnaById: (request: qnaTypes.TGETQnaByIdReq) =>
    __buildKey("qna", "getQnaById", {
      path: { pageId: request.pageId },
      query: { page: request.page, size: request.size },
    }),
} as const;

// Reports Query Keys
export const reportsKeys = {
  getReportcontentSyncNotionReports: __buildKey(
    "reports",
    "getReportcontentSyncNotionReports"
  ),
} as const;

// Store Query Keys
export const storeKeys = {
  getStoreProducts: (request: storeTypes.TGETStoreProductsReq) =>
    __buildKey("store", "getStoreProducts", {
      path: {},
      query: {
        onSale: request.onSale,
        pageSize: request.pageSize,
        cursor: request.cursor,
      },
    }),
  getStoreProductsById: (request: storeTypes.TGETStoreProductsByIdReq) =>
    __buildKey("store", "getStoreProductsById", {
      path: { productId: request.productId },
      query: {},
    }),
  getStorePurchases: (request: storeTypes.TGETStorePurchasesReq) =>
    __buildKey("store", "getStorePurchases", {
      path: {},
      query: { pageSize: request.pageSize, cursor: request.cursor },
    }),
} as const;

// Users Query Keys
export const usersKeys = {
  getUsers: __buildKey("users", "getUsers"),
  getUsersById: (request: usersTypes.TGETUsersByIdReq) =>
    __buildKey("users", "getUsersById", {
      path: { userId: request.userId },
      query: {},
    }),
  getUsersDeletePostById: (request: usersTypes.TGETUsersDeletePostByIdReq) =>
    __buildKey("users", "getUsersDeletePostById", {
      path: { userId: request.userId },
      query: {},
    }),
  getUsersMe: __buildKey("users", "getUsersMe"),
  getUsersMeCommentedPosts: (
    request: usersTypes.TGETUsersMeCommentedPostsReq
  ) =>
    __buildKey("users", "getUsersMeCommentedPosts", {
      path: {},
      query: { page: request.page, size: request.size },
    }),
  getUsersMeCompletedCommunities: __buildKey(
    "users",
    "getUsersMeCompletedCommunities"
  ),
  getUsersMeLikedPosts: (request: usersTypes.TGETUsersMeLikedPostsReq) =>
    __buildKey("users", "getUsersMeLikedPosts", {
      path: {},
      query: { page: request.page, size: request.size },
    }),
  getUsersMeMyPage: __buildKey("users", "getUsersMeMyPage"),
  getUsersMeParticipatingCommunities: __buildKey(
    "users",
    "getUsersMeParticipatingCommunities"
  ),
  getUsersMePosts: (request: usersTypes.TGETUsersMePostsReq) =>
    __buildKey("users", "getUsersMePosts", {
      path: {},
      query: { page: request.page, size: request.size },
    }),
  getUsersMeRewardsEarned: (request: usersTypes.TGETUsersMeRewardsEarnedReq) =>
    __buildKey("users", "getUsersMeRewardsEarned", {
      path: {},
      query: { page: request.page, size: request.size },
    }),
  getUsersNicknameAvailability: (
    request: usersTypes.TGETUsersNicknameAvailabilityReq
  ) =>
    __buildKey("users", "getUsersNicknameAvailability", {
      path: {},
      query: { nickname: request.nickname },
    }),
} as const;
