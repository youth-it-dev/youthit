const { onSchedule } = require("firebase-functions/v2/scheduler");
const PendingRewardService = require("../services/pendingRewardService");
const RewardService = require("../services/rewardService");
const { ADMIN_LOG_ACTIONS } = require("../constants/adminLogActions");
const adminLogsService = require("../services/adminLogsService");

// 설정
const BATCH_SIZE = 50; // 한 번에 처리할 최대 개수
const BATCH_DELAY_MS = 100; // 배치 간 지연 시간 (ms)

/**
 * 리워드 재시도 실행 함수
 * @returns {Promise<Object>} 처리 결과
 */
async function runRewardRetry() {
  console.log("[rewardRetryScheduler] 재시도 작업 시작", {
    timestamp: new Date().toISOString(),
    batchSize: BATCH_SIZE,
  });

  const pendingRewardService = new PendingRewardService();
  const rewardService = new RewardService();
  
  let totalProcessed = 0;
  let successCount = 0;
  let failCount = 0;
  const failedIds = [];

  try {
    // 재시도 대기 중인 리워드 조회
    const pendingRewards = await pendingRewardService.getPendingRewards(BATCH_SIZE);

    if (pendingRewards.length === 0) {
      console.log("[rewardRetryScheduler] 재시도 대기 중인 리워드 없음");
      return {
        success: true,
        totalProcessed: 0,
        successCount: 0,
        failCount: 0,
        message: "No pending rewards to retry",
      };
    }

    console.log(`[rewardRetryScheduler] ${pendingRewards.length}개 리워드 재시도 시작`);

    // 각 리워드 처리
    for (const pending of pendingRewards) {
      try {
        // 처리 중 상태로 변경 (동시 처리 방지)
        const locked = await pendingRewardService.markAsProcessing(pending.id);
        
        if (!locked) {
          console.log(`[rewardRetryScheduler] 이미 처리 중: ${pending.id}`);
          continue;
        }

        totalProcessed++;

        // 리워드 부여 재시도
        const result = await retryReward(rewardService, pending);

        if (result.success) {
          // 성공
          await pendingRewardService.markAsCompleted(pending.id, result.amount, pending);
          successCount++;
          console.log(`[rewardRetryScheduler] 재시도 성공: ${pending.id}`, {
            userId: pending.userId,
            actionKey: pending.actionKey,
            amount: result.amount,
          });
        } else {
          // 실패
          await pendingRewardService.markAsFailed(pending.id, result.error, result.errorCode, pending);
          failCount++;
          failedIds.push(pending.id);
          console.warn(`[rewardRetryScheduler] 재시도 실패: ${pending.id}`, {
            userId: pending.userId,
            actionKey: pending.actionKey,
            error: result.error,
          });
        }

        // 배치 간 지연 (Rate limit 방지)
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

      } catch (itemError) {
        // 개별 항목 처리 에러
        console.error(`[rewardRetryScheduler] 항목 처리 에러: ${pending.id}`, itemError.message);
        await pendingRewardService.markAsFailed(pending.id, itemError.message, itemError.code || 'UNKNOWN', pending);
        failCount++;
        failedIds.push(pending.id);
      }
    }

    // 통계 조회
    const stats = await pendingRewardService.getStats();

    const result = {
      success: true,
      totalProcessed,
      successCount,
      failCount,
      failedIds: failedIds.length > 0 ? failedIds : undefined,
      stats,
      timestamp: new Date().toISOString(),
    };

    console.log("[rewardRetryScheduler] 재시도 작업 완료", result);

    // 관리자 로그 기록
    await adminLogsService.saveAdminLog({
      adminId: 'system',
      action: ADMIN_LOG_ACTIONS.NADAUM_RETRY_SCHEDULER_COMPLETED,
      targetId: null,
      metadata: {
        successCount,
        failedCount: failCount,
        totalProcessed,
        stats,
      },
    });

    return result;

  } catch (error) {
    // 에러 코드가 없으면 기본값 설정
    if (!error.code) {
      error.code = 'NADAUM_RETRY_SCHEDULER_ERROR';
    }

    console.error("[rewardRetryScheduler] 재시도 작업 실패:", error);

    // 관리자 로그 기록
    await adminLogsService.saveAdminLog({
      adminId: 'system',
      action: ADMIN_LOG_ACTIONS.NADAUM_RETRY_SCHEDULER_FAILED,
      targetId: null,
      metadata: {
        successCount,
        failedCount: failCount + 1,
        totalProcessed,
        error: error.message,
        errorCode: error.code,
      },
    });

    throw error;
  }
}

/**
 * 개별 리워드 재시도 로직
 * @param {RewardService} rewardService - 리워드 서비스 인스턴스
 * @param {Object} pending - 대기 중인 리워드 정보
 * @returns {Promise<Object>} 처리 결과 { success, amount?, error?, errorCode? }
 */
async function retryReward(rewardService, pending) {
  const { userId, actionKey, metadata } = pending;

  try {
    // post_reward_XXX 형태의 actionKey는 grantPostReward로 처리
    if (actionKey.startsWith('post_reward_')) {
      const postType = actionKey.replace('post_reward_', '');
      const post = {
        id: metadata.postId,
        type: postType,
        communityId: metadata.communityId,
      };
      
      const result = await rewardService.grantPostReward(userId, post);
      
      if (result.success) {
        return { success: true, amount: result.amount };
      } else if (result.message === 'Reward already granted') {
        // 이미 지급된 경우도 성공으로 처리
        return { success: true, amount: 0, message: 'Already granted' };
      } else if (result.message === 'No reward for this post type') {
        // 정책 없음은 성공으로 처리 (재시도 불필요)
        return { success: true, amount: 0, message: 'No policy' };
      }
      
      return { success: false, error: result.message || 'Unknown error', errorCode: 'UNKNOWN' };
    }

    // 일반 액션 리워드
    const result = await rewardService.grantActionReward(userId, actionKey, metadata);

    if (result.success) {
      return { success: true, amount: result.amount };
    } else if (result.message === 'Reward already granted') {
      // 이미 지급된 경우도 성공으로 처리
      return { success: true, amount: 0, message: 'Already granted' };
    } else if (result.message === 'No reward for this action') {
      // 정책 없음은 성공으로 처리 (재시도 불필요)
      return { success: true, amount: 0, message: 'No policy' };
    }

    return { success: false, error: result.message || 'Unknown error', errorCode: 'UNKNOWN' };

  } catch (error) {
    // DAILY_LIMIT_EXCEEDED는 정상 흐름 (성공으로 처리)
    if (error.code === 'DAILY_LIMIT_EXCEEDED') {
      return { success: true, amount: 0, message: 'Daily limit exceeded' };
    }

    return {
      success: false,
      error: error.message,
      errorCode: error.code || 'UNKNOWN',
    };
  }
}

/**
 * 나다움 재시도 스케줄러
 * 매일 새벽 2시에 실행되어 실패한 나다움 부여를 재시도합니다.
 * 
 * Cron 표현식: "0 2 * * *" (매일 02:00)
 */
const rewardRetryScheduler = onSchedule(
  {
    schedule: "0 2 * * *", // 매일 새벽 2시 (한국 시간)
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 300, // 5분
    memory: "512MiB",
  },
  async (event) => {
    const MAX_RETRIES = 2; // 스케줄러 자체의 재시도 횟수
    const INITIAL_RETRY_DELAY = 3000; // 3초

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log("[rewardRetryScheduler] 스케줄러 실행", {
          scheduleTime: event.scheduleTime,
          timestamp: new Date().toISOString(),
          attempt: `${attempt}/${MAX_RETRIES}`,
        });

        const result = await runRewardRetry();

        if (attempt > 1) {
          console.log(`[rewardRetryScheduler] 재시도 성공 (시도 ${attempt}회만에 성공)`);
        }

        return result;

      } catch (error) {
        console.error(
          `[rewardRetryScheduler] 스케줄러 실행 실패 (시도 ${attempt}/${MAX_RETRIES}):`,
          error.message
        );

        if (attempt === MAX_RETRIES) {
          console.error("[rewardRetryScheduler] 최대 재시도 횟수 도달. 스케줄러 실패.");
          throw error;
        }

        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`[rewardRetryScheduler] ${retryDelay / 1000}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
);

module.exports = {
  rewardRetryScheduler,
  runRewardRetry,
};
