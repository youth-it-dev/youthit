const { db } = require('../config/database');
const FirestoreService = require('./firestoreService');

/**
 * Reward Monitoring Service
 * 나다움 포인트 관련 모니터링 데이터 조회 서비스
 */
class RewardMonitoringService {
  constructor() {
    this.firestoreService = new FirestoreService('users');
  }
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
    try {
      const { start, end } = this.getMonthRange(month);
      
      // collectionGroup으로 모든 사용자의 스토어 구매 내역을 한 번에 조회 (N+1 쿼리 방지)
      const historySnapshot = await db
        .collectionGroup('rewardsHistory')
        .where('changeType', '==', 'deduct')
        .where('actionKey', '==', 'store')
        .orderBy('createdAt', 'desc')
        .get();

      if (historySnapshot.empty) {
        return [];
      }

      // userId 추출 및 중복 제거
      const userIds = [...new Set(historySnapshot.docs.map(doc => {
        const pathSegments = doc.ref.path.split('/');
        return pathSegments[1]; // users/{userId}/rewardsHistory/{docId}
      }))];

      // 사용자 정보 batch 조회 (병렬 처리로 성능 개선)
      const usersMap = new Map();
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
      }
      
      const chunkPromises = chunks.map(chunk =>
        db.collection('users')
          .where('__name__', 'in', chunk)
          .get()
      );
      
      const chunkSnapshots = await Promise.all(chunkPromises);
      chunkSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          usersMap.set(doc.id, doc.data());
        });
      });

      // 구매 내역 생성 및 필터링
      const purchaseList = [];
      historySnapshot.docs.forEach(doc => {
        const history = doc.data();
        const createdAt = this.toDate(history.createdAt);
        
        // 월 범위 필터링
        if (!createdAt || createdAt < start || createdAt > end) {
          return;
        }

        const pathSegments = doc.ref.path.split('/');
        const userId = pathSegments[1];
        const userData = usersMap.get(userId) || {};

        purchaseList.push({
          userId,
          nickname: userData.nickname || '',
          name: userData.name || '',
          usedPoints: history.amount || 0,
          productName: history.reason || '상품권 구매',
          purchaseDate: createdAt,
        });
      });

      // 구매일 기준 내림차순 정렬
      purchaseList.sort((a, b) => b.purchaseDate - a.purchaseDate);

      console.log(`[RewardMonitoringService] getStorePurchaseList 완료: ${purchaseList.length}건`);

      return purchaseList;
    } catch (error) {
      console.error('[RewardMonitoringService] getStorePurchaseList 오류:', error);
      if (!error.code) {
        error.code = 'INTERNAL_ERROR';
      }
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  /**
   * API 2: 월별 참여자 나다움 적립/차감 명단 (요약)
   * @param {string[]} months - YYYY-MM 형식 배열
   * @returns {Promise<Object>} { users: Array, months: string[] }
   */
  async getMonthlySummary(months) {
    try {
      // 입력 검증
      if (!months || months.length === 0) {
        const error = new Error('months 배열이 비어있습니다');
        error.code = 'BAD_REQUEST';
        error.statusCode = 400;
        throw error;
      }

      // 월 정렬 (오름차순)
      const sortedMonths = [...months].sort((a, b) => a.localeCompare(b));
      const firstMonth = sortedMonths[0];
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      
      const { start: firstMonthStart } = this.getMonthRange(firstMonth);
      const { end: lastMonthEnd } = this.getMonthRange(lastMonth);

      console.log(`[RewardMonitoringService] getMonthlySummary 시작: ${firstMonth} ~ ${lastMonth}`);

      // 필요한 기간만 조회 (메모리 최적화)
      // 첫 달 이전 데이터도 '이전 누적' 계산을 위해 필요하므로 제한 없이 조회
      const historySnapshot = await db
        .collectionGroup('rewardsHistory')
        .orderBy('createdAt', 'asc')
        .get();

      if (historySnapshot.empty) {
        return { users: [], months: sortedMonths };
      }

      // userId별로 히스토리 그룹화 (메모리 효율적으로 처리)
      const userHistoriesMap = new Map();
      let totalDocs = 0;
      
      historySnapshot.docs.forEach(doc => {
        totalDocs++;
        const pathSegments = doc.ref.path.split('/');
        const userId = pathSegments[1]; // users/{userId}/rewardsHistory/{docId}
        
        if (!userHistoriesMap.has(userId)) {
          userHistoriesMap.set(userId, []);
        }
        
        const data = doc.data();
        userHistoriesMap.get(userId).push({
          changeType: data.changeType,
          actionKey: data.actionKey,
          amount: data.amount || 0,
          createdAt: this.toDate(data.createdAt),
        });
      });

      console.log(`[RewardMonitoringService] 히스토리 조회 완료: ${totalDocs}건, ${userHistoriesMap.size}명`);

      const userIds = Array.from(userHistoriesMap.keys());

      // 사용자 정보 batch 조회 (병렬 처리로 성능 개선)
      const usersMap = new Map();
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
      }
      
      const chunkPromises = chunks.map(chunk =>
        db.collection('users')
          .where('__name__', 'in', chunk)
          .get()
      );
      
      const chunkSnapshots = await Promise.all(chunkPromises);
      chunkSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          usersMap.set(doc.id, doc.data());
        });
      });

      // 각 사용자별 요약 데이터 생성
      const userSummaries = [];
      
      userHistoriesMap.forEach((histories, userId) => {
        const userData = usersMap.get(userId) || {};

        // 첫 번째 월 이전까지의 누적 계산
        let previousTotal = 0;
        histories.forEach(h => {
          if (h.createdAt && h.createdAt < firstMonthStart) {
            if (h.changeType === 'add') {
              previousTotal += h.amount;
            } else if (h.changeType === 'deduct') {
              previousTotal -= h.amount;
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
                earned += h.amount;
              } else if (h.changeType === 'deduct' && h.actionKey === 'store') {
                used += h.amount;
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
      });

      // 닉네임 기준 정렬
      userSummaries.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));

      console.log(`[RewardMonitoringService] getMonthlySummary 완료: ${userSummaries.length}명`);

      return {
        users: userSummaries,
        months: sortedMonths,
      };
    } catch (error) {
      console.error('[RewardMonitoringService] getMonthlySummary 오류:', error);
      if (!error.code) {
        error.code = 'INTERNAL_ERROR';
      }
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  /**
   * API 3: 나다움 적립/차감 내역 (상세)
   * @param {string} month - YYYY-MM 형식
   * @returns {Promise<Array>} 적립/차감 내역
   */
  async getRewardHistory(month) {
    try {
      const { start, end } = this.getMonthRange(month);
      
      console.log(`[RewardMonitoringService] getRewardHistory 시작: ${month}`);
      
      // collectionGroup으로 모든 사용자의 리워드 히스토리를 한 번에 조회 (N+1 쿼리 방지)
      const historySnapshot = await db
        .collectionGroup('rewardsHistory')
        .orderBy('createdAt', 'desc')
        .get();

      if (historySnapshot.empty) {
        return [];
      }

      // userId 추출 및 중복 제거 (메모리 효율화를 위해 필터링과 함께 처리)
      const relevantDocs = [];
      const userIdsSet = new Set();
      
      historySnapshot.docs.forEach(doc => {
        const history = doc.data();
        const createdAt = this.toDate(history.createdAt);
        
        // 월 범위 필터링 (조기 필터링으로 메모리 절약)
        if (createdAt && createdAt >= start && createdAt <= end) {
          relevantDocs.push(doc);
          const pathSegments = doc.ref.path.split('/');
          userIdsSet.add(pathSegments[1]);
        }
      });

      console.log(`[RewardMonitoringService] 필터링 완료: 전체 ${historySnapshot.size}건 → 해당 월 ${relevantDocs.length}건`);

      const userIds = Array.from(userIdsSet);

      // 사용자 정보 batch 조회 (병렬 처리로 성능 개선)
      const usersMap = new Map();
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
      }
      
      const chunkPromises = chunks.map(chunk =>
        db.collection('users')
          .where('__name__', 'in', chunk)
          .get()
      );
      
      const chunkSnapshots = await Promise.all(chunkPromises);
      chunkSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          usersMap.set(doc.id, doc.data());
        });
      });

      // 히스토리 데이터 생성
      const historyList = relevantDocs.map(doc => {
        const history = doc.data();
        const createdAt = this.toDate(history.createdAt);
        const pathSegments = doc.ref.path.split('/');
        const userId = pathSegments[1];
        const userData = usersMap.get(userId) || {};
        const expiresAt = this.toDate(history.expiresAt);

        return {
          userId,
          userName: userData.name || '',
          createdAt,
          expiresAt,
          amount: history.amount || 0,
          changeType: history.changeType === 'add' ? '지급' : '차감',
          reason: history.reason || '',
          actionKey: history.actionKey || '',
        };
      });

      // 발생일시 기준 내림차순 정렬
      historyList.sort((a, b) => b.createdAt - a.createdAt);

      console.log(`[RewardMonitoringService] getRewardHistory 완료: ${historyList.length}건`);

      return historyList;
    } catch (error) {
      console.error('[RewardMonitoringService] getRewardHistory 오류:', error);
      if (!error.code) {
        error.code = 'INTERNAL_ERROR';
      }
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}

module.exports = new RewardMonitoringService();

