"use client";

import { Typography } from "@/components/shared/typography";

/**
 * @description QnA가 없을 때 표시하는 메시지 컴포넌트
 */
export const QnAEmptyMessage = () => {
  return (
    <div className="flex items-center justify-center py-12">
      <Typography font="noto" variant="body2R" className="text-gray-500">
        아직 등록된 문의가 없습니다.
      </Typography>
    </div>
  );
};
