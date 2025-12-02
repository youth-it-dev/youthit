"use client";

import { useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircleMore } from "lucide-react";
import MissionCommentsSection from "@/components/community/MissionCommentsSection";
import KebabMenu from "@/components/shared/kebab-menu";
import { PostContent } from "@/components/shared/post-content";
import { PostDetailError } from "@/components/shared/post-detail-error";
import { PostDetailSkeleton } from "@/components/shared/post-detail-skeleton";
import { PostProfileSection } from "@/components/shared/post-profile-section";
import { Typography } from "@/components/shared/typography";
import { missionsKeys } from "@/constants/generated/query-keys";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetMissionsPostsById,
  usePostMissionsPostsLikeById,
} from "@/hooks/generated/missions-hooks";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type * as Schema from "@/types/generated/missions-types";
import { cn } from "@/utils/shared/cn";
import { debug } from "@/utils/shared/debugger";
import { sharePost } from "@/utils/shared/post-share";
import { showToast } from "@/utils/shared/toast";

/**
 * @description 미션 인증글 상세 페이지
 */
const Page = () => {
  const params = useParams();
  const router = useRouter();

  // URL에서 postId 추출
  const postId = params.id as string;

  const queryClient = useQueryClient();
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const focusCommentInputRef = useRef<(() => void) | null>(null);

  // API 연동 - useGetMissionsPostsById 사용
  const {
    data: postData,
    isLoading,
    error,
  } = useGetMissionsPostsById({
    request: {
      postId,
    },
    enabled: !!postId,
  });

  // postData를 Schema.TGETMissionsPostsByIdRes 타입으로 변환
  // 실제 API 응답에는 isLiked, likesCount가 포함됨
  const post = postData as Schema.TGETMissionsPostsByIdRes & {
    isLiked?: boolean;
    likesCount?: number;
  };

  const isLiked = post?.isLiked ?? false;
  const likesCount = post?.likesCount ?? 0;

  // 게시글 쿼리 키
  const postQueryKey = missionsKeys.getMissionsPostsById({ postId });

  const isAuthor = post?.isAuthor ?? false;

  // 좋아요 mutation (onMutate는 선언 시에만 사용 가능)
  const { mutate: likePost, isPending: isLikePending } =
    usePostMissionsPostsLikeById({
      onMutate: async () => {
        // Optimistic update: 즉시 UI 업데이트
        await queryClient.cancelQueries({ queryKey: postQueryKey });
        const previousPost = queryClient.getQueryData<
          Schema.TGETMissionsPostsByIdRes & {
            isLiked?: boolean;
            likesCount?: number;
          }
        >(postQueryKey);

        if (previousPost) {
          const currentIsLiked = previousPost.isLiked ?? false;
          const currentLikesCount = previousPost.likesCount ?? 0;

          queryClient.setQueryData<
            Schema.TGETMissionsPostsByIdRes & {
              isLiked?: boolean;
              likesCount?: number;
            }
          >(postQueryKey, {
            ...previousPost,
            isLiked: !currentIsLiked,
            likesCount: currentIsLiked
              ? Math.max(0, currentLikesCount - 1)
              : currentLikesCount + 1,
          });
        }

        return { previousPost };
      },
    });

  // 좋아요 핸들러
  const handleLike = useCallback(() => {
    if (!postId || isLikePending) return;

    likePost(
      { postId },
      {
        onSuccess: (response) => {
          // API 응답으로 정확한 값으로 업데이트
          const result = response.data;

          if (result) {
            const currentPost = queryClient.getQueryData<
              Schema.TGETMissionsPostsByIdRes & {
                isLiked?: boolean;
                likesCount?: number;
              }
            >(postQueryKey);

            if (currentPost) {
              queryClient.setQueryData<
                Schema.TGETMissionsPostsByIdRes & {
                  isLiked?: boolean;
                  likesCount?: number;
                }
              >(postQueryKey, {
                ...currentPost,
                isLiked: result.isLiked ?? false,
                likesCount: result.likesCount ?? 0,
              });
            }
          }
        },
        onError: (err: Error, _variables, onMutateResult: unknown) => {
          // 에러 발생 시 이전 상태로 롤백
          const context = onMutateResult as {
            previousPost?: Schema.TGETMissionsPostsByIdRes & {
              isLiked?: boolean;
              likesCount?: number;
            };
          };
          if (context?.previousPost) {
            queryClient.setQueryData(postQueryKey, context.previousPost);
          }
          debug.error("좋아요 실패:", err);
          showToast("좋아요 처리에 실패했습니다. 다시 시도해주세요.");
        },
      }
    );
  }, [postId, likePost, isLikePending, queryClient, postQueryKey]);

  // 공유하기 기능
  const handleShare = useCallback(async () => {
    if (!post) return;

    await sharePost({
      title: post.title,
      content: post.content,
      postId,
      sharePath: LINK_URL.COMMUNITY_MISSION,
      defaultTitle: "미션 인증글",
    });
  }, [post, postId]);

  const handleReportClick = useCallback(() => {
    if (!postId) return;

    const authorId = post?.authorId || "";
    const missionId = post?.missionNotionPageId || "";

    const searchParams = new URLSearchParams({
      targetType: "post",
      targetId: postId,
      targetUserId: authorId,
      missionId,
    });

    router.push(
      `${LINK_URL.COMMUNITY_MISSION_REPORT}?${searchParams.toString()}`
    );
  }, [postId, post?.authorId, post?.missionNotionPageId, router]);

  // 댓글 버튼 클릭 핸들러 - 입력창으로 스크롤 및 포커스
  const handleCommentClick = useCallback(() => {
    // MissionCommentsSection의 포커스 핸들러가 있으면 사용 (답글 상태 초기화 포함)
    if (focusCommentInputRef.current) {
      focusCommentInputRef.current();
    } else {
      // 없으면 기본 동작
      setTimeout(() => {
        commentInputRef.current?.focus();
        commentInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, []);

  // 탑바 커스텀
  useEffect(() => {
    setRightSlot(
      <KebabMenu
        onShare={handleShare}
        onEdit={undefined}
        onDelete={undefined}
        onReport={!isAuthor ? handleReportClick : undefined}
      />
    );
  }, [setRightSlot, handleShare, isAuthor, handleReportClick]);

  // 로딩 중 - 스켈레톤 표시
  if (isLoading) {
    return <PostDetailSkeleton headerButtonCount={1} showCategory={true} />;
  }

  // 에러 처리 또는 postData가 없는 경우
  if (error || !postData) {
    return (
      <PostDetailError
        error={error || undefined}
        notFoundMessage="인증글을 찾을 수 없습니다."
        backButtonText="이전으로 돌아가기"
      />
    );
  }

  return (
    <div className="bg-white pt-12">
      {/* 메인 콘텐츠 */}
      <div className="px-5 py-5">
        {/* 미션 제목 */}
        {post?.missionTitle && (
          <Typography
            as="h1"
            font="noto"
            variant="body2R"
            className="mb-1 text-gray-500"
          >
            {post.missionTitle}
          </Typography>
        )}

        {/* 제목 */}
        <Typography
          as="h2"
          font="noto"
          variant="heading1M"
          className="mb-4 text-gray-950"
        >
          {post?.title || "제목 없음"}
        </Typography>

        {/* 프로필 섹션 */}
        <PostProfileSection
          profileImageUrl={post?.profileImageUrl}
          author={post?.author}
          createdAt={post?.createdAt}
          viewCount={post?.viewCount}
        />

        {/* 내용 */}
        <div className="py-8">
          {post?.content && <PostContent content={post.content} />}
        </div>
      </div>

      {/* 좋아요/댓글 액션 바 */}
      <div className="flex items-center gap-6 border-t border-gray-200 p-4">
        <button
          onClick={handleLike}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          type="button"
        >
          <Heart
            className={cn(
              "h-5 w-5 transition-colors",
              isLiked ? "fill-main-500 text-main-500" : "text-gray-600"
            )}
            fill={isLiked ? "currentColor" : "none"}
          />
          <Typography
            font="noto"
            variant="body2R"
            className={cn(
              "transition-colors",
              isLiked ? "text-main-500" : "text-gray-600"
            )}
          >
            {likesCount}
          </Typography>
        </button>
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <MessageCircleMore className="h-5 w-5 text-gray-600" />
          <Typography font="noto" variant="body2R" className="text-gray-600">
            {post?.commentsCount || 0}
          </Typography>
        </button>
      </div>

      {/* 댓글 섹션 */}
      {postId && (
        <MissionCommentsSection
          postId={postId}
          missionId={post?.missionNotionPageId || ""}
          commentInputRef={commentInputRef}
          onFocusRequestRef={focusCommentInputRef}
        />
      )}
    </div>
  );
};

export default Page;
