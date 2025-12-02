/**
 * Utility Helpers
 * 순수 유틸리티 함수들을 모아놓은 파일입니다.
 *
 * 참고:
 * - Response 관련: middleware/responseHandler.js 사용
 * - Error 관련: middleware/errorHandler.js 사용
 */

const {admin, Timestamp, db} = require("../config/database");

// Cloud Storage 관련 상수
const SIGNED_URL_EXPIRY_HOURS = 1; // 서명된 URL 만료 시간 (시간)

/**
 * 미션 상태 검증
 * @param {string} status - 미션 상태
 * @return {boolean} 유효성 여부
 */
const validateMissionStatus = (status) => {
  const validStatuses = ["ONGOING", "COMPLETED", "EXPIRED", "RETRY"];
  return validStatuses.includes(status);
};

/**
 * 이메일 형식 검증
 * @param {string} email - 이메일 주소
 * @return {boolean} 유효성 여부
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 전화번호 형식 검증
 * @param {string} phoneNumber - 전화번호
 * @return {boolean} 유효성 여부
 */
const isValidPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  // 한국용 정규화 먼저 수행
  const normalized = normalizeKoreanPhoneNumber(phoneNumber);

  // 숫자만 추출
  const numbers = normalized.replace(/\D/g, '');
  
  // 한국 휴대폰 번호 패턴: 010-XXXX-XXXX (11자리)
  if (numbers.length === 11 && numbers.startsWith('010')) {
    return true;
  }
  
  // 한국 지역번호 패턴 (9-10자리)
  // 02: 서울 (9자리), 그 외 지역 (10자리)
  if (numbers.length === 9 && numbers.startsWith('02')) {
    return true;
  }
  
  if (numbers.length === 10 && !numbers.startsWith('02') && !numbers.startsWith('010')) {
    return true;
  }
  
  return false;
};

/**
 * 한국 전화번호 정규화
 * - 공백/하이픈 등 제거
 * - +82 또는 82 국가코드를 국내 0 프리픽스로 변환
 * @param {string} phone - 원본 전화번호
 * @return {string} 정규화된 국내형 번호
 */
const normalizeKoreanPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  const rawClean = phone.replace(/[^0-9+]/g, '');
  if (rawClean.startsWith('+82')) return '0' + rawClean.slice(3);
  if (rawClean.startsWith('82')) return '0' + rawClean.slice(2);
  return rawClean;
};

/**
 * 고유 ID 생성 (타임스탬프 기반)
 * @return {string} 생성된 ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * nanoid 함수 (URL-safe unique ID generator)
 * @param {number} length - ID 길이 (기본값: 21)
 * @return {string} 생성된 ID
 */
const nanoid = (length = 21) => {
  const alphabet = 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return id;
};

/**
 * 날짜 포맷팅 (UTC 기준)
 * - 서버 로직의 일관성과 안정성을 위해 UTC 기준으로 동작
 * - 환경(로컬/프로덕션)에 관계없이 동일한 결과 보장
 * @param {Date|string} date - 날짜
 * @return {string} 포맷된 날짜 (YYYY-MM-DD)
 * @throws {Error} 유효하지 않은 날짜인 경우
 */
const formatDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("유효하지 않은 날짜입니다");
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Firestore Timestamp를 Date 객체로 변환
 * @param {Timestamp|Date|string} timestamp - Firestore Timestamp 또는 Date
 * @return {Date} Date 객체
 * @throws {Error} timestamp가 없거나 유효하지 않은 경우
 */
const toDate = (timestamp) => {
  if (!timestamp) {
    throw new Error('timestamp is required (do not use client-side default time)');
  }
  
  // Firestore Timestamp 객체인 경우
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // Date 객체 또는 문자열인 경우
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp value');
  }
  
  return date;
};

/**
 * UTC 기준 오늘 00:00:00 계산
 * @param {Date} date - 기준 날짜 (필수, 서버 타임스탬프 전달)
 * @return {Date} UTC 기준 오늘 00:00:00
 * @throws {Error} date가 없거나 유효하지 않은 경우
 */
const getStartOfDayUTC = (date) => {
  if (!date) {
    throw new Error('date parameter is required (do not use client-side default time)');
  }
  
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('date must be a valid Date object');
  }
  
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
};

/**
 * UTC 기준 내일 00:00:00 계산
 * @param {Date} date - 기준 날짜 (필수, 서버 타임스탬프 전달)
 * @return {Date} UTC 기준 내일 00:00:00
 * @throws {Error} date가 없거나 유효하지 않은 경우
 */
const getStartOfNextDayUTC = (date) => {
  if (!date) {
    throw new Error('date parameter is required (do not use client-side default time)');
  }
  
  const today = getStartOfDayUTC(date);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow;
};

/**
 * 배열을 청크로 분할
 * @param {array} array - 분할할 배열
 * @param {number} size - 청크 크기
 * @return {array} 청크 배열
 * @throws {Error} size가 1 이상의 정수가 아닌 경우
 */
const chunkArray = (array, size) => {
  const chunkSize = Number(size);
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("chunk size는 1 이상의 정수여야 합니다");
  }
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * 객체에서 null/undefined 값 제거
 * @param {object} obj - 정리할 객체
 * @return {object} 정리된 객체
 */
const removeNullValues = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

/**
 * 딥 클론 (간단한 구현)
 * @param {object} obj - 복사할 객체
 * @return {object} 복사된 객체
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 전화번호 마스킹 (PII 보호)
 * @param {string} phoneNumber - 마스킹할 전화번호
 * @return {string} 마스킹된 전화번호
 */
const maskPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber;
  }

  // 숫자만 추출
  const numbers = phoneNumber.replace(/\D/g, '');
  
  // 한국 전화번호 패턴 (010-XXXX-XXXX 또는 010XXXXXXXX)
  if (numbers.length === 11 && numbers.startsWith('010')) {
    return `010-****-${numbers.slice(-4)}`;
  }
  
  // 다른 길이의 전화번호는 중간 부분을 마스킹
  if (numbers.length >= 8) {
    const start = numbers.slice(0, 3);
    const end = numbers.slice(-4);
    const middle = '*'.repeat(Math.max(4, numbers.length - 7));
    return `${start}-${middle}-${end}`;
  }
  
  // 너무 짧은 번호는 부분적으로만 마스킹
  if (numbers.length >= 4) {
    const visible = numbers.slice(-2);
    const masked = '*'.repeat(numbers.length - 2);
    return `${masked}${visible}`;
  }
  
  // 4자리 미만은 전체 마스킹
  return '*'.repeat(numbers.length);
};

/**
 * UTC 20:00 기준으로 날짜를 변환하여 YYYY-MM-DD 형식으로 반환
 * 
 * 미션 연속일자 계산 등에서 사용되며, UTC 20:00 이전 시간은 전날로 간주합니다.
 * UTC 20:00는 한국 시간 새벽 5시와 동일합니다.
 * 예: 2024-01-01 19:59 UTC → 2023-12-31, 2024-01-01 20:00 UTC → 2024-01-01
 * 
 * @param {Date|Timestamp|string} dateValue - 변환할 날짜 (Date, Firestore Timestamp, 또는 ISO string)
 * @returns {string|null} YYYY-MM-DD 형식의 날짜 문자열, 변환 실패 시 null
 */
function getDateKeyByUTC(dateValue) {
  if (!dateValue) return null;

  try {
    // Firestore Timestamp 처리
    let date;
    if (typeof dateValue === "object" && typeof dateValue.toDate === "function") {
      date = dateValue.toDate();
    } else if (typeof dateValue === "object" && dateValue.seconds) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    // UTC 기준 연/월/일/시 추출
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcHour = date.getUTCHours();

    // UTC 20:00 기준으로 날짜 조정 (20:00 이전은 전날로 간주)
    let targetYear = utcYear;
    let targetMonth = utcMonth;
    let targetDay = utcDay;

    if (utcHour < 20) {
      // 전날로 조정
      const prevDay = new Date(Date.UTC(utcYear, utcMonth, utcDay));
      prevDay.setUTCDate(prevDay.getUTCDate() - 1);
      targetYear = prevDay.getUTCFullYear();
      targetMonth = prevDay.getUTCMonth();
      targetDay = prevDay.getUTCDate();
    }

    // YYYY-MM-DD 형식으로 반환
    const year = targetYear.toString();
    const month = String(targetMonth + 1).padStart(2, "0");
    const day = String(targetDay).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn("[getDateKeyByUTC] 날짜 변환 실패:", error);
    return null;
  }
}

/**
 * UTC 20:00 기준으로 오늘 날짜를 계산하여 Date로 반환
 * 
 * 현재 시간이 UTC 20:00 이전이면 전날을 "오늘"로 간주합니다.
 * UTC 20:00는 한국 시간 새벽 5시와 동일합니다.
 * 미션 일일 리셋 및 연속일자 계산에 사용됩니다.
 * 날짜 키 계산에만 사용되므로 Date를 반환합니다.
 * 
 * @param {Date|Timestamp} [dateOrTimestamp] - 기준 시간 (기본값: 현재 시간)
 * @returns {Date} UTC 20:00 기준 오늘 날짜 (시,분,초,밀리초는 0으로 설정)
 */
function getTodayByUTC(dateOrTimestamp = null) {
  // Date 또는 Timestamp가 제공되지 않으면 현재 시간 사용
  let now;
  if (dateOrTimestamp) {
    if (typeof dateOrTimestamp.toDate === "function") {
      // Timestamp인 경우
      now = dateOrTimestamp.toDate();
    } else {
      // Date인 경우
      now = dateOrTimestamp;
    }
  } else {
    now = new Date();
  }
  
  // UTC 기준으로 날짜 계산
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDay = now.getUTCDate();
  const utcHour = now.getUTCHours();

  // UTC 20:00 이전이면 전날로 간주
  let targetYear = utcYear;
  let targetMonth = utcMonth;
  let targetDay = utcDay;

  if (utcHour < 20) {
    const prevDay = new Date(Date.UTC(utcYear, utcMonth, utcDay));
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    targetYear = prevDay.getUTCFullYear();
    targetMonth = prevDay.getUTCMonth();
    targetDay = prevDay.getUTCDate();
  }

  // UTC 20:00으로 설정
  return new Date(Date.UTC(targetYear, targetMonth, targetDay, 20, 0, 0, 0));
}

/**
 * 사용자가 관리자(admin)인지 확인
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 관리자 여부
 */
async function isAdminUser(userId) {
  if (!userId) {
    return false;
  }
  
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData?.userType === 'admin';
  } catch (error) {
    console.warn("[isAdminUser] 사용자 조회 실패:", error.message);
    return false;
  }
}

module.exports = {
  // Validation
  validateMissionStatus,
  isValidEmail,
  isValidPhoneNumber,
  normalizeKoreanPhoneNumber,

  // ID 생성
  generateId,
  nanoid,

  // 날짜/시간
  formatDate,
  toDate,
  getStartOfDayUTC,
  getStartOfNextDayUTC,
  getDateKeyByUTC,
  getTodayByUTC,

  // PII 보호
  maskPhoneNumber,

  // 배열/객체 유틸리티
  chunkArray,
  removeNullValues,
  deepClone,

  // 사용자 권한
  isAdminUser,

};

