/**
 * Admin Log 관련 상수 정의
 */
const ADMIN_LOG_CONSTANTS = {
    // 최대 유지할 관리자 로그 개수
    MAX_ADMIN_LOGS_COUNT: 1000,
    
    // 배치 삭제 크기 (Firestore batch write 최대 500개)
    CLEANUP_BATCH_SIZE: 500,
    
    // 배치 사이 지연 시간 (밀리초) - Firestore rate limit 방지
    CLEANUP_BATCH_DELAY_MS: 1000,
  };
  
  module.exports = {
    ADMIN_LOG_CONSTANTS,
  };