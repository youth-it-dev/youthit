"use client";

import { useMemo } from "react";
import ProfileImage from "@/components/shared/ui/profile-image";
import { Typography } from "@/components/shared/typography";
import { useGetCommunitiesPosts } from "@/hooks/generated/communities-hooks";

/**
 * @description 오늘 인증 멤버 프로필 + 누적 인증 수 표시 섹션
 */
const TodayCertificationSection = () => {
  const today = new Date().toISOString().split("T")[0];

  const { data } = useGetCommunitiesPosts({
    request: {
      programType: "ROUTINE",
      size: 100,
    },
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
    <div className="mx-4 mb-4 rounded-2xl bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
      <Typography font="noto" variant="label1M" className="mb-2 text-gray-700">
        오늘 함께 인증했어요 🔥
      </Typography>

      {todayPosts.length > 0 ? (
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
              <Typography font="noto" variant="caption1M" className="text-gray-600">
                +{todayPosts.length - 6}
              </Typography>
            </div>
          )}
        </div>
      ) : (
        <Typography font="noto" variant="caption1M" className="mb-2 text-gray-400">
          아직 오늘 인증한 멤버가 없어요
        </Typography>
      )}

      <Typography font="noto" variant="caption1M" className="text-gray-500">
        누적 인증 {totalCount.toLocaleString()}회
      </Typography>
    </div>
  );
};

export default TodayCertificationSection;
