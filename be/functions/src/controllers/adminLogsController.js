const adminLogsService = require("../services/adminLogsService.js");
const {successResponse} = require("../utils/helpers");
const {db} = require("../config/database");


class AdminLogsController {


    async syncAdminLogs(req, res, next) {
        try {
          const result = await adminLogsService.syncAdminLogs();
          res.success(`관리자 로그 동기화 완료: ${result.successCount}건, 동기화 실패: ${result.failedCount}건`);
        } catch (error) {
          console.error("[Controller Error] syncAdminLogs:", error);
          next(error);
        }
      }

}

module.exports = new AdminLogsController();