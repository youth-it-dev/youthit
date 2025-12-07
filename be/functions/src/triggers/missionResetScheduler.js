const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db, Timestamp } = require("../config/database");
const {
  USER_MISSIONS_COLLECTION,
  USER_MISSION_STATS_COLLECTION,
  MISSION_LAST_RESET_COLLECTION,
  MISSION_STATUS,
} = require("../constants/missionConstants");
const { getDateKeyByUTC, getTodayByUTC } = require("../utils/helpers");

const DAILY_RESET_DOCUMENT = "daily";

async function shouldRunReset(now) {
  try {
    const resetDocRef = db
      .collection(MISSION_LAST_RESET_COLLECTION)
      .doc(DAILY_RESET_DOCUMENT);
    const resetDoc = await resetDocRef.get();

    // UTC 20:00 기준으로 오늘 날짜 키 계산
    const todayKey = getDateKeyByUTC(now);

    // 문서가 없으면 리셋 실행 (문서는 리셋 성공 후 생성)
    if (!resetDoc.exists) {
      return { shouldRun: true, resetDocRef, todayKey };
    }

    // 문서가 있으면 마지막 리셋 날짜 확인
    const data = resetDoc.data();
    if (data.lastResetDate === todayKey) {
      return { shouldRun: false };
    }

    // 마지막 리셋 날짜가 오늘과 다르면 리셋 실행 필요
    return { shouldRun: true, resetDocRef, todayKey };
  } catch (error) {
    console.error("[missionReset] shouldRunReset 에러:", error);
    throw error;
  }
}

async function runMissionDailyReset() {
  const now = new Date();
  let resetDocRef = null;
  let todayKey = null;

  try {
    const shouldRunResult = await shouldRunReset(now);
    const { shouldRun } = shouldRunResult;

    if (!shouldRun) {
      console.log("[missionReset] 이미 오늘 리셋이 실행되었습니다.");
      return { skipped: true };
    }

    resetDocRef = shouldRunResult.resetDocRef;
    todayKey = shouldRunResult.todayKey;

    console.log("[missionReset] 리셋 시작", {
      timestamp: now.toISOString(),
      todayKey,
    });

    // 1. 사용자 미션 통계 리셋
    let statsUpdated = 0;
    let statsErrors = [];
    try {
      const userMissionStatsSnapshot = await db
        .collection(USER_MISSION_STATS_COLLECTION)
        .get();

      const statsUpdates = userMissionStatsSnapshot.docs.map(async (doc) => {
        try {
          await doc.ref.update({
            activeCount: 0,
            dailyAppliedCount: 0,
            dailyCompletedCount: 0,
            lastAppliedAt: null,
            lastCompletedAt: null,
            updatedAt: Timestamp.now(),
          });
          statsUpdated++;
        } catch (error) {
          console.error(
            `[missionReset] 통계 업데이트 실패 (userId: ${doc.id}):`,
            error,
          );
          statsErrors.push({ userId: doc.id, error: error.message });
        }
      });

      await Promise.all(statsUpdates);
      console.log(
        `[missionReset] 통계 리셋 완료: ${statsUpdated}개 성공, ${statsErrors.length}개 실패`,
      );
    } catch (error) {
      console.error("[missionReset] 통계 리셋 중 에러:", error);
      statsErrors.push({ error: error.message });
    }

    // 2. 진행 중인 미션 및 완료된 미션 QUIT로 변경
    let missionsUpdated = 0;
    let missionsErrors = [];
    try {
      const missionSnapshots = await db
        .collection(USER_MISSIONS_COLLECTION)
        .where("status", "in", [MISSION_STATUS.IN_PROGRESS, MISSION_STATUS.COMPLETED])
        .get();

      const missionUpdates = missionSnapshots.docs.map(async (doc) => {
        try {
          await doc.ref.update({
            status: MISSION_STATUS.QUIT,
            quitAt: Timestamp.now(),
            lastActivityAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          missionsUpdated++;
        } catch (error) {
          console.error(
            `[missionReset] 미션 업데이트 실패 (missionId: ${doc.id}):`,
            error,
          );
          missionsErrors.push({ missionId: doc.id, error: error.message });
        }
      });

      await Promise.all(missionUpdates);
      console.log(
        `[missionReset] 미션 리셋 완료: ${missionsUpdated}개 성공, ${missionsErrors.length}개 실패`,
      );
    } catch (error) {
      console.error("[missionReset] 미션 리셋 중 에러:", error);
      missionsErrors.push({ error: error.message });
    }

    // 3. 전체 성공 여부 확인
    const hasErrors =
      statsErrors.length > 0 || missionsErrors.length > 0;

    if (hasErrors) {
      console.warn("[missionReset] 리셋 중 일부 에러 발생, 리셋을 실패로 처리합니다.", {
        statsUpdated,
        statsErrors: statsErrors.length,
        missionsUpdated,
        missionsErrors: missionsErrors.length,
      });
      // 부분 실패도 전체적으로는 실패로 보고 재시도 대상이 되도록 함
      // 리셋 문서를 업데이트하지 않아서 같은 날 재시도 가능
      throw new Error(
        `리셋 중 일부 문서 처리 실패 (statsErrors=${statsErrors.length}, missionsErrors=${missionsErrors.length})`,
      );
    }

    console.log("[missionReset] 리셋 완료", {
      statsUpdated,
      missionsUpdated,
    });

    // 4. 리셋 문서 생성/업데이트 (리셋이 성공적으로 완료된 후에만 기록)
    // 모든 통계와 미션이 성공적으로 리셋된 경우에만 문서 생성/업데이트
    // 문서가 없으면 생성, 있으면 업데이트
    // 에러가 발생하면 문서를 생성/업데이트하지 않아서 다음 스케줄에서 재시도 가능
    try {
      if (resetDocRef && todayKey) {
        await resetDocRef.set(
          {
            lastResetDate: todayKey,
            lastResetAt: Timestamp.fromDate(now),
            statsUpdated,
            missionsUpdated,
            statsErrors: 0,
            missionsErrors: 0,
            hasErrors: false,
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
        console.log("[missionReset] 리셋 문서 생성/업데이트 완료", { todayKey });
      }
    } catch (error) {
      console.error("[missionReset] 리셋 문서 생성/업데이트 실패:", error);
      // 문서 생성/업데이트 실패 시 에러를 throw하여 재시도 가능하도록 함
      throw new Error(
        `리셋 완료 후 문서 생성/업데이트 실패: ${error.message}`,
      );
    }

    return {
      skipped: false,
      statsUpdated,
      missionsUpdated,
      statsErrors: statsErrors.length,
      missionsErrors: missionsErrors.length,
      hasErrors,
    };
  } catch (error) {
    console.error("[missionReset] 리셋 실행 중 치명적 에러:", error);
    console.error("[missionReset] 에러 스택:", error.stack);

    // 에러 발생 시 리셋 문서는 업데이트하지 않음 (다음 스케줄에 재시도 가능)
    throw error;
  }
}

const missionDailyResetScheduler = onSchedule(
  {
    schedule: "0 20 * * *", // 매일 UTC 20:00 (한국 시간 새벽 5시)
    timeZone: "UTC",
    region: "asia-northeast3",
    timeoutSeconds: 540, // 9분 (리셋 작업 완료 대기)
    memory: "512MiB",
  },
  async (event) => {
    const MAX_RETRIES = 3; // 최대 재시도 횟수
    const INITIAL_RETRY_DELAY = 5000; // 초기 재시도 지연 (5초)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log("[missionReset] 스케줄러 실행", {
          scheduleTime: event.scheduleTime,
          timestamp: new Date().toISOString(),
          attempt: `${attempt}/${MAX_RETRIES}`,
        });

        const result = await runMissionDailyReset();

        // 성공 시 재시도 루프 종료
        if (attempt > 1) {
          console.log(
            `[missionReset] 재시도 성공 (시도 ${attempt}회만에 성공)`,
          );
        } else {
          console.log("[missionReset] 스케줄러 완료", result);
        }

        return result;
      } catch (error) {
        console.error(
          `[missionReset] 스케줄러 실행 실패 (시도 ${attempt}/${MAX_RETRIES}):`,
          error.message,
        );
        console.error("[missionReset] 에러 상세:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
          attempt,
        });

        // 마지막 시도에서도 실패하면 에러 throw
        if (attempt === MAX_RETRIES) {
          console.error(
            "[missionReset] 최대 재시도 횟수에 도달했습니다. 스케줄러 실패.",
          );
          throw error;
        }

        // 재시도 전 대기 (지수 백오프: 5초, 10초, 20초)
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(
          `[missionReset] ${retryDelay / 1000}초 후 재시도합니다...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  },
);

module.exports = {
  missionDailyResetScheduler,
};

