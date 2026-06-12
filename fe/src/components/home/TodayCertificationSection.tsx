"use client";
import { useMemo } from "react";
import ProfileImage from "@/components/shared/ui/profile-image";
import { useGetCommunitiesPosts } from "@/hooks/generated/communities-hooks";

const TodayCertificationSection = () => {
  const today = new Date().toISOString().split("T")[0];

  const { data } = useGetCommunitiesPosts({
    request: {
      programType: "ROUTINE",
      size: 100,
    },
    enabled: typeof window !== "undefined",
  });

  const { todayPosts, totalCount } = useMemo(() => {
    const posts = data?.posts || [];
    const todayPosts = posts.filter((post) => {
      if (!post.createdAt) return false;
      return post.createdAt.startsWith(today);
    });
    return {
      todayPosts,
      totalCount: data?.pagination?.totalElements || 0,
    };
  }, [data, today]);

  if (!data) return null;

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
      <p className="mb-3 text-sm font-medium text-gray-700">오늘 함께 인증했어요 🔥</p>
      
      {todayPosts.length > 0 ? (
        <div className="mb-3 flex gap-4 overflow-x-auto pb-1">
          {todayPosts.map((post, index) => (
            <div key={post.id || index} className="flex flex-col items-center gap-1 flex-shrink-0">
              <ProfileImage
                src={post.profileImageUrl}
                alt={post.author || ""}
                size="h-12 w-12"
              />
              <p className="max-w-[48px] truncate text-xs text-gray-600">
                {post.author || "익명"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-gray-400">아직 오늘 인증한 멤버가 없어요</p>
      )}

      <p className="text-xs text-gray-500">누적 인증 {totalCount.toLocaleString()}회</p>
    </div>
  );
};

export default TodayCertificationSection;
