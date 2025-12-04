"use client";

import { Heart, MessageCircle, User } from "lucide-react";
import { Typography } from "@/components/shared/typography";

interface PostCardProps {
  /** 게시글 ID */
  id: string;
  /** 게시글 이미지 URL */
  imageUrl: string;
  /** 게시글 제목/태그 */
  title: string;
  /** 게시글 설명 */
  description: string;
  /** 작성자 닉네임 */
  authorName: string;
  /** 작성자 프로필 이미지 URL (선택) */
  authorProfileUrl?: string;
  /** 좋아요 수 */
  likeCount: number;
  /** 댓글 수 */
  commentCount: number;
  /** 카드 클릭 핸들러 */
  onClick?: () => void;
}

/**
 * @description 마이페이지 게시글 카드 컴포넌트
 */
const PostCard = ({
  imageUrl,
  title,
  description,
  authorName,
  authorProfileUrl,
  likeCount,
  commentCount,
  onClick,
}: PostCardProps) => {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-300 bg-white"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.();
        }
      }}
      aria-label={`${title} 게시글`}
    >
      {/* 게시글 이미지 */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full" />
        )}
      </div>

      {/* 게시글 정보 */}
      <div className="flex h-27 flex-col justify-between gap-1 p-2">
        {/* 제목/태그 */}
        <Typography font="noto" variant="label2M" className="text-pink-600">
          {title}
        </Typography>

        {/* 설명 */}
        <Typography
          font="noto"
          variant="label1B"
          className="line-clamp-2 self-start break-all text-gray-900"
        >
          {description}
        </Typography>

        {/* 작성자 및 통계 */}
        <div className="flex items-center justify-between">
          {/* 작성자 정보 */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-pink-100">
              {authorProfileUrl ? (
                <img
                  src={authorProfileUrl}
                  alt={authorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-3 w-3 text-pink-400" />
              )}
            </div>
            <Typography
              font="noto"
              variant="caption1R"
              className="text-gray-700"
            >
              {authorName}
            </Typography>
          </div>

          {/* 좋아요 및 댓글 수 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-gray-400" />
              <Typography
                font="noto"
                variant="caption1R"
                className="text-gray-600"
              >
                {likeCount}
              </Typography>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4 text-gray-400" />
              <Typography
                font="noto"
                variant="caption1R"
                className="text-gray-600"
              >
                {commentCount}
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
