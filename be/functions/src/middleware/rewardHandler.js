const RewardService = require('../services/rewardService');
const PendingRewardService = require('../services/pendingRewardService');

// RewardService 인스턴스 생성
const rewardService = new RewardService();
const pendingRewardService = new PendingRewardService();

// 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3, // 최대 즉시 재시도 횟수
  baseDelayMs: 100, // 기본 지연 시간 (ms)
  retryableErrors: new Set([
    'UNAVAILABLE', // Firestore 일시적 불가
    'RESOURCE_EXHAUSTED', // 쿼터 초과
    'DEADLINE_EXCEEDED', // 타임아웃
    'ABORTED', // 트랜잭션 충돌
    'INTERNAL', // 내부 에러 (일시적일 수 있음)
    'INTERNAL_ERROR',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
  ]),
};

/**
 * 재시도 가능한 에러인지 판별
 * @param {Error} error - 에러 객체
 * @return {boolean}
 */
function isRetryableError(error) {
  // 에러 코드 체크
  if (error.code && RETRY_CONFIG.retryableErrors.has(error.code)) {
    return true;
  }
  
  // 에러 메시지에서 네트워크 관련 키워드 체크
  const message = error.message?.toLowerCase() || '';
  const networkKeywords = ['network', 'timeout', 'connection', 'econnreset', 'etimedout', 'socket'];
  if (networkKeywords.some(keyword => message.includes(keyword))) {
    return true;
  }
  
  return false;
}

/**
 * 지수 백오프 지연
 * @param {number} attempt - 시도 횟수 (0부터 시작)
 * @return {Promise<void>}
 */
function delay(attempt) {
  const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Reward Handler Middleware
 * Express req 객체에 리워드 부여 함수를 추가합니다.
 * 
 * 사용법:
 * await req.grantReward('comment_create', { commentId: 'xxx', postId: 'yyy' });
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 * @return {void}
 */
const rewardHandler = (req, res, next) => {
  /**
   * 사용자에게 리워드 부여 (액션 기반) - 재시도 로직 포함
   * @param {string} actionKey - 액션 키 (예: "comment")
   * @param {Object} metadata - 추가 정보 (commentId, postId 등)
   * @return {Promise<Object>} { success, reason?, amount? }
   */
  req.grantReward = async (actionKey, metadata = {}) => {
    const userId = req.user?.uid;

    if (!userId) {
      console.warn('[REWARD] 인증 정보 없음', { actionKey, metadata });
      return { success: false, reason: 'NO_AUTH' };
    }

    let lastError = null;

    // 즉시 재시도 로직 (최대 3회)
    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const result = await rewardService.grantActionReward(userId, actionKey, metadata);
        
        // 결과 로깅
        if (result.success && result.amount > 0) {
          console.log('[REWARD SUCCESS]', { userId, actionKey, amount: result.amount, attempt: attempt + 1 });
        } else if (result.message === 'Reward already granted') {
          console.log('[REWARD DUPLICATE]', { userId, actionKey });
        } else if (result.message === 'No reward for this action') {
          console.log('[REWARD] 리워드 정책 없음:', { actionKey });
        }
        
        return result;
      } catch (error) {
        lastError = error;

        // DAILY_LIMIT_EXCEEDED는 정상 흐름 (재시도 불필요)
        if (error.code === 'DAILY_LIMIT_EXCEEDED') {
          console.log('[REWARD LIMIT] 일일 제한 도달:', { userId, actionKey });
          return { success: false, reason: 'DAILY_LIMIT' };
        }

        // BAD_REQUEST, NOT_FOUND 등은 재시도해도 의미 없음
        if (error.code === 'BAD_REQUEST' || error.code === 'NOT_FOUND') {
          console.error('[REWARD ERROR] 재시도 불가 에러:', error.message, { userId, actionKey, metadata });
          return { success: false, reason: 'ERROR', error: error.message };
        }

        // 재시도 가능한 에러인지 확인
        if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries - 1) {
          console.warn(`[REWARD RETRY] 재시도 ${attempt + 1}/${RETRY_CONFIG.maxRetries}:`, error.message, { userId, actionKey });
          await delay(attempt);
          continue;
        }

        // 마지막 시도이거나 재시도 불가능한 에러
        break;
      }
    }

    // 모든 재시도 실패 → pendingRewards에 저장
    console.error('[REWARD ERROR] 모든 재시도 실패, pendingRewards에 저장:', lastError?.message, { userId, actionKey, metadata });
    
    try {
      await pendingRewardService.savePendingReward({
        userId,
        actionKey,
        metadata,
        error: lastError?.message || 'Unknown error',
        errorCode: lastError?.code || 'UNKNOWN',
      });
      console.log('[REWARD PENDING] pendingRewards에 저장 완료:', { userId, actionKey });
    } catch (saveError) {
      // pendingRewards 저장 실패는 로깅만 (메인 로직에 영향 X)
      console.error('[REWARD PENDING ERROR] pendingRewards 저장 실패:', saveError.message, { userId, actionKey });
    }

    return { success: false, reason: 'PENDING', error: lastError?.message };
  };

  /**
   * 게시글 타입에 따른 리워드 부여 (게시글 전용) - 재시도 로직 포함
   * @param {Object} post - 게시글 객체 ({ id, type, media, content, communityId })
   * @return {Promise<Object>} { success, reason?, amount? }
   */
  req.grantPostReward = async (post) => {
    const userId = req.user?.uid;

    if (!userId) {
      console.warn('[REWARD] 인증 정보 없음', { postId: post.id });
      return { success: false, reason: 'NO_AUTH' };
    }

    let lastError = null;

    // 즉시 재시도 로직 (최대 3회)
    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const result = await rewardService.grantPostReward(userId, post);
        
        // 결과 로깅
        if (result.success && result.amount > 0) {
          console.log('[REWARD SUCCESS]', { userId, postType: post.type, amount: result.amount, attempt: attempt + 1 });
        } else if (result.message === 'Reward already granted') {
          console.log('[REWARD DUPLICATE]', { userId, postType: post.type });
        } else if (result.message === 'No reward for this post type') {
          console.log('[REWARD] 리워드 대상 아님:', { postType: post.type });
        }
        
        return result;
      } catch (error) {
        lastError = error;

        // DAILY_LIMIT_EXCEEDED는 정상 흐름 (재시도 불필요)
        if (error.code === 'DAILY_LIMIT_EXCEEDED') {
          console.log('[REWARD LIMIT] 일일 제한 도달:', { userId, postType: post.type });
          return { success: false, reason: 'DAILY_LIMIT' };
        }

        // BAD_REQUEST, NOT_FOUND 등은 재시도해도 의미 없음
        if (error.code === 'BAD_REQUEST' || error.code === 'NOT_FOUND') {
          console.error('[REWARD ERROR] 재시도 불가 에러:', error.message, { userId, postType: post.type });
          return { success: false, reason: 'ERROR', error: error.message };
        }

        // 재시도 가능한 에러인지 확인
        if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries - 1) {
          console.warn(`[REWARD RETRY] 재시도 ${attempt + 1}/${RETRY_CONFIG.maxRetries}:`, error.message, { userId, postType: post.type });
          await delay(attempt);
          continue;
        }

        // 마지막 시도이거나 재시도 불가능한 에러
        break;
      }
    }

    // 모든 재시도 실패 → pendingRewards에 저장
    const metadata = { postId: post.id, postType: post.type, communityId: post.communityId };
    console.error('[REWARD ERROR] 모든 재시도 실패, pendingRewards에 저장:', lastError?.message, { userId, ...metadata });
    
    try {
      await pendingRewardService.savePendingReward({
        userId,
        actionKey: `post_reward_${post.type}`,
        metadata,
        error: lastError?.message || 'Unknown error',
        errorCode: lastError?.code || 'UNKNOWN',
      });
      console.log('[REWARD PENDING] pendingRewards에 저장 완료:', { userId, postType: post.type });
    } catch (saveError) {
      // pendingRewards 저장 실패는 로깅만 (메인 로직에 영향 X)
      console.error('[REWARD PENDING ERROR] pendingRewards 저장 실패:', saveError.message, { userId, postType: post.type });
    }

    return { success: false, reason: 'PENDING', error: lastError?.message };
  };

  next();
};

module.exports = rewardHandler;

