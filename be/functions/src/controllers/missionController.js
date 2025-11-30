const notionMissionService = require("../services/notionMissionService");
const missionService = require("../services/missionService");
const missionPostService = require("../services/missionPostService");
const missionLikeService = require("../services/missionLikeService");
const { MISSION_STATUS } = require("../constants/missionConstants");
const {
  parsePageSize,
  sanitizeCursor,
} = require("../utils/paginationHelper");
const paginationConstants = require("../constants/paginationConstants");
const {
  DEFAULT_MISSION_PAGE_SIZE,
  MAX_MISSION_PAGE_SIZE,
  NOTION_MAX_PAGE_SIZE,
  DEFAULT_POST_PAGE_SIZE,
  MAX_POST_PAGE_SIZE,
  DEFAULT_COMMENT_PAGE_SIZE,
  MAX_COMMENT_PAGE_SIZE,
} = paginationConstants;

const encodePaginationCursor = (payload = {}) => {
  try {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  } catch (error) {
    console.warn("[MissionController] Failed to encode pagination cursor:", error.message);
    return null;
  }
};

const decodePaginationCursor = (cursor) => {
  if (!cursor || typeof cursor !== "string") {
    return {
      bufferedMissions: [],
      notionCursor: null,
      likedCursor: null,
    };
  }

  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return {
      bufferedMissions: Array.isArray(parsed.bufferedMissions) ? parsed.bufferedMissions : [],
      notionCursor: typeof parsed.notionCursor === "string" ? parsed.notionCursor : null,
      likedCursor:
        parsed.likedCursor && parsed.likedCursor.docId && parsed.likedCursor.createdAtMillis
          ? parsed.likedCursor
          : null,
    };
  } catch (error) {
    console.warn("[MissionController] Failed to decode pagination cursor:", error.message);
    return {
      bufferedMissions: [],
      notionCursor: null,
      likedCursor: null,
    };
  }
};

class MissionController {
  constructor() {
    // 메서드 바인딩
    this.getCategories = this.getCategories.bind(this);
    this.applyMission = this.applyMission.bind(this);
    this.getMissions = this.getMissions.bind(this);
    this.getMissionById = this.getMissionById.bind(this);
    this.getParticipatedMissionIds = this.getParticipatedMissionIds.bind(this);
    this.createMissionPost = this.createMissionPost.bind(this);
    this.getMyMissions = this.getMyMissions.bind(this);
    this.quitMission = this.quitMission.bind(this);
    this.getMissionStats = this.getMissionStats.bind(this);
    this.getAllMissionPosts = this.getAllMissionPosts.bind(this);
    this.getMissionPostById = this.getMissionPostById.bind(this);
    this.createMissionPostComment = this.createMissionPostComment.bind(this);
    this.getMissionPostComments = this.getMissionPostComments.bind(this);
    this.updateMissionPostComment = this.updateMissionPostComment.bind(this);
    this.deleteMissionPostComment = this.deleteMissionPostComment.bind(this);
    this.toggleMissionLike = this.toggleMissionLike.bind(this);
    this.toggleMissionPostLike = this.toggleMissionPostLike.bind(this);
    this.toggleMissionPostCommentLike = this.toggleMissionPostCommentLike.bind(this);
  }

  /**
   * 미션 신청
   */
  async applyMission(req, res, next) {
    try {
      const { missionId } = req.params;
      const userId = req.user?.uid;

      if (!missionId) {
        const error = new Error("미션 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const result = await missionService.applyMission({
        userId,
        missionId,
      });

      return res.created({
        missionId: result.missionId,
        status: result.status,
      });

    } catch (error) {
      console.error("[MissionController] 미션 신청 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 내 미션 목록 조회
   */
  async getMyMissions(req, res, next) {
    try {
      const userId = req.user?.uid;
      const { status = MISSION_STATUS.IN_PROGRESS, limit } = req.query;

      const missions = await missionService.getUserMissions({
        userId,
        status,
        limit: limit ? Number(limit) : 20,
      });

      return res.success({ missions });
    } catch (error) {
      console.error("[MissionController] 내 미션 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 그만두기
   */
  async quitMission(req, res, next) {
    try {
      const { missionId } = req.params;
      const userId = req.user?.uid;

      if (!missionId) {
        const error = new Error("미션 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const result = await missionService.quitMission({
        userId,
        missionId,
      });

      return res.success({
        missionId: result.missionId,
        status: result.status,
      });
    } catch (error) {
      console.error("[MissionController] 미션 그만두기 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 통계 조회
   */
  async getMissionStats(req, res, next) {
    try {
      const userId = req.user?.uid;

      const stats = await missionService.getMissionStats({ userId });

      return res.success(stats);
    } catch (error) {
      console.error("[MissionController] 미션 통계 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증 글 작성 (완료 처리)
   */
  async createMissionPost(req, res, next) {
    try {
      const { missionId } = req.params;
      const userId = req.user?.uid;
      const postData = req.body || {};

      const result = await missionPostService.createPost({
        userId,
        missionId,
        postData,
      });

      return res.created({
        missionId: result.missionId,
        postId: result.postId,
        status: result.status,
      });
    } catch (error) {
      console.error("[MissionController] 미션 인증 작성 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 카테고리 목록 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async getCategories(req, res, next) {
    try {
      const result = await notionMissionService.getCategories();

      res.success({
        categories: result.categories
      });

    } catch (error) {
      console.error("[MissionController] 카테고리 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 목록 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   * 
   * @note Notion cursor 기반 페이지네이션 지원
   * @note 정렬: latest(최신순), popular(인기순)
   * @note 필터: category(카테고리), excludeParticipated(참여 미션 제외)
   */
  async getMissions(req, res, next) {
    try {
      const {
        category,
        sortBy = "latest",
        excludeParticipated,
        pageSize: pageSizeParam,
        startCursor: startCursorParam,
        likedOnly,
      } = req.query;

      const pageSize = parsePageSize(
        pageSizeParam,
        DEFAULT_MISSION_PAGE_SIZE,
        MAX_MISSION_PAGE_SIZE,
      );
      const sanitizedCursor = sanitizeCursor(startCursorParam);
      const decodedCursor = decodePaginationCursor(sanitizedCursor);
      const {
        bufferedMissions: initialBufferedMissions,
        notionCursor: initialNotionCursor,
      } = decodedCursor;

      const userId = req.user?.uid || null; // optionalAuth에서 가져옴

      if (likedOnly === "true") {
        if (!userId) {
          const error = new Error("찜한 미션을 보려면 로그인이 필요합니다.");
          error.statusCode = 401;
          return next(error);
        }

        // 찜 목록에서도 "참여한 미션 제외" 옵션을 지원
        let participatedIds = [];
        if (excludeParticipated === "true") {
          participatedIds = await this.getParticipatedMissionIds(userId);
        }

        return this.respondWithLikedMissions({
          res,
          next,
          userId,
          pageSize,
          category,
          decodedCursor,
          participatedIds,
        });
      }

      const needsExclude = Boolean(userId && excludeParticipated === "true");
      const responseMissions = [];
      const bufferQueue = Array.isArray(initialBufferedMissions) ? [...initialBufferedMissions] : [];

      while (responseMissions.length < pageSize && bufferQueue.length > 0) {
        responseMissions.push(bufferQueue.shift());
      }

      let participatedIds = [];
      if (needsExclude) {
        participatedIds = await this.getParticipatedMissionIds(userId);
      }

      const shouldIncludeMission = (mission) =>
        !needsExclude || !participatedIds.includes(mission.id);

      let notionCursor = initialNotionCursor || null;
      let notionHasMore = Boolean(notionCursor);
      const bufferedOverflow = [];
      const fetchSize = needsExclude
        ? Math.min(pageSize * 3, NOTION_MAX_PAGE_SIZE)
        : pageSize;

      while (responseMissions.length < pageSize) {
        const notionRequest = {
          sortBy,
          pageSize: fetchSize,
        };

        if (category) {
          notionRequest.category = category;
        }
        if (notionCursor) {
          notionRequest.startCursor = notionCursor;
        }

        const result = await notionMissionService.getMissions(notionRequest);
        notionCursor = result.nextCursor || null;
        notionHasMore = Boolean(result.hasMore && notionCursor);

        let fetchedMissions = Array.isArray(result.missions) ? result.missions : [];
        fetchedMissions = fetchedMissions.filter(shouldIncludeMission);

        if (fetchedMissions.length === 0) {
          if (!notionHasMore) {
            break;
          }
          continue;
        }

        fetchedMissions.forEach((mission) => {
          if (responseMissions.length < pageSize) {
            responseMissions.push(mission);
          } else {
            bufferedOverflow.push(mission);
          }
        });

        if (!notionHasMore) {
          break;
        }
      }

      const finalBuffer = bufferQueue.concat(bufferedOverflow);
      const totalMissionsForLikes = responseMissions.concat(finalBuffer);
      const enrichedMissions = await this.enrichMissionsWithLikes(totalMissionsForLikes, userId);
      const enrichedResponses = enrichedMissions.slice(0, responseMissions.length);
      const enrichedBuffer = enrichedMissions.slice(responseMissions.length);

      const hasBufferedItems = enrichedBuffer.length > 0;
      const hasNext = hasBufferedItems || notionHasMore;
      const nextCursorPayload = hasNext
        ? encodePaginationCursor({
            bufferedMissions: enrichedBuffer,
            notionCursor: notionHasMore ? notionCursor : null,
            likedCursor: null,
          })
        : null;

      const pageInfo = {
        pageSize,
        nextCursor: nextCursorPayload,
        hasNext,
      };

      res.success({
        missions: enrichedResponses,
        pageInfo,
      });
    } catch (error) {
      console.error("[MissionController] 미션 목록 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 참여한 미션 ID 조회 (헬퍼 함수)
   * @private
   */
  async getParticipatedMissionIds(userId) {
    const { db } = require('../config/database');
    
    try {
      const snapshot = await db.collection('userMissions')
        .where('userId', '==', userId)
        .where('status', 'in', ['IN_PROGRESS', 'COMPLETED'])
        .select('missionNotionPageId')
        .get();
      
      return snapshot.docs.map(doc => doc.data().missionNotionPageId);
    } catch (error) {
      console.warn('[MissionController] 참여 미션 조회 오류:', error.message);
      return []; // 오류 시 빈 배열 (필터링 안 함)
    }
  }

  /**
   * 미션 상세 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async getMissionById(req, res, next) {
    try {
      const { missionId } = req.params;

      if (!missionId) {
        const error = new Error("미션 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const mission = await notionMissionService.getMissionById(missionId);
      const [missionWithLikes] = await this.enrichMissionsWithLikes(
        [mission],
        req.user?.uid || null,
      );

      res.success({
        mission: missionWithLikes,
      });

    } catch (error) {
      console.error("[MissionController] 미션 상세 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 목록 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async getAllMissionPosts(req, res, next) {
    try {
      const {
        sort = "latest",
        userId,
        missionId,
        pageSize: pageSizeParam,
        startCursor: startCursorParam,
      } = req.query;
      const rawCategories = req.query.categories;

      let categories = [];
      if (typeof rawCategories === "string" && rawCategories.trim().length > 0) {
        categories = rawCategories
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      } else if (Array.isArray(rawCategories)) {
        categories = rawCategories
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
      }

      const viewerId = req.user?.uid || null;

      const pageSize = parsePageSize(
        pageSizeParam,
        DEFAULT_POST_PAGE_SIZE,
        MAX_POST_PAGE_SIZE,
      );
      const startCursor = sanitizeCursor(startCursorParam);

      const result = await missionPostService.getAllMissionPosts(
        {
          sort,
          categories,
          userId,
          missionId,
          pageSize,
          startCursor,
        },
        viewerId,
      );

      return res.success(result);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 목록 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 상세 조회
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async getMissionPostById(req, res, next) {
    try {
      const { postId } = req.params;
      const viewerId = req.user?.uid || null;

      if (!postId) {
        const error = new Error("인증글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const post = await missionPostService.getMissionPostById(postId, viewerId);

      return res.success(post);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 상세 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 댓글 목록 조회
   */
  async getMissionPostComments(req, res, next) {
    try {
      const { postId } = req.params;
      const viewerId = req.user?.uid || null;
      const { pageSize: pageSizeParam, startCursor: startCursorParam } = req.query;

      console.info("[MissionController] getMissionPostComments 요청", {
        method: req.method,
        originalUrl: req.originalUrl,
        postId,
        hasViewer: Boolean(viewerId),
        pageSizeParam,
        startCursorParam,
      });

      if (!postId) {
        const error = new Error("인증글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const pageSize = parsePageSize(
        pageSizeParam,
        DEFAULT_COMMENT_PAGE_SIZE,
        MAX_COMMENT_PAGE_SIZE,
      );
      const startCursor = sanitizeCursor(startCursorParam);

      const result = await missionPostService.getComments(postId, viewerId, {
        pageSize,
        startCursor,
      });

      return res.success(result);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 댓글 목록 조회 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 댓글 생성
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async createMissionPostComment(req, res, next) {
    try {
      const { postId } = req.params;
      const userId = req.user?.uid;
      const commentData = req.body;

      if (!postId) {
        const error = new Error("인증글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const result = await missionPostService.createComment(postId, userId, commentData);

      return res.created(result);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 댓글 생성 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 댓글 수정
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async updateMissionPostComment(req, res, next) {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user?.uid;
      const updateData = req.body;

      if (!postId) {
        const error = new Error("인증글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      if (!commentId) {
        const error = new Error("댓글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const result = await missionPostService.updateComment(postId, commentId, userId, updateData);

      return res.success(result);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 댓글 수정 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 댓글 삭제
   * @param {Object} req - Express 요청 객체
   * @param {Object} res - Express 응답 객체
   * @param {Function} next - Express next 함수
   */
  async deleteMissionPostComment(req, res, next) {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user?.uid;

      if (!postId) {
        const error = new Error("인증글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      if (!commentId) {
        const error = new Error("댓글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      await missionPostService.deleteComment(postId, commentId, userId);

      return res.noContent();
    } catch (error) {
      console.error("[MissionController] 미션 인증글 댓글 삭제 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 좋아요 토글
   */
  async toggleMissionPostLike(req, res, next) {
    try {
      const { postId } = req.params;
      const userId = req.user?.uid;

      if (!postId) {
        const error = new Error("인증글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const result = await missionPostService.togglePostLike(postId, userId);
      return res.success(result);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 좋아요 토글 오류:", error.message);
      return next(error);
    }
  }

  /**
   * 미션 인증글 댓글 좋아요 토글
   */
  async toggleMissionPostCommentLike(req, res, next) {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user?.uid;

      if (!postId || !commentId) {
        const error = new Error("인증글 ID와 댓글 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      const result = await missionPostService.toggleCommentLike(postId, commentId, userId);
      return res.success(result);
    } catch (error) {
      console.error("[MissionController] 미션 인증글 댓글 좋아요 토글 오류:", error.message);
      return next(error);
    }
  }

  async toggleMissionLike(req, res, next) {
    try {
      const { missionId } = req.params;
      const userId = req.user?.uid;

      if (!missionId) {
        const error = new Error("미션 ID가 필요합니다.");
        error.statusCode = 400;
        return next(error);
      }

      if (!userId) {
        const error = new Error("찜 기능을 사용하려면 로그인이 필요합니다.");
        error.statusCode = 401;
        return next(error);
      }

      const result = await missionLikeService.toggleLike(userId, missionId);
      return res.success(result);
    } catch (error) {
      console.error("[MissionController] 미션 찜 토글 오류:", error.message);
      return next(error);
    }
  }

  async respondWithLikedMissions({
    res,
    next,
    userId,
    pageSize,
    category,
    decodedCursor,
    participatedIds = [],
  }) {
    try {
      const responseMissions = [];
      const bufferQueue = Array.isArray(decodedCursor.bufferedMissions)
        ? [...decodedCursor.bufferedMissions]
        : [];

      while (responseMissions.length < pageSize && bufferQueue.length > 0) {
        responseMissions.push(bufferQueue.shift());
      }

      let likedCursor = decodedCursor.likedCursor || null;
      let hasMoreLikes = true;
      const bufferedOverflow = [];

      while (responseMissions.length < pageSize && hasMoreLikes) {
        const { entries, nextCursor, hasNext } = await missionLikeService.getUserLikedEntries(
          userId,
          pageSize,
          likedCursor,
        );

        if (entries.length === 0) {
          hasMoreLikes = false;
          likedCursor = null;
          break;
        }

        const missionIds = entries.map((entry) => entry.missionId);
        const missionDetails = await this.fetchMissionSummaries(missionIds);

        entries.forEach((entry, index) => {
          const mission = missionDetails[index];
          if (!mission) {
            return;
          }

          // 참여한 미션 제외 옵션 적용
          if (Array.isArray(participatedIds) && participatedIds.includes(mission.id)) {
            return;
          }

          if (category && (!Array.isArray(mission.categories) || !mission.categories.includes(category))) {
            return;
          }

          if (responseMissions.length < pageSize) {
            responseMissions.push(mission);
          } else {
            bufferedOverflow.push(mission);
          }
        });

        if (hasNext) {
          likedCursor = nextCursor;
        } else {
          likedCursor = null;
          hasMoreLikes = false;
        }
      }

      const finalBuffer = bufferQueue.concat(bufferedOverflow);
      const totalMissionsForLikes = responseMissions.concat(finalBuffer);
      const enriched = await this.enrichMissionsWithLikes(totalMissionsForLikes, userId, {
        forceLiked: true,
      });
      const enrichedResponses = enriched.slice(0, responseMissions.length);
      const enrichedBuffer = enriched.slice(responseMissions.length);

      const hasBufferedItems = enrichedBuffer.length > 0;
      const hasNext = hasBufferedItems || Boolean(likedCursor);
      const nextCursorPayload = hasNext
        ? encodePaginationCursor({
            bufferedMissions: enrichedBuffer,
            notionCursor: null,
            likedCursor,
          })
        : null;

      return res.success({
        missions: enrichedResponses,
        pageInfo: {
          pageSize,
          nextCursor: nextCursorPayload,
          hasNext,
        },
      });
    } catch (error) {
      console.error("[MissionController] 찜한 미션 목록 조회 오류:", error.message);
      return next(error);
    }
  }

  async fetchMissionSummaries(missionIds = []) {
    if (!Array.isArray(missionIds) || missionIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(missionIds)];
    const missionsMap = new Map();

    const results = await Promise.all(
      uniqueIds.map(async (missionId) => {
        try {
          const mission = await notionMissionService.getMissionById(missionId, {
            includePageContent: false,
          });
          return { missionId, mission };
        } catch (error) {
          console.warn("[MissionController] 미션 정보 조회 실패", {
            missionId,
            message: error.message,
          });
          return { missionId, mission: null };
        }
      }),
    );

    results.forEach(({ missionId, mission }) => {
      missionsMap.set(missionId, mission);
    });

    return missionIds.map((missionId) => missionsMap.get(missionId) || null);
  }

  async enrichMissionsWithLikes(missions = [], userId = null, options = {}) {
    if (!Array.isArray(missions) || missions.length === 0) {
      return [];
    }

    const missionIds = missions.map((mission) => mission?.id).filter(Boolean);
    if (missionIds.length === 0) {
      return missions;
    }

    const { forceLiked = false } = options;
    const metadata = await missionLikeService.getLikesMetadata(missionIds, forceLiked ? null : userId);
    const likesCountMap = metadata.likesCountMap || {};
    const likedSet = forceLiked ? new Set(missionIds) : metadata.likedSet || new Set();

    return missions.map((mission) => {
      if (!mission || !mission.id) {
        return mission;
      }

      return {
        ...mission,
        likesCount: likesCountMap[mission.id] || 0,
        isLiked: likedSet.has(mission.id),
      };
    });
  }
}

module.exports = new MissionController();
