const {FieldValue} = require("firebase-admin/firestore");
const FirestoreService = require("./firestoreService");
const fcmHelper = require("../utils/fcmHelper");
const {sanitizeContent} = require("../utils/sanitizeHelper");
const {isAdminUser} = require("../utils/helpers");

/**
 * QnA Service (비즈니스 로직 계층)
 * 프로그램/공지사항/스토어 QnA 관련 모든 비즈니스 로직 처리
 */
class QnAService {
  
  static MAX_PARENT_QNA_FOR_REPLIES = 10; 
  static MAX_NOTIFICATION_TEXT_LENGTH = 10;
  static PAGE_TYPES = {
    PROGRAM: "program",
    ANNOUNCEMENT: "announcement",
    STORE: "store",
  };

  static validatePageType(value) {
    if (!value || typeof value !== "string") {
      return null;
    }
    const lower = value.trim().toLowerCase();
    return Object.values(QnAService.PAGE_TYPES).includes(lower) ? lower : null;
  }

  constructor() {
    this.firestoreService = new FirestoreService("qna");
  }

  /**
   * QnA 생성
   * @param {string} pageId - Notion 페이지 ID
   * @param {string} pageType - 페이지 타입 ('program' | 'announcement' | 'store')
   * @param {string} userId - 사용자 ID
   * @param {Object} qnaData - QnA 데이터
   * @return {Promise<Object>} 생성된 QnA
   */
  async createQnA(pageId, pageType, userId, qnaData) {
    try {
      const {content, parentId = null} = qnaData;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        const error = new Error("QnA 내용은 필수입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const textWithoutTags = content.replace(/<[^>]*>/g, '').trim();
      if (textWithoutTags.length === 0) {
        const error = new Error("QnA에 텍스트 내용이 필요합니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const sanitizedContent = sanitizeContent(content);

      const sanitizedText = sanitizedContent.replace(/<[^>]*>/g, '').trim();
      if (sanitizedText.length === 0) {
        const error = new Error("sanitize 후 유효한 텍스트 내용이 없습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      // pageType 검증
      const validatedPageType = QnAService.validatePageType(pageType);
      if (!validatedPageType) {
        const error = new Error("유효하지 않은 페이지 타입입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      let parentQnA = null;
      if (parentId) {
        parentQnA = await this.firestoreService.getDocument("qna", parentId);
        if (!parentQnA) {
          const error = new Error("부모 QnA를 찾을 수 없습니다.");
          error.code = "NOT_FOUND";
          throw error;
        }

        if (parentQnA.parentId) {
          const error = new Error("대댓글은 2레벨까지만 허용됩니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }

        // 부모 QnA가 같은 페이지의 것인지 확인
        if (parentQnA.pageId !== pageId) {
          const error = new Error("다른 페이지의 QnA에는 답글을 달 수 없습니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }
      }

      // 작성자 닉네임 조회 (nicknames 컬렉션에서)
      let author = "익명";
      try {
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
      } catch (nicknameError) {
        console.warn("Failed to get nickname for QnA creation:", nicknameError.message);
      }

      // 관리자 여부 확인
      const isAdmin = await isAdminUser(userId);

      const newQnA = {
        pageId,
        pageType: validatedPageType,
        userId,
        author,
        content: sanitizedContent,
        parentId,
        likesCount: 0,
        isDeleted: false,
        isLocked: false,
        isAdmin,
        depth: parentId ? 1 : 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const qnaRef = this.firestoreService.db.collection("qna").doc();
      await qnaRef.set(newQnA);
      const qnaId = qnaRef.id;

      const created = await this.firestoreService.getDocument("qna", qnaId);

      // 알림 전송: 대댓글인 경우만
      if (parentId && parentQnA && parentQnA.userId !== userId) {
        const textOnly = typeof parentQnA.content === 'string' 
          ? parentQnA.content.replace(/<[^>]*>/g, '') 
          : parentQnA.content;
        const qnaPreview = textOnly || "문의";
        const preview = qnaPreview.length > QnAService.MAX_NOTIFICATION_TEXT_LENGTH ? 
          qnaPreview.substring(0, QnAService.MAX_NOTIFICATION_TEXT_LENGTH) + "..." : 
          qnaPreview;

        const commenterName = author !== "익명" ? author : "사용자";
        console.log(`QnA 답글 알림 전송: ${parentQnA.userId}에게 답글 알림`);
        fcmHelper.sendNotification(
          parentQnA.userId,
          "새로운 답글이 달렸습니다",
          `${commenterName}님이 "${preview}"에 답글을 남겼습니다.`,
          "QNA",
          pageId,
          "",
          "",
          qnaId
        ).catch(error => {
          console.error("QnA 답글 알림 전송 실패:", error);
        });
      }
      // 첫 댓글인 경우: Notion 페이지 작성자 정보를 알 수 없으므로 알림 생략
      // console.log('[QnAService] Notion 페이지의 첫 댓글이므로 알림을 보내지 않습니다.');

      // 응답에서 제외할 필드
      const { isDeleted, media, userId: _userId, ...qnaWithoutDeleted } = created;
      
      return {
        id: qnaId,
        ...qnaWithoutDeleted,
        isLocked: qnaWithoutDeleted.isLocked || false,
      };
    } catch (error) {
      console.error("Create QnA error:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") {
        throw error;
      }
      throw new Error("Failed to create QnA");
    }
  }

  /**
   * QnA 목록 조회
   * @param {string} pageId - Notion 페이지 ID
   * @param {Object} options - 조회 옵션
   * @param {string|null} viewerId - 조회하는 사용자 ID (좋아요 여부 확인용)
   * @return {Promise<Object>} QnA 목록
   */
  async getQnAs(pageId, options = {}, viewerId = null) {
    try {
      const {page = 0, size = 10} = options;

      const pageNumber = parseInt(page);
      const pageSize = parseInt(size);

      const parentQnAsResult = await this.firestoreService.getWithPagination({
        page: pageNumber,
        size: pageSize,
        orderBy: "createdAt",
        orderDirection: "desc",
        where: [
          { field: "pageId", operator: "==", value: pageId },
          { field: "parentId", operator: "==", value: null }
        ]
      });

      const paginatedParentQnAs = parentQnAsResult.content || [];

      const qnasWithReplies = [];

      let likedQnAIds = new Set();

      if (paginatedParentQnAs.length > 0) {
        const parentIds = paginatedParentQnAs.map(qna => qna.id);
        
        if (parentIds.length > QnAService.MAX_PARENT_QNA_FOR_REPLIES) {
          console.warn(`부모 QnA: (${parentIds.length}) ${QnAService.MAX_PARENT_QNA_FOR_REPLIES}개 초과`);
          parentIds.splice(QnAService.MAX_PARENT_QNA_FOR_REPLIES);
        }

        const allReplies = await this.firestoreService.getCollectionWhereMultiple(
          "qna",
          [
            { field: "parentId", operator: "in", value: parentIds }
          ]
        );

        const repliesByParentId = {};
        allReplies.forEach(reply => {
          if (!repliesByParentId[reply.parentId]) {
            repliesByParentId[reply.parentId] = [];
          }
          repliesByParentId[reply.parentId].push(reply);
        });

        if (viewerId) {
          const replyIds = allReplies.map(reply => reply.id);
          const collectedIds = [...parentIds, ...replyIds].filter(Boolean);
          if (collectedIds.length > 0) {
            likedQnAIds = await this.getUserLikedQnAIds(collectedIds, viewerId);
          }
        }

        for (const qna of paginatedParentQnAs) {
          const replies = repliesByParentId[qna.id] || [];
         
          const ts = (t) => {
            if (t && typeof t.toMillis === "function") return t.toMillis();
            const ms = new Date(t).getTime();
            return Number.isFinite(ms) ? ms : 0;
          };
          const sortedReplies = replies
            .sort((a, b) => ts(a.createdAt) - ts(b.createdAt))
            .slice(0, 50)
            .map(reply => {
              const { media, userId: _userId, ...replyWithoutDeleted } = reply;
              const replyResult = {
                ...replyWithoutDeleted,
                isDeleted: reply.isDeleted || false,
                isAdmin: reply.isAdmin || false,
              };
              if (viewerId) {
                replyResult.isLiked = likedQnAIds.has(reply.id);
              }
              return replyResult;
            });

          const { media, userId: _userId, ...qnaWithoutDeleted } = qna;

          const processedQnA = {
            ...qnaWithoutDeleted,
            isDeleted: qna.isDeleted || false,
            isAdmin: qna.isAdmin || false,
            replies: sortedReplies,
            repliesCount: replies.length, 
          };
          if (viewerId) {
            processedQnA.isLiked = likedQnAIds.has(qna.id);
          }

          qnasWithReplies.push(processedQnA);
        }
      }

      return {
        content: qnasWithReplies,
        pagination: parentQnAsResult.pageable || {
          pageNumber,
          pageSize,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
          isFirst: true,
          isLast: true,
        },
      };
    } catch (error) {
      console.error("Get QnAs error:", error.message);
      throw new Error("Failed to get QnAs");
    }
  }

  async getUserLikedQnAIds(qnaIds, userId) {
    if (!userId || !Array.isArray(qnaIds) || qnaIds.length === 0) {
      return new Set();
    }

    const uniqueIds = Array.from(new Set(qnaIds.filter(Boolean)));
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
            .where("type", "==", "QNA")
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
      console.warn("[QnAService] 사용자 QnA 좋아요 조회 실패:", error.message);
      return new Set();
    }
  }

  /**
   * QnA 수정
   * @param {string} qnaId - QnA ID
   * @param {Object} updateData - 수정할 데이터
   * @param {string} userId - 사용자 ID (소유권 검증용)
   * @return {Promise<Object>} 수정된 QnA
   */
  async updateQnA(qnaId, updateData, userId) {
    try {
      const {content} = updateData;

      // QnA 존재 확인
      const qna = await this.firestoreService.getDocument("qna", qnaId);
      if (!qna) {
        const error = new Error("QnA를 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      if (qna.userId !== userId) {
        const error = new Error("QnA 수정 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      if (qna.isDeleted) {
        const error = new Error("삭제된 QnA는 수정할 수 없습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        const error = new Error("QnA 내용은 필수입니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const textWithoutTags = content.replace(/<[^>]*>/g, '').trim();
      if (textWithoutTags.length === 0) {
        const error = new Error("QnA에 텍스트 내용이 필요합니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const sanitizedContent = sanitizeContent(content);

      const sanitizedText = sanitizedContent.replace(/<[^>]*>/g, '').trim();
      if (sanitizedText.length === 0) {
        const error = new Error("sanitize 후 유효한 텍스트 내용이 없습니다.");
        error.code = "BAD_REQUEST";
        throw error;
      }

      const updatedData = {
        content: sanitizedContent,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await this.firestoreService.updateDocument("qna", qnaId, updatedData);

      const { isDeleted, media, userId: _userId, ...qnaWithoutDeleted } = qna;
      
      return {
        id: qnaId,
        ...qnaWithoutDeleted,
        ...updatedData,
        isLocked: qnaWithoutDeleted.isLocked || false,
      };
    } catch (error) {
      console.error("Update QnA error:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
        throw error;
      }
      throw new Error("Failed to update QnA");
    }
  }

  /**
   * QnA 삭제
   * @param {string} qnaId - QnA ID
   * @param {string} userId - 사용자 ID (소유권 검증용)
   * @return {Promise<void>}
   */
  async deleteQnA(qnaId, userId) {
    try {
      const qna = await this.firestoreService.getDocument("qna", qnaId);
      if (!qna) {
        const error = new Error("QnA를 찾을 수 없습니다.");
        error.code = "NOT_FOUND";
        throw error;
      }

      if (qna.userId !== userId) {
        const error = new Error("QnA 삭제 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }

      // 답글 확인 (삭제되지 않은 것만)
      const replies = await this.firestoreService.getCollectionWhereMultiple(
        "qna",
        [
          {field: "parentId", operator: "==", value: qnaId},
          {field: "isDeleted", operator: "==", value: false}
        ]
      );

      if (replies && replies.length > 0) {
        // 답글이 있으면 소프트 딜리트
        const qnaRef = this.firestoreService.db.collection("qna").doc(qnaId);
        await qnaRef.update({
          isDeleted: true,
          author: "알 수 없음",
          content: "삭제된 문의입니다",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        // 답글이 없으면 하드 딜리트
        const qnaRef = this.firestoreService.db.collection("qna").doc(qnaId);
        await qnaRef.delete();
      }
    } catch (error) {
      console.error("Delete QnA error:", error.message);
      if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
        throw error;
      }
      throw new Error("Failed to delete QnA");
    }
  }

  /**
   * QnA 좋아요 토글
   * @param {string} qnaId - QnA ID
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>} 좋아요 결과
   */
  async toggleQnALike(qnaId, userId) {
    try {
      const result = await this.firestoreService.runTransaction(async (transaction) => {
        const qnaRef = this.firestoreService.db.collection("qna").doc(qnaId);
        const qnaDoc = await transaction.get(qnaRef);

        if (!qnaDoc.exists) {
          const error = new Error("QnA를 찾을 수 없습니다.");
          error.code = "NOT_FOUND";
          throw error;
        }

        const qna = qnaDoc.data();
        if (qna.isDeleted) {
          const error = new Error("삭제된 QnA에는 좋아요를 할 수 없습니다.");
          error.code = "BAD_REQUEST";
          throw error;
        }

        const likesCollection = this.firestoreService.db.collection("likes");
        const likeQuery = likesCollection
          .where("type", "==", "QNA")
          .where("targetId", "==", qnaId)
          .where("userId", "==", userId)
          .limit(1);
        const likeSnapshot = await transaction.get(likeQuery);
        const existingLikeDoc = likeSnapshot.empty ? null : likeSnapshot.docs[0];
        let isLiked = false;

        if (existingLikeDoc) {
          transaction.delete(existingLikeDoc.ref);
          isLiked = false;

          transaction.update(qnaRef, {
            likesCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const newLikeRef = likesCollection.doc();
          transaction.set(newLikeRef, {
            type: "QNA",
            targetId: qnaId,
            userId,
            createdAt: FieldValue.serverTimestamp(),
          });
          isLiked = true;

          transaction.update(qnaRef, {
            likesCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        const currentLikesCount = qna.likesCount || 0;
        return {
          qnaId,
          userId,
          isLiked,
          likesCount: isLiked
            ? currentLikesCount + 1
            : Math.max(0, currentLikesCount - 1),
        };
      });

      if (result.isLiked) {
        const qna = await this.firestoreService.getDocument("qna", result.qnaId);

        if (qna.userId !== userId) {
          try {
            // 좋아요 누른 사용자 닉네임 조회
            let likerName = "사용자";
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

            const textOnly = typeof qna.content === 'string' 
              ? qna.content.replace(/<[^>]*>/g, '') 
              : qna.content;
            const qnaPreview = textOnly || "문의";
            const preview =
              qnaPreview.length > QnAService.MAX_NOTIFICATION_TEXT_LENGTH
                ? qnaPreview.substring(0, QnAService.MAX_NOTIFICATION_TEXT_LENGTH) + "..."
                : qnaPreview;

            fcmHelper
              .sendNotification(
                qna.userId,
                "문의에 좋아요가 달렸습니다",
                `${likerName}님이 "${preview}" 문의에 좋아요를 눌렀습니다`,
                "QNA_LIKE",
                qna.pageId,
                "",
                "",
                qna.id
              )
              .catch((error) => {
                console.error("QnA 좋아요 알림 전송 실패:", error);
              });
          } catch (error) {
            console.error("QnA 좋아요 알림 처리 실패:", error);
          }
        }
      }

      return result;
    } catch (error) {
      console.error("Toggle QnA like error:", error.message);
      if (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST") {
        throw error;
      }
      throw new Error("Failed to toggle QnA like");
    }
  }
}

module.exports = QnAService;

