import dayjs from "dayjs";
/**
 * @description 마이페이지 달력 관련 유틸리티 함수
 */

export interface CalendarDay {
  date: number;
  dateKey: string;
  imageUrl?: string;
  postId?: string;
  communityId?: string;
  hasPost: boolean;
  isConsecutive: boolean;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface CalendarDayData {
  [dateKey: string]: {
    imageUrl?: string;
    postId?: string;
    communityId?: string;
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
 * @param todayDateKey 오늘 날짜 키
 * @returns 달력 날짜 배열
 */
export const generateCalendarDays = (
  year: number,
  month: number,
  calendarDayData?: CalendarDayData,
  todayDateKey: string = ""
): CalendarDay[] => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)
  const daysInMonth = lastDay.getDate();

  const days: CalendarDay[] = [];

  // 인증한 날짜 키 목록 추출
  const certifiedDateKeys = calendarDayData
    ? Object.keys(calendarDayData).filter(
        (key) => calendarDayData[key]?.imageUrl
      )
    : [];
  const certifiedDateSet = new Set(certifiedDateKeys);

  // 연속 인증 여부 확인 헬퍼 함수
  const isConsecutiveDay = (dateKey: string): boolean => {
    if (!certifiedDateSet.has(dateKey)) return false;

    // dayjs를 사용하여 안전하게 날짜 계산
    // YYYY-MM-DD 형식을 파싱하여 이전/다음 날짜 계산
    const currentDate = dayjs(dateKey);
    const prevDate = currentDate.subtract(1, "day");
    const nextDate = currentDate.add(1, "day");

    const prevDateKey = generateDateKey(
      prevDate.year(),
      prevDate.month() + 1, // dayjs는 0-based month
      prevDate.date()
    );
    const nextDateKey = generateDateKey(
      nextDate.year(),
      nextDate.month() + 1, // dayjs는 0-based month
      nextDate.date()
    );

    // 이전 날짜나 다음 날짜 중 하나라도 인증이 있으면 연속 인증
    return (
      certifiedDateSet.has(prevDateKey) || certifiedDateSet.has(nextDateKey)
    );
  };

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
    const hasPost = Boolean(dayData?.imageUrl);
    const isToday = dateKey === todayDateKey;
    const isConsecutive = hasPost && isConsecutiveDay(dateKey);
    days.push({
      date,
      dateKey,
      imageUrl: dayData?.imageUrl,
      postId: dayData?.postId,
      communityId: dayData?.communityId,
      hasPost,
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
