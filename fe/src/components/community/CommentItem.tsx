"use client";

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Image as ImageIcon } from "lucide-react";
import { GiphySelector } from "@/components/shared/giphy-selector";
import KebabMenu from "@/components/shared/kebab-menu";
import { Typography } from "@/components/shared/typography";
import AdminBadge from "@/components/shared/ui/admin-badge";
import ExpandableBottomSheet from "@/components/shared/ui/expandable-bottom-sheet";
import {
  commentsKeys,
  communitiesKeys,
  missionsKeys,
} from "@/constants/generated/query-keys";
import {
  COMMENT_ANONYMOUS_NAME,
  COMMENT_PLACEHOLDER,
  COMMENT_CANCEL_BUTTON,
  COMMENT_SUBMIT_BUTTON,
  COMMENT_PAGE_SIZE,
} from "@/constants/shared/_comment-constants";
import { usePostCommentsLikeById } from "@/hooks/generated/comments-hooks";
import { usePostMissionsPostsCommentsLikeByTwoIds } from "@/hooks/generated/missions-hooks";
import type * as Schema from "@/types/generated/api-schema";
import type * as Types from "@/types/generated/comments-types";
import { parseCommentContent } from "@/utils/community/parse-comment-content";
import { cn } from "@/utils/shared/cn";
import { getTimeAgo } from "@/utils/shared/date";
import { debug } from "@/utils/shared/debugger";

/**
 * 댓글/댓글 콘텐츠 렌더링 컴포넌트
 * - parseCommentContent는 순수 함수이므로 content가 동일하면 같은 결과 반환
 * - CommentItem이 이미 memo로 감싸져 있어 추가 메모이제이션 불필요
 */
const CommentContent = ({ content }: { content: string }) => {
  // content는 댓글 생성 후 거의 변경되지 않으므로,
  // CommentItem 리렌더링 시에도 동일한 content면 파싱 결과 재사용
  const parsedContent = useMemo(() => parseCommentContent(content), [content]);

  return (
    <div className="prose prose-sm [&_*]:overflow-wrap-anywhere mb-2 max-w-full text-sm wrap-break-word text-gray-700">
      {parsedContent}
    </div>
  );
};

interface CommentItemProps {
  comment: NonNullable<
    Types.TGETCommentsCommunitiesPostsByTwoIdsRes["comments"]
  >[number];
  postId?: string;
  communityId?: string;
  userData?: Schema.User;
  isExpanded?: boolean;
  onToggleReplies: () => void;
  onStartReply: (commentId: string, author: string) => void;
  onStartReplyToReply?: (commentId: string, author: string) => void;
  onStartEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onReport?: (commentId: string) => void;
  editingCommentId: string | null;
  editingContent: string;
  onEditContentChange: (content: string) => void;
  onCancelEdit: () => void;
  onEditSubmit: (commentId: string) => void;
  replyingTo: { commentId: string; author: string; isReply?: boolean } | null;
  onCancelReply: () => void;
  onCommentSubmit: (
    e: FormEvent,
    customContent?: string
  ) => void | Promise<void>;
  openMenuId?: string | null;
  onMenuToggle?: (menuId: string | null) => void;
  replyToReplyInput?: string;
  onReplyToReplyInputChange?: (value: string) => void;
  isCommentSubmitting?: boolean;
}

/**
 * @description 댓글 아이템 컴포넌트
 * - 댓글 및 댓글 표시
 * - 댓글 더보기 기능
 * - 댓글 수정/삭제 메뉴
 * - 좋아요 기능
 */
const CommentItemComponent = ({
  comment,
  postId,
  communityId,
  userData,
  isExpanded = false,
  onToggleReplies,
  onStartReply,
  onStartReplyToReply,
  onStartEdit,
  onDelete,
  onReport,
  editingCommentId,
  editingContent,
  onEditContentChange,
  onCancelEdit,
  onEditSubmit,
  replyingTo,
  onCancelReply,
  onCommentSubmit,
  openMenuId = null,
  onMenuToggle,
  replyToReplyInput,
  onReplyToReplyInputChange,
  isCommentSubmitting = false,
}: CommentItemProps) => {
  const [isLiked, setIsLiked] = useState(comment.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [replyLikes, setReplyLikes] = useState<
    Record<string, { isLiked: boolean; likesCount: number }>
  >({});
  const [localReplyToReplyInput, setLocalReplyToReplyInput] = useState("");
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [isEditGiphyOpen, setIsEditGiphyOpen] = useState(false);
  const replyToReplyInputRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLDivElement>(null);
  const editReplyInputRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);
  const isEditInternalChangeRef = useRef(false);
  const isEditReplyInternalChangeRef = useRef(false);
  const queryClient = useQueryClient();

  const commentId = comment.id || "";
  const isRootComment = !comment.parentId;
  const isCommentLocked = comment.isLocked === true;

  // replies 배열 정규화 및 메모이제이션
  const replies = useMemo(() => {
    const rawReplies = comment.replies;
    return Array.isArray(rawReplies)
      ? rawReplies.filter((reply) => reply && reply.id)
      : [];
  }, [comment.replies]);

  const repliesCount = comment.repliesCount ?? replies.length;
  const visibleReplies = useMemo(
    () => (isExpanded ? replies : replies.slice(0, 1)),
    [isExpanded, replies]
  );
  const hiddenRepliesCount = Math.max(0, repliesCount - 1);
  const shouldShowMoreButton = repliesCount >= 2 && !isExpanded;

  const userId = userData?.id;
  const userName = userData?.nickname;

  const isOwnComment = comment.userId === userId;
  const isEditing = editingCommentId === commentId;
  const isReplying =
    replyingTo?.commentId === commentId && !replyingTo?.isReply;

  // 댓글에 대한 댓글 입력창의 실제 입력값
  const actualReplyToReplyInput = replyToReplyInput ?? localReplyToReplyInput;
  const setReplyToReplyInputValue =
    onReplyToReplyInputChange ?? setLocalReplyToReplyInput;

  // comment의 좋아요 상태와 카운트를 로컬 state에 동기화
  useEffect(() => {
    setIsLiked(comment.isLiked ?? false);
    setLikesCount(comment.likesCount || 0);
  }, [comment.isLiked, comment.likesCount]);

  // 댓글의 좋아요 상태와 카운트를 로컬 state에 동기화
  useEffect(() => {
    if (replies.length > 0) {
      setReplyLikes((prev) => {
        const updated: Record<
          string,
          { isLiked: boolean; likesCount: number }
        > = { ...prev };
        let hasChanges = false;

        replies.forEach((reply) => {
          if (reply.id) {
            // replyLikes state에 이미 값이 있으면 유지, 없으면 reply 데이터로 초기화
            if (!prev[reply.id]) {
              updated[reply.id] = {
                isLiked: reply.isLiked ?? false,
                likesCount: reply.likesCount ?? 0,
              };
              hasChanges = true;
            }
          }
        });

        return hasChanges ? updated : prev;
      });
    }
  }, [replies]);

  // 댓글에 대한 댓글 입력창이 닫힐 때 로컬 state 초기화
  useEffect(() => {
    if (!replyingTo?.isReply) {
      // 댓글에 대한 댓글 입력창이 닫혔고, 로컬 state에 값이 있으면 초기화
      if (localReplyToReplyInput && !onReplyToReplyInputChange) {
        setLocalReplyToReplyInput("");
      }
    }
  }, [replyingTo?.isReply, localReplyToReplyInput, onReplyToReplyInputChange]);

  // 댓글 작성자 프로필 썸네일 추출 (메모이제이션)
  const replyThumbnails = useMemo(() => {
    if (replies.length === 0) return [];
    if (replies.length === 1) return [replies[0]];
    // 2개 이상이면 랜덤하게 2개 선택
    const shuffled = [...replies].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }, [replies]);

  // 메뉴 제어
  const commentMenuId = useMemo(() => `comment-${commentId}`, [commentId]);
  const isCommentMenuOpen = openMenuId === commentMenuId;
  const handleCommentMenuToggle = useCallback(() => {
    if (onMenuToggle) {
      onMenuToggle(isCommentMenuOpen ? null : commentMenuId);
    }
  }, [onMenuToggle, isCommentMenuOpen, commentMenuId]);

  const isMissionCommentContext = !communityId && !!postId;

  type CommunityLikeVariables = { commentId?: string };
  type MissionLikeVariables = { postId?: string; commentId?: string };
  type LikeContext = {
    targetCommentId: string;
    isReply: boolean;
    previousState?: { isLiked: boolean; likesCount: number };
  };

  // 커뮤니티 댓글 좋아요 mutation (optimistic update 적용)
  const {
    mutateAsync: likeCommunityCommentAsync,
    isPending: isCommunityLikePending,
  } = usePostCommentsLikeById({
    onMutate: (variables: CommunityLikeVariables): LikeContext => {
      // Optimistic update: 즉시 UI 업데이트
      const targetCommentId = variables.commentId ?? "";
      if (!targetCommentId) {
        return { targetCommentId: "", isReply: false };
      }
      const reply = replies.find((r) => r.id === targetCommentId);
      const isReply = !!reply;

      let previousState: LikeContext["previousState"];

      if (isReply && reply) {
        // 답글 좋아요 - 실제 reply 데이터에서 초기 상태 가져오기
        const currentState = replyLikes[targetCommentId];
        const currentIsLiked = currentState?.isLiked ?? reply.isLiked ?? false;
        const currentLikesCount =
          currentState?.likesCount ?? reply.likesCount ?? 0;

        previousState = {
          isLiked: currentIsLiked,
          likesCount: currentLikesCount,
        };

        // Optimistic update
        setReplyLikes((prev) => ({
          ...prev,
          [targetCommentId]: {
            isLiked: !currentIsLiked,
            likesCount: currentIsLiked
              ? Math.max(0, currentLikesCount - 1)
              : currentLikesCount + 1,
          },
        }));
      } else if (targetCommentId === comment.id) {
        // 댓글 좋아요 - 실제 comment 데이터에서 초기 상태 가져오기
        const currentIsLiked = isLiked;
        const currentLikesCount = likesCount;

        previousState = {
          isLiked: currentIsLiked,
          likesCount: currentLikesCount,
        };

        // Optimistic update
        const newIsLiked = !currentIsLiked;
        setIsLiked(newIsLiked);
        setLikesCount(
          newIsLiked
            ? currentLikesCount + 1
            : Math.max(0, currentLikesCount - 1)
        );
      }

      return { targetCommentId, isReply, previousState };
    },
    onSuccess: (
      response: { data?: { isLiked?: boolean; likesCount?: number } },
      variables: CommunityLikeVariables
    ) => {
      // API 응답으로 정확한 값으로 업데이트
      const result = response.data;
      const targetCommentId = variables.commentId ?? "";

      updateLikeStateFromResponse(result, targetCommentId);

      // 서버 데이터도 최신화하여 페이지 이탈 후 재진입 시 반영되도록 처리
      if (communityId && postId) {
        queryClient.invalidateQueries({
          queryKey: commentsKeys.getCommentsCommunitiesPostsByTwoIds({
            communityId,
            postId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: communitiesKeys.getCommunitiesPostsByTwoIds({
            communityId,
            postId,
          }),
        });
      }
    },
    onError: (
      _err: unknown,
      variables: CommunityLikeVariables,
      context?: LikeContext
    ) => {
      rollbackLikeState(context, commentId);
    },
  });

  const updateLikeStateFromResponse = useCallback(
    (
      result: { isLiked?: boolean; likesCount?: number } | undefined,
      targetCommentId?: string
    ) => {
      if (!result || !targetCommentId) return;

      const isReply = replies.some((reply) => reply.id === targetCommentId);

      if (isReply) {
        setReplyLikes((prev) => ({
          ...prev,
          [targetCommentId]: {
            isLiked: result.isLiked || false,
            likesCount: result.likesCount || 0,
          },
        }));
      } else if (targetCommentId === comment.id) {
        setIsLiked(result.isLiked || false);
        setLikesCount(result.likesCount || 0);
      }
    },
    [comment.id, replies]
  );

  const rollbackLikeState = useCallback(
    (context: LikeContext | undefined, baseCommentId: string) => {
      if (!context?.previousState) return;

      if (context.isReply) {
        const targetId = context.targetCommentId;
        if (targetId) {
          setReplyLikes((prev) => ({
            ...prev,
            [targetId]: context.previousState!,
          }));
        }
      } else if (context.targetCommentId === baseCommentId) {
        setIsLiked(context.previousState.isLiked);
        setLikesCount(context.previousState.likesCount);
      }
    },
    []
  );

  const { mutate: mutateMissionLike, isPending: isMissionLikePending } =
    usePostMissionsPostsCommentsLikeByTwoIds<LikeContext, MissionLikeVariables>(
      {
        onMutate: (variables) => {
          const targetCommentId = variables.commentId ?? "";
          if (!targetCommentId) {
            return { targetCommentId: "", isReply: false };
          }

          const reply = replies.find((r) => r.id === targetCommentId);
          const isReply = !!reply;

          let previousState: LikeContext["previousState"];

          if (isReply && reply) {
            const currentState = replyLikes[targetCommentId];
            const currentIsLiked =
              currentState?.isLiked ?? reply.isLiked ?? false;
            const currentLikesCount =
              currentState?.likesCount ?? reply.likesCount ?? 0;

            previousState = {
              isLiked: currentIsLiked,
              likesCount: currentLikesCount,
            };

            const newIsLiked = !currentIsLiked;
            const newLikesCount = newIsLiked
              ? currentLikesCount + 1
              : Math.max(0, currentLikesCount - 1);

            setReplyLikes((prev) => ({
              ...prev,
              [targetCommentId]: {
                isLiked: newIsLiked,
                likesCount: newLikesCount,
              },
            }));
          } else if (targetCommentId === comment.id) {
            const currentIsLiked = isLiked;
            const currentLikesCount = likesCount;

            previousState = {
              isLiked: currentIsLiked,
              likesCount: currentLikesCount,
            };

            const newIsLiked = !currentIsLiked;
            setIsLiked(newIsLiked);
            setLikesCount(
              newIsLiked
                ? currentLikesCount + 1
                : Math.max(0, currentLikesCount - 1)
            );
          }

          return { targetCommentId, isReply, previousState };
        },
      }
    );

  const invalidateMissionCommentQueries = useCallback(() => {
    if (!postId) return;

    // 미션 게시글 상세 정보 refetch (댓글 카운트 반영)
    queryClient.invalidateQueries({
      queryKey: missionsKeys.getMissionsPostsById({ postId }),
    });

    // 미션 댓글 목록 refetch (무한 스크롤 쿼리 무효화)
    queryClient.invalidateQueries({
      queryKey: missionsKeys.getMissionsPostsCommentsById({
        postId,
        pageSize: COMMENT_PAGE_SIZE,
      }),
    });
  }, [postId, queryClient]);

  const isLikePending = isMissionCommentContext
    ? isMissionLikePending
    : isCommunityLikePending;

  // 좋아요 핸들러
  const handleLike = useCallback(async () => {
    if (!commentId || isLikePending) return;
    try {
      if (isMissionCommentContext) {
        if (!postId) return;
        mutateMissionLike(
          { postId, commentId },
          {
            onSuccess: (
              response: { data?: { isLiked?: boolean; likesCount?: number } },
              variables: MissionLikeVariables
            ) => {
              const result = response.data;
              const targetCommentId = variables.commentId ?? "";

              updateLikeStateFromResponse(result, targetCommentId);

              // 서버 데이터도 최신화하여 페이지 이탈 후 재진입 시 반영되도록 처리
              invalidateMissionCommentQueries();
            },
            onError: (
              _err: unknown,
              _variables: MissionLikeVariables,
              context
            ) => {
              rollbackLikeState(context, commentId);
            },
          }
        );
      } else {
        await likeCommunityCommentAsync({ commentId });
      }
    } catch (error) {
      debug.error("좋아요 실패:", error);
    }
  }, [
    commentId,
    invalidateMissionCommentQueries,
    isLikePending,
    isMissionCommentContext,
    likeCommunityCommentAsync,
    mutateMissionLike,
    postId,
    rollbackLikeState,
    updateLikeStateFromResponse,
  ]);

  const handleReplyLike = useCallback(
    async (targetReplyId: string) => {
      if (!targetReplyId || isLikePending) return;
      try {
        if (isMissionCommentContext) {
          if (!postId) return;
          mutateMissionLike(
            { postId, commentId: targetReplyId },
            {
              onSuccess: (
                response: { data?: { isLiked?: boolean; likesCount?: number } },
                variables: MissionLikeVariables
              ) => {
                const result = response.data;
                const targetCommentId = variables.commentId ?? "";

                updateLikeStateFromResponse(result, targetCommentId);

                // 서버 데이터도 최신화하여 페이지 이탈 후 재진입 시 반영되도록 처리
                invalidateMissionCommentQueries();
              },
              onError: (
                _err: unknown,
                _variables: MissionLikeVariables,
                context
              ) => {
                rollbackLikeState(context, commentId);
              },
            }
          );
        } else {
          await likeCommunityCommentAsync({ commentId: targetReplyId });
        }
      } catch (error) {
        debug.error("댓글 좋아요 실패:", error);
      }
    },
    [
      commentId,
      invalidateMissionCommentQueries,
      isLikePending,
      isMissionCommentContext,
      mutateMissionLike,
      likeCommunityCommentAsync,
      postId,
      rollbackLikeState,
      updateLikeStateFromResponse,
    ]
  );

  // 메뉴 핸들러
  const handleEdit = useCallback(() => {
    if (comment.content) {
      onStartEdit(commentId, comment.content);
    }
  }, [comment.content, commentId, onStartEdit]);

  const handleDelete = useCallback(() => {
    onDelete(commentId);
  }, [commentId, onDelete]);

  const handleReport = useCallback(() => {
    if (onReport) {
      onReport(commentId);
    }
  }, [commentId, onReport]);

  // 댓글에 대한 댓글 제출 핸들러
  const handleReplyToReplySubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (isCommentSubmitting) return;

      // 텍스트 내용 확인 (HTML 태그 제거)
      const textContent = actualReplyToReplyInput
        .replace(/<[^>]*>/g, "")
        .trim();
      // 이미지 태그 확인 (GIF 포함)
      const hasImage = /<img[^>]*>/i.test(actualReplyToReplyInput);

      // 텍스트나 이미지가 있어야 제출 가능
      if (!textContent && !hasImage) return;

      await onCommentSubmit(e, actualReplyToReplyInput);
      setReplyToReplyInputValue("");
    },
    [
      actualReplyToReplyInput,
      onCommentSubmit,
      setReplyToReplyInputValue,
      isCommentSubmitting,
    ]
  );

  // GIF 선택 핸들러
  const handleGifSelect = useCallback(
    (gifUrl: string) => {
      const inputElement = replyToReplyInputRef.current;
      if (!inputElement) return;

      // 입력창에 포커스 주기
      inputElement.focus();

      // 현재 HTML 가져오기
      const currentHtml = actualReplyToReplyInput || "";

      // img 태그 생성
      const imgTag = `<img src="${gifUrl}" alt="GIF" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 4px 0;" />`;

      // 현재 내용이 있으면 줄바꿈 추가, 없으면 그냥 추가
      const newHtml = currentHtml
        ? `${currentHtml}<br>${imgTag}<br>`
        : `${imgTag}<br>`;

      // HTML 업데이트
      setReplyToReplyInputValue(newHtml);

      // DOM에 직접 삽입하여 즉시 반영
      setTimeout(() => {
        inputElement.innerHTML = newHtml;

        // 커서를 끝으로 이동
        const range = document.createRange();
        const selection = window.getSelection();
        if (selection && inputElement.lastChild) {
          range.selectNodeContents(inputElement);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        inputElement.focus();
      }, 0);
    },
    [actualReplyToReplyInput, setReplyToReplyInputValue]
  );

  // 대댓글 입력창 변경 핸들러
  const handleReplyToReplyInputChangeEvent = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      isInternalChangeRef.current = true;
      const target = e.currentTarget;
      const html = target.innerHTML;
      setReplyToReplyInputValue(html);
    },
    [setReplyToReplyInputValue]
  );

  // 대댓글 입력창 키다운 핸들러 (img 태그 삭제)
  const handleReplyToReplyKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Backspace 또는 Delete 키로 img 태그 전체 삭제
      if (e.key === "Backspace" || e.key === "Delete") {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const container = replyToReplyInputRef.current;
        if (!container) return;

        // 선택된 노드 확인
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode as Node;
        }

        // img 태그 찾기
        let imgElement: HTMLImageElement | null = null;
        if (node instanceof HTMLImageElement) {
          imgElement = node;
        } else {
          // 부모 노드에서 img 찾기
          let current: Node | null = node;
          while (current && current !== container) {
            if (current instanceof HTMLImageElement) {
              imgElement = current;
              break;
            }
            current = current.parentNode;
          }
        }

        if (imgElement) {
          e.preventDefault();
          // img 태그와 앞뒤 br 태그 제거
          const parent = imgElement.parentNode;
          if (parent) {
            // 앞의 br 제거
            const prevSibling = imgElement.previousSibling;
            if (prevSibling && prevSibling instanceof HTMLBRElement) {
              parent.removeChild(prevSibling);
            }
            // img 제거
            parent.removeChild(imgElement);
            // 뒤의 br 제거
            const nextSibling = imgElement.nextSibling;
            if (nextSibling && nextSibling instanceof HTMLBRElement) {
              parent.removeChild(nextSibling);
            }

            // 커서 위치 조정
            const newRange = document.createRange();
            if (parent.childNodes.length > 0) {
              newRange.setStart(parent, 0);
            } else {
              newRange.setStart(parent, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // HTML 업데이트
            const newHtml = container.innerHTML;
            setReplyToReplyInputValue(newHtml);
          }
        }
      }
    },
    [setReplyToReplyInputValue]
  );

  // contentEditable div의 내용 동기화
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const inputElement = replyToReplyInputRef.current;
    if (!inputElement) return;

    // 현재 innerHTML과 actualReplyToReplyInput이 다를 때만 업데이트
    if (inputElement.innerHTML !== actualReplyToReplyInput) {
      inputElement.innerHTML = actualReplyToReplyInput || "";
    }
  }, [actualReplyToReplyInput]);

  // 댓글에 대한 댓글 취소 핸들러
  const handleCancelReplyToReply = useCallback(() => {
    onCancelReply();
    if (!onReplyToReplyInputChange) {
      setLocalReplyToReplyInput("");
    }
  }, [onCancelReply, onReplyToReplyInputChange]);

  // 댓글 좋아요 상태 계산 (메모이제이션)
  const getReplyLikeState = useCallback(
    (replyId: string) => {
      const reply = replies.find((r) => r.id === replyId);
      const replyLikeState = replyLikes[replyId];
      // replyLikes state가 있으면 우선 사용, 없으면 실제 reply 데이터 사용
      return {
        isLiked: replyLikeState?.isLiked ?? reply?.isLiked ?? false,
        likesCount: replyLikeState?.likesCount ?? reply?.likesCount ?? 0,
      };
    },
    [replyLikes, replies]
  );

  // 댓글에 대한 댓글 입력창에 내용이 있는지 확인 (텍스트 또는 이미지)
  const hasReplyToReplyContent = useMemo(() => {
    const textContent = actualReplyToReplyInput.replace(/<[^>]*>/g, "").trim();
    const hasImage = /<img[^>]*>/i.test(actualReplyToReplyInput);
    return textContent.length > 0 || hasImage;
  }, [actualReplyToReplyInput]);

  // 댓글 수정 입력창에 내용이 있는지 확인 (텍스트 또는 이미지)
  const hasEditContent = useMemo(() => {
    const textContent = editingContent.replace(/<[^>]*>/g, "").trim();
    const hasImage = /<img[^>]*>/i.test(editingContent);
    return textContent.length > 0 || hasImage;
  }, [editingContent]);

  // 공통 GIF 삽입 로직
  const insertGifToEditInput = useCallback(
    (inputRef: React.RefObject<HTMLDivElement | null>, gifUrl: string) => {
      const inputElement = inputRef.current;
      if (!inputElement) return;

      inputElement.focus();
      const currentHtml = editingContent || "";
      const imgTag = `<img src="${gifUrl}" alt="GIF" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 4px 0;" />`;
      const newHtml = currentHtml
        ? `${currentHtml}<br>${imgTag}<br>`
        : `${imgTag}<br>`;

      onEditContentChange(newHtml);

      setTimeout(() => {
        inputElement.innerHTML = newHtml;
        const range = document.createRange();
        const selection = window.getSelection();
        if (selection && inputElement.lastChild) {
          range.selectNodeContents(inputElement);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        inputElement.focus();
      }, 0);
    },
    [editingContent, onEditContentChange]
  );

  // 댓글 수정용 GIF 선택 핸들러
  const handleEditGifSelect = useCallback(
    (gifUrl: string) => {
      insertGifToEditInput(editInputRef, gifUrl);
    },
    [insertGifToEditInput]
  );

  // 답글 수정용 GIF 선택 핸들러
  const handleEditReplyGifSelect = useCallback(
    (gifUrl: string) => {
      insertGifToEditInput(editReplyInputRef, gifUrl);
    },
    [insertGifToEditInput]
  );

  // 공통 입력 변경 핸들러
  const createEditInputChangeHandler = useCallback(
    (internalChangeRef: React.MutableRefObject<boolean>) =>
      (e: React.FormEvent<HTMLDivElement>) => {
        internalChangeRef.current = true;
        onEditContentChange(e.currentTarget.innerHTML);
      },
    [onEditContentChange]
  );

  // 댓글 수정 입력창 변경 핸들러
  const handleEditInputChangeEvent = useMemo(
    () => createEditInputChangeHandler(isEditInternalChangeRef),
    [createEditInputChangeHandler]
  );

  // 답글 수정 입력창 변경 핸들러
  const handleEditReplyInputChangeEvent = useMemo(
    () => createEditInputChangeHandler(isEditReplyInternalChangeRef),
    [createEditInputChangeHandler]
  );

  // 공통 키다운 핸들러 (img 태그 삭제)
  const createEditKeyDownHandler = useCallback(
    (containerRef: React.RefObject<HTMLDivElement | null>) =>
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Backspace" && e.key !== "Delete") return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const container = containerRef.current;
        if (!container) return;

        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode as Node;
        }

        let imgElement: HTMLImageElement | null = null;
        if (node instanceof HTMLImageElement) {
          imgElement = node;
        } else {
          let current: Node | null = node;
          while (current && current !== container) {
            if (current instanceof HTMLImageElement) {
              imgElement = current;
              break;
            }
            current = current.parentNode;
          }
        }

        if (imgElement) {
          e.preventDefault();
          const parent = imgElement.parentNode;
          if (parent) {
            const prevSibling = imgElement.previousSibling;
            if (prevSibling && prevSibling instanceof HTMLBRElement) {
              parent.removeChild(prevSibling);
            }
            parent.removeChild(imgElement);
            const nextSibling = imgElement.nextSibling;
            if (nextSibling && nextSibling instanceof HTMLBRElement) {
              parent.removeChild(nextSibling);
            }

            const newRange = document.createRange();
            newRange.setStart(parent, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            onEditContentChange(container.innerHTML);
          }
        }
      },
    [onEditContentChange]
  );

  // 댓글 수정 입력창 키다운 핸들러
  const handleEditKeyDown = useMemo(
    () => createEditKeyDownHandler(editInputRef),
    [createEditKeyDownHandler]
  );

  // 답글 수정 입력창 키다운 핸들러
  const handleEditReplyKeyDown = useMemo(
    () => createEditKeyDownHandler(editReplyInputRef),
    [createEditKeyDownHandler]
  );

  // contentEditable div의 내용 동기화 (댓글/답글 수정용)
  useEffect(() => {
    const syncEditInput = (
      ref: React.RefObject<HTMLDivElement | null>,
      internalChangeRef: React.MutableRefObject<boolean>
    ) => {
      if (internalChangeRef.current) {
        internalChangeRef.current = false;
        return;
      }

      const inputElement = ref.current;
      if (!inputElement || inputElement.innerHTML === editingContent) return;

      inputElement.innerHTML = editingContent || "";
    };

    syncEditInput(editInputRef, isEditInternalChangeRef);
    syncEditInput(editReplyInputRef, isEditReplyInternalChangeRef);
  }, [editingContent]);

  if (isCommentLocked) {
    return (
      <div className="flex flex-col gap-1">
        <Typography
          font="noto"
          variant="label1M"
          className="mb-2 text-gray-700"
        >
          신고된 댓글입니다.
        </Typography>
        {comment.createdAt && (
          <Typography
            font="noto"
            variant="label2R"
            className="shrink-0 text-gray-400"
          >
            {getTimeAgo(comment.createdAt)}
          </Typography>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {/* 메인 댓글 */}
      <div className="flex gap-3">
        {/* 작성자 프로필 썸네일 */}
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-300">
          {comment.profileImageUrl && (
            <Image
              src={comment.profileImageUrl}
              alt={comment.author || COMMENT_ANONYMOUS_NAME}
              fill
              className="object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* 댓글 헤더 */}
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-800"
              >
                {comment.author || COMMENT_ANONYMOUS_NAME}
              </Typography>
              <AdminBadge role={comment.role} />
              {comment.createdAt && (
                <Typography
                  font="noto"
                  variant="label2R"
                  className="shrink-0 text-gray-400"
                >
                  {getTimeAgo(comment.createdAt)}
                </Typography>
              )}
            </div>
            {!isEditing && (
              <KebabMenu
                onEdit={isOwnComment ? handleEdit : undefined}
                onDelete={isOwnComment ? handleDelete : undefined}
                onReport={!isOwnComment ? handleReport : undefined}
                className="shrink-0"
                isOpen={isCommentMenuOpen}
                onToggle={handleCommentMenuToggle}
              />
            )}
          </div>

          {/* 댓글 내용 또는 수정 입력칸 */}
          {isEditing ? (
            <div className="mb-2 space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gray-300"></div>
                  <Typography
                    font="noto"
                    variant="body2M"
                    className="text-gray-800"
                  >
                    {comment.author || COMMENT_ANONYMOUS_NAME}
                  </Typography>
                  <AdminBadge role={comment.role} />
                </div>
                <button
                  onClick={onCancelEdit}
                  className="text-sm text-gray-600 hover:text-gray-800"
                  type="button"
                >
                  <Typography font="noto" variant="body2R">
                    취소
                  </Typography>
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (hasEditContent) {
                    onEditSubmit(commentId);
                  }
                }}
                className="relative"
              >
                <div
                  ref={editInputRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditInputChangeEvent}
                  onKeyDown={handleEditKeyDown}
                  data-placeholder={COMMENT_PLACEHOLDER}
                  className={cn(
                    "max-h-[200px] min-h-[40px] w-full resize-none overflow-y-auto rounded-lg border border-gray-200 p-3 pr-20 pb-12 text-sm focus:outline-none",
                    "empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]",
                    "focus:ring-main-400 focus:ring-2",
                    "[&_img]:my-1 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
                  )}
                  style={{
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                />
                <div className="absolute right-2 bottom-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditGiphyOpen((prev) => !prev)}
                    className={cn(
                      "flex h-[40px] w-[40px] items-center justify-center rounded-lg transition-all",
                      "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    )}
                    aria-label="GIF 선택"
                  >
                    <ImageIcon size={16} />
                  </button>
                  <button
                    type="submit"
                    disabled={!hasEditContent}
                    className={cn(
                      "flex h-8 items-center rounded-lg px-3 py-2 transition-all",
                      hasEditContent
                        ? "bg-main-600 hover:bg-main-700 cursor-pointer text-white"
                        : "cursor-not-allowed bg-gray-100 text-gray-400 opacity-50"
                    )}
                  >
                    <Typography
                      font="noto"
                      variant="body3M"
                      className={
                        hasEditContent ? "text-white" : "text-gray-400"
                      }
                    >
                      {COMMENT_SUBMIT_BUTTON}
                    </Typography>
                  </button>
                </div>
                {/* GIPHY 선택 UI - 바텀시트로 표시 */}
                <ExpandableBottomSheet
                  isOpen={isEditGiphyOpen}
                  onClose={() => setIsEditGiphyOpen(false)}
                >
                  <GiphySelector
                    onGifSelect={handleEditGifSelect}
                    onClose={() => setIsEditGiphyOpen(false)}
                  />
                </ExpandableBottomSheet>
              </form>
            </div>
          ) : (
            <>
              {comment.content && <CommentContent content={comment.content} />}

              {/* 댓글 액션 버튼 */}
              <div className="flex items-center gap-[6px]">
                <button
                  onClick={() => onStartReply(commentId, comment.author || "")}
                  className="flex items-center rounded-sm border border-gray-200 px-2 py-1 text-gray-600 hover:text-gray-800"
                  type="button"
                >
                  <Typography font="noto" variant="label1R">
                    댓글 쓰기
                  </Typography>
                </button>
                <button
                  onClick={handleLike}
                  className="flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600 hover:text-gray-800"
                  type="button"
                >
                  <Heart
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isLiked ? "fill-main-500 text-main-500" : "text-gray-600"
                    )}
                    fill={isLiked ? "currentColor" : "none"}
                  />
                  <Typography font="noto" variant="label1R">
                    {likesCount}
                  </Typography>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {/* 댓글 목록 */}
      {isRootComment && (replies.length > 0 || repliesCount > 0) && (
        <div className="ml-11 space-y-3">
          {visibleReplies.length > 0 ? (
            visibleReplies.map((reply) => {
              const replyId = reply.id || "";
              const replyAuthor = reply.author || COMMENT_ANONYMOUS_NAME;
              const isReplyLocked = reply.isLocked === true;
              const isEditingReply = editingCommentId === replyId;
              const isReplyingToThisReply =
                replyingTo?.commentId === replyId &&
                replyingTo?.isReply === true &&
                !isReplying;

              const replyMenuId = `reply-${replyId}`;
              const isReplyMenuOpen = openMenuId === replyMenuId;
              const handleReplyMenuToggle = () => {
                if (onMenuToggle) {
                  onMenuToggle(isReplyMenuOpen ? null : replyMenuId);
                }
              };

              const replyLikeState = getReplyLikeState(replyId);
              const replyIsLiked = replyLikeState.isLiked;
              const replyLikesCount = replyLikeState.likesCount;
              if (isReplyLocked) {
                return (
                  <div key={replyId} className="flex flex-col gap-1">
                    <Typography
                      font="noto"
                      variant="label1M"
                      className="mb-2 text-gray-700"
                    >
                      신고된 댓글입니다.
                    </Typography>
                    {comment.createdAt && (
                      <Typography
                        font="noto"
                        variant="label2R"
                        className="shrink-0 text-gray-400"
                      >
                        {getTimeAgo(comment.createdAt)}
                      </Typography>
                    )}
                  </div>
                );
              }
              return (
                <div key={replyId} className="flex gap-3">
                  {/* 작성자 프로필 썸네일 */}
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-300">
                    {reply.profileImageUrl && (
                      <Image
                        src={reply.profileImageUrl}
                        alt={reply.author || COMMENT_ANONYMOUS_NAME}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Typography
                          font="noto"
                          variant="body2R"
                          className="text-gray-800"
                        >
                          <span className="text-main-500">
                            {`${reply.depth && reply.depth! > 1 ? `@${reply.parentAuthor || COMMENT_ANONYMOUS_NAME} ` : ""}`}
                          </span>
                          {replyAuthor}
                        </Typography>
                        <AdminBadge role={reply.role} />
                        {reply.createdAt && (
                          <Typography
                            font="noto"
                            variant="label2R"
                            className="shrink-0 text-gray-400"
                          >
                            {getTimeAgo(reply.createdAt)}
                          </Typography>
                        )}
                      </div>
                      {!isReplyingToThisReply && !isEditingReply && (
                        <KebabMenu
                          onEdit={
                            replyAuthor === userName
                              ? () => {
                                  if (reply.content) {
                                    onStartEdit(replyId, reply.content);
                                  }
                                }
                              : undefined
                          }
                          onDelete={
                            replyAuthor === userName
                              ? () => onDelete(replyId)
                              : undefined
                          }
                          onReport={
                            replyAuthor !== userName && onReport
                              ? () => onReport(replyId)
                              : undefined
                          }
                          className="shrink-0"
                          isOpen={isReplyMenuOpen}
                          onToggle={handleReplyMenuToggle}
                        />
                      )}
                    </div>
                    {/* 댓글 내용 또는 수정 입력칸 */}
                    {isEditingReply ? (
                      <div className="mb-2 space-y-2">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gray-300"></div>
                            <Typography
                              font="noto"
                              variant="body2M"
                              className="text-gray-800"
                            >
                              {replyAuthor || COMMENT_ANONYMOUS_NAME}
                            </Typography>
                            <AdminBadge role={reply.role} />
                          </div>
                          <button
                            onClick={onCancelEdit}
                            className="text-sm text-gray-600 hover:text-gray-800"
                            type="button"
                          >
                            <Typography font="noto" variant="body2R">
                              취소
                            </Typography>
                          </button>
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (hasEditContent) {
                              onEditSubmit(replyId);
                            }
                          }}
                          className="relative"
                        >
                          <div
                            ref={editReplyInputRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={handleEditReplyInputChangeEvent}
                            onKeyDown={handleEditReplyKeyDown}
                            data-placeholder={COMMENT_PLACEHOLDER}
                            className={cn(
                              "max-h-[200px] min-h-[40px] w-full resize-none overflow-y-auto rounded-lg border border-gray-200 p-3 pr-20 pb-12 text-sm focus:outline-none",
                              "empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]",
                              "focus:ring-main-400 focus:ring-2",
                              "[&_img]:my-1 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
                            )}
                            style={{
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                            }}
                          />
                          <div className="absolute right-2 bottom-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setIsEditGiphyOpen((prev) => !prev)
                              }
                              className={cn(
                                "flex h-[40px] w-[40px] items-center justify-center rounded-lg transition-all",
                                "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                              )}
                              aria-label="GIF 선택"
                            >
                              <ImageIcon size={16} />
                            </button>
                            <button
                              type="submit"
                              disabled={!hasEditContent}
                              className={cn(
                                "flex h-8 items-center rounded-lg px-3 py-2 transition-all",
                                hasEditContent
                                  ? "bg-main-600 hover:bg-main-700 cursor-pointer text-white"
                                  : "cursor-not-allowed bg-gray-100 text-gray-400 opacity-50"
                              )}
                            >
                              <Typography
                                font="noto"
                                variant="body3M"
                                className={
                                  hasEditContent
                                    ? "text-white"
                                    : "text-gray-400"
                                }
                              >
                                {COMMENT_SUBMIT_BUTTON}
                              </Typography>
                            </button>
                          </div>
                          {/* GIPHY 선택 UI - 바텀시트로 표시 */}
                          <ExpandableBottomSheet
                            isOpen={isEditGiphyOpen}
                            onClose={() => setIsEditGiphyOpen(false)}
                          >
                            <GiphySelector
                              onGifSelect={handleEditReplyGifSelect}
                              onClose={() => setIsEditGiphyOpen(false)}
                            />
                          </ExpandableBottomSheet>
                        </form>
                      </div>
                    ) : (
                      <>
                        {reply.content && (
                          <CommentContent content={reply.content} />
                        )}
                        <div className="flex items-center gap-[6px]">
                          {onStartReplyToReply && (
                            <button
                              onClick={() => {
                                onStartReplyToReply(replyId, replyAuthor);
                              }}
                              className="flex items-center rounded-sm border border-gray-200 px-2 py-1 text-gray-600 transition-opacity hover:text-gray-800 hover:opacity-80"
                              type="button"
                            >
                              <Typography font="noto" variant="label1R">
                                댓글 쓰기
                              </Typography>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              handleReplyLike(replyId);
                            }}
                            className="flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600 transition-opacity hover:text-gray-800 hover:opacity-80"
                            type="button"
                          >
                            <Heart
                              className={cn(
                                "h-4 w-4 transition-colors",
                                replyIsLiked
                                  ? "fill-main-500 text-main-500"
                                  : "text-gray-600"
                              )}
                              fill={replyIsLiked ? "currentColor" : "none"}
                            />
                            <Typography
                              font="noto"
                              variant="label1R"
                              className={cn(
                                "transition-colors",
                                replyIsLiked ? "text-main-500" : "text-gray-600"
                              )}
                            >
                              {replyLikesCount}
                            </Typography>
                          </button>
                        </div>
                      </>
                    )}
                    {/* 댓글에 대한 댓글 입력창 */}
                    {isReplyingToThisReply && (
                      <div className="mt-3 space-y-2">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gray-300"></div>
                            <Typography
                              font="noto"
                              variant="body2R"
                              className="text-gray-800"
                            >
                              <span className="text-main-500">
                                @{replyingTo?.author}
                              </span>{" "}
                              {userName}
                            </Typography>
                          </div>
                          <button
                            type="button"
                            onClick={handleCancelReplyToReply}
                            className="mr-1 text-sm text-gray-400 hover:text-gray-800"
                          >
                            <Typography font="noto" variant="label1M">
                              {COMMENT_CANCEL_BUTTON}
                            </Typography>
                          </button>
                        </div>
                        <form
                          onSubmit={handleReplyToReplySubmit}
                          className="relative"
                        >
                          <div
                            ref={replyToReplyInputRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={handleReplyToReplyInputChangeEvent}
                            onKeyDown={handleReplyToReplyKeyDown}
                            data-placeholder={COMMENT_PLACEHOLDER}
                            className={cn(
                              "max-h-[200px] min-h-[40px] w-full resize-none overflow-y-auto rounded-lg border border-gray-200 p-3 pr-20 pb-12 text-sm focus:outline-none",
                              "empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]",
                              "focus:ring-main-400 focus:ring-2",
                              "[&_img]:my-1 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
                            )}
                            style={{
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                            }}
                          />
                          <div className="absolute right-2 bottom-3 flex items-center gap-0">
                            <button
                              type="button"
                              onClick={() => setIsGiphyOpen((prev) => !prev)}
                              className={cn(
                                "flex h-[40px] w-[40px] items-center justify-center rounded-lg transition-all",
                                "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                              )}
                              aria-label="GIF 선택"
                            >
                              <ImageIcon size={16} />
                            </button>
                            <button
                              type="submit"
                              disabled={
                                isCommentSubmitting || !hasReplyToReplyContent
                              }
                              className={cn(
                                "flex h-8 items-center rounded-lg px-3 py-2 transition-all",
                                !isCommentSubmitting && hasReplyToReplyContent
                                  ? "bg-main-600 hover:bg-main-700 cursor-pointer text-white"
                                  : "cursor-not-allowed bg-gray-100 text-gray-400 opacity-50"
                              )}
                            >
                              <Typography
                                font="noto"
                                variant="body3M"
                                className={
                                  !isCommentSubmitting && hasReplyToReplyContent
                                    ? "text-white"
                                    : "text-gray-400"
                                }
                              >
                                {COMMENT_SUBMIT_BUTTON}
                              </Typography>
                            </button>
                          </div>
                        </form>
                        {/* GIPHY 선택 UI - 바텀시트로 표시 */}
                        <ExpandableBottomSheet
                          isOpen={isGiphyOpen}
                          onClose={() => setIsGiphyOpen(false)}
                        >
                          <GiphySelector
                            onGifSelect={handleGifSelect}
                            onClose={() => setIsGiphyOpen(false)}
                          />
                        </ExpandableBottomSheet>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-gray-500">
              <Typography font="noto" variant="body2R">
                댓글을 불러오는 중...
              </Typography>
            </div>
          )}

          {/* 댓글 더보기 버튼 */}
          {shouldShowMoreButton && (
            <button
              onClick={onToggleReplies}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <div className="flex -space-x-2">
                {replyThumbnails.map((reply, index) => (
                  <div
                    key={reply.id || index}
                    className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white bg-gray-300"
                  >
                    {reply.profileImageUrl && (
                      <Image
                        src={reply.profileImageUrl}
                        alt={reply.author || COMMENT_ANONYMOUS_NAME}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
              <Typography font="noto" variant="body2R">
                댓글 {hiddenRepliesCount}개 더보기
              </Typography>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CommentItem = memo(CommentItemComponent);

CommentItem.displayName = "CommentItem";

export default CommentItem;
