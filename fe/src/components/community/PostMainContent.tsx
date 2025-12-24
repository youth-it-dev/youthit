import { memo } from "react";
import { PostContent } from "@/components/shared/post-content";
import { PostProfileSection } from "@/components/shared/post-profile-section";
import { Typography } from "@/components/shared/typography";
import type * as Schema from "@/types/generated/api-schema";

/**
 * @description 게시글 메인 콘텐츠 (좋아요 상태와 무관하게 리렌더링 방지)
 */
export const PostMainContent = memo<{
  category?: string;
  title?: string;
  profileImageUrl?: string;
  author?: string;
  createdAt?: string;
  viewCount?: number;
  content?: Schema.CommunityPost["content"];
}>(
  ({
    category,
    title,
    profileImageUrl,
    author,
    createdAt,
    viewCount,
    content,
  }) => {
    return (
      <div className="px-5 pt-5 pb-13">
        <Typography
          as="h1"
          font="noto"
          variant="body2R"
          className="mb-1 text-gray-500"
        >
          {category || "활동 후기"}
        </Typography>
        <Typography
          as="h2"
          font="noto"
          variant="heading1M"
          className="mb-4 text-gray-950"
        >
          {title}
        </Typography>

        <PostProfileSection
          profileImageUrl={profileImageUrl}
          author={author}
          createdAt={createdAt}
          viewCount={viewCount}
        />

        <PostContent content={content} />
      </div>
    );
  }
);

PostMainContent.displayName = "PostMainContent";
