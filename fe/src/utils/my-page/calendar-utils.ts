/**
 * @description 마이페이지 달력 관련 유틸리티 함수
 */

export interface CalendarDay {
  date: number;
  dateKey: string;
  imageUrl?: string;
  postId?: string;
  hasPost: boolean;
  isConsecutive: boolean;
  consecutiveDayNumber?: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface CalendarDayData {
  [dateKey: string]: {
    imageUrl?: string;
    postId?: string;
  };
}

/**
 * 날짜 키 생성 (YYYY-MM-DD 형식)
 */
export const generateDateKey = (
  year: number,
  month: number,
  date: number
): string => {
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
};

/**
 * 연속 인증 날짜별 번호 계산 (가장 최근 연속 집합에만 번호 부여)
 * @param dateKeys 인증한 날짜 키 배열 (YYYY-MM-DD 형식, 정렬되어 있어야 함)
 * @returns 날짜 키를 key로, 연속 인증 번호를 value로 하는 Map
 */
export const calculateConsecutiveDayNumbers = (
  dateKeys: string[]
): Map<string, number> => {
  const result = new Map<string, number>();

  if (dateKeys.length === 0) return result;

  const sortedDateKeys = [...dateKeys].sort();

  const allStreaks: string[][] = [];
  let currentStreak: string[] = [];

  sortedDateKeys.forEach((dateKey) => {
    const currentDate = new Date(dateKey);

    if (currentStreak.length === 0) {
      // 첫 번째 날짜 또는 새로운 연속 시작
      currentStreak = [dateKey];
    } else {
      const lastDateKey = currentStreak[currentStreak.length - 1];
      const lastDate = new Date(lastDateKey);

      // 날짜 차이 계산 (일 단위)
      const diffTime = currentDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // 연속된 날짜
        currentStreak.push(dateKey);
      } else {
        // 연속이 끊김 - 현재 연속을 저장하고 새로운 연속 시작
        if (currentStreak.length >= 2) {
          allStreaks.push([...currentStreak]);
        }
        currentStreak = [dateKey];
      }
    }
  });

  // 마지막 연속 집합 저장
  if (currentStreak.length >= 2) {
    allStreaks.push([...currentStreak]);
  }

  // 가장 최근(마지막) 연속 집합에만 번호 부여
  if (allStreaks.length > 0) {
    const lastStreak = allStreaks[allStreaks.length - 1];
    lastStreak.forEach((key, idx) => {
      result.set(key, idx + 1);
    });
  }

  return result;
};

/**
 * 달력 그리드 생성
 * @param year 년도
 * @param month 월 (1-12)
 * @param calendarDayData 달력 데이터 (날짜별 이미지 URL 등)
 * @param _consecutiveDays 연속 인증 날짜 Set (사용 안 함 - 이제 자동 계산, 하위 호환성을 위해 유지)
 * @param todayDateKey 오늘 날짜 키
 * @returns 달력 날짜 배열
 */
export const generateCalendarDays = (
  year: number,
  month: number,
  calendarDayData?: CalendarDayData,
  _consecutiveDays: Set<string> = new Set(),
  todayDateKey: string = ""
): CalendarDay[] => {
  void _consecutiveDays; // 하위 호환성을 위해 파라미터 유지, 사용하지 않음

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)
  const daysInMonth = lastDay.getDate();

  const days: CalendarDay[] = [];

  // 인증한 날짜들의 키 추출 및 연속 인증 번호 계산
  const certifiedDateKeys = calendarDayData
    ? Object.keys(calendarDayData).filter(
        (key) => calendarDayData[key]?.imageUrl
      )
    : [];
  const consecutiveDayNumbers =
    calculateConsecutiveDayNumbers(certifiedDateKeys);

  // 이전 달의 마지막 날들 (빈 칸 채우기)
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = prevMonthLastDay - i;
    days.push({
      date,
      dateKey: "",
      isCurrentMonth: false,
      hasPost: false,
      isConsecutive: false,
      isToday: false,
    });
  }

  // 현재 달의 날들
  for (let date = 1; date <= daysInMonth; date++) {
    const dateKey = generateDateKey(year, month, date);
    const dayData = calendarDayData?.[dateKey];
    const consecutiveDayNumber = consecutiveDayNumbers.get(dateKey);
    const isConsecutive = consecutiveDayNumber !== undefined;
    const isToday = dateKey === todayDateKey;
    days.push({
      date,
      dateKey,
      imageUrl: dayData?.imageUrl,
      postId: dayData?.postId,
      hasPost: Boolean(dayData?.imageUrl),
      isConsecutive,
      consecutiveDayNumber,
      isCurrentMonth: true,
      isToday,
    });
  }

  // 다음 달의 첫 날들 (빈 칸 채우기)
  const totalCells = Math.ceil(days.length / 7) * 7;
  const remainingCells = totalCells - days.length;
  for (let date = 1; date <= remainingCells; date++) {
    days.push({
      date,
      dateKey: "",
      isCurrentMonth: false,
      hasPost: false,
      isConsecutive: false,
      isToday: false,
    });
  }

  return days;
};
