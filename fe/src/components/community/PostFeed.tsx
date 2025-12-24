"use client";

import { memo, useState } from "react";
import ProfileImage from "@/components/shared/ui/profile-image";
import { Skeleton } from "@/components/ui/skeleton";
import { POST_ANONYMOUS_NAME } from "@/constants/shared/_post-constants";
import { CommunityPostListItem } from "@/types/generated/api-schema";
import { cn } from "@/utils/shared/cn";
import { getTimeAgo } from "@/utils/shared/date";
import { isValidImageUrl } from "@/utils/shared/url";
import { Typography } from "../shared/typography";

interface PostFeedProps {
  posts: CommunityPostListItem[];
  onPostClick: (post: CommunityPostListItem) => void;
  isLoading?: boolean;
  skeletonCount?: number;
}

const PostThumbnail = memo(({ src, alt }: { src: string; alt: string }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) return null;

  return (
    <div className="flex-shrink-0">
      <div className="relative h-22 w-22 overflow-hidden rounded-lg bg-gray-100">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
});

PostThumbnail.displayName = "PostThumbnail";

const PostFeed = ({
  posts,
  onPostClick,
  isLoading = false,
  skeletonCount = 3,
}: PostFeedProps) => {
  const handlePostClick = (post: CommunityPostListItem) => {
    onPostClick(post);
  };

  // 로딩 중일 때 스켈레톤 표시
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="relative border-b border-gray-200 bg-white py-5"
          >
            <div className="flex gap-3">
              {/* 텍스트 컨텐츠 영역 */}
              <div className="min-w-0 flex-1">
                {/* 카테고리 태그 스켈레톤 */}
                <div className="mb-2">
                  <Skeleton className="h-6 w-20" />
                </div>

                {/* 제목 스켈레톤 */}
                <div className="mb-2">
                  <Skeleton className="h-6 w-3/4" />
                </div>

                {/* 설명 스켈레톤 (2줄) */}
                <div className="mb-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>

                {/* 작성자/시간 스켈레톤 */}
                <div className="flex items-center gap-2">
                  {/* 프로필 이미지 스켈레톤 */}
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>

              {/* 우측 영역 - 썸네일 및 좋아요/코멘트 */}
              <div className="mb-3 flex flex-col items-end justify-between">
                {/* 썸네일 이미지 스켈레톤 */}
                <div className="flex justify-end">
                  <Skeleton className="h-20 w-20 rounded-lg" />
                </div>
                {/* 액션 아이콘들 스켈레톤 */}
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
  }

  return (
    <div>
      {posts.map((post) => {
        // 신고 처리된 게시글 표시
        if (post.reportsCount && post.reportsCount >= 5) {
          return (
            <div
              key={post.id}
              className={cn(
                "relative cursor-pointer border-b border-gray-200 bg-white py-5 transition-colors hover:bg-gray-50",
                post === posts[posts.length - 1] && "border-b-0"
              )}
            >
              <Typography
                font="noto"
                variant="label1M"
                className="h-9 text-gray-700"
              >
                신고 처리된 게시글 입니다.
              </Typography>
            </div>
          );
        }
        return (
          <div
            key={post.id}
            className={cn(
              "relative cursor-pointer border-b border-gray-200 bg-white py-5 transition-colors hover:bg-gray-50",
              post === posts[posts.length - 1] && "border-b-0"
            )}
            onClick={() => handlePostClick(post)}
          >
            <div className="flex min-h-25 gap-3">
              {/* 텍스트 컨텐츠 */}
              <div className="min-w-0 flex-1">
                {/* 카테고리 태그 */}
                {post.category && (
                  <Typography
                    font="noto"
                    variant="label1M"
                    // text가 배경 기준으로 세로 중앙에 오도록 정렬하기 위해서 line-height를 19px로 설정했음에도 여전히 텍스트가 세로 하단 정렬됨
                    className="text-main-500 bg-main-50 mb-2 flex h-[19px] w-fit items-center rounded-xs p-1 leading-[19px]"
                  >
                    {post.category}
                  </Typography>
                )}

                {/* 제목 */}
                <Typography
                  font="noto"
                  variant="body2B"
                  className="mb-1 line-clamp-1 text-gray-950"
                >
                  {post.title || ""}
                </Typography>

                {/* 설명 (2줄 미리보기) */}
                {post.preview?.description && (
                  <Typography
                    font="noto"
                    variant="caption1R"
                    className="line-clamp-2 text-gray-700"
                  >
                    {post.preview.description}
                  </Typography>
                )}
              </div>

              {/* 우측 영역 - 썸네일 */}
              <div className="mb-3">
                {post.preview?.thumbnail?.url &&
                  isValidImageUrl(post.preview.thumbnail.url) && (
                    <PostThumbnail
                      src={post.preview.thumbnail.url}
                      alt={post.title || ""}
                    />
                  )}
              </div>
            </div>
            {/* 하단 섹션 - 작성자/시간/게시물카운트 데이터 표시부 */}
            <div className="flex justify-between">
              <div className="flex items-center gap-1">
                {/* 유저 프로필사진 */}
                <ProfileImage
                  src={post.profileImageUrl}
                  alt={post.author || ""}
                  size="h-4 w-4"
                />
                <Typography
                  font="noto"
                  variant="label2R"
                  className="text-gray-400"
                >
                  {post.author || POST_ANONYMOUS_NAME}
                </Typography>
                <span className="h-[6px] w-px bg-gray-200" />
                {post.createdAt && (
                  <Typography
                    font="noto"
                    variant="label2R"
                    className="text-gray-400"
                  >
                    {getTimeAgo(post.createdAt)}
                  </Typography>
                )}
              </div>
              {/* 카운트 표시부 - 좋아요/댓글 */}
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
                    {post.likesCount}
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
                    {post.commentsCount}
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

export default memo(PostFeed);
