const { db, FieldValue, Timestamp } = require('../config/database');
const FirestoreService = require('./firestoreService');
const { getStatusValue, getNumberValue } = require('../utils/notionHelper');
const { toDate, formatDate } = require('../utils/helpers');

const DEFAULT_EXPIRY_DAYS = 120;

// 액션 키 → 타입 코드 매핑 (historyId 생성용)
const ACTION_TYPE_MAP = {
  'comment': 'COMMENT',
  'routine_post': 'ROUTINE-POST',
  'routine_review': 'ROUTINE-REVIEW',
  'gathering_review_text': 'GATHERING-TEXT',
  'gathering_review_media': 'GATHERING-MEDIA',
  'tmi_review': 'TMI',
  'mission_cert': 'MISSION-CERT',
  'consecutive_days_5': 'CONSECUTIVE-DAYS-5',
};

// 액션 키 → 리워드 사유 매핑 (rewardsHistory의 reason 필드용)
const ACTION_REASON_MAP = {
  'comment': '댓글 작성',
  'routine_post': '한끗루틴 인증',
  'routine_review': '한끗루틴 후기',
  'gathering_review_text': '소모임 후기',
  'gathering_review_media': '소모임 포토 후기',
  'tmi_review': 'TMI 후기',
  'mission_cert': '미션 인증',
  'consecutive_days_5': '연속 미션 5일 달성',
  'additional_point': '나다움 추가 지급/차감',
};

/**
 * Reward Service
 * Notion 리워드 정책 조회 및 사용자 리워드 부여
 */
class RewardService {
  constructor() {
    if (!process.env.NOTION_REWARD_POLICY_DB_ID) {
      const error = new Error('[REWARD SERVICE] NOTION_REWARD_POLICY_DB_ID 환경변수가 설정되지 않았습니다');
      error.code = 'INTERNAL_ERROR';
      throw error;
    }
    
    if (!process.env.NOTION_API_KEY) {
      const error = new Error('[REWARD SERVICE] NOTION_API_KEY 환경변수가 설정되지 않았습니다');
      error.code = 'INTERNAL_ERROR';
      throw error;
    }
    
    this.rewardPolicyDB = process.env.NOTION_REWARD_POLICY_DB_ID;
    this.notionApiKey = process.env.NOTION_API_KEY;
    this.firestoreService = new FirestoreService("users");
  }

  /**
   * Notion에서 특정 액션의 리워드 포인트 조회
   * @param {string} actionKey - 액션 키 (예: "comment")
   * @return {Promise<number>} 리워드 포인트 (정책이 없거나 비활성화면 0)
   */
  async getRewardByAction(actionKey) {
    try {
      if (!actionKey || typeof actionKey !== 'string') {
        console.warn('[REWARD] 유효하지 않은 actionKey:', actionKey);
        return 0;
      }

      // Notion REST API로 직접 호출 (기존 notionUserService 패턴)
      const response = await fetch(`https://api.notion.com/v1/databases/${this.rewardPolicyDB}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            property: '__DEV_ONLY__',
            rich_text: {
              equals: actionKey,
            },
          },
        }),
      });

      if (!response.ok) {
        console.error(`[REWARD] Notion API 호출 실패: ${response.status} ${response.statusText}`);
        return 0;
      }

      const data = await response.json();

      if (!data || !data.results || data.results.length === 0) {
        console.warn(`[REWARD] 액션 "${actionKey}"에 대한 리워드 정책이 없습니다`);
        return 0;
      }

      const page = data.results[0];
      if (!page || !page.properties) {
        console.warn(`[REWARD] 액션 "${actionKey}"의 페이지 데이터가 유효하지 않습니다`);
        return 0;
      }

      const props = page.properties;

      // status 체크 ('적용 완료'인 경우만 리워드 부여)
      const status = getStatusValue(props['정책 적용 상태']);
      if (status !== '적용 완료') {
        console.log(`[REWARD] 액션 "${actionKey}"는 적용 전 상태입니다 (status: ${status})`);
        return 0;
      }

      // Rewards 포인트 가져오기
      const rewards = getNumberValue(props['나다움']) || 0;
      return Math.max(0, rewards); // 음수 방지
    } catch (error) {
      console.error('[REWARD ERROR] getRewardByAction:', error.message);
      return 0;
    }
  }

  /**
   * 사용자 리워드 총량 업데이트 + 히스토리 추가 (범용 메서드)
   * @param {string} userId - 사용자 ID
   * @param {number} amount - 리워드 금액
   * @param {string} actionKey - 액션 키
   * @param {string} historyId - 히스토리 문서 ID (중복 체크용)
   * @param {Date|Timestamp|null} actionTimestamp - 액션 발생 시간 (null이면 FieldValue.serverTimestamp() 사용)
   * @param {boolean} checkDuplicate - 중복 체크 여부 (기본: true, 중복 지급 방지)
   * @param {string|null} reason - 리워드 사유 (null이면 ACTION_REASON_MAP에서 자동 생성)
   * @param {Object} [options] - 추가 옵션 (예: { expiresAt })
   * @return {Promise<{isDuplicate: boolean}>}
   * @throws {Error} DAILY_LIMIT_EXCEEDED - 일일 제한 초과 시
   */
  async addRewardToUser(
    userId,
    amount,
    actionKey,
    historyId,
    actionTimestamp = null,
    checkDuplicate = true,
    reason = null,
    options = {}
  ) {
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('유효하지 않은 userId입니다');
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('유효하지 않은 amount입니다. 양수여야 합니다');
    }

    if (!actionKey || typeof actionKey !== 'string' || actionKey.trim().length === 0) {
      throw new Error('유효하지 않은 actionKey입니다');
    }

    if (!historyId || typeof historyId !== 'string' || historyId.trim().length === 0) {
      throw new Error('유효하지 않은 historyId입니다');
    }

    const userRef = db.collection('users').doc(userId);
    const historyRef = db.collection(`users/${userId}/rewardsHistory`).doc(historyId);

    let isDuplicate = false;

    await this.firestoreService.runTransaction(async (transaction) => {
      // 댓글 일일 제한 체크 (actionTimestamp가 있고, actionKey가 comment인 경우)
      const actionDate = actionTimestamp ? toDate(actionTimestamp) : null;

      if (actionDate && actionKey === 'comment') {
        const dateKey = formatDate(actionDate);
        const counterRef = db.collection(`users/${userId}/dailyRewardCounters`).doc(dateKey);
        const counterDoc = await transaction.get(counterRef);
        
        const currentCount = counterDoc.exists ? (counterDoc.data()[actionKey] || 0) : 0;
        
        if (currentCount >= 5) {
          const error = new Error('Daily comment reward limit reached (5/day)');
          error.code = 'DAILY_LIMIT_EXCEEDED';
          throw error;
        }
      }

      // 중복 체크 (개별 리워드 중복 방지)
      if (checkDuplicate) {
        const historyDoc = await transaction.get(historyRef);
        if (historyDoc.exists) {
          isDuplicate = true;
          return; // 트랜잭션 중단
        }
      }

      // rewardsHistory에 기록 추가
      const rewardReason = reason || ACTION_REASON_MAP[actionKey] || '리워드 적립';
      const createdAtValue = actionDate ? Timestamp.fromDate(actionDate) : FieldValue.serverTimestamp();
      
      const historyData = {
        actionKey,
        amount,
        changeType: 'add',
        reason: rewardReason,
        createdAt: createdAtValue,
        isProcessed: false,
      };

      let expiresAtTimestamp = null;
      const requestedExpiry = options?.expiresAt;

      if (requestedExpiry instanceof Timestamp) {
        expiresAtTimestamp = requestedExpiry;
      } else if (requestedExpiry instanceof Date) {
        expiresAtTimestamp = Timestamp.fromDate(requestedExpiry);
      } else if (typeof requestedExpiry === 'string') {
        const parsedExpiry = new Date(requestedExpiry);
        if (!Number.isNaN(parsedExpiry.getTime())) {
          expiresAtTimestamp = Timestamp.fromDate(parsedExpiry);
        }
      }

      if (!expiresAtTimestamp) {
        let baseDate;
        if (actionTimestamp instanceof Timestamp) {
          baseDate = actionTimestamp.toDate();
        } else if (actionTimestamp instanceof Date) {
          baseDate = actionTimestamp;
        } else {
          baseDate = Timestamp.now().toDate();
        }

        const expiryDate = new Date(baseDate);
        expiryDate.setDate(expiryDate.getDate() + DEFAULT_EXPIRY_DAYS);
        expiresAtTimestamp = Timestamp.fromDate(expiryDate);
      }

      historyData.expiresAt = expiresAtTimestamp;

      transaction.set(historyRef, historyData);

      // users/{userId}.rewards 증가
      transaction.update(userRef, {
        rewards: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 일일 카운터 증가 (actionTimestamp가 있고, actionKey가 comment인 경우)
      if (actionDate && actionKey === 'comment') {
        const dateKey = formatDate(actionDate);
        const counterRef = db.collection(`users/${userId}/dailyRewardCounters`).doc(dateKey);
        
        transaction.set(counterRef, {
          [actionKey]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    return { isDuplicate };
  }

  /**
   * 사용자 리워드 차감 + 히스토리 추가
   * - 잔액 부족이어도 에러 없이 0 미만으로 내려가지 않도록 클램프 처리
   * @param {string} userId - 사용자 ID
   * @param {number} amount - 차감 금액(양수 기대, 음수 입력 시 절대값 처리)
   * @param {string} actionKey - 액션 키(예: "additional_point")
   * @param {string} historyId - 히스토리 문서 ID (중복 체크용)
   * @param {Date|Timestamp|null} actionTimestamp - 액션 발생 시간 (null이면 FieldValue.serverTimestamp() 사용)
   * @param {boolean} checkDuplicate - 중복 체크 여부 (기본: true)
   * @param {string|null} reason - 차감 사유
   * @param {Object} [options] - 추가 옵션(예약)
   * @return {Promise<{isDuplicate: boolean, deducted: number}>}
   */
  async deductRewardFromUser(
    userId,
    amount,
    actionKey,
    historyId,
    actionTimestamp = null,
    checkDuplicate = true,
    reason = null,
    options = {}
  ) {
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('유효하지 않은 userId입니다');
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
      throw new Error('유효하지 않은 amount입니다');
    }
    const amountAbs = Math.abs(amount);
    if (!actionKey || typeof actionKey !== 'string' || actionKey.trim().length === 0) {
      throw new Error('유효하지 않은 actionKey입니다');
    }
    if (!historyId || typeof historyId !== 'string' || historyId.trim().length === 0) {
      throw new Error('유효하지 않은 historyId입니다');
    }

    const userRef = db.collection('users').doc(userId);
    const historyRef = db.collection(`users/${userId}/rewardsHistory`).doc(historyId);

    let isDuplicate = false;
    let deducted = 0;

    await this.firestoreService.runTransaction(async (transaction) => {
      // 중복 체크
      if (checkDuplicate) {
        const historyDoc = await transaction.get(historyRef);
        if (historyDoc.exists) {
          isDuplicate = true;
          return;
        }
      }

      // 현재 리워드 조회
      const userDoc = await transaction.get(userRef);
      const currentRewards = userDoc.exists && typeof userDoc.data().rewards === 'number'
        ? userDoc.data().rewards
        : 0;

      // 0 미만 방지: 현재 보유치 만큼만 차감
      deducted = Math.min(currentRewards, amountAbs);
      const rewardReason = reason || ACTION_REASON_MAP[actionKey] || '리워드 차감';
      const createdAtValue = actionTimestamp
        ? (actionTimestamp instanceof Timestamp ? actionTimestamp : Timestamp.fromDate(new Date(actionTimestamp)))
        : FieldValue.serverTimestamp();

      // 히스토리 기록 (expiresAt, isProcessed는 만료 전용 의미 유지 → 설정하지 않음)
      transaction.set(historyRef, {
        actionKey,
        amount: deducted,
        changeType: 'deduct',
        reason: rewardReason,
        createdAt: createdAtValue,
        isProcessed: false,
      });

      // 사용자 리워드 차감
      if (deducted > 0) {
        transaction.update(userRef, {
          rewards: FieldValue.increment(-deducted),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { isDuplicate, deducted };
  }

  /**
   * 게시글 타입에 따른 리워드 부여 (비즈니스 로직)
   * @param {string} userId - 사용자 ID
   * @param {Object} post - 게시글 객체 ({ id, type, media, content, communityId })
   * @return {Promise<Object>} 부여 결과
   * @throws {Error} 에러 발생 시 (middleware에서 처리)
   */
  async grantPostReward(userId, post) {
    const { id: postId, type, media, content, communityId } = post;
    
    // 리워드 대상 게시글 타입별 처리
    if (type === 'ROUTINE_CERT') {
      return await this.grantActionReward(userId, 'routine_post', { postId, communityId });
    } else if (type === 'ROUTINE_REVIEW') {
      return await this.grantActionReward(userId, 'routine_review', { postId, communityId });
    } else if (type === 'GATHERING_REVIEW') {
      // 이미지 포함 여부 체크
      let hasImage = Array.isArray(media) && media.length > 0;
      
      if (!hasImage && content) {
        const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
        hasImage = /<\s*img\b/i.test(contentWithoutCodeBlocks);
      }
      
      const actionKey = hasImage ? 'gathering_review_media' : 'gathering_review_text';
      return await this.grantActionReward(userId, actionKey, { postId, communityId });
    } else if (type === 'TMI_REVIEW' || type === 'TMI') {
      return await this.grantActionReward(userId, 'tmi_review', { postId, communityId });
    }
    
    // 리워드 대상이 아닌 타입
    return { success: true, amount: 0, message: 'No reward for this post type' };
  }

  /**
   * Action 기반 리워드 부여 (Notion DB 조회)
   * Race condition 방지를 위해 중복 체크와 리워드 부여를 단일 transaction으로 처리
   * @param {string} userId - 사용자 ID
   * @param {string} actionKey - 액션 키 (예: "comment")
   * @param {Object} metadata - 추가 정보 (postId, commentId 등)
   * @return {Promise<Object>} 부여 결과
   */
  async grantActionReward(userId, actionKey, metadata = {}) {
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('유효하지 않은 userId입니다');
    }

    if (!actionKey || typeof actionKey !== 'string' || actionKey.trim().length === 0) {
      throw new Error('유효하지 않은 actionKey입니다');
    }

    try {
      // 1. Notion에서 리워드 포인트 조회
      const rewardAmount = await this.getRewardByAction(actionKey);

      if (rewardAmount <= 0) {
        return { success: true, amount: 0, message: 'No reward for this action' };
      }

      // 2. 액션 시점 결정 (Firestore에서 직접 조회)
      let actionTimestamp;
      
      // 댓글 작성: comments/{commentId}에서 createdAt 조회
      if (actionKey === 'comment' && metadata.commentId) {
        const commentDoc = await this.firestoreService.getDocument('comments', metadata.commentId);
        
        if (!commentDoc) {
          const error = new Error('댓글 문서를 찾을 수 없습니다');
          error.code = 'NOT_FOUND';
          throw error;
        }
        
        const createdAt = commentDoc.createdAt;
        if (!createdAt) {
          const error = new Error('댓글 문서에 createdAt이 없습니다');
          error.code = 'INTERNAL_ERROR';
          throw error;
        }
        
        actionTimestamp = toDate(createdAt);
      }
      // 미션 인증: missionPosts/{postId}에서 createdAt 조회
      else if (actionKey === 'mission_cert' && metadata.postId) {
        const { MISSION_POSTS_COLLECTION } = require('../constants/missionConstants');
        const postDoc = await this.firestoreService.getDocument(MISSION_POSTS_COLLECTION, metadata.postId);
        
        if (!postDoc) {
          const error = new Error('미션 인증글 문서를 찾을 수 없습니다');
          error.code = 'NOT_FOUND';
          throw error;
        }
        
        const createdAt = postDoc.createdAt;
        if (!createdAt) {
          const error = new Error('미션 인증글 문서에 createdAt이 없습니다');
          error.code = 'INTERNAL_ERROR';
          throw error;
        }
        
        actionTimestamp = toDate(createdAt);
      }
      // 게시글 작성: communities/{communityId}/posts/{postId}에서 createdAt 조회
      else if (metadata.postId && metadata.communityId) {
        const postDoc = await this.firestoreService.getDocument(
          `communities/${metadata.communityId}/posts`,
          metadata.postId
        );
        
        if (!postDoc) {
          const error = new Error('게시글 문서를 찾을 수 없습니다');
          error.code = 'NOT_FOUND';
          throw error;
        }
        
        const createdAt = postDoc.createdAt;
        if (!createdAt) {
          const error = new Error('게시글 문서에 createdAt이 없습니다');
          error.code = 'INTERNAL_ERROR';
          throw error;
        }
        
        actionTimestamp = toDate(createdAt);
      }
      
      // 일일 제한이 적용되는 액션은 actionTimestamp 필수
      if (actionKey === 'comment' && !actionTimestamp) {
        const error = new Error('댓글 리워드는 액션 타임스탬프가 필요합니다');
        error.code = 'INTERNAL_ERROR';
        throw error;
      }
      
      // 3. historyId 생성 (타입 코드 기반)
      const typeCode = ACTION_TYPE_MAP[actionKey] || 'REWARD';
      
      // consecutive_days_5는 userId를 targetId로 사용
      let targetId;
      if (actionKey === 'consecutive_days_5') {
        targetId = userId;
      } else {
        targetId = metadata.commentId || metadata.postId || metadata.targetId;
      }
      
      if (!targetId) {
        const error = new Error('commentId, postId, 또는 targetId가 필요합니다');
        error.code = 'BAD_REQUEST';
        throw error;
      }
      
      const historyId = `${typeCode}-${targetId}`;

      // 4. reason 생성 (ACTION_REASON_MAP에서 가져오기)
      const reason = ACTION_REASON_MAP[actionKey] || '리워드 적립';

      // 5. addRewardToUser 호출 (범용 메서드 활용, 트랜잭션 내 중복 체크 + 일일 제한 체크)
      const { isDuplicate } = await this.addRewardToUser(
        userId, 
        rewardAmount, 
        actionKey, 
        historyId, 
        actionTimestamp,
        true, // checkDuplicate
        reason
      );

      // 6. 중복 체크 결과 처리
      if (isDuplicate) {
        return { success: true, amount: 0, message: 'Reward already granted' };
      }

      console.log(`[REWARD SUCCESS] userId=${userId}, action=${actionKey}, amount=${rewardAmount}, targetId=${targetId}`);

      return {
        success: true,
        amount: rewardAmount,
        message: `Granted ${rewardAmount} rewards for ${actionKey}`,
      };
    } catch (error) {
      // error.code가 없으면 적절한 코드 설정 (Service 에러 가이드라인 준수)
      if (!error.code) {
        error.code = 'INTERNAL_ERROR';
      }
      
      console.error('[REWARD ERROR] grantActionReward:', error.message, {
        userId,
        actionKey,
        metadata,
        stack: error.stack,
      });
      
      throw error;
    }
  }

  /**
   * 리워드 유효기간 검증 및 차감
   * 로그인 시점에 호출하여 만료된 리워드를 차감 처리
   * expiresAt 필드가 있는 경우만 처리 (없으면 스킵)
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>} 차감 결과 { totalDeducted, count }
   */
  async checkAndDeductExpiredRewards(userId) {
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      console.error('[REWARD EXPIRY] 유효하지 않은 userId:', userId);
      return { totalDeducted: 0, count: 0, error: 'Invalid userId' };
    }

    try {
      const now = Timestamp.now();
      const nowDate = now.toDate();
      const rewardsHistoryRef = db.collection(`users/${userId}/rewardsHistory`);
      const userRef = db.collection('users').doc(userId);

      let totalDeducted = 0;
      let expiredCount = 0;

      // 트랜잭션으로 일괄 처리 (조회도 트랜잭션 내부에서 수행하여 중복 차감 방지)
      await this.firestoreService.runTransaction(async (transaction) => {
        // 트랜잭션 내에서 만료 대상 조회 (동시성 문제 방지)
        const snapshot = await transaction.get(rewardsHistoryRef
          .where('changeType', '==', 'add')
          .where('isProcessed', '==', false)
          .limit(100)); // 한 번에 처리할 최대 개수 제한

        if (snapshot.empty) {
          return;
        }

        const expiredHistories = [];
        let deductAmount = 0;

        // 만료된 항목 필터링 (expiresAt 필드 기반)
        for (const doc of snapshot.docs) {
          const data = doc.data();
          
          // expiresAt이 없으면 스킵 (다른 담당자가 추가할 때까지 대기)
          if (!data || !data.expiresAt) {
            continue;
          }

          let expiresAt;
          try {
            expiresAt = toDate(data.expiresAt);
          } catch (parseError) {
            console.warn(`[REWARD EXPIRY] rewardsHistory/${doc.id}의 expiresAt 파싱 실패:`, parseError.message);
            continue;
          }

          const amount = typeof data.amount === 'number' ? data.amount : 0;

          // 만료 여부 확인
          if (expiresAt <= nowDate) {
            expiredHistories.push({
              id: doc.id,
              amount,
              expiresAt,
              createdAt: data.createdAt,
            });
            deductAmount += amount;
          }
        }

        if (expiredHistories.length === 0) {
          return;
        }

        totalDeducted = deductAmount;
        expiredCount = expiredHistories.length;
        // 사용자 문서 읽기 (데이터 일관성 검증)
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error(`사용자 ${userId}를 찾을 수 없습니다.`);
        }

        const userData = userDoc.data();
        const currentRewards = typeof userData.rewards === 'number' ? userData.rewards : 0;

        // 차감할 금액이 현재 리워드보다 많으면 경고 로그
        if (totalDeducted > currentRewards) {
          console.warn(`[REWARD EXPIRY] userId=${userId}, 차감할 금액(${totalDeducted})이 현재 리워드(${currentRewards})보다 많습니다. 0으로 설정됩니다.`);
          // 모든 리워드 차감
          transaction.update(userRef, {
            rewards: 0,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else if (totalDeducted > 0) {
          // 정상 차감 (FieldValue.increment 사용으로 동시성 문제 방지)
          transaction.update(userRef, {
            rewards: FieldValue.increment(-totalDeducted),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 각 만료된 히스토리 항목 처리
        for (const history of expiredHistories) {
          const historyRef = rewardsHistoryRef.doc(history.id);

          // isProcessed를 true로 변경
          transaction.update(historyRef, {
            isProcessed: true,
          });

          // 차감 히스토리 추가
          const deductHistoryRef = rewardsHistoryRef.doc();
          transaction.set(deductHistoryRef, {
            amount: history.amount,
            changeType: 'deduct',
            actionKey: 'expiration',
            reason: '리워드 만료',
            isProcessed: true,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      console.log(`[REWARD EXPIRY] userId=${userId}, 만료된 리워드 ${expiredCount}건, 총 ${totalDeducted}포인트 차감`);

      return {
        totalDeducted,
        count: expiredCount,
      };
    } catch (error) {
      if (!error.code) {
        error.code = 'INTERNAL_ERROR';
      }
      console.error('[REWARD EXPIRY ERROR] checkAndDeductExpiredRewards:', error.message, {
        userId,
        stack: error.stack,
      });
      // 에러가 발생해도 로그인 프로세스는 계속 진행되도록 에러를 throw하지 않음
      // 대신 로그만 남기고 빈 결과 반환
      return { totalDeducted: 0, count: 0, error: error.message };
    }
  }

  /**
   * 지급받은 나다움 목록 조회
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 조회 옵션
   * @param {number} options.page - 페이지 번호 (기본값: 0)
   * @param {number} options.size - 페이지 크기 (기본값: 20)
   * @return {Promise<Object>} 조회 결과 { history, pagination }
   */
  async getRewardsEarned(userId, options = {}) {
    const { page = 0, size = 20, filter = 'all' } = options;
    
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('유효하지 않은 userId입니다');
    }
  

    try {
      const rewardsHistoryRef = this.firestoreService.db.collection(`users/${userId}/rewardsHistory`);
      const now = new Date();
      
      // 0. 사용자 문서에서 사용 가능한 나다움 포인트 조회
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const availableRewards = userDoc.exists ? (userDoc.data().rewards || 0) : 0;
      
      // 1. 지급 내역 조회 (changeType: "add")
      const addQuery = rewardsHistoryRef
        .where('changeType', '==', 'add')
        .orderBy('createdAt', 'desc');
      
      const addSnapshot = await addQuery.get();
      
      // 2. 차감 내역 조회 (changeType: "deduct" && actionKey: "additional_point" | "store" | "expiration")
      const deductQuery = rewardsHistoryRef
        .where('changeType', '==', 'deduct')
        .where('actionKey', 'in', ['additional_point', 'store', 'expiration'])
        .orderBy('createdAt', 'desc');
      
      const deductSnapshot = await deductQuery.get();
      
      // 3. 해당 월 소멸 예정 포인트 계산
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      let expiringThisMonth = 0;
      addSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        
        // changeType === 'add'이고 isProcessed === false인 항목만
        if (data.changeType !== 'add' || data.isProcessed === true) {
          return;
        }
        
        // expiresAt 계산
        let expiresAt = null;
        if (data.expiresAt?.toDate) {
          expiresAt = data.expiresAt.toDate();
        } else if (data.expiresAt) {
          const parsed = new Date(data.expiresAt);
          if (!Number.isNaN(parsed.getTime())) {
            expiresAt = parsed;
          }
        } else {
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          expiresAt = new Date(createdAt);
          expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);
        }
        
        // 현재 월 내에 만료되는지 확인
        if (expiresAt && expiresAt >= currentMonthStart && expiresAt <= currentMonthEnd) {
          expiringThisMonth += data.amount || 0;
        }
      });
      
      // 3. 두 결과 합치기 및 정렬 (메모리에서)
      const allDocs = [
        ...addSnapshot.docs.map(doc => ({ doc, createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt) })),
        ...deductSnapshot.docs.map(doc => ({ doc, createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt) }))
      ];
      
      // createdAt 기준 내림차순 정렬
      allDocs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      let filteredDocs = allDocs;
      if (filter === 'earned') {
        filteredDocs = allDocs.filter(({ doc }) => doc.data().changeType === 'add');
      } else if (filter === 'used') {
        filteredDocs = allDocs.filter(({ doc }) => {
          const data = doc.data();
          return data.changeType === 'deduct' && data.actionKey === 'store';
        });
      } else if (filter === 'expired') {
        filteredDocs = allDocs.filter(({ doc }) => {
          const data = doc.data();
          if (data.isProcessed !== true) {
            return false;
          }
          
          let expiresAt = null;
          if (data.expiresAt?.toDate) {
            expiresAt = data.expiresAt.toDate();
          } else if (data.expiresAt) {
            const parsed = new Date(data.expiresAt);
            if (!Number.isNaN(parsed.getTime())) {
              expiresAt = parsed;
            }
          } else {
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            expiresAt = new Date(createdAt);
            expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);
          }
          
          return expiresAt && expiresAt <= now;
        });
      }
      
      const totalElements = filteredDocs.length;
      const totalPages = Math.ceil(totalElements / size);
      
      const startIndex = page * size;
      const endIndex = startIndex + size;
      const paginatedDocs = filteredDocs.slice(startIndex, endIndex);
      
      const history = paginatedDocs.map(({ doc }) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        
        const expiresAt = data.changeType === 'deduct'
          ? null
          : (() => {
              if (data.expiresAt?.toDate) {
                return data.expiresAt.toDate();
              }
              if (data.expiresAt) {
                const parsed = new Date(data.expiresAt);
                if (!Number.isNaN(parsed.getTime())) {
                  return parsed;
                }
              }
              const expiry = new Date(createdAt);
              expiry.setDate(expiry.getDate() + DEFAULT_EXPIRY_DAYS);
              return expiry;
            })();
        
        // 만료 여부 확인 (차감 내역은 항상 false)
        const isExpired = data.changeType === 'deduct' ? false : (expiresAt && expiresAt <= now);
        
        return {
          id: doc.id,
          amount: data.amount || 0, 
          reason: data.reason || (data.changeType === 'deduct' ? '나다움 차감' : '리워드 적립'),
          actionKey: data.actionKey || null,
          changeType: data.changeType, // 지급/차감 구분을 위해 추가
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          isProcessed: data.isProcessed || false,
          isExpired,
        };
      });

      return {
        availableRewards,
        expiringThisMonth,
        history,
        pagination: {
          pageNumber: page,
          pageSize: size,
          totalElements,
          totalPages,
          hasNext: page < totalPages - 1,
          hasPrevious: page > 0,
        },
      };
    } catch (error) {
      console.error('[REWARD HISTORY ERROR] getRewardsEarned:', error.message, {
        userId,
        options,
        stack: error.stack,
      });
      
      if (!error.code) {
        error.code = 'INTERNAL_ERROR';
      }
      
      throw error;
    }
  }


  /**
   * 댓글 삭제 시 리워드 차감 처리
   * @param {string} userId - 사용자 ID
   * @param {string} commentId - 댓글 ID
   * @param {Object} transaction - Firestore 트랜잭션 객체
   * @return {Promise<void>}
   */
  async handleRewardOnCommentDeletion(userId, commentId, transaction) {
    try {
      const historyId = `COMMENT-${commentId}`;
      const historyRef = db.collection(`users/${userId}/rewardsHistory`).doc(historyId);
      const historyDoc = await transaction.get(historyRef);

      if (!historyDoc.exists) {
        return; // 리워드 히스토리가 없으면 스킵
      }

      const historyData = historyDoc.data();
      
      // 조건 확인: isProcessed === false && changeType === 'add'
      if (!historyData.isProcessed && historyData.changeType === 'add') {
        const amount = historyData.amount || 0;
        
        if (amount > 0) {
          // 현재 리워드 조회 (음수 방지)
          const userRef = db.collection('users').doc(userId);
          const userDoc = await transaction.get(userRef);
          const currentRewards = userDoc.exists && typeof userDoc.data().rewards === 'number'
            ? userDoc.data().rewards
            : 0;
          
          // 실제 차감할 금액 결정 (0 미만 방지)
          const deducted = Math.min(currentRewards, amount);
          
          if (deducted > 0) {
            // ① 원본 히스토리 isProcessed = true로 업데이트
            transaction.update(historyRef, {
              isProcessed: true
            });

            // ② 사용자 리워드 차감 및 패널티 카운트 증가 (0 미만 방지)
            transaction.update(userRef, {
              rewards: FieldValue.increment(-deducted),
              penaltyCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp()
            });

            // ③ 차감 히스토리 추가 (무작위 ID)
            const deductHistoryRef = db.collection(`users/${userId}/rewardsHistory`).doc();
            transaction.set(deductHistoryRef, {
              amount: deducted,
              changeType: 'deduct',
              reason: '댓글 삭제',
              actionKey: historyData.actionKey || 'comment_deletion',
              isProcessed: true,
              createdAt: FieldValue.serverTimestamp()
            });
          } else {
            // 차감할 금액이 없어도 원본 히스토리는 처리 완료로 표시
            transaction.update(historyRef, {
              isProcessed: true
            });
          }
        }
      }
    } catch (error) {
      console.error('[REWARD] 댓글 삭제 시 리워드 차감 실패:', error.message, {
        userId,
        commentId
      });
      // 에러가 발생해도 삭제 프로세스는 계속 진행되도록 에러를 throw하지 않음
    }
  }

  /**
   * 게시글 삭제 시 리워드 차감 처리
   * @param {string} userId - 사용자 ID
   * @param {string} postId - 게시글 ID
   * @param {string} postType - 게시글 타입 (예: 'ROUTINE_CERT', 'GATHERING_REVIEW')
   * @param {Array} postMedia - 게시글 미디어 배열
   * @param {Object} transaction - Firestore 트랜잭션 객체
   * @return {Promise<void>}
   */
  async handleRewardOnPostDeletion(userId, postId, postType, postMedia, transaction) {
    try {
      // TYPE_CODE 결정
      let typeCode;
      if (postType === 'ROUTINE_CERT') {
        typeCode = 'ROUTINE-POST';
      } else if (postType === 'ROUTINE_REVIEW') {
        typeCode = 'ROUTINE-REVIEW';
      } else if (postType === 'GATHERING_REVIEW') {
        // media 필드만 확인
        const hasMedia = Array.isArray(postMedia) && postMedia.length > 0;
        typeCode = hasMedia ? 'GATHERING-MEDIA' : 'GATHERING-TEXT';
      } else if (postType === 'TMI_REVIEW' || postType === 'TMI') {
        typeCode = 'TMI';
      } else {
        return; // 리워드 대상이 아닌 타입
      }

      const historyId = `${typeCode}-${postId}`;
      const historyRef = db.collection(`users/${userId}/rewardsHistory`).doc(historyId);
      const historyDoc = await transaction.get(historyRef);

      if (!historyDoc.exists) {
        return; // 리워드 히스토리가 없으면 스킵
      }

      const historyData = historyDoc.data();
      
      // 조건 확인: isProcessed === false && changeType === 'add'
      if (!historyData.isProcessed && historyData.changeType === 'add') {
        const amount = historyData.amount || 0;
        
        if (amount > 0) {
          // 현재 리워드 조회 (음수 방지)
          const userRef = db.collection('users').doc(userId);
          const userDoc = await transaction.get(userRef);
          const currentRewards = userDoc.exists && typeof userDoc.data().rewards === 'number'
            ? userDoc.data().rewards
            : 0;
          
          // 실제 차감할 금액 결정 (0 미만 방지)
          const deducted = Math.min(currentRewards, amount);
          
          if (deducted > 0) {
            // ① 원본 히스토리 isProcessed = true로 업데이트
            transaction.update(historyRef, {
              isProcessed: true
            });

            // ② 사용자 리워드 차감 및 패널티 카운트 증가 (0 미만 방지)
            transaction.update(userRef, {
              rewards: FieldValue.increment(-deducted),
              penaltyCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp()
            });

            // ③ 차감 히스토리 추가 (무작위 ID)
            const deductHistoryRef = db.collection(`users/${userId}/rewardsHistory`).doc();
            transaction.set(deductHistoryRef, {
              amount: deducted,
              changeType: 'deduct',
              reason: '게시글 삭제',
              actionKey: historyData.actionKey || 'post_deletion',
              isProcessed: true,
              createdAt: FieldValue.serverTimestamp()
            });
          } else {
            // 차감할 금액이 없어도 원본 히스토리는 처리 완료로 표시
            transaction.update(historyRef, {
              isProcessed: true
            });
          }
        }
      }
    } catch (error) {
      console.error('[REWARD] 게시글 삭제 시 리워드 차감 실패:', error.message, {
        userId,
        postId,
        postType
      });
      // 에러가 발생해도 삭제 프로세스는 계속 진행되도록 에러를 throw하지 않음
    }
  }
}

module.exports = RewardService;
