import { Typography } from "@/components/shared/typography";

interface Props {
  /** 요일 텍스트 */
  day: string;
}

/**
 * @description 달력 요일 표시 아이템 컴포넌트
 */
const CalendarWeekDayItem = ({ day }: Props) => {
  return (
    <div className="flex items-center justify-center py-2">
      <Typography font="noto" variant="label2R" className="text-gray-400">
        {day}
      </Typography>
    </div>
  );
};

export default CalendarWeekDayItem;
