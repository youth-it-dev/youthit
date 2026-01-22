const { db, FieldValue } = require('../config/database');
const { ADMIN_LOG_ACTIONS } = require('../constants/adminLogActions');
const adminLogsService = require('./adminLogsService');
const notionPendingRewardService = require('./notionPendingRewardService');

// 컬렉션명
const PENDING_REWARDS_COLLECTION = 'pendingRewards';

// 상태 상수
const PENDING_STATUS = {
  PENDING: 'pending', // 재시도 대기
  PROCESSING: 'processing', // 처리 중
  COMPLETED: 'completed', // 성공
  FAILED: 'failed', // 최종 실패
};

// 재시도 설정
const RETRY_LIMITS = {
  maxRetries: 1, // 스케줄러에서의 최대 재시도 횟수 (즉시 재시도 3회 후이므로 1회면 충분)
};

/**
 * Pending Reward Service
 * 리워드 부여 실패 시 재시도 큐 관리
 */
class PendingRewardService {
  constructor() {
    this.collectionRef = db.collection(PENDING_REWARDS_COLLECTION);
  }

  /**
   * 실패한 리워드를 pendingRewards 컬렉션에 저장
   * @param {Object} options - 저장 옵션
   * @param {string} options.userId - 사용자 ID
   * @param {string} options.actionKey - 액션 키
   * @param {Object} options.metadata - 메타데이터 (postId, commentId 등)
   * @param {string} options.error - 에러 메시지
   * @param {string} options.errorCode - 에러 코드
   * @return {Promise<string>} 생성된 문서 ID
   */
  async savePendingReward({ userId, actionKey, metadata = {}, error, errorCode }) {
    try {
      // 중복 체크: 동일한 userId + actionKey + targetId 조합이 이미 pending 상태로 있는지 확인
      const targetId = metadata.commentId || metadata.postId || metadata.targetId;
      
      if (targetId) {
        const existingQuery = await this.collectionRef
          .where('userId', '==', userId)
          .where('actionKey', '==', actionKey)
          .where('targetId', '==', targetId)
          .where('status', 'in', [PENDING_STATUS.PENDING, PENDING_STATUS.PROCESSING])
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          console.log('[PENDING REWARD] 이미 대기 중인 리워드가 있음:', { userId, actionKey, targetId });
          return existingQuery.docs[0].id;
        }
      }

      const docRef = this.collectionRef.doc();
      const pendingReward = {
        userId,
        actionKey,
        metadata,
        targetId: targetId || null,
        status: PENDING_STATUS.PENDING,
        retryCount: 0,
        maxRetries: RETRY_LIMITS.maxRetries,
        lastError: error,
        lastErrorCode: errorCode,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        nextRetryAt: FieldValue.serverTimestamp(), // 즉시 재시도 가능
      };

      await docRef.set(pendingReward);

      console.log('[PENDING REWARD] 저장 완료:', { docId: docRef.id, userId, actionKey });

      // Notion에 페이지 생성 (실시간 연동)
      try {
        const notionPageId = await notionPendingRewardService.createPendingRewardPage({
          docId: docRef.id,
          userId,
          actionKey,
          targetId: targetId || null,
          lastError: error,
          lastErrorCode: errorCode,
          retryCount: 0,
        });

        // Notion 페이지 ID를 Firestore에 저장
        if (notionPageId) {
          await docRef.update({ notionPageId });
          console.log('[PENDING REWARD] Notion 페이지 ID 저장 완료:', { docId: docRef.id, notionPageId });
        }
      } catch (notionError) {
        console.warn('[PENDING REWARD] Notion 연동 실패 (무시):', notionError.message);
        // Notion 실패해도 메인 로직에 영향 없음
      }

      // 관리자 로그 기록
      await adminLogsService.saveAdminLog({
        adminId: 'system',
        action: ADMIN_LOG_ACTIONS.NADAUM_GRANT_FAILED,
        targetId: userId,
        metadata: {
          successCount: 0,
          failedCount: 1,
          pendingRewardId: docRef.id,
          actionKey,
          error,
          errorCode,
          ...metadata,
        },
      });

      return docRef.id;
    } catch (saveError) {
      console.error('[PENDING REWARD] 저장 실패:', saveError.message);
      throw saveError;
    }
  }

  /**
   * 재시도 대기 중인 리워드 목록 조회
   * @param {number} limit - 조회 개수 제한
   * @return {Promise<Array>} 대기 중인 리워드 목록
   */
  async getPendingRewards(limit = 100) {
    try {
      const now = new Date();
      
      const snapshot = await this.collectionRef
        .where('status', '==', PENDING_STATUS.PENDING)
        .where('nextRetryAt', '<=', now)
        .orderBy('nextRetryAt', 'asc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('[PENDING REWARD] 조회 실패:', error.message);
      throw error;
    }
  }

  /**
   * 리워드 상태를 processing으로 업데이트 (동시 처리 방지)
   * @param {string} docId - 문서 ID
   * @return {Promise<boolean>} 성공 여부
   */
  async markAsProcessing(docId) {
    try {
      const docRef = this.collectionRef.doc(docId);
      
      // 트랜잭션으로 상태 확인 후 업데이트 (동시성 제어)
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        if (!doc.exists) {
          return false;
        }

        const data = doc.data();
        if (data.status !== PENDING_STATUS.PENDING) {
          return false; // 이미 처리 중이거나 완료됨
        }

        transaction.update(docRef, {
          status: PENDING_STATUS.PROCESSING,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return true;
      });

      return result;
    } catch (error) {
      console.error('[PENDING REWARD] 상태 업데이트 실패:', error.message);
      return false;
    }
  }

  /**
   * 리워드 부여 성공 시 처리
   * @param {string} docId - 문서 ID
   * @param {number} amount - 부여된 리워드 금액
   * @param {Object} existingData - 이미 조회한 문서 데이터 (선택, 불필요한 읽기 방지)
   * @return {Promise<void>}
   */
  async markAsCompleted(docId, amount = 0, existingData = null) {
    try {
      const docRef = this.collectionRef.doc(docId);

      const data = await db.runTransaction(async (transaction) => {
        let docData;
        
        if (existingData) {
          // 이미 데이터가 있으면 재사용 (불필요한 읽기 방지)
          docData = existingData;
        } else {
          const doc = await transaction.get(docRef);
          if (!doc.exists) {
            return null;
          }
          docData = doc.data();
        }

        transaction.update(docRef, {
          status: PENDING_STATUS.COMPLETED,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          grantedAmount: amount,
        });

        return docData;
      });

      if (!data) {
        return;
      }

      console.log('[PENDING REWARD] 재시도 성공:', { docId, userId: data.userId, actionKey: data.actionKey });

      // Notion 상태 업데이트 (성공)
      if (data.notionPageId) {
        try {
          await notionPendingRewardService.markAsCompleted(data.notionPageId, amount);
        } catch (notionError) {
          console.warn('[PENDING REWARD] Notion 상태 업데이트 실패 (무시):', notionError.message);
        }
      }

      // 관리자 로그 기록
      await adminLogsService.saveAdminLog({
        adminId: 'system',
        action: ADMIN_LOG_ACTIONS.NADAUM_GRANT_RETRY_SUCCESS,
        targetId: data.userId,
        metadata: {
          successCount: 1,
          failedCount: 0,
          pendingRewardId: docId,
          actionKey: data.actionKey,
          retryCount: (data.retryCount || 0) + 1,
          grantedAmount: amount,
        },
      });
    } catch (error) {
      console.error('[PENDING REWARD] 완료 처리 실패:', error.message);
      throw error;
    }
  }

  /**
   * 리워드 부여 실패 시 처리 (재시도 횟수 증가 또는 최종 실패)
   * @param {string} docId - 문서 ID
   * @param {string} error - 에러 메시지
   * @param {string} errorCode - 에러 코드
   * @param {Object} existingData - 이미 조회한 문서 데이터 (선택, 불필요한 읽기 방지)
   * @return {Promise<void>}
   */
  async markAsFailed(docId, error, errorCode, existingData = null) {
    try {
      const docRef = this.collectionRef.doc(docId);

      const result = await db.runTransaction(async (transaction) => {
        let docData;
        
        if (existingData) {
          // 이미 데이터가 있으면 재사용 (불필요한 읽기 방지)
          docData = existingData;
        } else {
          const doc = await transaction.get(docRef);
          if (!doc.exists) {
            return null;
          }
          docData = doc.data();
        }

        const newRetryCount = (docData.retryCount || 0) + 1;
        const isFinalFailure = newRetryCount >= RETRY_LIMITS.maxRetries;

        if (isFinalFailure) {
          // 최종 실패
          transaction.update(docRef, {
            status: PENDING_STATUS.FAILED,
            retryCount: newRetryCount,
            lastError: error,
            lastErrorCode: errorCode,
            failedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          // 다음 재시도를 위해 대기 상태로 복귀 (지수 백오프: 1분, 2분, 4분, 8분, 16분)
          const nextRetryDelay = Math.pow(2, newRetryCount) * 60 * 1000; // 밀리초
          const nextRetryAt = new Date(Date.now() + nextRetryDelay);

          transaction.update(docRef, {
            status: PENDING_STATUS.PENDING,
            retryCount: newRetryCount,
            lastError: error,
            lastErrorCode: errorCode,
            nextRetryAt,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        return { data: docData, newRetryCount, isFinalFailure };
      });

      if (!result) {
        return;
      }

      const { data, newRetryCount, isFinalFailure } = result;

      if (isFinalFailure) {
        console.error('[PENDING REWARD] 최종 실패:', { docId, userId: data.userId, actionKey: data.actionKey, retryCount: newRetryCount });

        // Notion 상태 업데이트 (최종 실패)
        if (data.notionPageId) {
          try {
            await notionPendingRewardService.markAsFailed(data.notionPageId, error, errorCode, newRetryCount);
          } catch (notionError) {
            console.warn('[PENDING REWARD] Notion 상태 업데이트 실패 (무시):', notionError.message);
          }
        }

        // 관리자 로그 기록
        await adminLogsService.saveAdminLog({
          adminId: 'system',
          action: ADMIN_LOG_ACTIONS.NADAUM_GRANT_RETRY_FAILED,
          targetId: data.userId,
          metadata: {
            successCount: 0,
            failedCount: 1,
            pendingRewardId: docId,
            actionKey: data.actionKey,
            retryCount: newRetryCount,
            lastError: error,
            lastErrorCode: errorCode,
          },
        });
      } else {
        const nextRetryDelay = Math.pow(2, newRetryCount) * 60 * 1000;
        const nextRetryAt = new Date(Date.now() + nextRetryDelay);

        console.warn('[PENDING REWARD] 재시도 예정:', { 
          docId, 
          userId: data.userId, 
          actionKey: data.actionKey, 
          retryCount: newRetryCount,
          nextRetryAt: nextRetryAt.toISOString(),
        });

        // Notion 상태 업데이트 (재시도 대기)
        if (data.notionPageId) {
          try {
            await notionPendingRewardService.markAsPending(data.notionPageId, error, errorCode, newRetryCount);
          } catch (notionError) {
            console.warn('[PENDING REWARD] Notion 상태 업데이트 실패 (무시):', notionError.message);
          }
        }
      }
    } catch (updateError) {
      console.error('[PENDING REWARD] 실패 처리 오류:', updateError.message);
      throw updateError;
    }
  }

  /**
   * 통계 조회 (모니터링용)
   * @return {Promise<Object>} 상태별 개수
   */
  async getStats() {
    try {
      const statuses = Object.values(PENDING_STATUS);
      const stats = {};

      for (const status of statuses) {
        const snapshot = await this.collectionRef
          .where('status', '==', status)
          .count()
          .get();
        
        stats[status] = snapshot.data().count;
      }

      return stats;
    } catch (error) {
      console.error('[PENDING REWARD] 통계 조회 실패:', error.message);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * 실패한 리워드 목록 조회 (관리자용)
   * @param {number} limit - 조회 개수 제한
   * @return {Promise<Array>} 실패한 리워드 목록
   */
  async getFailedRewards(limit = 100) {
    try {
      const snapshot = await this.collectionRef
        .where('status', '==', PENDING_STATUS.FAILED)
        .orderBy('failedAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('[PENDING REWARD] 실패 목록 조회 실패:', error.message);
      throw error;
    }
  }

  /**
   * 수동 재시도 설정 (관리자용) - 스케줄러가 다음에 처리하도록 대기열에 넣기
   * @param {string} docId - 문서 ID
   * @return {Promise<boolean>} 성공 여부
   */
  async manualRetry(docId) {
    try {
      const docRef = this.collectionRef.doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return false;
      }

      const data = doc.data();
      
      // pending, failed 상태만 수동 재시도 가능 (processing, completed는 불가)
      if (data.status !== PENDING_STATUS.FAILED && data.status !== PENDING_STATUS.PENDING) {
        return false;
      }

      // 상태를 pending으로 변경하고 재시도 카운트 리셋
      await docRef.update({
        status: PENDING_STATUS.PENDING,
        retryCount: 0,
        nextRetryAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log('[PENDING REWARD] 수동 재시도 설정:', { docId, userId: data.userId, actionKey: data.actionKey });
      return true;
    } catch (error) {
      console.error('[PENDING REWARD] 수동 재시도 설정 실패:', error.message);
      return false;
    }
  }

  /**
   * 즉시 수동 재시도 실행 (관리자용) - 스케줄러 기다리지 않고 바로 처리
   * @param {string} docId - 문서 ID
   * @return {Promise<Object>} 처리 결과 { success, amount?, error? }
   */
  async executeManualRetry(docId) {
    const RewardService = require('./rewardService');
    const rewardService = new RewardService();

    try {
      const docRef = this.collectionRef.doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return { success: false, error: '문서를 찾을 수 없습니다' };
      }

      const data = doc.data();

      // pending, failed 상태만 수동 재시도 가능
      if (data.status !== PENDING_STATUS.FAILED && data.status !== PENDING_STATUS.PENDING) {
        return { success: false, error: `현재 상태(${data.status})에서는 수동 재시도할 수 없습니다` };
      }

      // processing 상태로 변경
      const locked = await this.markAsProcessing(docId);
      if (!locked) {
        return { success: false, error: '이미 처리 중입니다' };
      }

      const { userId, actionKey, metadata } = data;

      // 리워드 부여 재시도
      let result;
      if (actionKey.startsWith('post_reward_')) {
        const postType = actionKey.replace('post_reward_', '');
        const post = {
          id: metadata.postId,
          type: postType,
          communityId: metadata.communityId,
        };
        result = await rewardService.grantPostReward(userId, post);
      } else {
        result = await rewardService.grantActionReward(userId, actionKey, metadata);
      }

      if (result.success || result.message === 'Reward already granted' || result.message === 'No reward for this action') {
        await this.markAsCompleted(docId, result.amount || 0);
        console.log('[PENDING REWARD] 수동 재시도 성공:', { docId, userId, actionKey, amount: result.amount });
        return { success: true, amount: result.amount || 0 };
      } else {
        await this.markAsFailed(docId, result.message || 'Unknown error', 'MANUAL_RETRY_FAILED');
        return { success: false, error: result.message };
      }

    } catch (error) {
      console.error('[PENDING REWARD] 수동 재시도 실행 실패:', error.message);
      await this.markAsFailed(docId, error.message, error.code || 'UNKNOWN');
      return { success: false, error: error.message };
    }
  }
}

module.exports = PendingRewardService;
