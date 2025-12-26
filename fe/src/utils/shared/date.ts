/**
 * @description 날짜 문자열 또는 Date 객체를 Date 객체로 변환
 */
const toDate = (date: string | Date | undefined): Date => {
  if (!date) return new Date();
  return typeof date === "string" ? new Date(date) : date;
};

/**
 * @description 요일 이름 배열
 */
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * @description 시간 관련 상수 (밀리초)
 */
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;

/**
 * 시간 차이를 계산하여 문자열로 반환
 * 24시간 이내: "~시간 전", "~분 전" 등
 * 24시간 이상: "MM월 DD일" 형식
 *
 * @param date - ISO 8601 문자열 또는 Date 객체
 * @returns 시간 차이 문자열
 */
export const getTimeAgo = (date: string | Date): string => {
  const targetDate = toDate(date);
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - targetDate.getTime()) / 1000
  );

  // 24시간 이내
  if (diffInSeconds < 60) {
    return "방금 전";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}분 전`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}시간 전`;
  }

  // 24시간 이상: "MM월 DD일" 형식
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  return `${month}월 ${day}일`;
};

/**
 * ISO 8601 문자열을 "YYYY년 MM월 DD일" 형식으로 변환
 */
export const formatDate = (date: string | Date): string => {
  const targetDate = toDate(date);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  return `${year}년 ${month}월 ${day}일`;
};

/**
 * 날짜를 "MM.DD.요일" 형식으로 변환
 * @param dateString - ISO 8601 문자열 또는 Date 객체
 * @returns "MM.DD.요일" 형식의 문자열
 */
export const formatDateWithDay = (dateString?: string | Date): string => {
  if (!dateString) return "";
  const date = toDate(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dayName = DAY_NAMES[date.getDay()];
  return `${month}.${day}.${dayName}요일`;
};

/**
 * 날짜 범위를 "MM.DD ~ MM.DD" 형식으로 변환
 * @param startDate - 시작 날짜 (ISO 8601 문자열 또는 Date 객체)
 * @param endDate - 종료 날짜 (ISO 8601 문자열 또는 Date 객체)
 * @returns "MM.DD ~ MM.DD" 형식의 문자열
 */
export const formatDateRange = (
  startDate?: string | Date,
  endDate?: string | Date
): string => {
  if (!startDate || !endDate) return "";
  const start = toDate(startDate);
  const end = toDate(endDate);
  const startMonth = String(start.getMonth() + 1).padStart(2, "0");
  const startDay = String(start.getDate()).padStart(2, "0");
  const endMonth = String(end.getMonth() + 1).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");
  return `${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
};

/**
 * 현재 날짜/시간을 포맷팅하여 반환
 * @param suffix - 날짜/시간 뒤에 붙일 접미사 (기본값: " 수정 중")
 * @returns 포맷된 날짜/시간 문자열 (예: "2024.01.01(월) 12:00 수정 중")
 */
export const getCurrentDateTime = (suffix = " 수정 중"): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dayName = DAY_NAMES[now.getDay()];
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day}(${dayName}) ${hours}:${minutes}${suffix}`;
};

/**
 * 현재 시간으로부터 지정된 시간만큼 후의 Date 객체를 반환
 * @param hours 시간
 * @param minutes 분
 * @param seconds 초
 * @returns 미래의 Date 객체
 */
export const getFutureDate = (
  hours: number,
  minutes: number,
  seconds: number
): Date => {
  return new Date(
    Date.now() + hours * HOUR_MS + minutes * MINUTE_MS + seconds * SECOND_MS
  );
};

/**
 * 시작 시간에서 다음날 새벽 5시까지의 Date 객체를 반환
 * @param startedAt - 시작 시간 (ISO 8601 문자열 또는 Date 객체)
 * @returns 다음날 새벽 5시의 Date 객체
 */
export const getNextDay5AM = (startedAt: string | Date): Date => {
  const startDate = toDate(startedAt);
  const nextDay = new Date(startDate);

  // 다음날로 이동
  nextDay.setDate(nextDay.getDate() + 1);

  // 새벽 5시로 설정
  nextDay.setHours(5, 0, 0, 0);

  return nextDay;
};

/**
 * 현재 시간 기준으로 다음 인증 마감 시간(새벽 4시 59분)의 Date 객체를 반환
 * - 현재 시간이 새벽 4시 59분 이전이면 → 오늘 새벽 4시 59분
 * - 현재 시간이 새벽 4시 59분 이후이면 → 내일 새벽 4시 59분
 * @returns 다음 인증 마감 시간(새벽 4시 59분)의 Date 객체
 */
export const getTomorrow4AM59 = (): Date => {
  const now = new Date();
  const target = new Date();

  // 오늘 새벽 4시 59분으로 설정
  target.setHours(4, 59, 0, 0);

  // 현재 시간이 오늘 새벽 4시 59분 이전이면 오늘 새벽 4시 59분 반환
  // 현재 시간이 오늘 새벽 4시 59분 이후이면 내일 새벽 4시 59분 반환
  if (now.getTime() < target.getTime()) {
    return target;
  }

  // 내일로 이동
  target.setDate(target.getDate() + 1);
  return target;
};

/**
 * 날짜를 "M월 D일 (요일) H시" 형식으로 변환
 * @param dateString - ISO 8601 문자열 또는 Date 객체
 * @returns "M월 D일 (요일) H시" 형식의 문자열 (예: "11월 12일 (수) 9시")
 */
export const formatDateTimeWithDay = (dateString?: string | Date): string => {
  if (!dateString) return "";
  const date = toDate(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const dayName = DAY_NAMES[date.getDay()];
  return `${month}월 ${day}일 (${dayName}) ${hour}시`;
};

/**
 * 날짜를 "M/D" 형식으로 변환
 * @param dateString - ISO 8601 문자열 또는 Date 객체
 * @returns "M/D" 형식의 문자열 (예: "11/12")
 */
export const formatDateSlash = (dateString?: string | Date): string => {
  if (!dateString) return "";
  const date = toDate(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
};

/**
 * 날짜를 "YYYY.MM.DD(요일)" 형식으로 변환
 * @param dateString - ISO 8601 문자열 또는 Date 객체
 * @returns "YYYY.MM.DD(요일)" 형식의 문자열 (예: "2025.10.23(수)")
 */
export const formatDateWithDayKorean = (dateString?: string | Date): string => {
  if (!dateString) return "";
  const date = toDate(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dayName = DAY_NAMES[date.getDay()];
  return `${year}.${month}.${day}(${dayName})`;
};

/**
 * 날짜를 두 줄 형식으로 변환 (타임스탬프용)
 * @param dateString - ISO 8601 문자열 또는 Date 객체 (기본값: 현재 시간)
 * @returns 두 줄 형식의 타임스탬프 객체
 *   - line1: "YYYY년 MM월 DD일(요일)" (예: "2025년 12월 26일(금)")
 *   - line2: "오전/오후 H:mm" (예: "오후 1:21")
 */
export const formatTimestampTwoLines = (
  dateString?: string | Date
): { line1: string; line2: string } => {
  const date = toDate(dateString);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayName = DAY_NAMES[date.getDay()];

  const hours24 = date.getHours();
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const ampm = hours24 >= 12 ? "오후" : "오전";
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return {
    line1: `${year}년 ${month}월 ${day}일(${dayName})`,
    line2: `${ampm} ${hours12}:${minutes}`,
  };
};
