const express = require("express");
const rewardController = require("../controllers/rewardController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Rewards
 *   description: 나다움 리워드 정책/히스토리 API
 */

/**
 * @swagger
 * /rewards/policies:
 *   get:
 *     summary: 나다움 리워드 정책 조회
 *     description: |
 *       Notion 리워드 정책 DB에서 "정책 적용 상태"가 "적용 완료"인 항목 중 댓글/루틴/소모임/TMI 관련 사용자 행동만 조회합니다.
 *       - 댓글 작성, 한끗루틴 인증/후기, 소모임 후기, TMI 리뷰에 대한 나다움 포인트를 반환합니다.
 *     tags: [Rewards]
 *     responses:
 *       200:
 *         description: 리워드 정책 조회 성공
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
 *                     policies:
 *                       type: array
 *                       description: 나다움 리워드 정책 목록
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             description: "사용자 행동 이름 (예: 댓글 작성, 한끗루틴 인증글 작성)"
 *                             example: "댓글 작성"
 *                           points:
 *                             type: number
 *                             description: 해당 행동으로 지급되는 나다움 포인트
 *                             example: 10
 *       500:
 *         description: 서버 오류 또는 Notion API 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/policies", rewardController.getRewardPolicies);

module.exports = router;

