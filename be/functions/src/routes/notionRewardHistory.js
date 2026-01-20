const express = require("express");
const notionRewardHistoryController = require("../controllers/notionRewardHistoryController");
const router = express.Router();

/**
 * @swagger
 * /notionRewardHistory/sync:
 *   get:
 *     summary: 리워드 히스토리 동기화
 *     description: |
 *       Firestore의 전체 사용자 리워드 히스토리를 조회하여 Notion 데이터베이스와 동기화합니다.
 *       - additional_point, comment, routine_post, routine_review, gathering_review_media, tmi_review 액션키 대상
 *       - add/deduct changeType 구분하여 지급/차감 타입으로 매핑
 *       - 회원 관리 테이블과 연동하여 사용자 정보 포함
 *     tags: [NotionRewardHistory]
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
 *                   type: string
 *                   example: "리워드 히스토리 동기화 완료: 150개, 실패: 5개 (총 155개)"
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
 *                   example: "리워드 히스토리 동기화 중 오류가 발생했습니다."
 */
router.get("/sync", notionRewardHistoryController.syncRewardHistory);

module.exports = router;

