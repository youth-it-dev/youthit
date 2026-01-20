const { db, FieldValue } = require('../config/database');

const REWARD_POLICIES_COLLECTION = 'rewardPolicies';

/**
 * Reward Policy Sync Service
 * Notion에서 Firestore로 리워드 정책을 동기화하는 서비스
 */
class RewardPolicySyncService {
  constructor() {
    this.db = db;
    this.collectionName = REWARD_POLICIES_COLLECTION;
  }

  /**
   * 입력 payload 정규화 및 검증
   * @param {Object} raw - 요청 body
   * @return {Object} 정규화된 데이터 { actionKey, points }
   * @throws {Error} actionKey가 없거나 유효하지 않은 경우
   */
  normalizePayload(raw) {
    if (!raw || typeof raw.actionKey !== 'string' || raw.actionKey.trim().length === 0) {
      const error = new Error('actionKey는 필수이며 문자열이어야 합니다');
      error.code = 'BAD_REQUEST';
      throw error;
    }

    const actionKey = raw.actionKey.trim();

    // points 파싱: 숫자가 아니면 0, 음수면 0
    let points = Number(raw.points);
    if (!Number.isFinite(points) || points < 0) {
      points = 0;
    }

    return { actionKey, points };
  }

  /**
   * Firestore에 리워드 정책 upsert
   * @param {Object} data - { actionKey, points }
   * @return {Promise<Object>} 업서트 결과 { actionKey, points, updatedAt }
   */
  async upsertRewardPolicy({ actionKey, points }) {
    const docRef = this.db.collection(this.collectionName).doc(actionKey);

    const updateData = {
      points,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(updateData, { merge: true });

    console.log(`[REWARD POLICY SYNC] ${actionKey} → points: ${points}`);

    return {
      actionKey,
      points,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 특정 actionKey의 리워드 정책 조회
   * @param {string} actionKey - 액션 키
   * @return {Promise<Object|null>} 정책 데이터 또는 null
   */
  async getRewardPolicy(actionKey) {
    if (!actionKey || typeof actionKey !== 'string') {
      return null;
    }

    const docRef = this.db.collection(this.collectionName).doc(actionKey);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      actionKey,
      points: typeof data.points === 'number' ? data.points : 0,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
    };
  }
}

module.exports = new RewardPolicySyncService();
