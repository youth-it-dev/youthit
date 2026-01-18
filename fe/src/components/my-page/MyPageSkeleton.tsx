import StatisticsSkeletonItem from "@/components/my-page/StatisticsSkeletonItem";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * @description 마이페이지 스켈레톤 컴포넌트
 */
const MyPageSkeleton = () => {
  return (
    <div className="flex flex-col bg-white pt-7">
      {/* 상단: 프로필 이미지 + 닉네임 + 버튼 + 설정 아이콘 */}
      <div className="flex items-start justify-between gap-3 pb-4">
        {/* 프로필 이미지 + 닉네임 + 프로필 편집 버튼 */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-[75px] w-[75px] shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        {/* 설정 버튼 */}
        <Skeleton className="h-5 w-5 rounded" />
      </div>

      {/* 구분선 */}
      <div className="h-px bg-gray-200" />

      {/* 통계 정보 및 나다움 카드 스켈레톤 */}
      <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-100">
        {/* 통계 정보 스켈레톤 */}
        <div className="flex justify-around py-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <StatisticsSkeletonItem key={index} />
          ))}
        </div>

        {/* 구분선 */}
        <div className="h-px bg-gray-200" />

        {/* 나다움 섹션 스켈레톤 */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPageSkeleton;
