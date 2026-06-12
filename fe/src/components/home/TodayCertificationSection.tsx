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
      <p className="mb-2 text-sm font-medium text-gray-700">오늘 함께 인증했어요 🔥</p>
      <div className="mb-2 flex items-center gap-1">
        {todayPosts.slice(0, 6).map((post, index) => (
          <ProfileImage
            key={post.id || index}
            src={post.profileImageUrl}
            alt={post.author || ""}
            size="h-8 w-8"
          />
        ))}
        {todayPosts.length > 6 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
            <p className="text-xs text-gray-600">+{todayPosts.length - 6}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">누적 인증 {totalCount.toLocaleString()}회</p>
    </div>
  );
};

export default TodayCertificationSection;
