import { Typography } from "@/components/shared/typography";

interface InfoItemProps {
  label: string;
  value: string;
}

/**
 * @description 설정 페이지에서 사용하는 정보 표시 아이템
 */
export const InfoItem = ({ label, value }: InfoItemProps) => (
  <div className="flex items-baseline py-4">
    <Typography font="noto" variant="body1R" className="w-29 text-gray-500">
      {label}
    </Typography>
    <Typography font="noto" variant="body1R" className="text-gray-950">
      {value}
    </Typography>
  </div>
);
