"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Typography } from "@/components/shared/typography";
import ProfileImage from "@/components/shared/ui/profile-image";
import { Skeleton } from "@/components/ui/skeleton";
import { POST_ANONYMOUS_NAME } from "@/constants/shared/_post-constants";
import type { TGETMissionsPostsRes } from "@/types/generated/missions-types";
import { cn } from "@/utils/shared/cn";
import { getTimeAgo } from "@/utils/shared/date";
import { isValidImageUrl } from "@/utils/shared/url";

type MissionPostItem = NonNullable<TGETMissionsPostsRes["posts"]>[number];

interface MissionFeedSkeletonProps {
  skeletonCount?: number;
}

const MissionFeedSkeleton = ({
  skeletonCount = 3,
}: MissionFeedSkeletonProps) => {
  return (
    <div>
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="relative border-b border-gray-200 bg-white py-5"
        >
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2">
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="mb-2">
                <Skeleton className="h-6 w-3/4" />
              </div>
              <div className="mb-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>

            <div className="mb-3 flex flex-col items-end justify-between">
              <div className="flex justify-end">
                <Skeleton className="h-20 w-20 rounded-lg" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface MissionFeedProps {
  posts: MissionPostItem[];
  onPostClick: (post: MissionPostItem) => void;
  isLoading?: boolean;
  skeletonCount?: number;
}

const MissionFeed = ({
  posts,
  onPostClick,
  isLoading = false,
  skeletonCount = 3,
}: MissionFeedProps) => {
  const PostThumbnail = ({ src, alt }: { src: string; alt: string }) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) return null;

    return (
      <div className="shrink-0">
        <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes="80px"
            onError={() => setHasError(true)}
          />
        </div>
      </div>
    );
  };

  const handlePostClick = (post: MissionPostItem) => {
    onPostClick(post);
  };

  if (isLoading) {
    return <MissionFeedSkeleton skeletonCount={skeletonCount} />;
  }

  return (
    <div>
      {posts.map((post, index) => {
        const isLocked = post?.isLocked === true;

        if (isLocked) {
          return (
            <div
              key={post?.id ?? index}
              className={cn(
                "relative cursor-default border-b border-gray-200 bg-white py-5",
                post === posts[posts.length - 1] && "border-b-0"
              )}
            >
              <Typography
                font="noto"
                variant="label1M"
                className="text-gray-700"
              >
                신고된 게시글 입니다.
              </Typography>
            </div>
          );
        }

        return (
          <div
            key={post?.id ?? index}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 border-b border-gray-200 bg-white py-5 transition-colors hover:bg-gray-50",
              post === posts[posts.length - 1] && "border-b-0"
            )}
            onClick={() => handlePostClick(post)}
          >
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Typography
                  font="noto"
                  variant="body2B"
                  className="mb-1 line-clamp-1 text-gray-950"
                >
                  {post?.title || ""}
                </Typography>

                {post?.preview?.description && (
                  <Typography
                    font="noto"
                    variant="body2R"
                    className="mb-2 line-clamp-2 text-gray-700"
                  >
                    {post.preview.description}
                  </Typography>
                )}

                <div className="flex items-center gap-1">
                  <Typography
                    font="noto"
                    variant="label2R"
                    className="text-gray-400"
                  >
                    미션
                  </Typography>
                  <span className="h-[10px] w-px bg-gray-200" />
                  <Typography
                    font="noto"
                    variant="label2R"
                    className="text-gray-400"
                  >
                    {post.missionTitle}
                  </Typography>
                </div>
              </div>

              <div className="mb-3">
                {post?.preview?.thumbnail?.url &&
                  isValidImageUrl(post.preview.thumbnail.url) && (
                    <PostThumbnail
                      src={post.preview.thumbnail.url}
                      alt={post.title || ""}
                    />
                  )}
              </div>
            </div>

            <div className="flex justify-between">
              <div className="flex items-center gap-1">
                <ProfileImage
                  src={post?.profileImageUrl}
                  alt={post?.author || ""}
                  size="h-4 w-4"
                />
                <Typography
                  font="noto"
                  variant="label2R"
                  className="text-gray-400"
                >
                  {post?.author || POST_ANONYMOUS_NAME}
                </Typography>
                <span className="h-[6px] w-px bg-gray-200" />
                {post?.createdAt && (
                  <Typography
                    font="noto"
                    variant="label2R"
                    className="text-gray-400"
                  >
                    {getTimeAgo(post.createdAt)}
                  </Typography>
                )}
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <span className="text-xs text-gray-400">
                    {post?.mediaCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span className="text-xs text-gray-400">
                    {post?.commentsCount ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default memo(MissionFeed);
