import { Skeleton } from "@/components/ui/skeleton";

/**
 * @description 통계 정보 스켈레톤 아이템 컴포넌트
 */
const StatisticsSkeletonItem = () => {
  return (
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="h-5 w-12" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
};

export default StatisticsSkeletonItem;
