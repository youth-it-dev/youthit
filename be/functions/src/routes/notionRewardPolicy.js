const express = require('express');
const notionRewardPolicyController = require('../controllers/notionRewardPolicyController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: NotionRewardPolicy
 *   description: Notion → Firestore 리워드 정책 동기화 API
 */

/**
 * @swagger
 * /notionRewardPolicy/sync:
 *   post:
 *     summary: 선택된 리워드 정책 동기화 (Notion → Firestore)
 *     description: |
 *       Notion 리워드 정책 DB에서 '선택' 체크박스가 체크된 정책만 Firestore에 동기화합니다.
 *       
 *       **사용 방법:**
 *       1. Notion 리워드 정책 DB에 '선택' 체크박스 속성 추가
 *       2. 동기화할 정책에 체크
 *       3. Notion 버튼으로 이 API 호출
 *       4. 성공한 정책의 '선택' 체크박스 자동 해제
 *       
 *       **Notion 버튼 설정:**
 *       - URL: https://<domain>/notionRewardPolicy/sync
 *       - Method: POST (body 없음)
 *       
 *       **Firestore 저장 형식:**
 *       - Collection: `rewardPolicies`
 *       - Document ID: `__DEV_ONLY__` 값 (예: "comment")
 *       - Fields: { points: number, updatedAt: Timestamp }
 *     tags: [NotionRewardPolicy]
 *     responses:
 *       200:
 *         description: 동기화 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "리워드 정책 동기화 완료"
 *                     totalCount:
 *                       type: number
 *                       example: 3
 *                     successCount:
 *                       type: number
 *                       example: 3
 *                     failedCount:
 *                       type: number
 *                       example: 0
 *                     syncedPolicies:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["comment", "routine_post", "mission_cert"]
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "리워드 정책 동기화 중 오류가 발생했습니다"
 */
router.post('/sync', notionRewardPolicyController.syncRewardPolicy);

module.exports = router;
