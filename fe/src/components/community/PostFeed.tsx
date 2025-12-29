"use client";

import { memo, useState } from "react";
import Image from "next/image";
import ProfileImage from "@/components/shared/ui/profile-image";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { POST_ANONYMOUS_NAME } from "@/constants/shared/_post-constants";
import { CommunityPostListItem } from "@/types/generated/api-schema";
import { getTimeAgo } from "@/utils/shared/date";
import { isValidImageUrl } from "@/utils/shared/url";
import { Typography } from "../shared/typography";

interface PostFeedProps {
  posts: CommunityPostListItem[];
  onPostClick: (post: CommunityPostListItem) => void;
  isLoading?: boolean;
  skeletonCount?: number;
}

const PostThumbnail = memo(
  ({
    src,
    alt,
    imageCount = 1,
  }: {
    src: string;
    alt: string;
    imageCount?: number;
  }) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
      return (
        <div className="relative h-[186px] w-[186px]">
          <div className="relative h-[186px] w-[186px] overflow-hidden rounded-md border-2 border-white bg-gray-100" />
        </div>
      );
    }

    return (
      <div className="relative h-[186px] w-[186px]">
        {/* 2개 이상일 때 뒤에 포개진 카드들 */}
        {imageCount >= 2 && (
          <>
            <div
              className="bg-main-100 absolute top-0 left-0 h-[186px] w-[186px] overflow-hidden rounded-md border-2 border-white"
              style={{ transform: "rotate(5deg)" }}
            />
          </>
        )}

        {/* 메인 카드 (맨 앞) - 정방형 */}
        <div className="relative h-[186px] w-[186px] overflow-hidden rounded-md border-2 border-white bg-gray-100">
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
  }
);

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
      <div className="mt-5 space-y-4">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div key={`skeleton-${index}`} className="relative">
            {/* 상단 - 작성자/시간 스켈레톤 (포스트잇 밖) */}
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>

            {/* 포스트잇 스타일 컨텐츠 */}
            <div
              className="relative ml-8 p-5 shadow-sm"
              style={{
                backgroundColor: "#EBF0F9",
                borderRadius: "10px",
                clipPath:
                  "polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%)",
              }}
            >
              {/* 제목 스켈레톤 */}
              <Skeleton className="mb-1 h-6 w-3/4" />

              {/* 설명 스켈레톤 (2줄) */}
              <div className="mb-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>

              {/* 썸네일 이미지 스켈레톤 - 정방형 */}
              <div className="relative mb-4 flex justify-center">
                <Skeleton className="h-[186px] w-[186px] rounded-md" />
              </div>

              {/* 하단 칩 스켈레톤 */}
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded" />
                <Skeleton className="h-6 w-24 rounded" />
              </div>
            </div>

            {/* 우하단 접힌 부분 (dog-ear) */}
            <div
              className="pointer-events-none absolute right-0 bottom-0"
              style={{
                borderTopLeftRadius: "10px",
                borderWidth: "0 0 24px 24px",
                borderColor: "transparent transparent transparent #C4D4F3",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {posts.map((post) => {
        // 신고 처리된 게시글 표시
        if (post.reportsCount && post.reportsCount >= 5) {
          return (
            <div key={post.id} className="relative">
              <div className="bg-main-50 relative rounded-md p-5 shadow-sm">
                <Typography
                  font="noto"
                  variant="label1M"
                  className="text-gray-700"
                >
                  신고 처리된 게시글 입니다.
                </Typography>
              </div>
            </div>
          );
        }

        return (
          <div key={post.id} className="relative">
            {/* 상단 - 작성자/시간 (포스트잇 밖) */}
            <div className="mb-2 flex items-center gap-2">
              <ProfileImage
                src={post.profileImageUrl}
                alt={post.author || ""}
                size="h-8 w-8"
              />
              <div className="flex-1">
                <Typography
                  font="noto"
                  variant="body2B"
                  className="text-gray-950"
                >
                  {post.author || POST_ANONYMOUS_NAME}
                </Typography>
              </div>
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

            {/* 포스트잇 스타일 컨텐츠 */}
            <div
              className="relative ml-8 cursor-pointer p-5 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => handlePostClick(post)}
              style={{
                backgroundColor: "#EBF0F9",
                borderRadius: "10px",
                clipPath:
                  "polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%)",
              }}
            >
              {/* 제목 */}
              <Typography
                font="noto"
                variant="body1B"
                className="mb-1 text-gray-950"
              >
                {post.title || ""}
              </Typography>

              {/* 설명 (2줄 미리보기) */}
              {post.preview?.description && (
                <Typography
                  font="noto"
                  variant="body2R"
                  className="mb-4 line-clamp-2 text-gray-700"
                >
                  {post.preview.description}
                </Typography>
              )}

              {/* 썸네일 이미지 - 정방형, 중앙 배치 */}
              <div className="relative mb-4 flex justify-center">
                {post.preview?.thumbnail?.url &&
                isValidImageUrl(post.preview.thumbnail.url) ? (
                  <>
                    {/* 스티커 - 이미지 테두리와 겹치게 */}
                    <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                      <Image
                        src={IMAGE_URL.ICON.sticker.cloud.url}
                        alt={IMAGE_URL.ICON.sticker.cloud.alt}
                        width={46}
                        height={20}
                      />
                    </div>
                    <PostThumbnail
                      src={post.preview.thumbnail.url}
                      alt={post.title || ""}
                      imageCount={
                        (post.preview as { imageCount?: number })?.imageCount ||
                        1
                      }
                    />
                  </>
                ) : (
                  <div className="relative h-[186px] w-[186px]">
                    {/* 스티커 - 이미지 테두리와 겹치게 */}
                    <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                      <Image
                        src={IMAGE_URL.ICON.sticker.cloud.url}
                        alt={IMAGE_URL.ICON.sticker.cloud.alt}
                        width={46}
                        height={20}
                      />
                    </div>
                    <div className="h-full w-full overflow-hidden rounded-md border-2 border-white bg-gray-100" />
                  </div>
                )}
              </div>

              {/* 하단 칩 섹션 */}
              <div className="flex gap-2">
                {post.category && (
                  <div className="flex items-center rounded-md bg-white px-[6px] py-1">
                    <Typography
                      font="noto"
                      variant="caption1M"
                      className="line-clamp-1 text-gray-400"
                    >
                      {post.category}
                    </Typography>
                  </div>
                )}
                {post.channel && (
                  <div className="flex items-center rounded-md bg-white px-[6px] py-1">
                    <Typography
                      font="noto"
                      variant="caption1M"
                      className="line-clamp-1 text-gray-400"
                    >
                      {post.channel}
                    </Typography>
                  </div>
                )}
              </div>
            </div>

            {/* 우하단 접힌 부분 (dog-ear) */}
            <div
              className="pointer-events-none absolute right-0 bottom-0"
              style={{
                borderTopLeftRadius: "10px",
                borderWidth: "0 0 24px 24px",
                borderColor: "transparent transparent transparent #C4D4F3",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default memo(PostFeed);
