/**
 * @description 마이페이지 달력 관련 유틸리티 함수
 */

export interface CalendarDay {
  date: number;
  dateKey: string;
  imageUrl?: string;
  hasPost: boolean;
  isConsecutive: boolean;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface CalendarDayData {
  [dateKey: string]: {
    imageUrl?: string;
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
 * 달력 그리드 생성
 * @param year 년도
 * @param month 월 (1-12)
 * @param calendarDayData 달력 데이터 (날짜별 이미지 URL 등)
 * @param consecutiveDays 연속 인증 날짜 Set
 * @param todayDateKey 오늘 날짜 키
 * @returns 달력 날짜 배열
 */
export const generateCalendarDays = (
  year: number,
  month: number,
  calendarDayData?: CalendarDayData,
  consecutiveDays: Set<string> = new Set(),
  todayDateKey: string = ""
): CalendarDay[] => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)
  const daysInMonth = lastDay.getDate();

  const days: CalendarDay[] = [];

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
    const isConsecutive = consecutiveDays.has(dateKey);
    const isToday = dateKey === todayDateKey;
    days.push({
      date,
      dateKey,
      imageUrl: dayData?.imageUrl,
      hasPost: Boolean(dayData),
      isConsecutive,
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
