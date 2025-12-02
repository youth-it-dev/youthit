/**
 * @description Comments 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import type * as Schema from "./api-schema";

export interface TDELETECommentsByIdReq {
  commentId: string;
}

export interface TPUTCommentsByIdReq {
  commentId: string;
  data: {
    content: string;
  };
}

export type TPUTCommentsByIdRes = {
  id?: string;
  communityId?: string;
  postId?: string;
  author?: string;
  content?: string;
  parentId?: string;
  depth?: number;
  isLocked?: boolean;
  likesCount?: number;
  isLiked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export interface TPOSTCommentsLikeByIdReq {
  commentId: string;
}

export type TPOSTCommentsLikeByIdRes = {
  commentId?: string;
  userId?: string;
  isLiked?: boolean;
  likesCount?: number;
};

export interface TGETCommentsCommunitiesPostsByTwoIdsReq {
  communityId: string;
  postId: string;
  page?: number;
  size?: number;
}

export type TGETCommentsCommunitiesPostsByTwoIdsRes = {
  comments?: {
    id?: string;
    communityId?: string;
    postId?: string;
    author?: string;
    userId?: string;
    profileImageUrl?: string;
    content?: string;
    parentId?: string;
    parentAuthor?: string;
    depth?: number;
    isLocked?: boolean;
    isDeleted?: boolean;
    likesCount?: number;
    isLiked?: boolean;
    repliesCount?: number;
    reportsCount?: number;
    createdAt?: string;
    updatedAt?: string;
    replies?: {
      id?: string;
      communityId?: string;
      postId?: string;
      author?: string;
      userId?: string;
      profileImageUrl?: string;
      content?: string;
      parentId?: string;
      parentAuthor?: string;
      depth?: number;
      isLocked?: boolean;
      isDeleted?: boolean;
      likesCount?: number;
      isLiked?: boolean;
      reportsCount?: number;
      createdAt?: string;
      updatedAt?: string;
    }[];
  }[];
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

export interface TPOSTCommentsCommunitiesPostsByTwoIdsReq {
  communityId: string;
  postId: string;
  data: {
    content: string;
    parentId?: string;
  };
}

export type TPOSTCommentsCommunitiesPostsByTwoIdsRes = {
  id?: string;
  communityId?: string;
  postId?: string;
  author?: string;
  content?: string;
  parentId?: string;
  parentAuthor?: string;
  depth?: number;
  isLocked?: boolean;
  likesCount?: number;
  isLiked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
