const { db, Timestamp } = require("../config/database");
const notionMissionService = require("./notionMissionService");
const { getDateKeyByUTC, getTodayByUTC } = require("../utils/helpers");
const {
  USER_MISSIONS_COLLECTION,
  USER_MISSION_STATS_COLLECTION,
  MISSION_POSTS_COLLECTION,
  MISSION_STATUS,
  BLOCKED_STATUSES,
  MAX_ACTIVE_MISSIONS,
  FIRST_MISSION_REWARD_LIMIT,
} = require("../constants/missionConstants");

function buildError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

class MissionService {
  /**
   * 미션 신청
   * @param {Object} params
   * @param {string} params.userId - 신청자 UID
   * @param {string} params.missionId - 노션 미션 페이지 ID
   * @returns {Promise<Object>} 신청 결과
   */
  async applyMission({ userId, missionId }) {
    if (!userId) {
      throw buildError("사용자 정보가 필요합니다.", "UNAUTHORIZED", 401);
    }

    if (!missionId) {
      throw buildError("미션 ID가 필요합니다.", "BAD_REQUEST", 400);
    }

    const mission = await notionMissionService.getMissionById(missionId);
    if (!mission) {
      throw buildError("존재하지 않는 미션입니다.", "MISSION_NOT_FOUND", 404);
    }

    const missionDocId = `${userId}_${missionId}`;
    const missionDocRef = db.collection(USER_MISSIONS_COLLECTION).doc(missionDocId);
    const userMissionsRef = db.collection(USER_MISSIONS_COLLECTION);
    const userMissionStatsRef = db.collection(USER_MISSION_STATS_COLLECTION).doc(userId);
    const now = Timestamp.now();

    await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(userMissionStatsRef);
      const statsData = statsDoc.exists
        ? statsDoc.data()
        : {
            userId,
            activeCount: 0,
            dailyAppliedCount: 0,
            dailyCompletedCount: 0,
            lastAppliedAt: null,
            consecutiveDays: 0, // 연속일자 초기값 (인증글 작성 시 업데이트됨)
            updatedAt: now,
          };

      const dailyAppliedCount = statsData.dailyAppliedCount || 0;

      const activeQuery = userMissionsRef
        .where("userId", "==", userId)
        .where("status", "==", MISSION_STATUS.IN_PROGRESS);
      const activeSnapshot = await transaction.get(activeQuery);
      const existingDoc = await transaction.get(missionDocRef);

      if (statsData.activeCount >= MAX_ACTIVE_MISSIONS || activeSnapshot.size >= MAX_ACTIVE_MISSIONS) {
        throw buildError(
          "동시에 진행할 수 있는 미션은 최대 3개입니다.",
          "MAX_ACTIVE_MISSIONS_EXCEEDED",
          409,
        );
      }
      const existingData = existingDoc.exists ? existingDoc.data() : null;
      if (existingDoc.exists) {
        const currentStatus = existingData?.status;
        if (BLOCKED_STATUSES.includes(currentStatus)) {
          throw buildError(
            "이미 참여한 미션입니다. 다음 리셋 이후에 다시 신청해주세요.",
            "MISSION_ALREADY_APPLIED",
            409,
          );
        }
      }

      const missionPayload = {
        userId,
        missionNotionPageId: missionId,
        missionTitle: mission.title || null,
        detailTags: mission.detailTags || null, // 미션 태그 저장
        categories: Array.isArray(mission.categories) ? mission.categories : [],
        status: MISSION_STATUS.IN_PROGRESS,
        startedAt: now,
        lastActivityAt: now,
        createdAt: existingData?.createdAt || now,
        updatedAt: now,
      };

      transaction.set(missionDocRef, missionPayload);
      transaction.set(
        userMissionStatsRef,
        {
          userId,
          activeCount: (statsData.activeCount || 0) + 1,
          dailyAppliedCount: dailyAppliedCount + 1,
          updatedAt: now,
          lastAppliedAt: now,
        },
        { merge: true },
      );
    });

    return {
      missionId,
      status: MISSION_STATUS.IN_PROGRESS,
    };
  }

  /**
   * 미션 그만두기
   * @param {Object} params
   * @param {string} params.userId - 사용자 UID
   * @param {string} params.missionId - 노션 미션 페이지 ID
   * @returns {Promise<Object>} 그만두기 결과
   */
  async quitMission({ userId, missionId }) {
    if (!userId) {
      throw buildError("사용자 정보가 필요합니다.", "UNAUTHORIZED", 401);
    }

    if (!missionId) {
      throw buildError("미션 ID가 필요합니다.", "BAD_REQUEST", 400);
    }

    const missionDocId = `${userId}_${missionId}`;
    const missionDocRef = db.collection(USER_MISSIONS_COLLECTION).doc(missionDocId);
    const userMissionStatsRef = db.collection(USER_MISSION_STATS_COLLECTION).doc(userId);
    const now = Timestamp.now();

    await db.runTransaction(async (transaction) => {
      const missionDoc = await transaction.get(missionDocRef);

      if (!missionDoc.exists) {
        throw buildError("신청한 미션이 없습니다.", "MISSION_NOT_FOUND", 404);
      }

      const missionData = missionDoc.data();

      // 본인의 미션인지 확인
      if (missionData.userId !== userId) {
        throw buildError("본인의 미션만 그만둘 수 있습니다.", "FORBIDDEN", 403);
      }

      // 진행 중인 미션인지 확인
      if (missionData.status !== MISSION_STATUS.IN_PROGRESS) {
        throw buildError(
          "진행 중인 미션만 그만둘 수 있습니다.",
          "MISSION_NOT_IN_PROGRESS",
          409,
        );
      }

      // 통계 업데이트
      const statsDoc = await transaction.get(userMissionStatsRef);
      const statsData = statsDoc.exists ? statsDoc.data() : { activeCount: 0 };

      const currentActiveCount = statsData.activeCount || 0;
      const newActiveCount = Math.max(0, currentActiveCount - 1);

      // 미션 상태를 QUIT로 변경
      transaction.update(missionDocRef, {
        status: MISSION_STATUS.QUIT,
        quitAt: now,
        lastActivityAt: now,
        updatedAt: now,
      });

      // 통계 업데이트 (activeCount, dailyAppliedCount 감소)
      // 오늘 신청한 미션을 그만두면 dailyAppliedCount도 감소
      // 어제 이전에 신청한 미션은 dailyAppliedCount에 영향을 주지 않음
      const currentDailyAppliedCount = statsData.dailyAppliedCount || 0;
      let newDailyAppliedCount = currentDailyAppliedCount;

      // 미션 신청일이 오늘인지 확인 (AM 05:00 KST 기준)
      const missionStartedAt = missionData.startedAt;
      if (missionStartedAt) {
        const missionStartedDateKey = getDateKeyByUTC(missionStartedAt);
        const todayKey = getDateKeyByUTC(getTodayByUTC());

        // 오늘 신청한 미션이면 dailyAppliedCount 감소
        if (missionStartedDateKey === todayKey) {
          newDailyAppliedCount = Math.max(0, currentDailyAppliedCount - 1);
        }
      }

      transaction.set(
        userMissionStatsRef,
        {
          userId,
          activeCount: newActiveCount,
          dailyAppliedCount: newDailyAppliedCount,
          updatedAt: now,
        },
        { merge: true },
      );
    });

    return {
      missionId,
      status: MISSION_STATUS.QUIT,
    };
  }

  /**
   * 사용자 미션 목록 조회
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.status=MISSION_STATUS.IN_PROGRESS]
   * @param {number} [params.limit=20]
   * @returns {Promise<Array>}
   */
  async getUserMissions({ userId, status = MISSION_STATUS.IN_PROGRESS, limit = 20 }) {
    if (!userId) {
      throw buildError("사용자 정보가 필요합니다.", "UNAUTHORIZED", 401);
    }

    const normalizedStatus = status && status !== "ALL" ? status : null;

    let query = db.collection(USER_MISSIONS_COLLECTION).where("userId", "==", userId);

    if (normalizedStatus) {
      query = query.where("status", "==", normalizedStatus);
    }

    const snapshot = await query
      .orderBy("lastActivityAt", "desc")
      .limit(limit)
      .get();

    const missions = [];
    for (const doc of snapshot.docs) {
      if (missions.length >= limit) {
        break;
      }

      const data = doc.data();
      missions.push({
        id: doc.id,
        missionNotionPageId: data.missionNotionPageId,
        missionTitle: data.missionTitle,
        detailTags: data.detailTags || null, // 저장된 태그 사용
        startedAt: data.startedAt?.toDate?.()?.toISOString?.() || data.startedAt,
      });
    }

    return missions;
  }

  /**
   * 미션 통계 조회
   * @param {Object} params
   * @param {string} params.userId - 사용자 UID
   * @returns {Promise<Object>} 통계 데이터
   */
  async getMissionStats({ userId }) {
    if (!userId) {
      throw buildError("사용자 정보가 필요합니다.", "UNAUTHORIZED", 401);
    }

    // 1. 오늘의 미션 인증 현황 (userMissionStats에서 가져오기)
    const statsDoc = await db
      .collection(USER_MISSION_STATS_COLLECTION)
      .doc(userId)
      .get();

    const statsData = statsDoc.exists ? statsDoc.data() : {};

    // 오늘 신청한 미션 수 (QUIT 제외) - dailyAppliedCount는 QUIT 시 감소되므로 이미 QUIT 제외됨
    const todayTotalCount = statsData.dailyAppliedCount || 0;

    // 오늘 완료한 미션 수
    const todayCompletedCount = statsData.dailyCompletedCount || 0;

    // 진행 중인 미션 수 (오늘 신청한 미션 중 IN_PROGRESS만)
    // 오늘 신청한 미션 중 완료하지 않은 것 = total - completed
    const todayActiveCount = Math.max(0, todayTotalCount - todayCompletedCount);

    // 3. 연속 미션일 (userMissionStats에서 가져오기)
    // 3회 이하는 튜토리얼 단계로 연속일자는 0
    const totalPostsCount = statsData.totalPostsCount || 0;
    let consecutiveDays = 0;

    if (totalPostsCount > FIRST_MISSION_REWARD_LIMIT) {
      // 3회 이후부터만 연속일자 집계
      consecutiveDays = statsData.consecutiveDays || 0;
      
      // 마지막 인증일을 날짜 키로 변환 (UTC 20:00 기준)
      const lastPostDateKey = getDateKeyByUTC(statsData.lastCompletedAt);
      const todayKey = getDateKeyByUTC(getTodayByUTC());

      // 어제 날짜 계산: UTC 기반 오늘에서 하루를 뺀 후 날짜 키로 변환
      const todayDate = getTodayByUTC();
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterdayKey = getDateKeyByUTC(yesterdayDate);

      // 어제 또는 오늘 인증하지 않았으면 연속일자 0으로 처리
      if (lastPostDateKey !== yesterdayKey && lastPostDateKey !== todayKey) {
        consecutiveDays = 0;
      }
    }

    // 4. 누적 게시글 수 (userMissionStats의 totalPostsCount 사용)
    // totalPostsCount는 위에서 이미 계산됨

    return {
      todayTotalCount, // 오늘 신청한 미션 수 (QUIT 제외, IN_PROGRESS + COMPLETED)
      todayCompletedCount, // 오늘 완료한 미션 수 (COMPLETED만)
      todayActiveCount, // 진행 중인 미션 수 (오늘 신청한 미션 중 IN_PROGRESS만)
      consecutiveDays, // 연속 미션일
      totalPostsCount, // 누적 게시글 수 (totalMissionCount 또는 쿼리 결과)
    };
  }
}

module.exports = new MissionService();

