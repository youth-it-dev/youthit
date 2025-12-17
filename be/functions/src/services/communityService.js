const {FieldValue} = require("firebase-admin/firestore");
const FirestoreService = require("./firestoreService");
const fcmHelper = require("../utils/fcmHelper");
const {sanitizeContent} = require("../utils/sanitizeHelper");
const fileService = require("./fileService");
const {isAdminUser} = require("../utils/helpers");
const {NOTIFICATION_LINKS} = require("../constants/urlConstants");

const PROGRAM_TYPES = {
  ROUTINE: "ROUTINE",
  GATHERING: "GATHERING",
  TMI: "TMI",
};

const PROGRAM_TYPE_ALIASES = {
  [PROGRAM_TYPES.ROUTINE]: [
    "ROUTINE",
    "한끗루틴",
    "루틴",
  ],
  [PROGRAM_TYPES.GATHERING]: [
    "GATHERING",
    "월간 소모임",
    "월간소모임",
    "소모임",
  ],
  [PROGRAM_TYPES.TMI]: [
    "TMI",
    "티엠아이",
  ],
};

const PROGRAM_STATES = {
  ONGOING: "ongoing",
  FINISHED: "finished",
};

const PROGRAM_TYPE_TO_POST_TYPE = {
  [PROGRAM_TYPES.ROUTINE]: {
    cert: "ROUTINE_CERT",
    review: "ROUTINE_REVIEW",
  },
  [PROGRAM_TYPES.GATHERING]: {
    cert: "GATHERING_CERT",
    review: "GATHERING_REVIEW",
  },
  [PROGRAM_TYPES.TMI]: {
    cert: "TMI_CERT",
    review: "TMI_REVIEW",
  },
};

const LEGACY_POST_TYPE_TO_PROGRAM_TYPE = {
  ROUTINE_CERT: PROGRAM_TYPES.ROUTINE,
  ROUTINE_REVIEW: PROGRAM_TYPES.ROUTINE,
  GATHERING_CERT: PROGRAM_TYPES.GATHERING,
  GATHERING_REVIEW: PROGRAM_TYPES.GATHERING,
  TMI_CERT: PROGRAM_TYPES.TMI,
  TMI_REVIEW: PROGRAM_TYPES.TMI,
  TMI: PROGRAM_TYPES.TMI,
};

const PROGRAM_TYPE_TO_CATEGORY = {
  [PROGRAM_TYPES.ROUTINE]: "한끗루틴",
  [PROGRAM_TYPES.GATHERING]: "월간소모임",
  [PROGRAM_TYPES.TMI]: "TMI",
};

const CERTIFICATION_COUNT_TYPES = new Set([
  PROGRAM_TYPE_TO_POST_TYPE[PROGRAM_TYPES.ROUTINE].cert,
  PROGRAM_TYPE_TO_POST_TYPE[PROGRAM_TYPES.GATHERING].cert,
  PROGRAM_TYPE_TO_POST_TYPE[PROGRAM_TYPES.TMI].cert,
]);

// 멤버 역할 상수
const MEMBER_ROLES = {
  MEMBER: 'member',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

/**
 * Community Service (비즈니스 로직 계층)
 * 커뮤니티 관련 모든 비즈니스 로직 처리
 */
class CommunityService {
  static MAX_PREVIEW_TEXT_LENGTH = 30;

  constructor() {
    this.firestoreService = new FirestoreService("communities");
  }

  static normalizeProgramType(value) {
    if (!value || typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    const upper = trimmed.toUpperCase();

    for (const [programType, aliases] of Object.entries(PROGRAM_TYPE_ALIASES)) {
      if (aliases.some((alias) => {
        if (typeof alias !== "string") return false;
        const aliasTrimmed = alias.trim();
        return aliasTrimmed === trimmed || aliasTrimmed.toUpperCase() === upper;
      })) {
        return programType;
      }
    }

    if (PROGRAM_TYPES[upper]) {
      return PROGRAM_TYPES[upper];
    }
    if (Object.values(PROGRAM_TYPES).includes(trimmed)) {
      return trimmed;
    }

    return null;
  }

  static mapLegacyPostTypeToProgramType(type) {
    if (!type || typeof type !== "string") {
      return null;
    }
    const upper = type.toUpperCase();
    return LEGACY_POST_TYPE_TO_PROGRAM_TYPE[upper] || null;
  }

  static resolveIsReviewFromLegacyType(type) {
    if (!type || typeof type !== "string") {
      return null;
    }
    const upper = type.toUpperCase();
    if (upper.endsWith("_REVIEW")) {
      return true;
    }
    if (upper.endsWith("_CERT")) {
      return false;
    }
    return null;
  }

  static resolvePostType(programType, isReview) {
    const normalizedProgramType = CommunityService.normalizeProgramType(programType);
    if (!normalizedProgramType) {
      return null;
    }
    const mapping = PROGRAM_TYPE_TO_POST_TYPE[normalizedProgramType];
    if (!mapping) {
      return null;
    }
    return isReview ? mapping.review : mapping.cert;
  }

  static normalizeProgramTypeList(values) {
    if (!values) {
      return [];
    }
    const rawValues = Array.isArray(values) ? values : [values];
    const normalized = [];
    rawValues.forEach((rawValue) => {
      if (typeof rawValue !== "string") {
        return;
      }
      rawValue
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .forEach((token) => {
          const normalizedToken = CommunityService.normalizeProgramType(token);
          if (normalizedToken) {
            normalized.push(normalizedToken);
          }
        });
    });
    return Array.from(new Set(normalized));
  }

  static toDate(value) {
    if (!value) {
      return null;
    }
    if (typeof value.toDate === "function") {
      try {
        return value.toDate();
      } catch (error) {
        return null;
      }
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  static resolveProgramState(community) {
    if (!community) {
      return null;
    }
    const now = new Date();
    const startDate = CommunityService.toDate(community.startDate);
    const endDate = CommunityService.toDate(community.endDate);

    const hasStarted = !startDate || startDate <= now;
    const notEnded = !endDate || endDate >= now;

    if (hasStarted && notEnded) {
      return PROGRAM_STATES.ONGOING;
    }

    if (endDate && endDate < now) {
      return PROGRAM_STATES.FINISHED;
    }

    return null;
  }

  getUserService() {
    if (!this._userService) {
      const UserService = require("./userService");
      this._userService = new UserService();
    }
    return this._userService;
  }

  getRewardService() {
    if (!this._rewardService) {
      const RewardService = require("./rewardService");
      this._rewardService = new RewardService();
    }
    return this._rewardService;
  }

  /**
   * 사용자가 참여 중인 커뮤니티 ID 목록 조회
   * @param {string} userId
   * @return {Promise<Set<string>>}
   */
  async getUserCommunityIds(userId) {
    if (!userId) {
      return new Set();
    }

    try {
      // Admin 사용자는 모든 커뮤니티에 접근 가능
      const isAdmin = await isAdminUser(userId);
      if (isAdmin) {
        const allCommunities = await this.firestoreService.getCollection("communities");
        return new Set(allCommunities.map(c => c.id).filter(Boolean));
      }

      const membershipIds = new Set();
      const membershipService = this.firestoreService;
      const pageSize = 100;
      let currentPage = 0;
      let hasMore = true;
      let fallbackUsed = false;

      while (hasMore) {
        try {
          const result = await membershipService.getCollectionGroup("members", {
            where: [{field: "userId", operator: "==", value: userId}],
            page: currentPage,
            size: pageSize,
            orderBy: "joinedAt",
            orderDirection: "desc",
          });

          (result.content || []).forEach((member) => {
            if (member?.communityId) {
              membershipIds.add(member.communityId);
            }
          });

          hasMore = result.pageable?.hasNext || false;
          currentPage += 1;

          if (currentPage >= 10) {
            break;
          }
        } catch (error) {
          if (!fallbackUsed &&
            (error.code === 9 ||
              (typeof error.message === "string" && (
                error.message.includes("FAILED_PRECONDITION") ||
                error.message.includes("AggregateQuery")
              )))) {
            fallbackUsed = true;
            const fallbackResult = await membershipService.getCollectionGroupWithoutCount("members", {
              where: [{field: "userId", operator: "==", value: userId}],
              size: 1000,
              orderBy: "joinedAt",
              orderDirection: "desc",
            });
            (fallbackResult.content || []).forEach((member) => {
              if (member?.communityId) {
                membershipIds.add(member.communityId);
              }
            });
            console.warn("[COMMUNITY][getUserCommunityIds] collectionGroupWithoutCount 대체 경로 사용", {
              userId,
              fetchedCount: fallbackResult.content?.length || 0,
              totalCollected: membershipIds.size,
            });
            break;
          }
          throw error;
        }
      }

      return membershipIds;
    } catch (error) {
      console.error("[COMMUNITY] 사용자 커뮤니티 조회 실패:", error.message);
      return new Set();
    }
  }

  /**
   * 커뮤니티 매핑 정보 조회
   * @param {string} communityId - 커뮤니티 ID
   * @return {Promise<Object|null>} 커뮤니티 매핑 정보
   */
  async getCommunityMapping(communityId) {
    try {
      const community = await this.firestoreService.getDocument("communities", communityId);
      if (!community) {
        return null;
      }

      return {
        name: community.name,
        type: community.type,
        channel: community.channel,
        programType: CommunityService.normalizeProgramType(community.programType),
      };
    } catch (error) {
      console.error("[COMMUNITY] 커뮤니티 매핑 정보 조회 실패:", error.message);
      throw new Error("커뮤니티 매핑 정보 조회에 실패했습니다");
    }
  }

  /**
   * 커뮤니티 목록 조회
   * @param {Object} options - 조회 옵션
   * @return {Promise<Object>} 커뮤니티 목록
   */
  async getCommunities(options = {}) {
    try {
      const {type, page = 0, size = 10} = options;
      const whereConditions = [];

      // 타입 필터링 (interest | anonymous)
      if (type && ["interest", "anonymous"].includes(type)) {
        whereConditions.push({
          field: "type",
          operator: "==",
          value: type,
        });
      }

      const result = await this.firestoreService.getWithPagination({
        page: parseInt(page),
        size: parseInt(size),
        orderBy: "createdAt",
        orderDirection: "desc",
        where: whereConditions,
      });

      return {
        content: result.content || [],
        pagination: result.pageable || {},
      };
    } catch (error) {
      console.error("[COMMUNITY] 커뮤니티 목록 조회 실패:", error.message);
      throw new Error("커뮤니티 목록 조회에 실패했습니다");
    }
  }



  /**
   * 시간 차이 계산
   * @param {Date} date - 날짜
   * @return {string} 시간 차이 문자열
   */
  getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return "방금 전";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}분 전`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}시간 전`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}일 전`;
    } else {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months}개월 전`;
    }
  }

  /**
   * 게시글 프리뷰 생성
   * @param {Object} post - 게시글 데이터
   * @return {Object} 프리뷰 객체
   */
  createPreview(post) {
    let description = "";
    let thumbnail = null;

    if (typeof post.content === 'string') {
      const textOnly = post.content.replace(/<[^>]*>/g, '').trim();
      description = textOnly.substring(0, CommunityService.MAX_PREVIEW_TEXT_LENGTH) + (textOnly.length > CommunityService.MAX_PREVIEW_TEXT_LENGTH ? "..." : "");

      const imgMatch = post.content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      if (imgMatch) {
        const imgTag = post.content.match(/<img[^>]*>/i)?.[0] || "";
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
        const widthMatch = imgTag.match(/width=["']?(\d+)["']?/i);
        const heightMatch = imgTag.match(/height=["']?(\d+)["']?/i);
        const blurHashMatch = imgTag.match(/data-blurhash=["']([^"']+)["']/i);

        const width = widthMatch ? parseInt(widthMatch[1], 10) : null;
        const height = heightMatch ? parseInt(heightMatch[1], 10) : null;
        const blurHash = blurHashMatch ? blurHashMatch[1] : null;

        thumbnail = {
          url: srcMatch ? srcMatch[1] : imgMatch[1],
          width,
          height,
          blurHash,
        };
      }
    } else {
      const contentArr = Array.isArray(post.content) ? post.content : [];
      const mediaArr = Array.isArray(post.media) ? post.media : [];

      const textItem = contentArr.find(
        (item) =>
          item.type === "text" &&
          (item.content || item.text) &&
          (item.content || item.text).trim(),
      );
      const text = textItem ? (textItem.content || textItem.text) : "";
      description = text
        ? text.substring(0, CommunityService.MAX_PREVIEW_TEXT_LENGTH) +
          (text.length > CommunityService.MAX_PREVIEW_TEXT_LENGTH ? "..." : "")
        : "";

      const firstImage = mediaArr.find((item) => item.type === "image") ||
        contentArr.find((item) => item.type === "image");

      thumbnail = firstImage ? {
        url: firstImage.url || firstImage.src,
        blurHash: firstImage.blurHash || null,
        width: typeof firstImage.width === "number" ? firstImage.width : (firstImage.width ? Number(firstImage.width) : null),
        height: typeof firstImage.height === "number" ? firstImage.height : (firstImage.height ? Number(firstImage.height) : null),
      } : null;
    }

    return {
      description,
      thumbnail,
    };
  }

  async getAllCommunityPosts(options = {}, viewerId = null) {
    try {
      const {
        programTypes: programTypesOption,
        programType: programTypeOption,
        programState: programStateOption,
        page = 0,
        size = 10,
        sort = "latest",
        orderBy = "createdAt",
        orderDirection = "desc",
      } = options;

      const requestedProgramTypes = [
        ...CommunityService.normalizeProgramTypeList(programTypesOption),
        ...CommunityService.normalizeProgramTypeList(programTypeOption),
      ];

      const normalizedProgramTypes = Array.from(new Set(requestedProgramTypes));

      let normalizedProgramState =
        typeof programStateOption === "string"
          ? programStateOption.toLowerCase()
          : null;
      if (
        normalizedProgramState &&
        ![PROGRAM_STATES.ONGOING, PROGRAM_STATES.FINISHED].includes(
          normalizedProgramState,
        )
      ) {
        normalizedProgramState = null;
      }

      if (normalizedProgramTypes.length > 10) {
        const error = new Error("programType 필터는 최대 10개까지 지정할 수 있습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const whereConditions = [];
      if (normalizedProgramTypes.length === 1) {
        whereConditions.push({
          field: "programType",
          operator: "==",
          value: normalizedProgramTypes[0],
        });
      } else if (normalizedProgramTypes.length > 1) {
        whereConditions.push({
          field: "programType",
          operator: "in",
          value: normalizedProgramTypes,
        });
      }
      // isLocked가 false인 게시글만 조회
      whereConditions.push({
        field: "isLocked",
        operator: "==",
        value: false,
      });

      const communityCache = new Map();
      const userProfileCache = new Map();

      const loadCommunities = async (communityIds = []) => {
        if (!communityIds || communityIds.length === 0) {
          return;
        }
        const uniqueIds = Array.from(
          new Set(communityIds.filter((id) => id && !communityCache.has(id))),
        );
        if (uniqueIds.length === 0) {
          return;
        }

        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
          chunks.push(uniqueIds.slice(i, i + 10));
        }

        const communityResults = await Promise.all(
          chunks.map((chunk) =>
            this.firestoreService.getCollectionWhereIn("communities", "id", chunk),
          ),
        );
        communityResults
          .flat()
          .filter((community) => community?.id)
          .forEach((community) => {
            communityCache.set(community.id, community);
          });
      };

      const loadUserProfiles = async (authorIds = []) => {
        if (!authorIds || authorIds.length === 0) {
          return {};
        }
        
        // 중복 제거 및 유효한 ID만 필터링
        const uniqueAuthorIds = Array.from(new Set(authorIds.filter((id) => id)));
        if (uniqueAuthorIds.length === 0) {
          return {};
        }

        // 이미 캐시에 없는 유저 ID만 조회 대상으로 선정
        const uncachedIds = uniqueAuthorIds.filter((id) => !userProfileCache.has(id));
        
        // 문서 ID로 배치 조회 (성능 최적화: 1개 쿼리로 여러 문서 조회)
        if (uncachedIds.length > 0) {
          try {
            // Firestore 'in' 쿼리는 최대 10개만 지원하므로 청크로 나누어 처리
            const chunks = [];
            for (let i = 0; i < uncachedIds.length; i += 10) {
              chunks.push(uncachedIds.slice(i, i + 10));
            }

            const userResults = await Promise.all(
              chunks.map((chunk) =>
                this.firestoreService.getCollectionWhereIn("users", "__name__", chunk),
              ),
            );
            userResults
              .flat()
              .filter((user) => user?.id)
              .forEach((user) => {
                // 프로필 이미지가 있으면 저장, 없으면 null로 저장하여 재조회 방지
                const profileImageUrl = user.profileImageUrl || null;
                userProfileCache.set(user.id, profileImageUrl);
              });
          } catch (error) {
            console.warn("[COMMUNITY] 작성자 프로필 이미지 배치 조회 실패:", error.message);
          }
        }

        // 요청한 모든 authorId에 대한 결과 반환 (캐시에서 조회)
        const result = {};
        uniqueAuthorIds.forEach((id) => {
          result[id] = userProfileCache.get(id) || null;
        });
        return result;
      };

      const matchesFilter = (post, community) => {
        const postProgramType =
          CommunityService.normalizeProgramType(post.programType) ||
          CommunityService.mapLegacyPostTypeToProgramType(post.type);

        const matchesProgramType =
          normalizedProgramTypes.length === 0 ||
          (postProgramType && normalizedProgramTypes.includes(postProgramType));

        if (!matchesProgramType) {
          return false;
        }

        if (!normalizedProgramState) {
          return true;
        }

        if (!community) {
          return false;
        }

        const communityState = CommunityService.resolveProgramState(community);
        if (!communityState) {
          return false;
        }

        if (normalizedProgramState === PROGRAM_STATES.ONGOING) {
          return communityState === PROGRAM_STATES.ONGOING;
        }

        if (normalizedProgramState === PROGRAM_STATES.FINISHED) {
          return communityState === PROGRAM_STATES.FINISHED;
        }

        return false;
      };

      const membershipIds = await this.getUserCommunityIds(viewerId);

      const resolveIsPublic = (post) => {
        if (typeof post.isPublic === "boolean") {
          return post.isPublic;
        }
        return true;
      };
      const canViewPost = async (post) => {
        if (resolveIsPublic(post)) return true;
        if (!viewerId) return false;
        if (!post.communityId) return false;
        // Admin 사용자는 모든 게시글 조회 가능
        const isAdmin = await isAdminUser(viewerId);
        if (isAdmin) return true;
        
        // 비공개 게시글은 approved 멤버만 조회 가능
        if (!membershipIds.has(post.communityId)) {
          return false;
        }
        
        // 해당 커뮤니티의 멤버 status 확인
        try {
          const members = await this.firestoreService.getCollectionWhere(
            `communities/${post.communityId}/members`,
            "userId",
            "==",
            viewerId
          );
          const memberData = members && members[0];
          if (memberData && memberData.status === "approved") {
            return true;
          }
          return false;
        } catch (error) {
          console.warn("[COMMUNITY] 멤버 status 확인 실패:", error.message);
          return false;
        }
      };

      const postsService = new FirestoreService();
      
      let paginatedPosts = [];
      let totalElements = 0;
      let totalPages = 0;
      let hasNextPage = false;

      // 인기순 정렬인 경우 점수 기반 정렬 로직
      if (sort === "popular") {
        // 인기순은 더 많은 데이터를 가져와서 점수 계산 후 정렬해야 함
        const batchSize = 500; // 인기순일 때는 더 많이 가져옴
        const maxPosts = 1000; // 최신순 게시글 1000개까지 수집
        let rawPage = 0;
        let hasMore = true;
        const allAccessiblePosts = [];

        // 최신순 게시글부터 수집 (최대 1000개)
        while (hasMore && allAccessiblePosts.length < maxPosts) {
          let result;
          try {
            result = await postsService.getCollectionGroup("posts", {
              page: rawPage,
              size: batchSize,
              orderBy: "createdAt",
              orderDirection: "desc",
              where: whereConditions,
            });
          } catch (firestoreError) {
            if (firestoreError.code === 9 || firestoreError.code === "FAILED_PRECONDITION") {
              console.error("[COMMUNITY] posts collectionGroup 인덱스 부족, fallback 쿼리 사용", {
                whereConditions,
                orderBy: "createdAt",
                orderDirection: "desc",
                errorMessage: firestoreError.message,
              });
              result = await postsService.getCollectionGroupWithoutCount("posts", {
                size: batchSize,
                orderBy: "createdAt",
                orderDirection: "desc",
                where: whereConditions,
              });
            } else {
              throw firestoreError;
            }
          }

          const rawPosts = result.content || [];
          if (rawPosts.length === 0) {
            break;
          }

          const communityIdsInBatch = rawPosts
            .map((post) => post.communityId)
            .filter(Boolean);
          await loadCommunities(communityIdsInBatch);

          for (const post of rawPosts) {
            const community =
              post.communityId && communityCache.has(post.communityId)
                ? communityCache.get(post.communityId)
                : null;
            
            if (await canViewPost(post) && matchesFilter(post, community)) {
              allAccessiblePosts.push(post);
            }
          }

          hasMore = result.pageable?.hasNext || false;
          rawPage += 1;
        }

        // 최신성 점수 계산을 위한 시간 범위 계산
        if (allAccessiblePosts.length > 0) {
          const now = Date.now();
          const postTimes = allAccessiblePosts
            .map((post) => {
              const createdAt = post.createdAt?.toDate?.() || (post.createdAt ? new Date(post.createdAt) : null);
              return createdAt ? createdAt.getTime() : 0;
            })
            .filter((time) => time > 0);

          const latestTime = postTimes.length > 0 ? Math.max(...postTimes) : now;
          const oldestTime = postTimes.length > 0 ? Math.min(...postTimes) : now;
          const timeRange = latestTime - oldestTime || 1; // 0으로 나누기 방지

          // 각 게시글에 점수 계산
          const postsWithScores = allAccessiblePosts.map((post) => {
            const likesCount = post.likesCount || 0;
            const commentsCount = post.commentsCount || 0;
            const viewCount = post.viewCount || 0;
            
            // 최신성 점수 계산 (0~1 사이 값, 최신일수록 1에 가까움)
            const createdAt = post.createdAt?.toDate?.() || (post.createdAt ? new Date(post.createdAt) : null);
            const postTime = createdAt ? createdAt.getTime() : oldestTime;
            const recencyScore = timeRange > 0 ? 1 - ((latestTime - postTime) / timeRange) : 0.5;

            // 인기 점수 계산: (좋아요×0.45) + (댓글×0.2) + (조회수×0.1) + (최신성×0.15)
            const popularityScore = 
              (likesCount * 0.45) + 
              (commentsCount * 0.2) + 
              (viewCount * 0.1) + 
              (recencyScore * 0.15);

            return {
              ...post,
              _popularityScore: popularityScore,
            };
          });

          // 점수 높은 순으로 정렬
          postsWithScores.sort((a, b) => b._popularityScore - a._popularityScore);

          // 페이지네이션 적용
          totalElements = postsWithScores.length;
          totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);
          const startIndex = page * size;
          const endIndex = startIndex + size;
          paginatedPosts = postsWithScores.slice(startIndex, endIndex);
          hasNextPage = endIndex < totalElements;
        } else {
          totalPages = 0;
          hasNextPage = false;
        }
      } else {
        // 최신순 정렬 (기존 로직)
        const batchSize = Math.max(size, 50);
        let rawPage = 0;
        let hasMore = true;

        const startIndex = page * size;
        const targetEndIndex = (page + 1) * size;
        let accessibleCount = 0;
        let hasNextAccessible = false;
        const pagePosts = [];

        while (hasMore && !hasNextAccessible) {
          let result;
          try {
            result = await postsService.getCollectionGroup("posts", {
              page: rawPage,
              size: batchSize,
              orderBy,
              orderDirection,
              where: whereConditions,
            });
          } catch (firestoreError) {
            if (firestoreError.code === 9 || firestoreError.code === "FAILED_PRECONDITION") {
              console.error("[COMMUNITY] posts collectionGroup 인덱스 부족, fallback 쿼리 사용", {
                whereConditions,
                orderBy,
                orderDirection,
                errorMessage: firestoreError.message,
              });
              result = await postsService.getCollectionGroupWithoutCount("posts", {
                size: batchSize,
                orderBy,
                orderDirection,
                where: whereConditions,
              });
            } else {
              throw firestoreError;
            }
          }

          const rawPosts = result.content || [];
          if (rawPosts.length === 0) {
            break;
          }

          const communityIdsInBatch = rawPosts
            .map((post) => post.communityId)
            .filter(Boolean);
          await loadCommunities(communityIdsInBatch);

          for (const post of rawPosts) {
            const community =
              post.communityId && communityCache.has(post.communityId)
                ? communityCache.get(post.communityId)
                : null;
            if (await canViewPost(post) && matchesFilter(post, community)) {
              accessibleCount += 1;

              if (accessibleCount > startIndex && pagePosts.length < size) {
                pagePosts.push(post);
              }

              if (accessibleCount >= targetEndIndex + 1) {
                hasNextAccessible = true;
                break;
              }
            }
          }

          hasMore = result.pageable?.hasNext || false;
          rawPage += 1;

          if (!hasMore || hasNextAccessible) {
            break;
          }
        }

        totalElements = hasNextAccessible
          ? startIndex + pagePosts.length + 1
          : accessibleCount;
        totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);
        hasNextPage = hasNextAccessible || page < totalPages - 1;
        paginatedPosts = pagePosts;
      }

      const communityIds = [...new Set(paginatedPosts.map(post => post.communityId).filter(Boolean))];
      const communityMap = {};
      if (communityIds.length > 0) {
        await loadCommunities(communityIds);
        communityIds.forEach((communityId) => {
          if (communityCache.has(communityId)) {
            communityMap[communityId] = communityCache.get(communityId);
          }
        });
      }

      // 작성자 프로필 이미지 배치 조회 (캐시 활용)
      const authorIds = [...new Set(paginatedPosts.map(post => post.authorId).filter(Boolean))];
      const profileImageMap = authorIds.length > 0 ? await loadUserProfiles(authorIds) : {};

      const processPost = (post) => {
        const {authorId: _ignored, content: _content, media: _media, communityId, ...rest} = post;
        const createdAtDate = post.createdAt?.toDate?.() || (post.createdAt ? new Date(post.createdAt) : null);
        const updatedAtDate = post.updatedAt?.toDate?.() || (post.updatedAt ? new Date(post.updatedAt) : null);
        const scheduledDate = post.scheduledDate?.toDate?.() || (post.scheduledDate ? new Date(post.scheduledDate) : null);
        const resolvedProgramType =
          CommunityService.normalizeProgramType(rest.programType) ||
          CommunityService.mapLegacyPostTypeToProgramType(post.type);
        const resolvedIsReview =
          typeof rest.isReview === "boolean"
            ? rest.isReview
            : CommunityService.resolveIsReviewFromLegacyType(post.type);

        const processed = {
          id: post.id,
          ...rest,
          createdAt: createdAtDate?.toISOString?.() || post.createdAt,
          updatedAt: updatedAtDate?.toISOString?.() || post.updatedAt,
          scheduledDate: scheduledDate?.toISOString?.() || post.scheduledDate,
          timeAgo: createdAtDate ? this.getTimeAgo(createdAtDate) : "",
          communityPath: communityId ? `communities/${communityId}` : null,
          rewardGiven: post.rewardGiven || false,
          reportsCount: post.reportsCount || 0,
          viewCount: post.viewCount || 0,
          community: communityId && communityMap[communityId] ? {
            id: communityId,
            name: communityMap[communityId].name,
          } : null,
          profileImageUrl: post.authorId ? (profileImageMap[post.authorId] || null) : null,
        };
        processed.programType = resolvedProgramType;
        processed.isReview = resolvedIsReview;

        processed.preview = post.preview || this.createPreview(post);
        processed.isPublic = resolveIsPublic(post);

        return processed;
      };

      let processedPosts = paginatedPosts.map(processPost);

      if (viewerId) {
        const likedPostIds = await this.getUserLikedTargetIds("POST", processedPosts.map(post => post.id), viewerId);
        processedPosts = processedPosts.map((post) => ({
          ...post,
          isLiked: likedPostIds.has(post.id),
        }));
      }

      return {
        content: processedPosts,
        pagination: {
          pageNumber: page,
          pageSize: size,
          totalElements,
          totalPages,
          hasNext: hasNextPage,
          hasPrevious: page > 0,
          isFirst: page === 0,
          isLast: totalPages === 0 ? true : !hasNextPage,
        },
      };
    } catch (error) {
      console.error("[COMMUNITY] 전체 게시글 조회 실패:", error.message);
      throw new Error("커뮤니티 게시글 조회에 실패했습니다");
    }
  }

  /**
   * @param {Array<string>} postIds - 게시글 ID 목록
   * @param {Object} communityIdMap - postId를 communityId로 매핑
   * @return {Promise<Array>} 처리된 게시글 목록
   */
  async getPostsByIds(postIds, communityIdMap) {
    if (!postIds || postIds.length === 0) {
      return [];
    }

    // CommunityService 인스턴스 생성 (lazy loading으로 순환 참조 방지)
    const CommunityService = require("./communityService");
    const communityService = new CommunityService();

    // 커뮤니티 정보 조회
    const communities = await communityService.firestoreService.getCollection("communities");
    const communityMap = {};
    communities.forEach(community => {
      communityMap[community.id] = community;
    });

    // 각 postId별로 게시글 조회
    const postPromises = postIds.map(async (postId) => {
      try {
        const communityId = communityIdMap[postId];
        if (!communityId) return null;
        
        const postsService = new FirestoreService(`communities/${communityId}/posts`);
        const post = await postsService.getById(postId);
        
        if (!post) return null;
        
        return {
          ...post,
          communityId,
          community: communityMap[communityId] ? {
            id: communityId,
            name: communityMap[communityId].name,
          } : null,
        };
      } catch (error) {
        console.error(`[COMMUNITY] 게시글 조회 실패 (${postId}):`, error.message);
        return null;
      }
    });

    const posts = await Promise.all(postPromises);
    const allPosts = posts.filter(post => post !== null);

    // processPost 헬퍼 함수 적용 (저장된 preview 사용)
    const processPost = (post) => {
      const { authorId: _, ...postWithoutAuthorId } = post;
      const createdAtDate = post.createdAt?.toDate?.() || post.createdAt;
      const processedPost = {
        ...postWithoutAuthorId,
        createdAt: createdAtDate?.toISOString?.() || post.createdAt,
        updatedAt: post.updatedAt?.toDate?.()?.toISOString?.() || post.updatedAt,
        scheduledDate: post.scheduledDate?.toDate?.()?.toISOString?.() || post.scheduledDate,
        timeAgo: createdAtDate ? communityService.getTimeAgo(new Date(createdAtDate)) : "",
        communityPath: `communities/${post.communityId}`,
        rewardGiven: post.rewardGiven || false,
        reportsCount: post.reportsCount || 0,
        viewCount: post.viewCount || 0,
      };

      // 저장된 preview 사용 (하위 호환: 없으면 동적 생성)
      processedPost.preview = post.preview || communityService.createPreview(post);
      delete processedPost.content;
      delete processedPost.media;
      delete processedPost.communityId;

      processedPost.programType =
        CommunityService.normalizeProgramType(post.programType) ||
        CommunityService.mapLegacyPostTypeToProgramType(post.type) ||
        processedPost.programType ||
        null;

      const resolvedIsReview =
        typeof post.isReview === "boolean"
          ? post.isReview
          : CommunityService.resolveIsReviewFromLegacyType(post.type);
      if (resolvedIsReview !== null) {
        processedPost.isReview = resolvedIsReview;
      }

      return processedPost;
    };

    return allPosts.map(processPost);
  }


  /**
   * 게시글 생성
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} userId - 사용자 ID
   * @param {Object} postData - 게시글 데이터
   * @return {Promise<Object>} 생성된 게시글
   */
  async createPost(communityId, userId, postData) {
    try {
      console.log("[COMMUNITY][createPost] 요청 수신", {
        communityId,
        userId,
        hasPostData: !!postData,
      });

      const {
        title,
        content,
        media: postMedia = [],
        type,
        channel,
        category,
        scheduledDate,
        isPublic: requestIsPublic,
        isReview: requestIsReview,
      } = postData;
      
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        console.warn("[COMMUNITY][createPost] 제목 누락", { communityId, userId });
        const error = new Error("제목은 필수입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        console.warn("[COMMUNITY][createPost] 내용 누락", { communityId, userId });
        const error = new Error("게시글 내용은 필수입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const textWithoutTags = content.replace(/<[^>]*>/g, '').trim();
      if (textWithoutTags.length === 0) {
        console.warn("[COMMUNITY][createPost] 텍스트만 추출 시 빈 문자열", { communityId, userId });
        const error = new Error("게시글에 텍스트 내용이 필요합니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      console.log("[COMMUNITY][createPost] 원본 콘텐츠 검증 통과", {
        communityId,
        userId,
        originalLength: content.length,
      });

      const sanitizedContent = sanitizeContent(content);

      const sanitizedText = sanitizedContent.replace(/<[^>]*>/g, '').trim();
      if (sanitizedText.length === 0) {
        console.warn("[COMMUNITY][createPost] sanitize 이후 빈 문자열", { communityId, userId });
        const error = new Error("sanitize 후 유효한 텍스트 내용이 없습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      console.log("[COMMUNITY][createPost] sanitize 완료", {
        communityId,
        userId,
        sanitizedLength: sanitizedContent.length,
      });

      // 파일 검증 (게시글 생성 전)
      let validatedFiles = [];
      if (postMedia && Array.isArray(postMedia) && postMedia.length > 0) {
        console.log("[COMMUNITY][createPost] 미디어 검증 시작", {
          communityId,
          userId,
          mediaCount: postMedia.length,
        });
        try {
          validatedFiles = await fileService.validateFilesForPost(postMedia, userId);
          console.log("[COMMUNITY][createPost] 미디어 검증 성공", {
            communityId,
            userId,
            validatedCount: validatedFiles.length,
          });
        } catch (fileError) {
          console.error("[COMMUNITY][createPost] 파일 검증 실패", {
            communityId,
            userId,
            error: fileError.message,
          });
          // 파일 검증 실패 시 게시글 생성 안 함
          throw fileError;
        }
      }

      const community = await this.firestoreService.getDocument("communities", communityId);
      if (!community) {
        console.warn("[COMMUNITY][createPost] 커뮤니티 없음", { communityId, userId });
        const error = new Error("Community not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      console.log("[COMMUNITY][createPost] 커뮤니티 조회 성공", {
        communityId,
        userId,
        communityName: community.name,
      });

      const resolvedProgramType =
        CommunityService.normalizeProgramType(community.programType);

      if (!resolvedProgramType) {
        const error = new Error("community.programType 값이 필요합니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const resolvedCategory = PROGRAM_TYPE_TO_CATEGORY[resolvedProgramType] || null;

      let resolvedIsReview = null;
      if (Object.prototype.hasOwnProperty.call(postData, "isReview")) {
        if (typeof requestIsReview !== "boolean") {
          const error = new Error("isReview 값은 boolean 타입이어야 합니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }
        resolvedIsReview = requestIsReview;
      }

      if (resolvedIsReview === null) {
        const inferredFromType =
          CommunityService.resolveIsReviewFromLegacyType(type);
        resolvedIsReview = inferredFromType !== null ? inferredFromType : false;
      }

      const resolvedType = CommunityService.resolvePostType(
        resolvedProgramType,
        resolvedIsReview,
      );
      if (!resolvedType) {
        const error = new Error("게시글 타입을 결정할 수 없습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      let author = "익명"; 
      try {
        const isAdmin = await isAdminUser(userId);
        
        if (isAdmin) {
          // Admin 사용자는 members에 없어도 users 컬렉션에서 닉네임 조회
          try {
            const userProfile = await this.firestoreService.getDocument("users", userId);
            if (resolvedProgramType === PROGRAM_TYPES.TMI) {
              author = userProfile?.name || "익명";
            } else {
              // Admin의 경우 nicknames 컬렉션에서 조회
              const nicknames = await this.firestoreService.getCollectionWhere(
                "nicknames",
                "uid",
                "==",
                userId
              );
              const nicknameDoc = nicknames && nicknames[0];
              if (nicknameDoc) {
                author = nicknameDoc.id || nicknameDoc.nickname || "익명";
              } else {
                author = userProfile?.name || "익명";
              }
            }
          } catch (userError) {
            console.warn("[COMMUNITY][createPost] Admin 사용자 정보 조회 실패", {
              userId,
              error: userError.message,
            });
            author = "익명";
          }
        } else {
          // 일반 사용자는 members에서 조회
          const members = await this.firestoreService.getCollectionWhere(
            `communities/${communityId}/members`,
            "userId",
            "==",
            userId
          );
          const memberData = members && members[0];
          if (memberData) {
            if (resolvedProgramType === PROGRAM_TYPES.TMI) {
              // TMI 타입: users 컬렉션에서 name 가져오기
              try {
                const userProfile = await this.firestoreService.getDocument("users", userId);
                author = userProfile?.name || "익명";
              } catch (userError) {
                console.warn("[COMMUNITY][createPost] 사용자 정보 조회 실패", {
                  userId,
                  error: userError.message,
                });
                author = "익명";
              }
            } else {
              author = memberData.nickname || "익명";
            }
          }
        }
      } catch (memberError) {
        console.warn("[COMMUNITY][createPost] 멤버 정보 조회 실패", {
          communityId,
          userId,
          error: memberError.message,
        });
      }

      const postsService = new FirestoreService(`communities/${communityId}/posts`);
      
      // preview 필드 생성
      const preview = this.createPreview({
        content: sanitizedContent,
        media: postMedia,
      });
      
      let isPublic = true;
      if (Object.prototype.hasOwnProperty.call(postData, "isPublic")) {
        if (typeof requestIsPublic !== "boolean") {
          const error = new Error("isPublic 값은 boolean 타입이어야 합니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }
        isPublic = requestIsPublic;
      }

      const newPost = {
        communityId,
        authorId: userId,
        author: author,
        title,
        content: sanitizedContent,
        media: postMedia,
        preview,
        type: resolvedType,
        programType: resolvedProgramType,
        isReview: resolvedIsReview,
        channel: channel || community.name || "general",
        category: resolvedCategory,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        isLocked: false,
        isPublic,
        rewardGiven: false,
        likesCount: 0,
        commentsCount: 0,
        reportsCount: 0,
        viewCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const result = await this.firestoreService.runTransaction(async (transaction) => {
        console.log("[COMMUNITY][createPost] Firestore 트랜잭션 시작", {
          communityId,
          userId,
          hasValidatedFiles: validatedFiles.length > 0,
        });

        const postRef = this.firestoreService.db.collection(`communities/${communityId}/posts`).doc();
        transaction.set(postRef, newPost);
        
        if (validatedFiles.length > 0) {
          fileService.attachFilesToPostInTransaction(validatedFiles, postRef.id, transaction);
        }
        
        const authoredPostRef = this.firestoreService.db
          .collection(`users/${userId}/authoredPosts`)
          .doc(postRef.id);
        transaction.set(authoredPostRef, {
          postId: postRef.id,
          communityId,
          createdAt: FieldValue.serverTimestamp(),
          lastAuthoredAt: FieldValue.serverTimestamp(),
        });

        if (CERTIFICATION_COUNT_TYPES.has(newPost.type)) {
          const userRef = this.firestoreService.db.collection("users").doc(userId);
          transaction.update(userRef, {
            certificationPosts: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });

          const memberRef = this.firestoreService.db
            .collection(`communities/${communityId}/members`)
            .doc(userId);
          transaction.update(memberRef, {
            certificationPostsCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        
        console.log("[COMMUNITY][createPost] 트랜잭션 내 작업 완료", {
          communityId,
          userId,
          postId: postRef.id,
        });

        return { postId: postRef.id };
      });
      const postId = result.postId;

      console.log("[COMMUNITY][createPost] 게시글 생성 완료", {
        communityId,
        userId,
        postId,
      });

      this._notifyCommunityMembersAboutNewPost(communityId, userId, postId, title, community.name, author)
        .catch((error) => {
          console.error("[COMMUNITY][createPost] 멤버 알림 전송 실패 (게시글 생성은 성공):", error.message);
        });

      const {authorId, createdAt: _createdAt, updatedAt: _updatedAt, preview: _preview, ...restNewPost} = newPost;
      
      return {
        id: postId,
        ...restNewPost,
        scheduledDate: newPost.scheduledDate?.toISOString?.() || newPost.scheduledDate,
        communityPath: `communities/${communityId}`,
        community: {
          id: communityId,
          name: community.name,
        },
      };
    } catch (error) {
      console.error("[COMMUNITY][createPost] 게시글 생성 에러", {
        communityId,
        userId,
        error: error.message,
      });
      if (error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("게시글 생성에 실패했습니다");
    }
  }

  /**
   * 커뮤니티 멤버들에게 새 게시글 작성 알림 전송
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} authorId - 작성자 ID
   * @param {string} postId - 게시글 ID
   * @param {string} postTitle - 게시글 제목
   * @param {string} communityName - 커뮤니티 이름
   * @param {string} authorName - 작성자 이름
   * @private
   */
  async _notifyCommunityMembersAboutNewPost(communityId, authorId, postId, postTitle, communityName, authorName) {
    try {
      const members = await this.firestoreService.getCollectionWhere(
        `communities/${communityId}/members`,
        "status",
        "==",
        "approved"
      );

      if (!members || members.length === 0) {
        console.log(`[COMMUNITY][_notifyCommunityMembersAboutNewPost] 멤버 없음: communityId=${communityId}`);
        return;
      }

      const memberUserIds = members
        .filter((member) => member.userId && member.userId !== authorId)
        .map((member) => member.userId);

      if (memberUserIds.length === 0) {
        console.log(`[COMMUNITY][_notifyCommunityMembersAboutNewPost] 알림 대상 없음 (작성자만 존재): communityId=${communityId}`);
        return;
      }

      const link = NOTIFICATION_LINKS.POST(postId, communityId);
      
      const notificationTitle = "새 게시글이 올라왔어요";
      const notificationMessage = communityName ? `${communityName} 프로그램에 새로운 게시글이 올라왔어요` : "새로운 게시글이 올라왔어요";

      await fcmHelper.sendNotificationToUsers(
        memberUserIds,
        notificationTitle,
        notificationMessage,
        "ACTIVITY",
        postId,
        communityId,
        link
      );

      console.log(`[COMMUNITY][_notifyCommunityMembersAboutNewPost] 알림 전송 완료: communityId=${communityId}, postId=${postId}, 대상=${memberUserIds.length}명`);
    } catch (error) {
      console.error("[COMMUNITY][_notifyCommunityMembersAboutNewPost] 알림 전송 실패:", error);
      throw error;
    }
  }

  /**
   * 게시글 상세 조회
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} postId - 게시글 ID
   * @return {Promise<Object>} 게시글 상세 정보
   */
  async getPostById(communityId, postId, viewerId = null) {
    try {
      const postsService = new FirestoreService(`communities/${communityId}/posts`);
      const post = await postsService.getById(postId);

      if (!post) {
        const error = new Error("Post not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      // 조회수 증가
      const newViewCount = (post.viewCount || 0) + 1;
      postsService.update(postId, {
        viewCount: newViewCount,
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(error => {
        console.error("조회수 증가 실패:", error);
      });

      // 커뮤니티 정보 추가
      const community = await this.firestoreService.getDocument("communities", communityId);

      // 비공개 게시글 권한 체크
      const isPublic = typeof post.isPublic === "boolean" ? post.isPublic : true;
      if (!isPublic && viewerId) {
        const isAdmin = await isAdminUser(viewerId);
        if (!isAdmin) {
          const membershipIds = await this.getUserCommunityIds(viewerId);
          if (!membershipIds.has(communityId)) {
            const error = new Error("Post not found");
            error.code = "NOT_FOUND";
            throw error;
          }
          
          // 비공개 게시글은 approved 멤버만 조회 가능
          try {
            const members = await this.firestoreService.getCollectionWhere(
              `communities/${communityId}/members`,
              "userId",
              "==",
              viewerId
            );
            const memberData = members && members[0];
            if (!memberData || memberData.status !== "approved") {
              const error = new Error("Post not found");
              error.code = "NOT_FOUND";
              throw error;
            }
          } catch (error) {
            if (error.code === "NOT_FOUND") {
              throw error;
            }
            console.warn("[COMMUNITY] 멤버 status 확인 실패:", error.message);
            const notFoundError = new Error("Post not found");
            notFoundError.code = "NOT_FOUND";
            throw notFoundError;
          }
        }
      } else if (!isPublic && !viewerId) {
        const error = new Error("Post not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      const {authorId, ...postWithoutAuthorId} = post;
      const resolvedProgramType =
        CommunityService.normalizeProgramType(post.programType) ||
        CommunityService.mapLegacyPostTypeToProgramType(post.type);
      const resolvedIsReview =
        typeof post.isReview === "boolean"
          ? post.isReview
          : CommunityService.resolveIsReviewFromLegacyType(post.type);
      
      const isAuthor = Boolean(viewerId && viewerId === authorId);

      // 작성자 프로필 이미지 조회
      let profileImageUrl = null;
      if (authorId) {
        try {
          const userService = this.getUserService();
          const author = await userService.getUserById(authorId);
          if (author && author.profileImageUrl) {
            profileImageUrl = author.profileImageUrl;
          }
        } catch (error) {
          console.warn("[COMMUNITY] 작성자 프로필 이미지 조회 실패:", error.message);
        }
      }

      const response = {
        ...postWithoutAuthorId,
        authorId: authorId || null, // 작성자 UID 추가
        programType: resolvedProgramType,
        isReview: resolvedIsReview,
        viewCount: newViewCount,
        reportsCount: post.reportsCount || 0,
        // 시간 필드들을 ISO 문자열로 변환 (FirestoreService와 동일)
        createdAt: post.createdAt?.toDate?.()?.toISOString?.() || post.createdAt,
        updatedAt: post.updatedAt?.toDate?.()?.toISOString?.() || post.updatedAt,
        scheduledDate: post.scheduledDate?.toDate?.()?.toISOString?.() || post.scheduledDate,
        timeAgo: post.createdAt ? this.getTimeAgo(new Date(post.createdAt?.toDate?.() || post.createdAt)) : "",
        communityPath: `communities/${communityId}`,
        community: community ? {
          id: communityId,
          name: community.name,
        } : null,
        isAuthor,
        profileImageUrl,
      };

      if (viewerId) {
        const liked = await this.hasUserLikedTarget("POST", postId, viewerId);
        response.isLiked = liked;
      } else {
        response.isLiked = false;
      }

      return response;
    } catch (error) {
      console.error("[COMMUNITY] 게시글 상세 조회 실패:", error.message);
      if (error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("게시글 조회에 실패했습니다");
    }
  }

  async getUserLikedTargetIds(type, targetIds, userId) {
    if (!userId || !Array.isArray(targetIds) || targetIds.length === 0) {
      return new Set();
    }

    const uniqueIds = Array.from(new Set(targetIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return new Set();
    }

    try {
      const chunks = [];
      for (let i = 0; i < uniqueIds.length; i += 10) {
        chunks.push(uniqueIds.slice(i, i + 10));
      }

      const snapshots = await Promise.all(chunks.map((chunk) =>
        this.firestoreService.db
          .collection("likes")
          .where("userId", "==", userId)
          .where("type", "==", type)
          .where("targetId", "in", chunk)
          .get()
      ));

      const likedIds = new Set();
      snapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data?.targetId) {
            likedIds.add(data.targetId);
          }
        });
      });

      return likedIds;
    } catch (error) {
      console.warn("[CommunityService] 사용자 좋아요 조회 실패:", error.message);
      return new Set();
    }
  }

  async hasUserLikedTarget(type, targetId, userId) {
    if (!userId || !targetId) {
      return false;
    }

    try {
      const snapshot = await this.firestoreService.db
        .collection("likes")
        .where("userId", "==", userId)
        .where("type", "==", type)
        .where("targetId", "==", targetId)
        .limit(1)
        .get();

      return !snapshot.empty;
    } catch (error) {
      console.warn("[CommunityService] 좋아요 여부 확인 실패:", error.message);
      return false;
    }
  }

  /**
   * 게시글 수정
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} postId - 게시글 ID
   * @param {Object} updateData - 수정할 데이터
   * @param {string} userId - 사용자 ID (소유권 검증용)
   * @return {Promise<Object>} 수정된 게시글
   */
  async updatePost(communityId, postId, updateData, userId) {
    try {
      const postsService = new FirestoreService(`communities/${communityId}/posts`);
      const post = await postsService.getById(postId);

      if (!post) {
        const error = new Error("Post not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      if (post.authorId !== userId) {
        const error = new Error("게시글 수정 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "isPublic")) {
        if (typeof updateData.isPublic !== "boolean") {
          const error = new Error("isPublic 값은 boolean 타입이어야 합니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "content")) {
        if (!updateData.content || typeof updateData.content !== 'string' || updateData.content.trim().length === 0) {
          const error = new Error("게시글 내용은 필수입니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }

        const textWithoutTags = updateData.content.replace(/<[^>]*>/g, '').trim();
        if (textWithoutTags.length === 0) {
          const error = new Error("게시글에 텍스트 내용이 필요합니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }

        const sanitizedContent = sanitizeContent(updateData.content);

        const sanitizedText = sanitizedContent.replace(/<[^>]*>/g, '').trim();
        if (sanitizedText.length === 0) {
          const error = new Error("sanitize 후 유효한 텍스트 내용이 없습니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }

        updateData.content = sanitizedContent;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "media")) {
        const currentMedia = post.media || [];
        const requestedMedia = updateData.media || [];
        
        // 새로 추가된 파일 식별
        const newFiles = requestedMedia.filter(file => !currentMedia.includes(file));
        
        // 새로 추가된 파일 검증 및 연결
        let validatedNewFiles = [];
        if (newFiles.length > 0) {
          try {
            validatedNewFiles = await fileService.validateFilesForPost(newFiles, userId);
          } catch (fileError) {
            console.error("새 파일 검증 실패:", fileError);
            throw fileError;
          }
        }
        
        const existingFiles = requestedMedia.filter(file => currentMedia.includes(file));
        if (existingFiles.length > 0) {
          const check = await fileService.filesExist(existingFiles, userId);
          if (!check.allExist) {
            const missing = Object.entries(check.results)
              .filter(([, exists]) => !exists)
              .map(([filePath]) => filePath);
            const error = new Error(`파일을 찾을 수 없습니다: ${missing.join(", ")}`);
            error.code = "NOT_FOUND";
            throw error;
          }
        }
        
        // 제거된 파일 삭제
        const filesToDelete = currentMedia.filter(file => !requestedMedia.includes(file));
        if (filesToDelete.length > 0) {
          const deletePromises = filesToDelete.map(filePath => 
            fileService.deleteFile(filePath, userId)
          );
          await Promise.all(deletePromises);
        }
        
        updateData._newFilesToAttach = validatedNewFiles;
      }

      const needsPreviewUpdate = 
        Object.prototype.hasOwnProperty.call(updateData, "content") || 
        Object.prototype.hasOwnProperty.call(updateData, "media");
      
      if (needsPreviewUpdate) {
        const finalContent = updateData.content !== undefined ? updateData.content : post.content;
        const finalMedia = updateData.media !== undefined ? updateData.media : post.media;
        updateData.preview = this.createPreview({
          content: finalContent,
          media: finalMedia,
        });
      }

      // 새로 추가된 파일 추출 (트랜잭션에서 사용)
      const newFilesToAttach = updateData._newFilesToAttach || [];
      delete updateData._newFilesToAttach; // Firestore에 저장하지 않도록 제거

      const updatedData = {
        ...updateData,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // 트랜잭션으로 게시글 업데이트 + 새 파일 연결
      await this.firestoreService.runTransaction(async (transaction) => {
        const postRef = this.firestoreService.db
          .collection(`communities/${communityId}/posts`)
          .doc(postId);
        transaction.update(postRef, updatedData);
        
        // 새로 추가된 파일 연결
        if (newFilesToAttach.length > 0) {
          fileService.attachFilesToPostInTransaction(newFilesToAttach, postId, transaction);
        }
      });
      
      const fresh = await postsService.getById(postId);
      const community = await this.firestoreService.getDocument("communities", communityId);

      const {authorId, preview: _preview, ...freshWithoutAuthorId} = fresh;
      
      return {
        id: postId,
        ...freshWithoutAuthorId,
        createdAt: fresh.createdAt?.toDate?.()?.toISOString?.() || fresh.createdAt,
        updatedAt: fresh.updatedAt?.toDate?.()?.toISOString?.() || fresh.updatedAt,
        scheduledDate: fresh.scheduledDate?.toDate?.()?.toISOString?.() || fresh.scheduledDate,
        communityPath: `communities/${communityId}`,
        community: community ? {
          id: communityId,
          name: community.name,
        } : null,
      };
    } catch (error) {
      console.error("[COMMUNITY] 게시글 수정 실패:", error.message);
      if (error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
        throw error;
      }
      throw new Error("게시글 수정에 실패했습니다");
    }
  }

  /**
   * 게시글 삭제
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} postId - 게시글 ID
   * @param {string} userId 
   * @return {Promise<void>}
   */
  async deletePost(communityId, postId, userId) {
    try {
      const postsService = new FirestoreService(`communities/${communityId}/posts`);
      const post = await postsService.getById(postId);

      if (!post) {
        const error = new Error("Post not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      if (post.authorId !== userId) {
        const error = new Error("게시글 삭제 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      // 파일 삭제 (Storage 작업이라 트랜잭션 밖에서 처리)
      if (post.media && post.media.length > 0) {
        const deletePromises = post.media.map(async (filePath) => {
          try {
            await fileService.deleteFile(filePath, userId);
          } catch (error) {
            console.warn(`파일 삭제 실패 (${filePath}):`, error.message);
          }
        });
        await Promise.all(deletePromises);
      }

      await this._deleteCommentsByPost(communityId, postId);

      await this._deleteLikesByPost(postId);

      // 리워드 차감 + 게시글 삭제를 하나의 트랜잭션으로 처리
      await this.firestoreService.runTransaction(async (transaction) => {
        // 리워드 차감 처리
        await this.getRewardService().handleRewardOnPostDeletion(
          userId,
          postId,
          post.type,
          post.media,
          transaction
        );

        // 게시글 삭제
        const postRef = this.firestoreService.db
          .collection(`communities/${communityId}/posts`)
          .doc(postId);
        transaction.delete(postRef);

        // authoredPosts에서 제거
        const authoredPostRef = this.firestoreService.db
          .collection(`users/${userId}/authoredPosts`)
          .doc(postId);
        transaction.delete(authoredPostRef);

        // certificationPosts 카운트 감소
        if (CERTIFICATION_COUNT_TYPES.has(post.type)) {
          const userRef = this.firestoreService.db.collection("users").doc(userId);
          transaction.update(userRef, {
            certificationPosts: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });

          // members 컬렉션의 certificationPostsCount 감소
          const memberRef = this.firestoreService.db
            .collection(`communities/${communityId}/members`)
            .doc(userId);
          transaction.update(memberRef, {
            certificationPostsCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error("[COMMUNITY] 게시글 삭제 실패:", error.message);
      if (error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
        throw error;
      }
      throw new Error("게시글 삭제에 실패했습니다");
    }
  }

  /**
   * 게시글에 속한 댓글/대댓글 모두 하드 삭제
   * @private
   */
  async _deleteCommentsByPost(communityId, postId) {
    const commentsRef = this.firestoreService.db.collection("comments");
    let cursor = null;
    let totalDeleted = 0;

    try {
      while (true) {
        let query = commentsRef
          .where("communityId", "==", communityId)
          .where("postId", "==", postId)
          .orderBy("__name__")
          .limit(300);

        if (cursor) {
          query = query.startAfter(cursor);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = this.firestoreService.db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snapshot.size;
        cursor = snapshot.docs[snapshot.docs.length - 1];
      }

      if (totalDeleted > 0) {
        console.log(`[COMMUNITY] 게시글 댓글 삭제 완료: communityId=${communityId}, postId=${postId}, deleted=${totalDeleted}`);
      }
    } catch (error) {
      console.error("[COMMUNITY] 게시글 댓글 삭제 실패:", error.message);
      // 댓글 삭제 실패는 게시글 삭제를 막지 않음
    }
  }

  /**
   * 게시글 좋아요 및 사용자 likedPosts 집계 삭제
   * @private
   */
  async _deleteLikesByPost(postId) {
    const db = this.firestoreService.db;
    let cursor = null;
    let totalDeleted = 0;

    try {
      // likes 컬렉션에서 POST 타입 삭제
      while (true) {
        let query = db
          .collection("likes")
          .where("type", "==", "POST")
          .where("targetId", "==", postId)
          .orderBy("__name__")
          .limit(300);

        if (cursor) {
          query = query.startAfter(cursor);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snapshot.size;
        cursor = snapshot.docs[snapshot.docs.length - 1];
      }

      // users/{userId}/likedPosts 서브컬렉션에서도 제거
      const likedPostsSnap = await db
        .collectionGroup("likedPosts")
        .where("postId", "==", postId)
        .get();

      if (!likedPostsSnap.empty) {
        const batch = db.batch();
        likedPostsSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += likedPostsSnap.size;
      }

      if (totalDeleted > 0) {
        console.log(`[COMMUNITY] 게시글 좋아요 삭제 완료: postId=${postId}, deleted=${totalDeleted}`);
      }
    } catch (error) {
      console.error("[COMMUNITY] 게시글 좋아요 삭제 실패:", error.message);
      // 좋아요 삭제 실패는 게시글 삭제를 막지 않음
    }
  }

  /**
   * 게시글 좋아요 토글
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} postId - 게시글 ID
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>} 좋아요 결과
   */
  async togglePostLike(communityId, postId, userId) {
    try {
      const result = await this.firestoreService.runTransaction(async (transaction) => {
        const postRef = this.firestoreService.db
          .collection("communities")
          .doc(communityId)
          .collection("posts")
          .doc(postId);
        const postDoc = await transaction.get(postRef);

        if (!postDoc.exists) {
          const error = new Error("Post not found");
          error.code = "NOT_FOUND";
          throw error;
        }

        const likesCollection = this.firestoreService.db.collection("likes");
        const likeQuery = likesCollection
          .where("type", "==", "POST")
          .where("targetId", "==", postId)
          .where("userId", "==", userId)
          .limit(1);
        const likeSnapshot = await transaction.get(likeQuery);
        const existingLikeDoc = likeSnapshot.empty ? null : likeSnapshot.docs[0];
        let isLiked = false;

        if (existingLikeDoc) {
          transaction.delete(existingLikeDoc.ref);
          isLiked = false;

          transaction.update(postRef, {
            likesCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
          
          // 집계 컬렉션에서 제거
          const likedPostRef = this.firestoreService.db
            .collection(`users/${userId}/likedPosts`)
            .doc(postId);
          transaction.delete(likedPostRef);
        } else {
          const newLikeRef = likesCollection.doc();
          transaction.set(newLikeRef, {
            type: "POST",
            targetId: postId,
            userId,
            communityId, // communityId 저장 추가
            createdAt: FieldValue.serverTimestamp(),
          });
          isLiked = true;

          transaction.update(postRef, {
            likesCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
          
          // 집계 컬렉션 추가
          const likedPostRef = this.firestoreService.db
            .collection(`users/${userId}/likedPosts`)
            .doc(postId);
          transaction.set(likedPostRef, {
            postId,
            communityId,
            lastLikedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        const post = postDoc.data();
        const currentLikesCount = post.likesCount || 0;

    
        if (isLiked && post.authorId !== userId) {
          try {
            // 게시글 isPublic에 따라 닉네임 가져오기
            const isPrivatePost = post.isPublic === false;
            let likerName = "사용자";

            if (isPrivatePost) {
              // 비공개 게시글: members 컬렉션에서 가져오기
              const members = await this.firestoreService.getCollectionWhere(
                `communities/${communityId}/members`,
                "userId",
                "==",
                userId
              );
              const memberData = members && members[0];
              if (memberData) {
                likerName = memberData.nickname || "사용자";
              }
            } else {
              // 공개 게시글: nicknames 컬렉션에서 가져오기
              const nicknames = await this.firestoreService.getCollectionWhere(
                "nicknames",
                "uid",
                "==",
                userId
              );
              const nicknameDoc = nicknames && nicknames[0];
              if (nicknameDoc) {
                likerName = nicknameDoc.id || nicknameDoc.nickname || "사용자";
              }
            }

            const link = NOTIFICATION_LINKS.POST(postId, communityId);
            fcmHelper.sendNotification(
              post.authorId,
              "게시글에 좋아요가 달렸습니다",
              `${likerName}님이 "${post.title}"에 좋아요를 눌렀습니다`,
              "POST_LIKE",
              postId,
              communityId,
              link
            ).catch((err) => {
              console.error("게시글 좋아요 알림 전송 실패:", err);
            });
          } catch (error) {
            console.error("게시글 좋아요 알림 처리 실패:", error);
          }
        }

        return {
          postId,
          userId,
          isLiked,
          likesCount: isLiked ? currentLikesCount + 1 : Math.max(0, currentLikesCount - 1),
        };
      });

      return result;
    } catch (error) {
      console.error("[COMMUNITY] 게시글 좋아요 토글 실패:", error.message);
      if (error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("게시글 좋아요 처리에 실패했습니다");
    }
  }

  /**
   * 커뮤니티 멤버 닉네임 중복 체크
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} nickname - 체크할 닉네임
   * @return {Promise<boolean>} 닉네임 사용 가능 여부 (true: 사용 가능, false: 중복)
   */
  async checkNicknameAvailability(communityId, nickname) {
    try {
      if (!communityId) {
        const error = new Error("커뮤니티 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!nickname || nickname.trim().length === 0) {
        const error = new Error("닉네임이 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const membersService = new FirestoreService(`communities/${communityId}/members`);
    
      const members = await membersService.getWhere("nickname", "==", nickname.trim());

      return members.length === 0;
    } catch (error) {
      console.error("닉네임 중복 체크 오류:", error.message);
      if (error.code === "BAD_REQUEST") {
        throw error;
      }
      throw new Error("닉네임 중복 체크에 실패했습니다");
    }
  }

  /**
   * 커뮤니티에 멤버 추가
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} userId - 사용자 ID
   * @param {string} nickname - 닉네임
   * @return {Promise<Object>} 추가된 멤버 정보
   */
  async addMemberToCommunity(communityId, userId, nickname) {
    try {
      if (!communityId) {
        const error = new Error("커뮤니티 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!nickname || nickname.trim().length === 0) {
        const error = new Error("닉네임이 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const community = await this.firestoreService.getDocument("communities", communityId);
      if (!community) {
        const error = new Error("커뮤니티를 찾을 수 없습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      const membersService = new FirestoreService(`communities/${communityId}/members`);
      const existingMember = await membersService.getById(userId);
      if (existingMember) {
        const error = new Error("이미 해당 커뮤니티의 멤버입니다");
        error.code = "CONFLICT";
        throw error;
      }

      const duplicateNickname = await membersService.getWhere("nickname", "==", nickname.trim());
      if (duplicateNickname.length > 0) {
        const error = new Error("이미 사용 중인 닉네임입니다");
        error.code = "NICKNAME_DUPLICATE";
        throw error;
      }
      
      const memberData = {
        userId,
        nickname: nickname.trim(),
        role: "member",
        joinedAt: FieldValue.serverTimestamp(),
      };

      const memberId = userId;
      const result = await membersService.create(memberData, memberId);

      return {
        id: memberId,
        userId,
        nickname: nickname.trim(),
        role: "member",
        joinedAt: memberData.joinedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      };
    } catch (error) {
      console.error("커뮤니티 멤버 추가 오류:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND" || error.code === "CONFLICT") {
        throw error;
      }
      throw new Error("커뮤니티 멤버 추가에 실패했습니다");
    }
  }

  /**
   * 커뮤니티 멤버 닉네임 중복 체크
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} nickname - 체크할 닉네임
   * @return {Promise<boolean>} 닉네임 사용 가능 여부 (true: 사용 가능, false: 중복)
   */
  async checkNicknameAvailability(communityId, nickname) {
    try {
      if (!communityId) {
        const error = new Error("커뮤니티 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!nickname || nickname.trim().length === 0) {
        const error = new Error("닉네임이 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const membersService = new FirestoreService(`communities/${communityId}/members`);

      const members = await membersService.getWhere("nickname", "==", nickname.trim());

      return members.length === 0;
    } catch (error) {
      console.error("닉네임 중복 체크 오류:", error.message);
      if (error.code === "BAD_REQUEST") {
        throw error;
      }
      throw new Error("닉네임 중복 체크에 실패했습니다");
    }
  }

  /**
   * 커뮤니티에 멤버 추가
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} userId - 사용자 ID
   * @param {string} nickname - 닉네임
   * @param {Object} [options] - 추가 옵션
   * @param {string} [options.applicantsPageId] - Notion 프로그램신청자 페이지 ID
   * @return {Promise<Object>} 추가된 멤버 정보
   */
  async addMemberToCommunity(communityId, userId, nickname, options = {}) {
    try {
      if (!communityId) {
        const error = new Error("커뮤니티 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!nickname || nickname.trim().length === 0) {
        const error = new Error("닉네임이 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const community = await this.firestoreService.getDocument("communities", communityId);
      if (!community) {
        const error = new Error("커뮤니티를 찾을 수 없습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      const membersService = new FirestoreService(`communities/${communityId}/members`);
      const existingMember = await membersService.getById(userId);
      if (existingMember) {
        const error = new Error("이미 해당 커뮤니티의 멤버입니다");
        error.code = "CONFLICT";
        throw error;
      }

      const duplicateNickname = await membersService.getWhere("nickname", "==", nickname.trim());
      if (duplicateNickname.length > 0) {
        const error = new Error("이미 사용 중인 닉네임입니다");
        error.code = "NICKNAME_DUPLICATE";
        throw error;
      }

      const memberData = {
        userId,
        nickname: nickname.trim(),
        role: MEMBER_ROLES.MEMBER,
        status: 'pending',
        joinedAt: FieldValue.serverTimestamp(),
      };

      if (options.applicantsPageId) {
        memberData.applicantsPageId = options.applicantsPageId;
      }

      const memberId = userId;
      const result = await membersService.create(memberData, memberId);

      return {
        id: memberId,
        userId,
        nickname: nickname.trim(),
        role: MEMBER_ROLES.MEMBER,
        joinedAt: memberData.joinedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      };
    } catch (error) {
      console.error("커뮤니티 멤버 추가 오류:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND" || error.code === "CONFLICT" || error.code === "NICKNAME_DUPLICATE") {
        throw error;
      }
      throw new Error("커뮤니티 멤버 추가에 실패했습니다");
    }
  }

  /**
   * 커뮤니티 멤버 닉네임 조회
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object|null>} 멤버 정보 (nickname 포함)
   */
  async getMemberNickname(communityId, userId) {
    try {
      if (!communityId) {
        const error = new Error("커뮤니티 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!userId) {
        const error = new Error("사용자 ID가 필요합니다");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const membersService = new FirestoreService(`communities/${communityId}/members`);
      const member = await membersService.getById(userId);

      if (!member) {
        const error = new Error("멤버를 찾을 수 없습니다");
        error.code = "NOT_FOUND";
        throw error;
      }

      return {
        id: member.id || userId,
        userId: member.userId || userId,
        nickname: member.nickname || null,
        role: member.role || "member",
        status: member.status || null,
        joinedAt: member.joinedAt?.toDate?.()?.toISOString?.() || member.joinedAt,
      };
    } catch (error) {
      console.error("[COMMUNITY] 멤버 닉네임 조회 오류:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("멤버 닉네임 조회에 실패했습니다");
    }
  }
}

module.exports = CommunityService;
