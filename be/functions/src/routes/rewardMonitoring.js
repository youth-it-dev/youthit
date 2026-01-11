const express = require('express');
const router = express.Router();
const rewardMonitoringController = require('../controllers/rewardMonitoringController');

/**
 * @swagger
 * tags:
 *   name: RewardMonitoring
 *   description: 나다움 포인트 모니터링 엑셀 다운로드 API
 */

/**
 * @swagger
 * /rewardMonitoring/export/store-purchases:
 *   get:
 *     summary: 월별 나다움 스토어 구매 명단 엑셀 다운로드
 *     description: |
 *       특정 월의 나다움 스토어 구매 명단을 엑셀 파일로 다운로드합니다.
 *       
 *       **엑셀 시트 형식:**
 *       | 순번 | 사용자ID | 닉네임 | 이름 | 사용한 나다움 포인트(N) | 상품명 | 구매일 |
 *       |------|----------|--------|------|------------------------|--------|--------|
 *       | 1    | xxx      | 지니   | 홍길동 | 250                   | 문화상품권 2만원권 | 2024-10-10 |
 *     tags: [RewardMonitoring]
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: 조회 월 (YYYY-MM 형식)
 *         example: "2024-10"
 *     responses:
 *       200:
 *         description: 엑셀 파일 다운로드 성공
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: 잘못된 요청 (필수 파라미터 누락 또는 형식 오류)
 *       500:
 *         description: 서버 오류
 */
router.get('/export/store-purchases', rewardMonitoringController.exportStorePurchases);

/**
 * @swagger
 * /rewardMonitoring/export/monthly-summary:
 *   get:
 *     summary: 월별 참여자 나다움 적립/차감 명단 엑셀 다운로드
 *     description: |
 *       지정된 월들의 참여자별 나다움 적립/차감 요약을 엑셀 파일로 다운로드합니다.
 *       
 *       **엑셀 시트 형식:**
 *       | 순번 | 사용자ID | 닉네임 | 이름 | 이전 누적 | 9월 적립 | 9월 사용 | 10월 적립 | 10월 사용 | 현재 보유 |
 *       |------|----------|--------|------|----------|---------|---------|----------|----------|----------|
 *       | 1    | xxx      | 지니   | 홍길동 | 302      | 48      | 250     | 254      | 0        | 350      |
 *     tags: [RewardMonitoring]
 *     parameters:
 *       - in: query
 *         name: months
 *         required: true
 *         schema:
 *           type: string
 *         description: 조회할 월 목록 (콤마 구분, YYYY-MM 형식)
 *         example: "2024-09,2024-10"
 *     responses:
 *       200:
 *         description: 엑셀 파일 다운로드 성공
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: 잘못된 요청 (필수 파라미터 누락 또는 형식 오류)
 *       500:
 *         description: 서버 오류
 */
router.get('/export/monthly-summary', rewardMonitoringController.exportMonthlySummary);

/**
 * @swagger
 * /rewardMonitoring/export/history:
 *   get:
 *     summary: 나다움 적립/차감 내역 엑셀 다운로드
 *     description: |
 *       특정 월의 나다움 적립/차감 상세 내역을 엑셀 파일로 다운로드합니다.
 *       
 *       **엑셀 시트 형식:**
 *       | 순번 | 사용자 ID | 사용자 이름 | 발생 일시 | 소멸 예정 일시 | 수량/금액 | 내역 구분 | 사유 | 관리자 메뉴/부가 설명 |
 *       |------|-----------|------------|----------|---------------|----------|----------|------|----------------------|
 *       | 1    | xxx       | 지니       | 2025-12-08 | 2026-04-07   | 1        | 지급     | 디퀘스트 | 한 끗 루틴유스보이스 |
 *     tags: [RewardMonitoring]
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: 조회 월 (YYYY-MM 형식)
 *         example: "2024-10"
 *     responses:
 *       200:
 *         description: 엑셀 파일 다운로드 성공
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: 잘못된 요청 (필수 파라미터 누락 또는 형식 오류)
 *       500:
 *         description: 서버 오류
 */
router.get('/export/history', rewardMonitoringController.exportRewardHistory);

module.exports = router;

