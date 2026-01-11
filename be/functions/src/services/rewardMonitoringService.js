const { db } = require('../config/database');

/**
 * Reward Monitoring Service
 * 나다움 포인트 관련 모니터링 데이터 조회 서비스
 */
class RewardMonitoringService {
  /**
   * 월 문자열을 시작/종료 Date로 변환
   * @param {string} month - YYYY-MM 형식
   * @returns {{ start: Date, end: Date }}
   */
  getMonthRange(month) {
    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Firestore Timestamp를 Date로 변환
   * @param {any} timestamp - Firestore Timestamp 또는 Date
   * @returns {Date|null}
   */
  toDate(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
  }

  /**
   * API 1: 월별 나다움 스토어 구매 명단
   * @param {string} month - YYYY-MM 형식
   * @returns {Promise<Array>} 구매 명단
   */
  async getStorePurchaseList(month) {
    const { start, end } = this.getMonthRange(month);
    
    // 모든 사용자 조회
    const usersSnapshot = await db.collection('users').get();
    const purchaseList = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // 해당 사용자의 스토어 구매 내역 조회
      const historySnapshot = await db
        .collection(`users/${userId}/rewardsHistory`)
        .where('changeType', '==', 'deduct')
        .where('actionKey', '==', 'store')
        .orderBy('createdAt', 'desc')
        .get();

      for (const historyDoc of historySnapshot.docs) {
        const history = historyDoc.data();
        const createdAt = this.toDate(history.createdAt);

        // 월 범위 필터링
        if (createdAt && createdAt >= start && createdAt <= end) {
          purchaseList.push({
            userId,
            nickname: userData.nickname || '',
            name: userData.name || '',
            usedPoints: history.amount || 0,
            productName: history.reason || '상품권 구매',
            purchaseDate: createdAt,
          });
        }
      }
    }

    // 구매일 기준 정렬
    purchaseList.sort((a, b) => b.purchaseDate - a.purchaseDate);

    return purchaseList;
  }

  /**
   * API 2: 월별 참여자 나다움 적립/차감 명단 (요약)
   * @param {string[]} months - YYYY-MM 형식 배열
   * @returns {Promise<Object>} { users: Array, months: string[] }
   */
  async getMonthlySummary(months) {
    // 월 정렬 (오름차순)
    const sortedMonths = [...months].sort();
    
    // 모든 사용자 조회
    const usersSnapshot = await db.collection('users').get();
    const userSummaries = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // 전체 리워드 히스토리 조회
      const historySnapshot = await db
        .collection(`users/${userId}/rewardsHistory`)
        .orderBy('createdAt', 'asc')
        .get();

      if (historySnapshot.empty) continue;

      const histories = historySnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: this.toDate(doc.data().createdAt),
      }));

      // 첫 번째 월 이전까지의 누적 계산
      const firstMonth = sortedMonths[0];
      const { start: firstMonthStart } = this.getMonthRange(firstMonth);
      
      let previousTotal = 0;
      histories.forEach(h => {
        if (h.createdAt && h.createdAt < firstMonthStart) {
          if (h.changeType === 'add') {
            previousTotal += h.amount || 0;
          } else if (h.changeType === 'deduct') {
            previousTotal -= h.amount || 0;
          }
        }
      });

      // 각 월별 적립/차감 계산
      const monthlyData = {};
      sortedMonths.forEach(month => {
        const { start, end } = this.getMonthRange(month);
        let earned = 0;  // 적립
        let used = 0;    // 사용 (스토어 구매)

        histories.forEach(h => {
          if (h.createdAt && h.createdAt >= start && h.createdAt <= end) {
            if (h.changeType === 'add') {
              earned += h.amount || 0;
            } else if (h.changeType === 'deduct' && h.actionKey === 'store') {
              used += h.amount || 0;
            }
          }
        });

        monthlyData[month] = { earned, used };
      });

      // 현재 보유 포인트
      const currentRewards = userData.rewards || 0;

      // 히스토리가 있는 사용자만 포함
      const hasActivity = Object.values(monthlyData).some(m => m.earned > 0 || m.used > 0);
      if (hasActivity || previousTotal > 0 || currentRewards > 0) {
        userSummaries.push({
          userId,
          nickname: userData.nickname || '',
          name: userData.name || '',
          previousTotal,
          monthlyData,
          currentRewards,
        });
      }
    }

    // 닉네임 기준 정렬
    userSummaries.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));

    return {
      users: userSummaries,
      months: sortedMonths,
    };
  }

  /**
   * API 3: 나다움 적립/차감 내역 (상세)
   * @param {string} month - YYYY-MM 형식
   * @returns {Promise<Array>} 적립/차감 내역
   */
  async getRewardHistory(month) {
    const { start, end } = this.getMonthRange(month);
    
    // 모든 사용자 조회
    const usersSnapshot = await db.collection('users').get();
    const historyList = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // 해당 사용자의 전체 리워드 히스토리 조회
      const historySnapshot = await db
        .collection(`users/${userId}/rewardsHistory`)
        .orderBy('createdAt', 'desc')
        .get();

      for (const historyDoc of historySnapshot.docs) {
        const history = historyDoc.data();
        const createdAt = this.toDate(history.createdAt);
        const expiresAt = this.toDate(history.expiresAt);

        // 월 범위 필터링
        if (createdAt && createdAt >= start && createdAt <= end) {
          historyList.push({
            userId,
            userName: userData.name || '',
            createdAt,
            expiresAt,
            amount: history.amount || 0,
            changeType: history.changeType === 'add' ? '지급' : '차감',
            reason: history.reason || '',
            actionKey: history.actionKey || '',
          });
        }
      }
    }

    // 발생일시 기준 내림차순 정렬
    historyList.sort((a, b) => b.createdAt - a.createdAt);

    return historyList;
  }
}

module.exports = new RewardMonitoringService();

