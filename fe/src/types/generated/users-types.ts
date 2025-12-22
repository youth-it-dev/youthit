/**
 * @description Users 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import type * as Schema from "./api-schema";

export type TGETUsersRes = {
  users?: Schema.User[];
  count?: number;
};

export interface TGETUsersByIdReq {
  userId: string;
}

export type TGETUsersByIdRes = { user?: Schema.User };

export interface TPUTUsersByIdReq {
  userId: string;
  data: {
    email?: string;
    nickname?: string;
    name?: string;
    birthDate?: string;
    gender?: "male" | "female";
    phoneNumber?: string;
    profileImageUrl?: string;
    bio?: string;
    rewards?: number;
    authType?: string;
    snsProvider?: string;
    status?: "pending" | "approved" | "suspended";
    serviceTermsVersion?: string;
    privacyTermsVersion?: string;
    age14TermsAgreed?: boolean;
    pushTermsAgreed?: boolean;
  };
}

export type TPUTUsersByIdRes = { user?: Schema.User };

export interface TGETUsersDeletePostByIdReq {
  userId: string;
}

export type TGETUsersDeletePostByIdRes = {
  userId?: string;
};

export interface TGETUsersMeReq {
  token?: string;
}

export type TGETUsersMeRes = { user?: Schema.User };

export interface TGETUsersMeCommentedPostsReq {
  page?: number;
  size?: number;
  type?: "all" | "program" | "mission";
}

export type TGETUsersMeCommentedPostsRes = {
  posts?: {
    id?: string;
    author?: string;
    profileImageUrl?: string;
    title?: string;
    type?: string;
    programType?: "ROUTINE" | "GATHERING" | "TMI";
    isReview?: boolean;
    channel?: string;
    category?: string;
    scheduledDate?: string;
    isPublic?: boolean;
    isLocked?: boolean;
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
    timeAgo?: string;
    communityPath?: string;
    preview?: {
      description?: string;
      thumbnail?: {
        url?: string;
        width?: number;
        height?: number;
        blurHash?: string;
      };
    };
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

export type TGETUsersMeCompletedCommunitiesRes = {
  routine?: {
    label?: string;
    items?: {
      id?: string;
      name?: string;
      status?: string;
    }[];
  };
  gathering?: {
    label?: string;
    items?: {
      id?: string;
      name?: string;
      status?: string;
    }[];
  };
  tmi?: {
    label?: string;
    items?: {
      id?: string;
      name?: string;
      status?: string;
    }[];
  };
};

export interface TGETUsersMeLikedPostsReq {
  page?: number;
  size?: number;
  type?: "all" | "program" | "mission";
}

export type TGETUsersMeLikedPostsRes = {
  posts?: {
    id?: string;
    author?: string;
    profileImageUrl?: string;
    title?: string;
    type?: string;
    programType?: "ROUTINE" | "GATHERING" | "TMI";
    isReview?: boolean;
    channel?: string;
    category?: string;
    scheduledDate?: string;
    isPublic?: boolean;
    isLocked?: boolean;
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
    timeAgo?: string;
    communityPath?: string;
    preview?: {
      description?: string;
      thumbnail?: {
        url?: string;
        width?: number;
        height?: number;
        blurHash?: string;
      };
    };
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

export interface TPOSTUsersMeMarketingTermsToggleReq {
  data: {
    accessToken: string;
  };
}

export type TPOSTUsersMeMarketingTermsToggleRes = {
  marketingTermsAgreed?: boolean;
};

export type TGETUsersMeMyPageRes = {
  activityParticipationCount?: number;
  certificationPosts?: number;
  rewardPoints?: number;
  name?: string;
  profileImageUrl?: string;
  bio?: string;
};

export interface TPATCHUsersMeOnboardingReq {
  data: {
    nickname: string;
    profileImageUrl?: string;
    bio?: string;
  };
}

export type TPATCHUsersMeOnboardingRes = {
  status?: "pending" | "active" | "suspended";
};

export type TGETUsersMeParticipatingCommunitiesRes = {
  routine?: {
    label?: string;
    items?: {
      id?: string;
      name?: string;
      status?: string;
      programStatus?: "ongoing" | "completed";
    }[];
  };
  gathering?: {
    label?: string;
    items?: {
      id?: string;
      name?: string;
      status?: string;
      programStatus?: "ongoing" | "completed";
    }[];
  };
  tmi?: {
    label?: string;
    items?: {
      id?: string;
      name?: string;
      status?: string;
      programStatus?: "ongoing" | "completed";
    }[];
  };
};

export interface TGETUsersMePostsReq {
  page?: number;
  size?: number;
  type?: "all" | "program" | "mission";
}

export type TGETUsersMePostsRes = {
  posts?: {
    id?: string;
    author?: string;
    profileImageUrl?: string;
    title?: string;
    type?: string;
    programType?: "ROUTINE" | "GATHERING" | "TMI";
    isReview?: boolean;
    channel?: string;
    category?: string;
    scheduledDate?: string;
    isPublic?: boolean;
    isLocked?: boolean;
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
    timeAgo?: string;
    communityPath?: string;
    preview?: {
      description?: string;
      thumbnail?: {
        url?: string;
        width?: number;
        height?: number;
        blurHash?: string;
      };
    };
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

export interface TPOSTUsersMePushNotificationToggleReq {
  data: {
    token: string;
  };
}

export type TPOSTUsersMePushNotificationToggleRes = {
  pushTermsAgreed?: boolean;
};

export interface TGETUsersMeRewardsEarnedReq {
  page?: number;
  size?: number;
  filter?: "all" | "earned" | "used" | "expired";
}

export type TGETUsersMeRewardsEarnedRes = {
  availableRewards?: number;
  expiringThisMonth?: number;
  history?: {
    id?: string;
    amount?: number;
    reason?: string;
    actionKey?: string;
    changeType?: "add" | "deduct";
    createdAt?: string;
    expiresAt?: string;
    isProcessed?: boolean;
    isExpired?: boolean;
  }[];
  pagination?: {
    pageNumber?: number;
    pageSize?: number;
    totalElements?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
};

export interface TPOSTUsersMeSyncKakaoProfileReq {
  data: {
    accessToken: string;
  };
}

export type TPOSTUsersMeSyncKakaoProfileRes = {
  success?: boolean;
};

export interface TGETUsersNicknameAvailabilityReq {
  nickname: string;
}

export type TGETUsersNicknameAvailabilityRes = {
  available?: boolean;
};

export interface TPOSTUsersTestCreateReq {
  data: {
    count: number;
  };
}

export type TPOSTUsersTestCreateRes = {
  message?: string;
  created?: number;
  failed?: number;
  users?: {
    uid?: string;
    email?: string;
    displayName?: string;
  }[];
};
