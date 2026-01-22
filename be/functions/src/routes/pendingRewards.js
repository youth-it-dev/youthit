const express = require('express');
const router = express.Router();
const pendingRewardController = require('../controllers/pendingRewardController');
const authGuard = require('../middleware/authGuard');

/**
 * @swagger
 * tags:
 *   name: PendingRewards
 *   description: 나다움 부여 실패 건 관리 API (재시도)
 */

/**
 * @swagger
 * /pendingRewards/list:
 *   get:
 *     summary: 실패/대기 중인 나다움 목록 조회
 *     description: |
 *       나다움 부여 실패 또는 대기 중인 항목 목록을 조회합니다.
 *     tags: [PendingRewards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, failed, pending]
 *           default: all
 *         description: 조회할 상태 (all, failed, pending)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: 조회 개수 제한
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 failed:
 *                   type: array
 *                   description: 최종 실패한 항목 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: 문서 ID
 *                       userId:
 *                         type: string
 *                         description: 사용자 ID
 *                       actionKey:
 *                         type: string
 *                         description: 액션 키
 *                       status:
 *                         type: string
 *                         description: 상태
 *                       retryCount:
 *                         type: integer
 *                         description: 재시도 횟수
 *                       lastError:
 *                         type: string
 *                         description: 마지막 에러 메시지
 *                 pending:
 *                   type: array
 *                   description: 재시도 대기 중인 항목 목록
 *                   items:
 *                     type: object
 */
router.get('/list', authGuard, pendingRewardController.getList);

/**
 * @swagger
 * /pendingRewards/stats:
 *   get:
 *     summary: 나다움 재시도 통계 조회
 *     description: |
 *       상태별 나다움 재시도 건수를 조회합니다.
 *     tags: [PendingRewards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pending:
 *                   type: integer
 *                 processing:
 *                   type: integer
 *                 completed:
 *                   type: integer
 *                 failed:
 *                   type: integer
 */
router.get('/stats', authGuard, pendingRewardController.getStats);

/**
 * @swagger
 * /pendingRewards/retry-all:
 *   post:
 *     summary: 전체 실패 건 일괄 재시도 (노션 버튼용)
 *     description: |
 *       모든 실패 및 대기 중인 나다움 부여 건을 일괄 재시도합니다.
 *       
 *       **노션 버튼 연동:**
 *       ```
 *       https://your-api-domain.com/pendingRewards/retry-all
 *       ```
 *     tags: [PendingRewards]
 *     responses:
 *       200:
 *         description: 일괄 재시도 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalProcessed:
 *                   type: integer
 *                   description: 처리된 총 항목 수
 *                 successCount:
 *                   type: integer
 *                   description: 성공한 항목 수
 *                 failCount:
 *                   type: integer
 *                   description: 실패한 항목 수
 *                 results:
 *                   type: array
 *                   description: 각 항목별 처리 결과
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: 문서 ID
 *                       userId:
 *                         type: string
 *                         description: 사용자 ID
 *                       actionKey:
 *                         type: string
 *                         description: 액션 키
 *                       success:
 *                         type: boolean
 *                         description: 성공 여부
 *                       amount:
 *                         type: integer
 *                         description: 부여된 나다움 (성공 시)
 *                       error:
 *                         type: string
 *                         description: 에러 메시지 (실패 시)
 */
router.post('/retry-all', pendingRewardController.retryAll);

/**
 * @swagger
 * /pendingRewards/retry-selected:
 *   post:
 *     summary: Notion에서 선택된 항목 일괄 재시도 (노션 체크박스 선택용)
 *     description: |
 *       Notion "나다움 지급 실패 목록" DB에서 '선택' 체크박스가 체크된 항목들을 일괄 재시도합니다.
 *       성공한 항목은 체크박스가 자동으로 해제되고 상태가 '성공'으로 변경됩니다.
 *       
 *       **노션 버튼 연동:**
 *       ```
 *       https://your-api-domain.com/pendingRewards/retry-selected
 *       ```
 *       
 *       **사용 방법:**
 *       1. Notion에서 재시도할 항목의 '선택' 체크박스를 체크
 *       2. 이 API를 호출 (노션 버튼 또는 직접 호출)
 *       3. 성공한 항목은 체크박스 해제 + 상태 '성공'으로 변경
 *     tags: [PendingRewards]
 *     responses:
 *       200:
 *         description: 선택된 항목 일괄 재시도 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalProcessed:
 *                   type: integer
 *                   description: 처리된 총 항목 수
 *                 successCount:
 *                   type: integer
 *                   description: 성공한 항목 수
 *                 failCount:
 *                   type: integer
 *                   description: 실패한 항목 수
 *                 results:
 *                   type: array
 *                   description: 각 항목별 처리 결과
 */
router.post('/retry-selected', pendingRewardController.retrySelected);

module.exports = router;
