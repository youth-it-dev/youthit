/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @description Missions 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import type * as Schema from "./api-schema";

export interface TGETMissionsReq {
  sortBy?: "latest" | "popular";
  category?: string;
  excludeParticipated?: boolean;
  pageSize?: number;
  startCursor?: string;
  likedOnly?: boolean;
}

export type TGETMissionsRes = {
  missions?: Schema.Mission[];
  pageInfo?: {
    pageSize?: number;
    nextCursor?: string;
    hasNext?: boolean;
  };
};

export interface TGETMissionsByIdReq {
  missionId: string;
}

export type TGETMissionsByIdRes = {
  mission?: Schema.Mission;
};

export interface TPOSTMissionsApplyByIdReq {
  missionId: string;
}

export type TPOSTMissionsApplyByIdRes = {
  missionId?: string;
  status?: string;
};

export interface TGETMissionsFaqsByIdReq {
  missionId: string;
}

export type TGETMissionsFaqsByIdRes = {
  faqs?: {
    id?: string;
    title?: string;
    category?: string[];
    content?: any[];
  }[];
  count?: number;
};

export interface TPOSTMissionsLikeByIdReq {
  missionId: string;
}

export type TPOSTMissionsLikeByIdRes = {
  liked?: boolean;
  likesCount?: number;
};

export interface TPOSTMissionsPostsByIdReq {
  missionId: string;
  data: {
    title?: string;
    content?: string;
    media?: string[];
    postType?: string;
  };
}

export type TPOSTMissionsPostsByIdRes = {
  missionId?: string;
  postId?: string;
  status?: string;
};

export interface TPOSTMissionsQuitByIdReq {
  missionId: string;
}

export type TPOSTMissionsQuitByIdRes = {
  missionId?: string;
  status?: string;
};

export type TGETMissionsCategoriesRes = {
  categories?: string[];
};

export interface TGETMissionsMeReq {
  limit?: number;
}

export type TGETMissionsMeRes = {
  missions?: {
    id?: string;
    missionNotionPageId?: string;
    missionTitle?: string;
    detailTags?: string;
    startedAt?: string;
  }[];
};

export interface TGETMissionsPostsReq {
  sort?: "latest" | "popular";
  missionId?: string;
  categories?: string;
  userId?: string;
  pageSize?: number;
  startCursor?: string;
}

export type TGETMissionsPostsRes = {
  posts?: {
    id?: string;
    title?: string;
    missionTitle?: string;
    missionNotionPageId?: string;
    author?: string;
    profileImageUrl?: string;
    preview?: {
      description?: string;
      thumbnail?: {
        url?: string;
        width?: number;
        height?: number;
        blurHash?: string;
      };
    };
    mediaCount?: number;
    commentsCount?: number;
    viewCount?: number;
    createdAt?: string;
    timeAgo?: string;
  }[];
  pageInfo?: {
    pageSize?: number;
    nextCursor?: string;
    hasNext?: boolean;
  };
};

export interface TGETMissionsPostsByIdReq {
  postId: string;
}

export type TGETMissionsPostsByIdRes = {
  id?: string;
  title?: string;
  content?: string;
  media?: string[];
  missionTitle?: string;
  missionNotionPageId?: string;
  author?: string;
  profileImageUrl?: string;
  commentsCount?: number;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  timeAgo?: string;
  isAuthor?: boolean;
};

export interface TGETMissionsPostsCommentsByIdReq {
  postId: string;
  pageSize?: number;
  startCursor?: string;
}

export type TGETMissionsPostsCommentsByIdRes = {
  comments?: {
    id?: string;
    postId?: string;
    userId?: string;
    author?: string;
    profileImageUrl?: string;
    content?: string;
    parentId?: string;
    parentAuthor?: string;
    depth?: number;
    likesCount?: number;
    isDeleted?: boolean;
    isLocked?: boolean;
    isMine?: boolean;
    isAuthor?: boolean;
    repliesCount?: number;
    replies?: {
      id?: string;
      userId?: string;
      author?: string;
      profileImageUrl?: string;
      content?: string;
      parentId?: string;
      parentAuthor?: string;
      depth?: number;
      likesCount?: number;
      isDeleted?: boolean;
      isLocked?: boolean;
      isMine?: boolean;
      isAuthor?: boolean;
      createdAt?: string;
      updatedAt?: string;
    }[];
    createdAt?: string;
    updatedAt?: string;
  }[];
  pageInfo?: {
    pageSize?: number;
    nextCursor?: string;
    hasNext?: boolean;
  };
};

export interface TPOSTMissionsPostsCommentsByIdReq {
  postId: string;
  data: {
    content: string;
    parentId?: string;
  };
}

export type TPOSTMissionsPostsCommentsByIdRes = {
  id?: string;
  postId?: string;
  userId?: string;
  author?: string;
  content?: string;
  parentId?: string;
  parentAuthor?: string;
  depth?: number;
  likesCount?: number;
  isLocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export interface TDELETEMissionsPostsCommentsByTwoIdsReq {
  postId: string;
  commentId: string;
}

export interface TPUTMissionsPostsCommentsByTwoIdsReq {
  postId: string;
  commentId: string;
  data: {
    content: string;
  };
}

export type TPUTMissionsPostsCommentsByTwoIdsRes = {
  id?: string;
  postId?: string;
  userId?: string;
  author?: string;
  content?: string;
  parentId?: string;
  depth?: number;
  likesCount?: number;
  isLocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export interface TPOSTMissionsPostsCommentsLikeByTwoIdsReq {
  postId: string;
  commentId: string;
}

export type TPOSTMissionsPostsCommentsLikeByTwoIdsRes = {
  commentId?: string;
  userId?: string;
  isLiked?: boolean;
  likesCount?: number;
};

export interface TPOSTMissionsPostsCommentsReportByTwoIdsReq {
  postId: string;
  commentId: string;
  data: {
    targetUserId: string;
    reportReason: string;
    missionId: string;
  };
}

export type TPOSTMissionsPostsCommentsReportByTwoIdsRes = {
  message?: string;
};

export interface TPOSTMissionsPostsLikeByIdReq {
  postId: string;
}

export type TPOSTMissionsPostsLikeByIdRes = {
  postId?: string;
  userId?: string;
  isLiked?: boolean;
  likesCount?: number;
};

export interface TPOSTMissionsPostsReportByIdReq {
  postId: string;
  data: {
    targetUserId: string;
    reportReason: string;
    missionId: string;
  };
}

export type TPOSTMissionsPostsReportByIdRes = {
  message?: string;
};

export type TGETMissionsStatsRes = {
  todayTotalCount?: number;
  todayCompletedCount?: number;
  todayActiveCount?: number;
  consecutiveDays?: number;
  totalPostsCount?: number;
};
