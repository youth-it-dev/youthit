const FirestoreService = require('./firestoreService');
const { getNumberValue, getTextContent } = require('../utils/notionHelper');

const REWARD_POLICIES_COLLECTION = 'rewardPolicies';

/**
 * Reward Policy Sync Service
 * Notion에서 Firestore로 리워드 정책을 동기화하는 서비스
 * (선택 체크박스가 체크된 정책만 동기화)
 */
class RewardPolicySyncService {
  constructor() {
    this.firestoreService = new FirestoreService(REWARD_POLICIES_COLLECTION);
    this.rewardPolicyDB = process.env.NOTION_REWARD_POLICY_DB_ID;
    this.notionApiKey = process.env.NOTION_API_KEY;
  }

  /**
   * Notion에서 '선택' 체크박스가 체크된 정책 조회
   * @return {Promise<Array>} 선택된 정책 목록
   */
  async getSelectedPolicies() {
    const allPages = [];
    let hasMore = true;
    let startCursor = undefined;

    console.log('[RewardPolicySyncService] 선택된 정책 조회 시작...');

    while (hasMore) {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${this.rewardPolicyDB}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.notionApiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              property: '선택',
              checkbox: {
                equals: true,
              },
            },
            page_size: 100,
            start_cursor: startCursor,
          }),
        }
      );

      if (!response.ok) {
        const error = new Error(`Notion API 호출 실패: ${response.status}`);
        error.code = 'NOTION_SYNC_FAILED';
        throw error;
      }

      const data = await response.json();
      allPages.push(...data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor;

      console.log(`[RewardPolicySyncService] ${allPages.length}건 조회 중...`);

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    }

    console.log(`[RewardPolicySyncService] 총 ${allPages.length}건 조회 완료`);

    // 필요한 정보 추출
    const policies = [];
    for (const page of allPages) {
      try {
        const props = page.properties;
        const actionKey = getTextContent(props['__DEV_ONLY__']);
        const points = getNumberValue(props['나다움']) || 0;

        if (!actionKey) {
          console.warn('[RewardPolicySyncService] actionKey가 없는 정책 건너뜀:', page.id);
          continue;
        }

        policies.push({
          pageId: page.id,
          actionKey: actionKey.trim(),
          points: Math.max(0, points),
        });
      } catch (err) {
        console.error('[RewardPolicySyncService] 정책 파싱 오류:', err.message);
      }
    }

    return policies;
  }

  /**
   * Firestore에 정책 일괄 upsert
   * @param {Array} policies - { actionKey, points }[]
   * @return {Promise<Array>} 결과 목록
   */
  async upsertPolicies(policies) {
    const results = [];

    for (const policy of policies) {
      try {
        await this.firestoreService.setDocument(
          REWARD_POLICIES_COLLECTION,
          policy.actionKey,
          { points: policy.points }
        );

        console.log(`[REWARD POLICY SYNC] ${policy.actionKey} → points: ${policy.points}`);
        results.push({ success: true, pageId: policy.pageId, actionKey: policy.actionKey });
      } catch (err) {
        console.error(`[REWARD POLICY SYNC ERROR] ${policy.actionKey}:`, err.message);
        results.push({ success: false, pageId: policy.pageId, actionKey: policy.actionKey, error: err.message });
      }
    }

    return results;
  }

  /**
   * 성공한 항목의 '선택' 체크박스 해제
   * @param {Array} successResults - 성공한 결과 목록
   */
  async resetSelectionCheckboxes(successResults) {
    const BATCH_SIZE = 5;

    for (let i = 0; i < successResults.length; i += BATCH_SIZE) {
      const batch = successResults.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(result =>
          fetch(`https://api.notion.com/v1/pages/${result.pageId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${this.notionApiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              properties: {
                '선택': { checkbox: false },
              },
            }),
          })
        )
      );

      if (i + BATCH_SIZE < successResults.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[RewardPolicySyncService] ${successResults.length}건 선택 체크박스 해제 완료`);
  }

  /**
   * 선택된 정책 동기화 (메인 로직)
   * @return {Promise<Object>} 동기화 결과
   */
  async syncSelectedPolicies() {
    // 1. 선택된 정책 조회
    const policies = await this.getSelectedPolicies();

    if (policies.length === 0) {
      return {
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    // 2. Firestore에 upsert
    const results = await this.upsertPolicies(policies);

    // 3. 성공한 항목의 선택 체크박스 해제
    const successResults = results.filter(r => r.success);
    if (successResults.length > 0) {
      await this.resetSelectionCheckboxes(successResults);
    }

    return {
      totalCount: policies.length,
      successCount: successResults.length,
      failedCount: results.filter(r => !r.success).length,
      results,
    };
  }
}

module.exports = new RewardPolicySyncService();
