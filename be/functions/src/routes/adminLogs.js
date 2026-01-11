const express = require("express");
const adminLogsController = require("../controllers/adminLogsController");
const { runAdminLogsCleanup } = require("../triggers/adminLogsCleanupScheduler");
const router = express.Router();

/**
 * @swagger
 * /adminLogs/sync/adminLogs:
 *   get:
 *     summary: 관리자 로그 동기화
 *     description: |
 *       Firebase의 adminLogs 컬렉션 데이터를 조회하여 Notion 데이터베이스와 동기화합니다.
 *       - adminLogs 컬렉션의 모든 데이터를 조회
 *       - 관리자ID(컬렉션 ID)를 기준으로 노션 데이터베이스에 업데이트
 *     tags: [AdminLogs]
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
 *                   example: "관리자 로그 동기화 완료: 150건"
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
 *                   example: "관리자 로그 동기화 중 오류가 발생했습니다."
 */
router.get("/sync/adminLogs", adminLogsController.syncAdminLogs);


//테스트용 수동 실행 API 엔드포인트
router.post("/cleanup", async (req, res) => {
    try {
      const { maxRecords } = req.body;
      const result = await runAdminLogsCleanup();
      res.success(result, "adminLogs 정리 완료");
    } catch (error) {
      res.error(error, "adminLogs 정리 실패");
    }
  });


module.exports = router;
