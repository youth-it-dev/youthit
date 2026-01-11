const { onSchedule } = require("firebase-functions/v2/scheduler");
const adminLogsService = require("../services/adminLogsService");


// 최대 유지할 레코드 수 (환경변수로 설정 가능, 기본값: 1000)
const MAX_ADMIN_LOGS = 1000;

// 테스트용: 최대 유지할 레코드 수를 5로 설정
//const MAX_ADMIN_LOGS = parseInt(process.env.MAX_ADMIN_LOGS || "5", 10);

/**
 * adminLogs 컬렉션 정리 실행 함수
 * @returns {Promise<Object>} 정리 결과
 */
async function runAdminLogsCleanup() {
  console.log("[adminLogsCleanup] 정리 작업 시작", {
    timestamp: new Date().toISOString(),
    maxRecords: MAX_ADMIN_LOGS,
  });

  try {
    const result = await adminLogsService.cleanupAdminLogs(MAX_ADMIN_LOGS);
    
    console.log("[adminLogsCleanup] 정리 작업 완료", result);
    
    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[adminLogsCleanup] 정리 작업 실패:", error);
    throw error;
  }
}

/**
 * adminLogs 컬렉션 정리 스케줄러
 * 매일 새벽 2시에 실행되어 오래된 관리자 로그를 정리합니다.
 * 
 * Cron 표현식: "0 2 * * *" (매일 02:00)
 * - 한국 시간 기준 새벽 2시
 * - UTC 기준으로는 전날 17:00 (한국 시간 -9시간)
 */
const adminLogsCleanupScheduler = onSchedule(
  {
    schedule: "0 2 * * *", // 매일 새벽 2시 (한국 시간)
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540, // 9분 (정리 작업 완료 대기)
    memory: "512MiB",
  },
  async (event) => {
    const MAX_RETRIES = 3; // 최대 재시도 횟수
    const INITIAL_RETRY_DELAY = 5000; // 초기 재시도 지연 (5초)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log("[adminLogsCleanup] 스케줄러 실행", {
          scheduleTime: event.scheduleTime,
          timestamp: new Date().toISOString(),
          attempt: `${attempt}/${MAX_RETRIES}`,
        });

        const result = await runAdminLogsCleanup();

        // 성공 시 재시도 루프 종료
        if (attempt > 1) {
          console.log(
            `[adminLogsCleanup] 재시도 성공 (시도 ${attempt}회만에 성공)`,
          );
        } else {
          console.log("[adminLogsCleanup] 스케줄러 완료", result);
        }

        return result;
      } catch (error) {
        console.error(
          `[adminLogsCleanup] 스케줄러 실행 실패 (시도 ${attempt}/${MAX_RETRIES}):`,
          error.message,
        );
        console.error("[adminLogsCleanup] 에러 상세:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
          attempt,
        });

        // 마지막 시도에서도 실패하면 에러 throw
        if (attempt === MAX_RETRIES) {
          console.error(
            "[adminLogsCleanup] 최대 재시도 횟수에 도달했습니다. 스케줄러 실패.",
          );
          throw error;
        }

        // 재시도 전 대기 (지수 백오프: 5초, 10초, 20초)
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(
          `[adminLogsCleanup] ${retryDelay / 1000}초 후 재시도합니다...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  },
);

module.exports = {
  adminLogsCleanupScheduler,
  runAdminLogsCleanup,
};