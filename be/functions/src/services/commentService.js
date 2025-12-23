const {FieldValue} = require("firebase-admin/firestore");
const FirestoreService = require("./firestoreService");
const fcmHelper = require("../utils/fcmHelper");
const UserService = require("./userService");
const {sanitizeContent} = require("../utils/sanitizeHelper");
const {isAdminUser} = require("../utils/helpers");
const {NOTIFICATION_LINKS} = require("../constants/urlConstants");

/**
 * Comment Service (비즈니스 로직 계층)
 * 댓글 관련 모든 비즈니스 로직 처리
 */
class CommentService {
  
  static MAX_PARENT_COMMENTS_FOR_REPLIES = 10; 
  static MAX_NOTIFICATION_TEXT_LENGTH = 10;
  static PROGRAM_TYPES = {
    ROUTINE: "ROUTINE",
    GATHERING: "GATHERING",
    TMI: "TMI",
  };

  static normalizeProgramType(value) {
    if (!value || typeof value !== "string") {
      return null;
    }
    const upper = value.trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(CommentService.PROGRAM_TYPES, upper)
      ? CommentService.PROGRAM_TYPES[upper]
      : upper;
  }

  constructor() {
    this.firestoreService = new FirestoreService("comments");
    this.userService = new UserService();
    this.rewardService = null; // lazy loading
  }

  getRewardService() {
    if (!this.rewardService) {
      const RewardService = require("./rewardService");
      this.rewardService = new RewardService();
    }
    return this.rewardService;
  }

  /**
   * 댓글 생성
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} postId - 게시글 ID
   * @param {string} userId - 사용자 ID
   * @param {Object} commentData - 댓글 데이터
   * @return {Promise<Object>} 생성된 댓글
   */
  async createComment(communityId, postId, userId, commentData) {
    try {
      const {content, parentId = null} = commentData;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        const error = new Error("댓글 내용은 필수입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      // const textWithoutTags = content.replace(/<[^>]*>/g, '').trim();
      // if (textWithoutTags.length === 0) {
      //   const error = new Error("댓글에 텍스트 내용이 필요합니다.");
      //   error.code = "BAD_REQUEST";
      //   throw error;
      // }

      const sanitizedContent = sanitizeContent(content);

      // const sanitizedText = sanitizedContent.replace(/<[^>]*>/g, '').trim();
      // if (sanitizedText.length === 0) {
      //   const error = new Error("sanitize 후 유효한 텍스트 내용이 없습니다.");
      //   error.code = "BAD_REQUEST";
      //   throw error;
      // }

      const community = await this.firestoreService.getDocument(
        "communities",
        communityId,
      );
      if (!community) {
        const error = new Error("커뮤니티를 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      const post = await this.firestoreService.getDocument(`communities/${communityId}/posts`, postId);
      if (!post) {
        const error = new Error("게시글을 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      let parentComment = null;
      if (parentId) {
        parentComment = await this.firestoreService.getDocument("comments", parentId);
        if (!parentComment) {
          const error = new Error("부모 댓글을 찾을 수 없습니다.");
          error.code = "NOT_FOUND";
          throw error;
        }
      }

      let author = "익명";
      try {
        const programType =
          CommentService.normalizeProgramType(
            post.programType || community?.programType || post.type,
          ) || null;
        const isPrivatePost = post.isPublic === false;

        if (isPrivatePost) {
          // Admin 사용자는 비공개 게시글에도 댓글 작성 가능
          const isAdmin = await isAdminUser(userId);
          
          if (isAdmin) {
            // Admin은 members에 없어도 users/nicknames에서 조회
            if (programType === CommentService.PROGRAM_TYPES.TMI) {
              const userProfile = await this.firestoreService.getDocument("users", userId);
              author = userProfile?.name || "익명";
            } else {
              const nicknames = await this.firestoreService.getCollectionWhere(
                "nicknames",
                "uid",
                "==",
                userId
              );
              const nicknameDoc = nicknames && nicknames[0];
              if (nicknameDoc) {
                author = nicknameDoc.id || nicknameDoc.nickname || "익명";
              } else {
                const userProfile = await this.firestoreService.getDocument("users", userId);
                author = userProfile?.name || "익명";
              }
            }
          } else {
            // 일반 사용자는 members에서 조회
            const members = await this.firestoreService.getCollectionWhere(
              `communities/${communityId}/members`,
              "userId",
              "==",
              userId
            );
            const memberData = members && members[0];

            if (programType === CommentService.PROGRAM_TYPES.TMI) {
              const userProfile = await this.firestoreService.getDocument("users", userId);
              author =
                userProfile?.name ||
                memberData?.nickname ||
                "익명";
            } else if (memberData) {
              author = memberData.nickname || "익명";
            }
          }
        } else {
          const members = await this.firestoreService.getCollectionWhere(
            `communities/${communityId}/members`,
            "userId",
            "==",
            userId
          );
          const memberData = members && members[0];

          if (memberData) {
            // 멤버가 있으면 members에서 가져오기
            if (programType === CommentService.PROGRAM_TYPES.TMI) {
              const userProfile = await this.firestoreService.getDocument("users", userId);
              author =
                userProfile?.name ||
                memberData?.nickname ||
                "익명";
            } else {
              author = memberData.nickname || "익명";
            }
          } else {
            // 멤버가 없으면 기존 nicknames 로직 사용
          const nicknames = await this.firestoreService.getCollectionWhere(
            "nicknames",
            "uid",
            "==",
            userId
          );
          const nicknameDoc = nicknames && nicknames[0];
          if (nicknameDoc) {
            author = nicknameDoc.id || nicknameDoc.nickname || "익명";
            }
          }
        }
      } catch (memberError) {
        console.warn("Failed to get member info for comment creation:", memberError.message);
      }

      // depth 계산: parentId가 있으면 부모의 depth + 1, 없으면 0
      const depth = parentId && parentComment ? (parentComment.depth || 0) + 1 : 0;

      const newComment = {
        communityId,
        postId,
        userId,
        author,
        content: sanitizedContent,
        parentId,
        likesCount: 0,
        isDeleted: false,
        isLocked: false,
        depth,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (parentId && parentComment && parentComment.author) {
        newComment.parentAuthor = parentComment.author;
      }

      const result = await this.firestoreService.runTransaction(async (transaction) => {
        const commentRef = this.firestoreService.db.collection("comments").doc();
        const postRef = this.firestoreService.db.collection(`communities/${communityId}/posts`).doc(postId);
        const commentedPostRef = this.firestoreService.db.collection(`users/${userId}/commentedPosts`).doc(postId);
        
        transaction.set(commentRef, newComment);
        transaction.update(postRef, {
          commentsCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        // 집계 컬렉션 업데이트: 댓글 단 게시글 추적
        transaction.set(commentedPostRef, {
          postId,
          communityId,
          lastCommentedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        
        return { commentId: commentRef.id };
      });

      const commentId = result.commentId;

      const created = await this.firestoreService.getDocument("comments", commentId);

      if (post.authorId !== userId) {
        const commenterName = author !== "익명" ? author : "사용자";
        const link = NOTIFICATION_LINKS.POST(postId, communityId);
        fcmHelper.sendNotification(
          post.authorId,
          "새로운 댓글이 달렸습니다",
          `${commenterName}님이 게시글 "${post.title}"에 댓글을 남겼습니다.`,
          "COMMENT",
          postId,
          communityId,
          link,
          commentId
        ).catch(error => {
          console.error("댓글 알림 전송 실패:", error);
        });
      }

      
      if (parentId && parentComment && parentComment.userId !== userId) {
        const textOnly = typeof parentComment.content === 'string' 
          ? parentComment.content.replace(/<[^>]*>/g, '') 
          : parentComment.content;
        const commentPreview = textOnly || "댓글";
        const preview = commentPreview.length > CommentService.MAX_NOTIFICATION_TEXT_LENGTH ? 
          commentPreview.substring(0, CommentService.MAX_NOTIFICATION_TEXT_LENGTH) + "..." : 
          commentPreview;

        // author는 이미 게시글 isPublic에 따라 올바르게 설정됨
        const commenterName = author !== "익명" ? author : "사용자";
        console.log(`대댓글 알림 전송: ${parentComment.userId}에게 답글 알림`);
        const link = NOTIFICATION_LINKS.POST(postId, communityId);
        fcmHelper.sendNotification(
          parentComment.userId,
          "새로운 답글이 달렸습니다",
          `${commenterName}님이 "${preview}"에 답글을 남겼습니다.`,
          "COMMENT",
          postId,
          communityId,
          link,
          commentId
        ).catch(error => {
          console.error("대댓글 알림 전송 실패:", error);
        });
      }

      // 응답에서 제외할 필드
      const { isDeleted, media, userId: _userId, ...commentWithoutDeleted } = created;
      
      return {
        id: commentId,
        ...commentWithoutDeleted,
        isLocked: commentWithoutDeleted.isLocked || false,
        parentAuthor: commentWithoutDeleted.parentAuthor || null,
      };
    } catch (error) {
      console.error("Create comment error:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("Failed to create comment");
    }
  }

  /**
   * 댓글 목록 조회
   * @param {string} communityId - 커뮤니티 ID
   * @param {string} postId - 게시글 ID
   * @param {Object} options - 조회 옵션
   * @return {Promise<Object>} 댓글 목록
   */
  async getComments(communityId, postId, options = {}, viewerId = null) {
    try {
      const {page = 0, size = 10} = options;

      const post = await this.firestoreService.getDocument(
        `communities/${communityId}/posts`,
        postId,
      );
      if (!post) {
        const error = new Error("게시글을 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      const pageNumber = parseInt(page);
      const pageSize = parseInt(size);

      const parentCommentsResult = await this.firestoreService.getWithPagination({
        page: pageNumber,
        size: pageSize,
        orderBy: "createdAt",
        orderDirection: "asc",
        where: [
          { field: "postId", operator: "==", value: postId },
          { field: "parentId", operator: "==", value: null }
        ]
      });

      const paginatedParentComments = parentCommentsResult.content || [];

      const commentsWithReplies = [];

      let likedCommentIds = new Set();

      if (paginatedParentComments.length > 0) {
        const parentIds = paginatedParentComments.map(comment => comment.id);
        
        if (parentIds.length > CommentService.MAX_PARENT_COMMENTS_FOR_REPLIES) {
          console.warn(`부모댓글: (${parentIds.length}) ${CommentService.MAX_PARENT_COMMENTS_FOR_REPLIES}개 초과`);
          parentIds.splice(CommentService.MAX_PARENT_COMMENTS_FOR_REPLIES);
        }

        // 모든 하위 댓글 조회 (parentId가 null이 아닌 모든 댓글)
        const allReplies = await this.firestoreService.getCollectionWhereMultiple(
          "comments",
          [
            { field: "postId", operator: "==", value: postId },
            { field: "parentId", operator: "!=", value: null }
          ]
        );

        // 원댓글 ID를 키로 하는 맵 생성
        const rootCommentMap = {};
        paginatedParentComments.forEach(comment => {
          rootCommentMap[comment.id] = true;
        });

        // 각 댓글의 원댓글을 찾는 함수
        const findRootCommentId = (comment, allCommentsMap) => {
          if (!comment.parentId) {
            return comment.id;
          }
          const parent = allCommentsMap[comment.parentId];
          if (!parent) {
            return null;
          }
          if (rootCommentMap[parent.id]) {
            return parent.id;
          }
          return findRootCommentId(parent, allCommentsMap);
        };

        // 모든 댓글을 맵으로 변환 (빠른 조회를 위해)
        const allCommentsMap = {};
        paginatedParentComments.forEach(comment => {
          allCommentsMap[comment.id] = comment;
        });
        allReplies.forEach(reply => {
          allCommentsMap[reply.id] = reply;
        });

        // 원댓글별로 모든 하위 댓글 그룹화
        const repliesByRootId = {};
        allReplies.forEach(reply => {
          const rootId = findRootCommentId(reply, allCommentsMap);
          if (rootId && rootCommentMap[rootId]) {
            if (!repliesByRootId[rootId]) {
              repliesByRootId[rootId] = [];
            }
            repliesByRootId[rootId].push(reply);
          }
        });

        if (viewerId) {
          const replyIds = allReplies.map(reply => reply.id);
          const collectedIds = [...parentIds, ...replyIds].filter(Boolean);
          if (collectedIds.length > 0) {
            likedCommentIds = await this.getUserLikedCommentIds(collectedIds, viewerId);
          }
        }

        // 댓글 작성자 프로필 이미지 배치 조회
        const commentUserIds = [
          ...paginatedParentComments.map(comment => comment.userId),
          ...allReplies.map(reply => reply.userId)
        ].filter(Boolean);
        const uniqueUserIds = Array.from(new Set(commentUserIds));
        
        const profileImageMap = {};
        if (uniqueUserIds.length > 0) {
          try {
            // Firestore 'in' 쿼리는 최대 10개만 지원하므로 청크로 나누어 처리
            const chunks = [];
            for (let i = 0; i < uniqueUserIds.length; i += 10) {
              chunks.push(uniqueUserIds.slice(i, i + 10));
            }

            const userResults = await Promise.all(
              chunks.map((chunk) =>
                this.firestoreService.getCollectionWhereIn("users", "__name__", chunk),
              ),
            );
            userResults
              .flat()
              .filter((user) => user?.id)
              .forEach((user) => {
                profileImageMap[user.id] = user.profileImageUrl || null;
              });
          } catch (error) {
            console.warn("[COMMENT] 작성자 프로필 이미지 배치 조회 실패:", error.message);
          }
        }

        for (const comment of paginatedParentComments) {
          const replies = repliesByRootId[comment.id] || [];
         
          const ts = (t) => {
            if (t && typeof t.toMillis === "function") return t.toMillis();
            const ms = new Date(t).getTime();
            return Number.isFinite(ms) ? ms : 0;
          };
          const sortedReplies = replies
            .sort((a, b) => ts(a.createdAt) - ts(b.createdAt))
            .slice(0, 50)
            .map(reply => {
              const { media, parentAuthor: _parentAuthor, ...replyWithoutDeleted } = reply;
              const replyResult = {
                ...replyWithoutDeleted,
                userId: reply.userId || null, // 작성자 UID 추가
                isDeleted: reply.isDeleted || false,
                isLiked: viewerId ? likedCommentIds.has(reply.id) : false,
                reportsCount: reply.reportsCount || 0,
                parentAuthor: reply.parentAuthor || null,
                profileImageUrl: reply.userId ? (profileImageMap[reply.userId] || null) : null,
              };
              return replyResult;
            });

          const { media, parentAuthor: _parentAuthor, ...commentWithoutDeleted } = comment;

          const processedComment = {
            ...commentWithoutDeleted,
            userId: comment.userId || null, // 작성자 UID 추가
            isDeleted: comment.isDeleted || false,
            replies: sortedReplies,
            repliesCount: replies.length,
            isLiked: viewerId ? likedCommentIds.has(comment.id) : false,
            reportsCount: comment.reportsCount || 0,
            parentAuthor: comment.parentAuthor || null,
            profileImageUrl: comment.userId ? (profileImageMap[comment.userId] || null) : null,
          };

          commentsWithReplies.push(processedComment);
        }
      }

      let commentAuthorName = null;
      if (viewerId) {
        try {
          const programType = CommentService.normalizeProgramType(
            post.programType || post.type
          );

          if (programType === CommentService.PROGRAM_TYPES.TMI) {
            const userProfile = await this.firestoreService.getDocument("users", viewerId);
            commentAuthorName = userProfile?.name || null;
          } else {
            const members = await this.firestoreService.getCollectionWhere(
              `communities/${communityId}/members`,
              "userId",
              "==",
              viewerId
            );
            const memberData = members && members[0];

            if (memberData && memberData.nickname) {
              commentAuthorName = memberData.nickname;
            } else {
              const userProfile = await this.firestoreService.getDocument("users", viewerId);
              commentAuthorName = userProfile?.nickname || null;
            }
          }
        } catch (error) {
          console.warn("[COMMENT] commentAuthorName 조회 실패:", error.message);
          commentAuthorName = null;
        }
      }

      return {
        content: commentsWithReplies,
        pagination: parentCommentsResult.pageable || {
          pageNumber,
          pageSize,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
          isFirst: true,
          isLast: true,
        },
        commentAuthorName,
      };
    } catch (error) {
      console.error("Get comments error:", error.message);
      if (error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("Failed to get comments");
    }
  }

  async getUserLikedCommentIds(commentIds, userId) {
    if (!userId || !Array.isArray(commentIds) || commentIds.length === 0) {
      return new Set();
    }

    const uniqueIds = Array.from(new Set(commentIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return new Set();
    }

    try {
      const chunks = [];
      for (let i = 0; i < uniqueIds.length; i += 10) {
        chunks.push(uniqueIds.slice(i, i + 10));
      }

      const snapshots = await Promise.all(
        chunks.map((chunk) =>
          this.firestoreService.db
            .collection("likes")
            .where("userId", "==", userId)
            .where("type", "==", "COMMENT")
            .where("targetId", "in", chunk)
            .get()
        )
      );

      const likedIds = new Set();
      snapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data?.targetId) {
            likedIds.add(data.targetId);
          }
        });
      });

      return likedIds;
    } catch (error) {
      console.warn("[CommentService] 사용자 댓글 좋아요 조회 실패:", error.message);
      return new Set();
    }
  }

  /**
   * 댓글 수정
   * @param {string} commentId - 댓글 ID
   * @param {Object} updateData - 수정할 데이터
   * @param {string} userId - 사용자 ID (소유권 검증용)
   * @return {Promise<Object>} 수정된 댓글
   */
  async updateComment(commentId, updateData, userId) {
    try {
      const {content} = updateData;

      // 댓글 존재 확인
      const comment = await this.firestoreService.getDocument("comments", commentId);
      if (!comment) {
        const error = new Error("댓글을 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      if (comment.userId !== userId) {
        const error = new Error("댓글 수정 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      if (comment.isDeleted) {
        const error = new Error("삭제된 댓글은 수정할 수 없습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        const error = new Error("댓글 내용은 필수입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      // const textWithoutTags = content.replace(/<[^>]*>/g, '').trim();
      // if (textWithoutTags.length === 0) {
      //   const error = new Error("댓글에 텍스트 내용이 필요합니다.");
      //   error.code = "BAD_REQUEST";
      //   throw error;
      // }

      const sanitizedContent = sanitizeContent(content);

      // const sanitizedText = sanitizedContent.replace(/<[^>]*>/g, '').trim();
      // if (sanitizedText.length === 0) {
      //   const error = new Error("sanitize 후 유효한 텍스트 내용이 없습니다.");
      //   error.code = "BAD_REQUEST";
      //   throw error;
      // }

      const updatedData = {
        content: sanitizedContent,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await this.firestoreService.updateDocument("comments", commentId, updatedData);

      const { isDeleted, media, userId: _userId, ...commentWithoutDeleted } = comment;
      
      return {
        id: commentId,
        ...commentWithoutDeleted,
        ...updatedData,
        isLocked: commentWithoutDeleted.isLocked || false,
      };
    } catch (error) {
      console.error("Update comment error:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
        throw error;
      }
      throw new Error("Failed to update comment");
    }
  }

  /**
   * 댓글 삭제
   * @param {string} commentId - 댓글 ID
   * @param {string} userId - 사용자 ID (소유권 검증용)
   * @return {Promise<void>}
   */
  async deleteComment(commentId, userId) {
    try {
      const comment = await this.firestoreService.getDocument("comments", commentId);
      if (!comment) {
        const error = new Error("댓글을 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      if (comment.userId !== userId) {
        const error = new Error("댓글 삭제 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      // 대댓글 확인 (삭제되지 않은 댓글만)
      const replies = await this.firestoreService.getCollectionWhereMultiple(
        "comments",
        [
          {field: "parentId", operator: "==", value: commentId},
          {field: "isDeleted", operator: "==", value: false}
        ]
      );

      if (replies && replies.length > 0) {
        // 대댓글이 있으면 소프트 딜리트
        await this.firestoreService.runTransaction(async (transaction) => {
          const commentRef = this.firestoreService.db.collection("comments").doc(commentId);
          
          // 리워드 차감 처리
          await this.getRewardService().handleRewardOnCommentDeletion(userId, commentId, transaction);
          
          // 소프트 딜리트
          transaction.update(commentRef, {
            isDeleted: true,
            userId: null,
            author: "알 수 없음",
            content: "삭제된 댓글입니다",
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } else {
        // 대댓글이 없으면 하드 딜리트
        await this.firestoreService.runTransaction(async (transaction) => {
        const commentRef = this.firestoreService.db.collection("comments").doc(commentId);
        const postRef = this.firestoreService.db.collection(
          `communities/${comment.communityId}/posts`
        ).doc(comment.postId);
        const commentedPostRef = this.firestoreService.db.collection(
          `users/${userId}/commentedPosts`
        ).doc(comment.postId);

        const remainingSnapshot = await transaction.get(
          this.firestoreService.db
            .collection("comments")
            .where("postId", "==", comment.postId)
            .where("userId", "==", userId)
        );
        
        const remainingCount = remainingSnapshot.docs.filter(
          (doc) => doc.id !== commentId
        ).length;

        // 리워드 차감 처리
        await this.getRewardService().handleRewardOnCommentDeletion(userId, commentId, transaction);

        // 댓글 실제 삭제
        transaction.delete(commentRef);

        transaction.update(postRef, {
          commentsCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 남은 댓글이 없으면 commentedPosts에서 제거
        if (remainingCount === 0) {
          transaction.delete(commentedPostRef);
        }
      });
      }
    } catch (error) {
      console.error("Delete comment error:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
        throw error;
      }
      throw new Error("Failed to delete comment");
    }
  }

  /**
   * 댓글 좋아요 토글
   * @param {string} commentId - 댓글 ID
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>} 좋아요 결과
   */
  async toggleCommentLike(commentId, userId) {
    try {
      const result = await this.firestoreService.runTransaction(async (transaction) => {
        const commentRef = this.firestoreService.db.collection("comments").doc(commentId);
        const commentDoc = await transaction.get(commentRef);

        if (!commentDoc.exists) {
          const error = new Error("댓글을 찾을 수 없습니다.");
          error.code = "NOT_FOUND";
          throw error;
        }

        const comment = commentDoc.data();
        if (comment.isDeleted) {
          const error = new Error("삭제된 댓글에는 좋아요를 할 수 없습니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }

        const likesCollection = this.firestoreService.db.collection("likes");
        const likeQuery = likesCollection
          .where("type", "==", "COMMENT")
          .where("targetId", "==", commentId)
          .where("userId", "==", userId)
          .limit(1);
        const likeSnapshot = await transaction.get(likeQuery);
        const existingLikeDoc = likeSnapshot.empty ? null : likeSnapshot.docs[0];
        let isLiked = false;

        if (existingLikeDoc) {
          transaction.delete(existingLikeDoc.ref);
          isLiked = false;

          transaction.update(commentRef, {
            likesCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const newLikeRef = likesCollection.doc();
          transaction.set(newLikeRef, {
            type: "COMMENT",
            targetId: commentId,
            userId,
            createdAt: FieldValue.serverTimestamp(),
          });
          isLiked = true;

          transaction.update(commentRef, {
            likesCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        const currentLikesCount = comment.likesCount || 0;
        return {
          commentId,
          userId,
          isLiked,
          likesCount: isLiked
            ? currentLikesCount + 1
            : Math.max(0, currentLikesCount - 1),
        };
      });

      if (result.isLiked) {
        const comment = await this.firestoreService.getDocument("comments", result.commentId);

        if (comment.userId !== userId) {
          try {
            // 게시글 정보 가져오기 (isPublic 확인용)
            const post = await this.firestoreService.getDocument(
              `communities/${comment.communityId}/posts`,
              comment.postId
            );
            const isPrivatePost = post?.isPublic === false;
            let likerName = "사용자";

            if (isPrivatePost) {
              // 비공개 게시글: members 컬렉션에서 가져오기
              const members = await this.firestoreService.getCollectionWhere(
                `communities/${comment.communityId}/members`,
                "userId",
                "==",
                userId
              );
              const memberData = members && members[0];
              if (memberData) {
                likerName = memberData.nickname || "사용자";
              }
            } else {
              // 공개 게시글: nicknames 컬렉션에서 가져오기
              const nicknames = await this.firestoreService.getCollectionWhere(
                "nicknames",
                "uid",
                "==",
                userId
              );
              const nicknameDoc = nicknames && nicknames[0];
              if (nicknameDoc) {
                likerName = nicknameDoc.id || nicknameDoc.nickname || "사용자";
              }
            }

            const textOnly = typeof comment.content === 'string' 
              ? comment.content.replace(/<[^>]*>/g, '') 
              : comment.content;
            const commentPreview = textOnly || "댓글";
            const preview =
              commentPreview.length > CommentService.MAX_NOTIFICATION_TEXT_LENGTH
                ? commentPreview.substring(0, CommentService.MAX_NOTIFICATION_TEXT_LENGTH) + "..."
                : commentPreview;

            const link = NOTIFICATION_LINKS.POST(comment.postId, comment.communityId);
            fcmHelper
              .sendNotification(
                comment.userId,
                "댓글에 좋아요가 달렸습니다",
                `${likerName}님이 "${preview}" 댓글에 좋아요를 눌렀습니다`,
                "COMMENT_LIKE",
                comment.postId,
                comment.communityId,
                link,
                comment.id
              )
              .catch((error) => {
                console.error("댓글 좋아요 알림 전송 실패:", error);
              });
          } catch (error) {
            console.error("댓글 좋아요 알림 처리 실패:", error);
          }
        }
      }

      return result;
    } catch (error) {
      console.error("Toggle comment like error:", error.message);
      if (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST") {
        throw error;
      }
      throw new Error("Failed to toggle comment like");
    }
  }
}

module.exports = CommentService;
