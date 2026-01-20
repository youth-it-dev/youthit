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
 *     summary: 리워드 정책 동기화 (Notion → Firestore)
 *     description: |
 *       Notion 자동화에서 호출하여 리워드 정책을 Firestore에 동기화합니다.
 *       - actionKey: 정책 식별자 (예: "comment", "mission_cert", "consecutive_days_5")
 *       - points: 리워드 포인트 (0 이상의 정수)
 *       
 *       **Notion 자동화 설정:**
 *       1. 정책 DB의 행이 생성/수정될 때 트리거
 *       2. HTTP 요청 전송:
 *          - URL: https://<domain>/notionRewardPolicy/sync
 *          - Method: POST
 *          - Body: { "actionKey": "{{__DEV_ONLY__}}", "points": {{나다움}} }
 *     tags: [NotionRewardPolicy]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actionKey
 *               - points
 *             properties:
 *               actionKey:
 *                 type: string
 *                 description: 정책 식별자 (__DEV_ONLY__ 필드 값)
 *                 example: "comment"
 *               points:
 *                 type: number
 *                 description: 리워드 포인트
 *                 example: 10
 *     responses:
 *       200:
 *         description: 동기화 성공
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
 *                     actionKey:
 *                       type: string
 *                       example: "comment"
 *                     points:
 *                       type: number
 *                       example: 10
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-01-20T12:00:00.000Z"
 *       400:
 *         description: 잘못된 요청 (actionKey 누락 등)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "actionKey는 필수이며 문자열이어야 합니다"
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

/**
 * @swagger
 * /notionRewardPolicy/{actionKey}:
 *   get:
 *     summary: 특정 리워드 정책 조회
 *     description: actionKey로 특정 리워드 정책을 조회합니다.
 *     tags: [NotionRewardPolicy]
 *     parameters:
 *       - in: path
 *         name: actionKey
 *         required: true
 *         schema:
 *           type: string
 *         description: 정책 식별자
 *         example: comment
 *     responses:
 *       200:
 *         description: 조회 성공
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
 *                     actionKey:
 *                       type: string
 *                       example: "comment"
 *                     points:
 *                       type: number
 *                       example: 1
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: 정책을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:actionKey', notionRewardPolicyController.getRewardPolicy);

module.exports = router;
