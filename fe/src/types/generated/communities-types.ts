/**
 * @description Communities 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import type * as Schema from "./api-schema";

export interface TGETCommunitiesReq {
  type?: "interest" | "anonymous";
  page?: number;
  size?: number;
}

export type TGETCommunitiesRes = {
  communities?: Schema.Community[];
  pagination?: {
    pageNumber?: number;
    pageSize?: number;
    totalElements?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
  };
};

export interface TGETCommunitiesMembersByTwoIdsReq {
  communityId: string;
  userId: string;
}

export type TGETCommunitiesMembersByTwoIdsRes = Schema.CommunityMember;

export interface TGETCommunitiesNicknameAvailabilityByIdReq {
  communityId: string;
  nickname: string;
}

export type TGETCommunitiesNicknameAvailabilityByIdRes = {
  available?: boolean;
};

export interface TPOSTCommunitiesPostsByIdReq {
  communityId: string;
  data: {
    title: string;
    content?: string;
    media?: string[];
    category?: string;
    scheduledDate?: string;
    isReview?: boolean;
    isPublic?: boolean;
  };
}

export type TPOSTCommunitiesPostsByIdRes = {
  id?: string;
  type?: string;
  programType?: string;
  isReview?: boolean;
  communityId?: string;
  author?: string;
  communityPath?: string;
  title?: string;
  content?: string;
  media?: string[];
  channel?: string;
  category?: string;
  scheduledDate?: string;
  isLocked?: boolean;
  isPublic?: boolean;
  rewardGiven?: boolean;
  likesCount?: number;
  commentsCount?: number;
  reportsCount?: number;
  viewCount?: number;
  community?: {
    id?: string;
    name?: string;
  };
};

export interface TDELETECommunitiesPostsByTwoIdsReq {
  communityId: string;
  postId: string;
}

export interface TGETCommunitiesPostsByTwoIdsReq {
  communityId: string;
  postId: string;
}

export type TGETCommunitiesPostsByTwoIdsRes = Schema.CommunityPost & {
  preview?: {
    description?: string;
    thumbnail?: {
      url?: string;
      blurHash?: string;
      width?: number;
      height?: number;
    };
  };
  programType?: "ROUTINE" | "GATHERING" | "TMI";
  isReview?: boolean;
  media?: string[];
  thumbnailMedia?: string[];
  thumbnailUrl?: string;
  imageCount?: number;
  reportsCount?: number;
  isAuthor?: boolean;
};

export interface TPUTCommunitiesPostsByTwoIdsReq {
  communityId: string;
  postId: string;
  data: {
    title?: string;
    content?: string;
    media?: string[];
    category?: string;
    scheduledDate?: string;
  };
}

export type TPUTCommunitiesPostsByTwoIdsRes = {
  id?: string;
  type?: string;
  communityId?: string;
  author?: string;
  communityPath?: string;
  title?: string;
  content?: string;
  media?: string[];
  channel?: string;
  category?: string;
  scheduledDate?: string;
  isLocked?: boolean;
  isPublic?: boolean;
  rewardGiven?: boolean;
  likesCount?: number;
  commentsCount?: number;
  reportsCount?: number;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  community?: {
    id?: string;
    name?: string;
  };
};

export interface TPOSTCommunitiesPostsLikeByTwoIdsReq {
  communityId: string;
  postId: string;
}

export type TPOSTCommunitiesPostsLikeByTwoIdsRes = {
  postId?: string;
  userId?: string;
  isLiked?: boolean;
  likesCount?: number;
};

export interface TGETCommunitiesPostsReq {
  page?: number;
  size?: number;
  programType?: "ROUTINE" | "GATHERING" | "TMI";
  programState?: "ongoing" | "finished";
  sort?: "popular";
}

export type TGETCommunitiesPostsRes = {
  posts?: Schema.CommunityPost[];
  pagination?: {
    pageNumber?: number;
    pageSize?: number;
    totalElements?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
  };
};
