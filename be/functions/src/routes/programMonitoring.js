const express = require('express');
const router = express.Router();
const programMonitoringController = require('../controllers/programMonitoringController');

/**
 * @swagger
 * tags:
 *   name: ProgramMonitoring
 *   description: 프로그램 모니터링 엑셀 다운로드 API
 */

/**
 * @swagger
 * /programMonitoring/export:
 *   get:
 *     summary: 프로그램 참가자 인증 현황 엑셀 다운로드
 *     description: |
 *       특정 프로그램의 참가자들의 일별 인증글 작성 현황을 엑셀 파일로 다운로드합니다.
 *       
 *       **엑셀 시트 형식:**
 *       | 닉네임 | 이름   | 10.15 | 10.16 | 10.17 | ... | 인증개수 |
 *       |--------|--------|-------|-------|-------|-----|----------|
 *       | 신규   | 오서빈 | TRUE  | TRUE  | FALSE | ... | 14       |
 *       | 이경   | 이경래 | TRUE  | FALSE | TRUE  | ... | 11       |
 *       
 *       **날짜 범위:**
 *       - programId만 제공: 프로그램 활동 기간 전체
 *       - month만 제공: 해당 월 1일~말일 (전체 프로그램 대상)
 *       - 둘 다 제공: 프로그램 활동 기간과 해당 월의 교집합
 *       - 둘 중 하나 이상은 필수입니다.
 *       
 *       **노션 버튼 연동:**
 *       노션에서 아래 URL을 버튼에 연결하면 바로 다운로드가 가능합니다:
 *       ```
 *       https://your-api-domain.com/programMonitoring/export?programId={프로그램ID}&month=2024-10
 *       ```
 *     tags: [ProgramMonitoring]
 *     parameters:
 *       - in: query
 *         name: programId
 *         required: false
 *         schema:
 *           type: string
 *         description: 프로그램 ID (Notion 페이지 ID 또는 Firestore community ID). 생략 시 전체 프로그램 대상
 *         example: "1234abcd-5678-efgh-ijkl-9012mnop3456"
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: 조회 월 (YYYY-MM 형식). programId와 month 중 하나 이상 필수
 *         example: "2024-10"
 *     responses:
 *       200:
 *         description: 엑셀 파일 다운로드 성공
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: 파일명이 포함된 다운로드 헤더
 *             schema:
 *               type: string
 *               example: "attachment; filename*=UTF-8''monitoring_program_2024-10.xlsx"
 *       400:
 *         description: 잘못된 요청 (필수 파라미터 누락 또는 형식 오류)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "programId 또는 month 파라미터 중 하나 이상이 필요합니다."
 *                 code:
 *                   type: string
 *                   example: "BAD_REQUEST"
 *       500:
 *         description: 서버 오류 (Firestore 인덱스 누락 등)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Firestore 인덱스가 필요합니다."
 *                 code:
 *                   type: string
 *                   example: "MISSING_FIRESTORE_INDEX"
 */
router.get('/export', programMonitoringController.exportProgramMonitoring);

module.exports = router;
