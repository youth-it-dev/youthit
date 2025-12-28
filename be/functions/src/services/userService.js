const {FieldValue} = require("firebase-admin/firestore");
const {admin, db} = require("../config/database");
const FirestoreService = require("./firestoreService");
const {isAdminUser} = require("../utils/helpers");
const NicknameService = require("./nicknameService");
const TermsService = require("./termsService");
const {isValidPhoneNumber, normalizeKoreanPhoneNumber, formatDate} = require("../utils/helpers");
const {KAKAO_API_TIMEOUT, KAKAO_API_RETRY_DELAY, KAKAO_API_MAX_RETRIES} = require("../constants/kakaoConstants");
const {fetchKakaoAPI} = require("../utils/kakaoApiHelper");
const fileService = require("./fileService");
const { validateNicknameOrThrow } = require("../utils/nicknameValidator");
const CommunityService = require("./communityService");

// 기본 프로필 아바타 이미지 URL (공용 이미지)
const DEFAULT_PROFILE_AVATAR_URL = "https://storage.googleapis.com/youthvoice-2025.firebasestorage.app/files/cVZGcXR0yH67/Profile_Default_Ah5nnOc4lAVw.png";
const DEFAULT_PROFILE_AVATAR_PATH = "files/cVZGcXR0yH67/Profile_Default_Ah5nnOc4lAVw.png";

/**
 * User Service (비즈니스 로직 계층)
 * Firebase Auth + Firestore 통합 관리
 */
class UserService {
  constructor() {
    this.firestoreService = new FirestoreService("users");
    this.nicknameService = new NicknameService();
    this.termsService = new TermsService();
  }

  /**
   * 온보딩 업데이트
   * - 허용 필드만 부분 업데이트
   * - 닉네임 + 사용자 정보 (트랜잭션)
   * @param {Object} params
   * @param {string} params.uid - 사용자 ID
   * @param {Object} params.payload - 업데이트할 데이터
   * @param {string} params.payload.nickname - 닉네임 (필수)
   * @param {string} [params.payload.profileImageUrl] - 프로필 이미지 URL (선택)
   * @param {string} [params.payload.bio] - 자기소개 (선택)
   * @return {Promise<{status:string}>}
   */
  async updateOnboarding({uid, payload}) {
    // 1) 현재 사용자 문서 조회
    const existing = await this.firestoreService.getById(uid);
    if (!existing) {
      const e = new Error("사용자 정보를 찾을 수 없습니다.");
      e.code = "NOT_FOUND";
      throw e;
    }

    const restPayload = payload || {};

    // 2) 허용 필드 화이트리스트 적용
    const allowedFields = [
      "nickname",
      "profileImageUrl",
      "bio",
    ];
    const update = {};
    for (const key of allowedFields) {
      if (restPayload[key] !== undefined) update[key] = restPayload[key];
    }

    // 3) 필수 필드 체크
    if (!(typeof update.nickname === "string" && update.nickname.trim().length > 0)) {
      const e = new Error("REQUIRE_FIELDS_MISSING: nickname");
      e.code = "REQUIRE_FIELDS_MISSING";
      throw e;
    }

    // 닉네임 검증 (공백 제외, 한글/영어/숫자만, 최대 8글자)
    validateNicknameOrThrow(update.nickname);

    // 4) 프로필 이미지 검증
    let newProfileImagePath = null;
    let newProfileImageUrl = update.profileImageUrl !== undefined ? update.profileImageUrl : null;
    let previousProfilePath = existing.profileImagePath || null;

    let requestedProfileUrl = typeof update.profileImageUrl === "string"
      ? update.profileImageUrl.trim()
      : null;
    
    if (!requestedProfileUrl) {
      requestedProfileUrl = DEFAULT_PROFILE_AVATAR_URL;
      newProfileImageUrl = DEFAULT_PROFILE_AVATAR_URL;
      newProfileImagePath = DEFAULT_PROFILE_AVATAR_PATH;
    }

    let profileFileDoc = null;
    let thumbnailFile = null;
    let requestedProfilePath = null;

    if (requestedProfileUrl && requestedProfileUrl !== DEFAULT_PROFILE_AVATAR_URL) {
      try {
        profileFileDoc = await fileService.getFileByUrlForUser(requestedProfileUrl, uid);
      } catch (fileLookupError) {
        console.error("[USER][updateOnboarding] 프로필 파일 조회 실패", fileLookupError);
        throw fileLookupError;
      }

      requestedProfilePath = profileFileDoc.filePath;

      if (previousProfilePath && requestedProfilePath === previousProfilePath) {
        newProfileImagePath = previousProfilePath;
        if (newProfileImageUrl === null) {
          newProfileImageUrl = existing.profileImageUrl || requestedProfileUrl;
        }
      } else {
        try {
          const thumbnailFiles = await fileService.findThumbnailsByOriginalPaths([requestedProfilePath]);
          if (thumbnailFiles && thumbnailFiles.length > 0) {
            thumbnailFile = thumbnailFiles[0];
          }
        } catch (thumbnailError) {
          console.warn("[USER][updateOnboarding] 썸네일 조회 실패 (원본 사용):", thumbnailError);
        }

        if (thumbnailFile && thumbnailFile.fileUrl) {
          newProfileImagePath = thumbnailFile.filePath;
          newProfileImageUrl = thumbnailFile.fileUrl;
        
        } else {
          newProfileImagePath = profileFileDoc.filePath;
          if (newProfileImageUrl === null || newProfileImageUrl === requestedProfileUrl) {
            newProfileImageUrl = profileFileDoc.fileUrl || profileFileDoc.url || requestedProfileUrl;
          }

        }
      }
    }

    // 5) 닉네임 설정 및 사용자 문서 업데이트를 단일 트랜잭션으로 처리
    const nickname = update.nickname;
    const setNickname = typeof nickname === "string" && nickname.trim().length > 0;

    const userUpdate = {
      ...update,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    };

    if (newProfileImagePath) {
      userUpdate.profileImagePath = newProfileImagePath;
    }

    if (newProfileImageUrl !== null) {
      userUpdate.profileImageUrl = newProfileImageUrl;
    }

    // 트랜잭션으로 닉네임 + 사용자 업데이트 + 파일 메타데이터 업데이트 원자적 처리
    await db.runTransaction(async (transaction) => {
      // 닉네임 중복 체크 및 설정
      if (setNickname) {
        const lower = nickname.toLowerCase();
        const nickRef = db.collection("nicknames").doc(lower);
        const nickDoc = await transaction.get(nickRef);
        
        // 이미 존재하고 다른 사용자가 사용 중인 경우
        if (nickDoc.exists && nickDoc.data()?.uid !== uid) {
          const e = new Error("NICKNAME_TAKEN");
          e.code = "NICKNAME_TAKEN";
          throw e;
        }
        
        // 닉네임 설정 (트랜잭션 내)
        this.nicknameService.setNickname(transaction, nickname, uid, existing.nickname);
      }
      
      // 파일 메타데이터 업데이트 (트랜잭션 내)
      if (thumbnailFile && thumbnailFile.fileUrl) {
        // 썸네일 파일 메타데이터 업데이트
        const thumbnailRef = db.collection("files").doc(thumbnailFile.id);
        transaction.update(thumbnailRef, {
          profileOwner: uid,
          isUsed: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (profileFileDoc) {
        // 원본 파일 메타데이터 업데이트
        const fileRef = db.collection("files").doc(profileFileDoc.id);
        transaction.update(fileRef, {
          profileOwner: uid,
          isUsed: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      
      // 사용자 문서 업데이트 (트랜잭션 내)
      const userRef = db.collection("users").doc(uid);
      transaction.update(userRef, userUpdate);
    });

    // 트랜잭션 성공 후 원본 파일 삭제 (썸네일 사용 시)
    if (thumbnailFile && thumbnailFile.fileUrl && requestedProfilePath) {
      try {
        await fileService.deleteFile(requestedProfilePath, uid);
        console.log(`[USER][updateOnboarding] 원본 프로필 이미지 삭제 완료: ${requestedProfilePath}`);
      } catch (deleteError) {
        console.warn("[USER][updateOnboarding] 원본 프로필 이미지 삭제 실패 (트랜잭션은 성공):", deleteError.message);
        // 트랜잭션은 이미 성공했으므로 계속 진행
      }
    }

    const previousProfileUrl = existing.profileImageUrl || "";
    const isPreviousDefaultAvatar = previousProfileUrl === DEFAULT_PROFILE_AVATAR_URL;
    const isSwitchingToDefaultAvatar = requestedProfileUrl === DEFAULT_PROFILE_AVATAR_URL;

    const shouldDeletePrevious =
      previousProfilePath &&
      !isPreviousDefaultAvatar &&
      (
        (newProfileImagePath && previousProfilePath !== newProfileImagePath) ||
        (!newProfileImagePath && isSwitchingToDefaultAvatar)
      );

    if (shouldDeletePrevious) {
      try {
        await fileService.deleteFile(previousProfilePath, uid);
      } catch (cleanupError) {
        console.warn("[USER][updateOnboarding] 이전 프로필 이미지 삭제 실패", cleanupError.message);
      }
    } else if (previousProfilePath && isPreviousDefaultAvatar) {
      console.log("[USER][updateOnboarding] 기본 아바타 이미지는 삭제하지 않음");
    }


    // Notion에 사용자 동기화 (비동기로 실행, 실패해도 메인 프로세스에 영향 없음)
    const notionUserService = require("./notionUserService");
    notionUserService.syncSingleUserToNotion(uid)
        .then(result => {
          if (result.success) {
            console.log(`Notion 동기화 완료: ${uid}`);
          } else {
            console.warn(`Notion 동기화 실패: ${uid} - ${result.error || result.reason}`);
          }
        })
        .catch(error => {
          console.error(`Notion 동기화 오류: ${uid}`, error);
        });

    return {success: true};
  }

  /**
   * 모든 사용자 조회
   * @return {Promise<Array<Object>>} 사용자 목록
   */
  async getAllUsers() {
    try {
      return await this.firestoreService.getAll();
    } catch (error) {
      console.error("사용자 목록 조회 에러:", error.message);
      const e = new Error("사용자 목록을 조회할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 사용자 정보 조회
   * @param {string} uid - 사용자 ID
   * @return {Promise<Object|null>} 사용자 정보
   */
  async getUserById(uid) {
    try {
      return await this.firestoreService.getById(uid);
    } catch (error) {
      console.error("사용자 조회 에러:", error.message);
      const e = new Error("사용자를 조회할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 마이페이지 정보 조회
   * @param {string} uid - 사용자 ID
   * @return {Promise<Object>} 마이페이지 정보
   */
  async getMyPage(uid) {
    try {
      const user = await this.firestoreService.getById(uid);
      if (!user) {
        const e = new Error("사용자를 찾을 수 없습니다");
        e.code = "NOT_FOUND";
        throw e;
      }

      return {
        activityParticipationCount: user.activityParticipationCount || 0,
        certificationPosts: user.certificationPosts || 0,
        rewardPoints: user.rewards || 0,
        name: user.name || "",
        profileImageUrl: user.profileImageUrl || "",
        bio: user.bio || "",
      };
    } catch (error) {
      console.error("마이페이지 조회 에러:", error.message);
      if (error.code === "NOT_FOUND") {
        throw error;
      }
      const e = new Error("마이페이지 정보를 조회할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 사용자 정보 업데이트 (관리자용)
   * - 모든 필드 업데이트 가능
   * @param {string} uid - 사용자 ID
   * @param {Object} updateData - 업데이트할 데이터
   * @return {Promise<Object>} 업데이트된 사용자 정보
   */
  async updateUser(uid, updateData) {
    try {
      const updatePayload = {
        ...updateData,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      };

      return await this.firestoreService.update(uid, updatePayload);
    } catch (error) {
      console.error("사용자 업데이트 에러:", error.message);
      const e = new Error("사용자 정보를 업데이트할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 알림 설정 토글
   * - pushTermsAgreed 필드를 현재 값의 반대로 변경
   * @param {string} uid - 사용자 ID
   * @return {Promise<Object>} 업데이트된 사용자 정보
   */
  async togglePushNotification(uid) {
    try {
      // 현재 사용자 정보 조회
      const user = await this.firestoreService.getById(uid);
      if (!user) {
        const e = new Error("사용자를 찾을 수 없습니다");
        e.code = "NOT_FOUND";
        throw e;
      }

      // 현재 pushTermsAgreed 값 확인 및 토글
      const currentValue = user.pushTermsAgreed === true;
      const newValue = !currentValue;

      // 업데이트
      const updatePayload = {
        pushTermsAgreed: newValue,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      };

      await this.firestoreService.update(uid, updatePayload);

      // 업데이트된 사용자 정보 반환
      const updatedUser = await this.firestoreService.getById(uid);
      return updatedUser;
    } catch (error) {
      console.error("알림 설정 토글 에러:", error.message);
      if (error.code) {
        throw error;
      }
      const e = new Error("알림 설정을 변경할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 마케팅 약관 토글
   * - marketingTermsAgreed 필드를 현재 값의 반대로 변경
   * - 카카오 서비스 약관 API 연동 (동의/철회)
   * @param {string} uid - 사용자 ID
   * @param {string} accessToken - 카카오 액세스 토큰
   * @return {Promise<{marketingTermsAgreed: boolean}>}
   */
  async toggleMarketingTerms(uid, accessToken) {
    try {
      // 현재 사용자 정보 조회
      const user = await this.firestoreService.getById(uid);
      if (!user) {
        const e = new Error("사용자를 찾을 수 없습니다");
        e.code = "NOT_FOUND";
        throw e;
      }

      // 현재 marketingTermsAgreed 값 확인
      const currentValue = user.marketingTermsAgreed === true;

      // 토글: true → false (철회), false → true (동의)
      if (currentValue) {
        // 현재 동의 상태 → 철회
        return await this.termsService.revokeMarketingTerms(accessToken, uid);
      } else {
        // 현재 미동의 상태 → 동의
        return await this.termsService.agreeMarketingTerms(accessToken, uid);
      }
    } catch (error) {
      console.error("마케팅 약관 토글 에러:", error.message);
      if (error.code) {
        throw error;
      }
      const e = new Error("마케팅 약관 설정을 변경할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 사용자 삭제 (Firebase Auth + Firestore)
   * @param {string} uid
   * @return {Promise<void>}
   */
  async deleteUser(uid) {
    try {
      await admin.auth().deleteUser(uid);
      await this.firestoreService.delete(uid);
    } catch (error) {
      console.error("사용자 삭제 에러:", error.message);
      const e = new Error("사용자를 삭제할 수 없습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 계정 탈퇴 (게시글, 댓글, 프로필 이미지 등 모든 데이터 정리)
   * @param {string} uid - 사용자 ID
   * @return {Promise<{success: boolean}>}
   */
  async deleteAccount(uid) {
    try {
      console.log(`[ACCOUNT_DELETION] 시작: userId=${uid}`);

      // 1. 사용자 정보 조회
      const user = await this.firestoreService.getById(uid);
      if (!user) {
        const e = new Error("사용자를 찾을 수 없습니다");
        e.code = "NOT_FOUND";
        throw e;
      }

      // 2. 게시글 삭제 및 관련 데이터 정리
      await this._deleteUserPosts(uid);

      // 3. 댓글 삭제 (게시글에 속하지 않은 댓글들)
      await this._deleteUserComments(uid);

      console.log(`[ACCOUNT_DELETION] 완료: userId=${uid}`);
      return {success: true};
    } catch (error) {
      console.error(`[ACCOUNT_DELETION] 에러: userId=${uid}`, error.message);
      if (error.code) {
        throw error;
      }
      const e = new Error("계정 탈퇴 중 오류가 발생했습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 사용자가 작성한 게시글 삭제 및 관련 데이터 정리
   * @param {string} uid - 사용자 ID
   * @private
   */
  async _deleteUserPosts(uid) {
    try {
      // authoredPosts 서브컬렉션에서 모든 게시글 조회
      const authoredPostsService = new FirestoreService(`users/${uid}/authoredPosts`);
      const authoredPosts = await authoredPostsService.getAll();

      if (!authoredPosts || authoredPosts.length === 0) {
        console.log(`[ACCOUNT_DELETION] 작성한 게시글 없음: userId=${uid}`);
        return;
      }

      console.log(`[ACCOUNT_DELETION] 게시글 삭제 시작: ${authoredPosts.length}개`);

      // 각 게시글별로 처리
      for (const authoredPost of authoredPosts) {
        const {postId, communityId} = authoredPost;
        if (!postId || !communityId) continue;

        try {
          // 1. 해당 게시글의 모든 원댓글 조회 (순환 참조 방지를 위해 lazy require)
          const CommentService = require("./commentService");
          const commentsService = new CommentService();
          const parentComments = await commentsService.firestoreService.getCollectionWhereMultiple(
            "comments",
            [
              {field: "postId", operator: "==", value: postId},
              {field: "parentId", operator: "==", value: null}
            ]
          );

          // 2. 각 원댓글별로 대댓글 확인 후 삭제 처리
          if (parentComments && parentComments.length > 0) {
            let totalHardDeleteCount = 0;
            let totalSoftDeleteCount = 0;
            
            for (const comment of parentComments) {
              try {
                // 대댓글 확인 (삭제되지 않은 댓글만)
                const replies = await commentsService.firestoreService.getCollectionWhereMultiple(
                  "comments",
                  [
                    {field: "parentId", operator: "==", value: comment.id},
                    {field: "isDeleted", operator: "==", value: false}
                  ]
                );

                // 대댓글을 본인/타인으로 분류
                const myReplies = replies.filter(reply => reply.userId === uid);
                const otherReplies = replies.filter(reply => reply.userId !== uid);

                // 게시글 삭제 시에는 모든 댓글을 하드 딜리트
                if (replies.length > 0) {
                  await commentsService.firestoreService.runTransaction(async (transaction) => {
                    const commentRef = db.collection("comments").doc(comment.id);

                    transaction.delete(commentRef);

                    for (const reply of replies) {
                      const replyRef = db.collection("comments").doc(reply.id);
                      transaction.delete(replyRef);
                    }
                  });
                  totalHardDeleteCount += 1 + replies.length;
                  console.log(`[ACCOUNT_DELETION] 게시글 ${postId}의 댓글 ${comment.id} + 대댓글 ${replies.length}개 모두 하드 딜리트`);
                } else if (myReplies.length > 0) {
                  await commentsService.firestoreService.runTransaction(async (transaction) => {
                    const commentRef = db.collection("comments").doc(comment.id);

                    transaction.delete(commentRef);

                    for (const myReply of myReplies) {
                      const replyRef = db.collection("comments").doc(myReply.id);
                      transaction.delete(replyRef);
                    }
                  });
                  totalHardDeleteCount += 1 + myReplies.length;
                  console.log(`[ACCOUNT_DELETION] 게시글 ${postId}의 댓글 ${comment.id} + 대댓글 ${myReplies.length}개 모두 하드 딜리트`);
                } else {
                  // 대댓글이 없으면 원댓글만 하드 딜리트
                  await commentsService.firestoreService.runTransaction(async (transaction) => {
                    const commentRef = db.collection("comments").doc(comment.id);

                    transaction.delete(commentRef);
                  });
                  totalHardDeleteCount++;
                  console.log(`[ACCOUNT_DELETION] 게시글 ${postId}의 댓글 ${comment.id} 하드 딜리트`);
                }
              } catch (commentError) {
                console.error(`[ACCOUNT_DELETION] 게시글 ${postId}의 댓글 ${comment.id} 삭제 실패:`, commentError.message);
                // 개별 댓글 삭제 실패해도 계속 진행
              }
            }
            
            console.log(`[ACCOUNT_DELETION] 게시글 ${postId}의 댓글 처리 완료: 하드딜리트 ${totalHardDeleteCount}개, 소프트딜리트 ${totalSoftDeleteCount}개`);
          }

          // 3. 게시글 삭제 (이미지 포함, communityService 사용)
          const communityService = new CommunityService();
          await communityService.deletePost(communityId, postId, uid);

          // 4. 다른 사용자들의 서브컬렉션에서 제거
          await this._removePostFromOtherUsersSubCollections(postId);

          console.log(`[ACCOUNT_DELETION] 게시글 삭제 완료: postId=${postId}`);
        } catch (postError) {
          console.error(`[ACCOUNT_DELETION] 게시글 삭제 실패: postId=${postId}`, postError.message);
          // 개별 게시글 삭제 실패해도 계속 진행
        }
      }
    } catch (error) {
      console.error(`[ACCOUNT_DELETION] 게시글 삭제 중 오류:`, error.message);
      throw error;
    }
  }

  /**
   * 다른 사용자들의 서브컬렉션에서 게시글 제거
   * @param {string} postId - 게시글 ID
   * @private
   */
  async _removePostFromOtherUsersSubCollections(postId) {
    try {
      // likedPosts 서브컬렉션에서 제거
      const likedPostsQuery = db.collectionGroup("likedPosts")
        .where("postId", "==", postId)
        .limit(1000);
      
      const likedPostsSnapshot = await likedPostsQuery.get();
      
      if (!likedPostsSnapshot.empty) {
        const batch = db.batch();
        likedPostsSnapshot.forEach((doc) => {
          const pathParts = doc.ref.path.split("/");
          if (pathParts.length >= 4 && pathParts[0] === "users") {
            const userId = pathParts[1];
            const likedPostRef = db.collection(`users/${userId}/likedPosts`).doc(postId);
            batch.delete(likedPostRef);
          }
        });
        if (!likedPostsSnapshot.empty) {
          await batch.commit();
          console.log(`[ACCOUNT_DELETION] 다른 사용자들의 likedPosts에서 ${likedPostsSnapshot.size}개 제거`);
        }
      }

      // commentedPosts 서브컬렉션에서 제거
      const commentedPostsQuery = db.collectionGroup("commentedPosts")
        .where("postId", "==", postId)
        .limit(1000);
      
      const commentedPostsSnapshot = await commentedPostsQuery.get();
      
      if (!commentedPostsSnapshot.empty) {
        const batch = db.batch();
        commentedPostsSnapshot.forEach((doc) => {
          // doc.ref.path에서 userId 추출: users/{userId}/commentedPosts/{postId}
          const pathParts = doc.ref.path.split("/");
          if (pathParts.length >= 4 && pathParts[0] === "users") {
            const userId = pathParts[1];
            const commentedPostRef = db.collection(`users/${userId}/commentedPosts`).doc(postId);
            batch.delete(commentedPostRef);
          }
        });
        if (!commentedPostsSnapshot.empty) {
          await batch.commit();
          console.log(`[ACCOUNT_DELETION] 다른 사용자들의 commentedPosts에서 ${commentedPostsSnapshot.size}개 제거`);
        }
      }
    } catch (error) {
      console.error(`[ACCOUNT_DELETION] 다른 사용자 서브컬렉션 정리 실패:`, error.message);
      // 실패해도 계속 진행
    }
  }

  /**
   * 사용자가 작성한 댓글 삭제 (게시글에 속하지 않은 댓글들)
   * @param {string} uid - 사용자 ID
   * @private
   */
  async _deleteUserComments(uid) {
    try {
      // 순환 참조 방지를 위해 lazy require
      const CommentService = require("./commentService");
      const commentsService = new CommentService();
      
      // 사용자가 작성한 모든 원댓글 조회 (parentId가 null인 것만)
      const parentComments = await commentsService.firestoreService.getCollectionWhereMultiple(
        "comments",
        [
          {field: "userId", operator: "==", value: uid},
          {field: "parentId", operator: "==", value: null}
        ]
      );

      // 사용자가 작성한 모든 대댓글 조회 (다른 사람 원댓글에 단 대댓글)
      const myReplies = await commentsService.firestoreService.getCollectionWhereMultiple(
        "comments",
        [
          {field: "userId", operator: "==", value: uid},
          {field: "parentId", operator: "!=", value: null},
          {field: "isDeleted", operator: "==", value: false}
        ]
      );

      if ((!parentComments || parentComments.length === 0) && (!myReplies || myReplies.length === 0)) {
        console.log(`[ACCOUNT_DELETION] 작성한 댓글 없음: userId=${uid}`);
        return;
      }

      console.log(`[ACCOUNT_DELETION] 댓글 삭제 시작: 원댓글 ${parentComments?.length || 0}개, 대댓글 ${myReplies?.length || 0}개`);

      for (const comment of parentComments || []) {
        try {
          const replies = await commentsService.firestoreService.getCollectionWhereMultiple(
            "comments",
            [
              {field: "parentId", operator: "==", value: comment.id},
              {field: "isDeleted", operator: "==", value: false}
            ]
          );

          const myReplies = replies.filter(reply => reply.userId === uid);
          const otherReplies = replies.filter(reply => reply.userId !== uid);

          if (otherReplies.length > 0) {
            await commentsService.firestoreService.runTransaction(async (transaction) => {
              const commentRef = db.collection("comments").doc(comment.id);
              const postRef = db.collection(`communities/${comment.communityId}/posts`).doc(comment.postId);
              const commentedPostRef = db.collection(`users/${uid}/commentedPosts`).doc(comment.postId);

              // ===== 모든 읽기 작업 먼저 수행 =====
              const remainingSnapshot = await transaction.get(
                db.collection("comments")
                  .where("postId", "==", comment.postId)
                  .where("userId", "==", uid)
              );
              
              const remainingCount = remainingSnapshot.docs.filter(
                (doc) => doc.id !== comment.id && !myReplies.some(reply => reply.id === doc.id)
              ).length;

              transaction.update(commentRef, {
                isDeleted: true,
                userId: null,
                author: "알 수 없음",
                content: "삭제된 댓글입니다",
                updatedAt: FieldValue.serverTimestamp(),
              });

              for (const myReply of myReplies) {
                const replyRef = db.collection("comments").doc(myReply.id);
                transaction.delete(replyRef);
              }

              if (myReplies.length > 0) {
                transaction.update(postRef, {
                  commentsCount: FieldValue.increment(-myReplies.length),
                  updatedAt: FieldValue.serverTimestamp(),
                });
              }

              if (remainingCount === 0) {
                transaction.delete(commentedPostRef);
              }
            });
            console.log(`[ACCOUNT_DELETION] 댓글 소프트 딜리트 + 본인 대댓글 ${myReplies.length}개 하드 딜리트: commentId=${comment.id}`);
          } else if (myReplies.length > 0) {
            await commentsService.firestoreService.runTransaction(async (transaction) => {
              const commentRef = db.collection("comments").doc(comment.id);
              const postRef = db.collection(`communities/${comment.communityId}/posts`).doc(comment.postId);
              const commentedPostRef = db.collection(`users/${uid}/commentedPosts`).doc(comment.postId);

              const remainingSnapshot = await transaction.get(
                db.collection("comments")
                  .where("postId", "==", comment.postId)
                  .where("userId", "==", uid)
              );
              
              const remainingCount = remainingSnapshot.docs.filter(
                (doc) => doc.id !== comment.id && !myReplies.some(reply => reply.id === doc.id)
              ).length;
              transaction.delete(commentRef);

              for (const myReply of myReplies) {
                const replyRef = db.collection("comments").doc(myReply.id);
                transaction.delete(replyRef);
              }

              transaction.update(postRef, {
                commentsCount: FieldValue.increment(-1 - myReplies.length),
                updatedAt: FieldValue.serverTimestamp(),
              });

              if (remainingCount === 0) {
                transaction.delete(commentedPostRef);
              }
            });
            console.log(`[ACCOUNT_DELETION] 댓글 + 대댓글 ${myReplies.length}개 모두 하드 딜리트: commentId=${comment.id}`);
          } else {
            await commentsService.firestoreService.runTransaction(async (transaction) => {
              const commentRef = db.collection("comments").doc(comment.id);
              const postRef = db.collection(`communities/${comment.communityId}/posts`).doc(comment.postId);
              const commentedPostRef = db.collection(`users/${uid}/commentedPosts`).doc(comment.postId);

              const remainingSnapshot = await transaction.get(
                db.collection("comments")
                  .where("postId", "==", comment.postId)
                  .where("userId", "==", uid)
              );
              
              const remainingCount = remainingSnapshot.docs.filter(
                (doc) => doc.id !== comment.id
              ).length;

              transaction.delete(commentRef);

              transaction.update(postRef, {
                commentsCount: FieldValue.increment(-1),
                updatedAt: FieldValue.serverTimestamp(),
              });

              if (remainingCount === 0) {
                transaction.delete(commentedPostRef);
              }
            });
            console.log(`[ACCOUNT_DELETION] 댓글 하드 딜리트: commentId=${comment.id}`);
          }
        } catch (commentError) {
          console.error(`[ACCOUNT_DELETION] 댓글 삭제 실패: commentId=${comment.id}`, commentError.message);
        }
      }

      if (myReplies && myReplies.length > 0) {
        const processedReplyIds = new Set();
        for (const parentComment of parentComments || []) {
          const replies = await commentsService.firestoreService.getCollectionWhereMultiple(
            "comments",
            [
              {field: "parentId", operator: "==", value: parentComment.id},
              {field: "isDeleted", operator: "==", value: false}
            ]
          );
          replies.filter(reply => reply.userId === uid).forEach(reply => {
            processedReplyIds.add(reply.id);
          });
        }

        const unprocessedReplies = myReplies.filter(reply => !processedReplyIds.has(reply.id));

        for (const reply of unprocessedReplies) {
          try {
            const parentComment = await commentsService.firestoreService.getDocument("comments", reply.parentId);
            if (!parentComment) {
              console.warn(`[ACCOUNT_DELETION] 부모 댓글을 찾을 수 없음: parentId=${reply.parentId}`);
              continue;
            }

            const allRepliesToParent = await commentsService.firestoreService.getCollectionWhereMultiple(
              "comments",
              [
                {field: "parentId", operator: "==", value: reply.parentId},
                {field: "isDeleted", operator: "==", value: false}
              ]
            );

            const otherRepliesToParent = allRepliesToParent.filter(r => r.userId !== uid && r.id !== reply.id);

            await commentsService.firestoreService.runTransaction(async (transaction) => {
              const replyRef = db.collection("comments").doc(reply.id);
              const postRef = db.collection(`communities/${reply.communityId}/posts`).doc(reply.postId);
              const commentedPostRef = db.collection(`users/${uid}/commentedPosts`).doc(reply.postId);

              const remainingSnapshot = await transaction.get(
                db.collection("comments")
                  .where("postId", "==", reply.postId)
                  .where("userId", "==", uid)
              );
              
              const remainingCount = remainingSnapshot.docs.filter(
                (doc) => doc.id !== reply.id
              ).length;

              transaction.delete(replyRef);

              transaction.update(postRef, {
                commentsCount: FieldValue.increment(-1),
                updatedAt: FieldValue.serverTimestamp(),
              });

              if (remainingCount === 0) {
                transaction.delete(commentedPostRef);
              }
            });
            console.log(`[ACCOUNT_DELETION] 다른 사람 원댓글에 단 대댓글 하드 딜리트: replyId=${reply.id}, parentId=${reply.parentId}`);
          } catch (replyError) {
            console.error(`[ACCOUNT_DELETION] 대댓글 삭제 실패: replyId=${reply.id}`, replyError.message);
            // 개별 대댓글 삭제 실패해도 계속 진행
          }
        }
      }
    } catch (error) {
      console.error(`[ACCOUNT_DELETION] 댓글 삭제 중 오류:`, error.message);
      throw error;
    }
  }

  /**
   * 카카오 API 호출 (타임아웃 설정, 실패 시 에러 throw)
   * @param {string} url - API URL
   * @param {string} accessToken - 카카오 액세스 토큰
   * @param {number} maxRetries - 시도 횟수 (기본 1회, 재시도 없음)
   * @private
   */
  async _fetchKakaoAPI(url, accessToken, maxRetries = KAKAO_API_MAX_RETRIES) {
    return fetchKakaoAPI(url, accessToken, {
      maxRetries,
      retryDelay: KAKAO_API_RETRY_DELAY,
      timeout: KAKAO_API_TIMEOUT,
      throwOnError: true, // 실패 시 에러 throw
      serviceName: "UserService",
    });
  }

  /**
   * 카카오 OIDC userinfo + 서비스 약관 동기화
   * @param {string} uid - 사용자 ID
   * @param {string} accessToken - 카카오 액세스 토큰
   * @return {Promise<{success:boolean}>}
   */
  async syncKakaoProfile(uid, accessToken) {
    const startTime = Date.now();
    console.log(`[KAKAO_SYNC_START] uid=${uid}`);
    
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
    let userinfoJson;
    let termsData;

    // 에뮬레이터 환경: Firebase Auth customClaims에서 더미 데이터 사용
    if (isEmulator && accessToken === "test") {
      const userRecord = await admin.auth().getUser(uid);
      const customClaims = userRecord.customClaims || {};
      
      userinfoJson = {
        name: customClaims.kakaoName || "테스트유저",
        gender: (customClaims.kakaoGender || "male").toLowerCase(),
        birthdate: customClaims.kakaoBirthdate || "2000-01-01",
        phone_number: customClaims.kakaoPhoneNumber || "01012345678",
      };
      
      // 에뮬레이터 약관 데이터
      termsData = await this.termsService.parseEmulatorTerms(uid);
    } else {
      // 실제 환경: userinfo + 약관 병렬 호출 (성능 최적화)
      const parallelStartTime = Date.now();
      console.log(`[KAKAO_PARALLEL_API_START] uid=${uid}`);
      
      try {
        const userinfoUrl = "https://kapi.kakao.com/v1/oidc/userinfo";
        
        // userinfo와 약관 API 동시 호출
        const [userinfoRes, fetchedTermsData] = await Promise.all([
          this._fetchKakaoAPI(userinfoUrl, accessToken),
          this.termsService.fetchKakaoTerms(accessToken),
        ]);
        
        const parallelDuration = Date.now() - parallelStartTime;
        console.log(`[KAKAO_PARALLEL_API_SUCCESS] uid=${uid}, duration=${parallelDuration}ms`);
        
        userinfoJson = await userinfoRes.json();
        termsData = fetchedTermsData;
        
      // 카카오 API 응답 상세 로깅 (디버깅용)
      console.log(`[UserService][syncKakaoProfile] 카카오 API 응답 필드 확인:`, {
          hasName: !!userinfoJson.name,
          hasGender: !!userinfoJson.gender,
          hasBirthdate: !!userinfoJson.birthdate,
          hasPhoneNumber: !!userinfoJson.phone_number,
          hasPicture: !!userinfoJson.picture,
          rawGender: userinfoJson.gender,
          rawBirthdate: userinfoJson.birthdate,
          phoneNumberLength: userinfoJson.phone_number?.length || 0,
        });
      } catch (apiError) {
        const parallelDuration = Date.now() - parallelStartTime;
        console.error(`[KAKAO_PARALLEL_API_FAILED] uid=${uid}, duration=${parallelDuration}ms, error=${apiError.message}`);
        throw apiError;
      }
    }

    const name = userinfoJson.name || "";
    const genderRaw = userinfoJson.gender || null; // "male" | "female" (소문자)
    const birthdateRaw = userinfoJson.birthdate || null; // YYYY-MM-DD 기대
    const phoneRaw = userinfoJson.phone_number || "";
    const profileImageUrl = userinfoJson.picture || "";

    // 필수 정보 검증
    if (!genderRaw || !birthdateRaw || !phoneRaw) {
      console.error(`[KAKAO_REQUIRED_FIELDS_MISSING] uid=${uid}`, {
        missingFields: {
          gender: !genderRaw,
          birthdate: !birthdateRaw,
          phoneNumber: !phoneRaw,
        },
        receivedData: {
          name: !!name,
          gender: genderRaw || "null",
          birthdate: birthdateRaw || "null",
          phoneNumber: phoneRaw || "null",
          picture: !!profileImageUrl,
        },
      });
      const e = new Error("카카오에서 필수 정보(성별, 생년월일, 전화번호)를 받아올 수 없습니다. 카카오 계정 설정에서 정보 제공 동의를 확인해주세요.");
      e.code = "REQUIRE_FIELDS_MISSING";
      throw e;
    }

    // gender 정규화 (소문자로 변환 및 검증)
    const genderNormalized = genderRaw?.toString().toLowerCase();
    const gender = genderNormalized === "male" || genderNormalized === "female" ? genderNormalized : null;
    if (!gender) {
      const e = new Error("카카오에서 받은 성별 정보가 유효하지 않습니다");
      e.code = "INVALID_INPUT";
      throw e;
    }

    // birthDate 정규화
    let birthDate;
    try {
      birthDate = formatDate(birthdateRaw);
    } catch (_) {
      const e = new Error("카카오에서 받은 생년월일 정보가 유효하지 않습니다");
      e.code = "INVALID_INPUT";
      throw e;
    }

    // 한국 번호 검증은 helper 내부에서 정규화 포함 수행
    if (!isValidPhoneNumber(String(phoneRaw))) {
      const e = new Error("카카오에서 받은 전화번호 정보가 유효하지 않습니다");
      e.code = "INVALID_INPUT";
      throw e;
    }
    
    // 저장은 정규화된 국내형으로
    const normalizedPhone = normalizeKoreanPhoneNumber(String(phoneRaw));

    // 2. 약관 정보 처리
    this.termsService.validateTermsData(termsData, uid);
    const termsUpdate = this.termsService.prepareTermsUpdate(termsData, uid);

    // 3. Firestore 사용자 문서 생성
    const update = {
      name: name || null,
      birthDate,
      gender,
      phoneNumber: normalizedPhone,
      profileImageUrl,
      ...termsUpdate,
      lastLoginAt: FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    };

    console.log(`[USER_DOCUMENT_UPDATE_START] uid=${uid}`);
    
    // 안전 체크: 문서가 없으면 에러 (정상적인 경우 발생하지 않아야 함)
    const existing = await this.firestoreService.getById(uid);
    if (!existing) {
      console.error(`[ERROR] 사용자 문서가 없음! authTrigger 실행 확인 필요: uid=${uid}`);
      const e = new Error("사용자 기본 정보가 없습니다. 다시 로그인해주세요.");
      e.code = "USER_DOCUMENT_NOT_FOUND";
      throw e;
    }
    
    // 카카오 상세 정보로 업데이트
    await this.firestoreService.update(uid, update);
    console.log(`[USER_DOCUMENT_UPDATED] uid=${uid} (카카오 정보 + 약관 포함)`)

    const totalDuration = Date.now() - startTime;
    console.log(`[KAKAO_SYNC_SUCCESS] uid=${uid}, totalDuration=${totalDuration}ms`);
    return {success: true};
  }

  /**
   * @param {Array<string>} postIds - 게시글 ID 목록
   * @param {Object} communityIdMap - postId를 communityId로 매핑
   * @return {Promise<Array>} 처리된 게시글 목록
   */
  async getPostsByIds(postIds, communityIdMap) {
    if (!postIds || postIds.length === 0) {
      return [];
    }

    // CommunityService 인스턴스 생성 (lazy loading으로 순환 참조 방지)
    const CommunityService = require("./communityService");
    const communityService = new CommunityService();

    // 커뮤니티 정보 조회
    const communities = await communityService.firestoreService.getCollection("communities");
    const communityMap = {};
    communities.forEach(community => {
      communityMap[community.id] = community;
    });


    const postsByCommunity = {};
    postIds.forEach(postId => {
      const communityId = communityIdMap[postId];
      if (communityId) {
        if (!postsByCommunity[communityId]) {
          postsByCommunity[communityId] = [];
        }
        postsByCommunity[communityId].push(postId);
      }
    });


    const {FieldPath} = require("firebase-admin/firestore");
    
    const communityPromises = Object.entries(postsByCommunity).map(async ([communityId, communityPostIds]) => {
      try {
        const postsService = new FirestoreService(`communities/${communityId}/posts`);
        
        // 10개씩 나누어서 처리 (Firestore in 쿼리 최대 10개 제한)
        const chunks = [];
        for (let i = 0; i < communityPostIds.length; i += 10) {
          chunks.push(communityPostIds.slice(i, i + 10));
        }

        const allPosts = [];
        for (const chunk of chunks) {
          const posts = await postsService.getWhereMultiple([
            { field: FieldPath.documentId(), operator: "in", value: chunk }
          ]);
          posts.forEach(post => {
            allPosts.push({
              ...post,
              communityId,
              community: communityMap[communityId] ? {
                id: communityId,
                name: communityMap[communityId].name,
              } : null,
            });
          });
        }
        return allPosts;
      } catch (error) {
        console.error(`Error fetching posts for community ${communityId}:`, error.message);
        return [];
      }
    });

    const postsArrays = await Promise.all(communityPromises);
    const allPostsFlat = postsArrays.flat().filter((post) => post.isLocked !== true);
    
    const postsMap = {};
    allPostsFlat.forEach(post => {
      postsMap[post.id] = post;
    });
    
    const allPosts = postIds
      .map(postId => postsMap[postId])
      .filter(post => post !== undefined)
      .filter(post => post.isLocked !== true);

    // 사용자 프로필 배치 조회
    const userIds = [];
    allPosts.forEach(post => {
      if (post.authorId) {
        userIds.push(post.authorId);
      }
    });

    const missionPostService = require("./missionPostService");
    const profileMap = userIds.length > 0 ? await missionPostService.loadUserProfiles(userIds) : {};

    const processPost = (post) => {
      const { authorId: _, ...postWithoutAuthorId } = post;
      const createdAtDate = post.createdAt?.toDate?.() || post.createdAt;
      const userProfile = profileMap[post.authorId] || {};
      
      const processedPost = {
        ...postWithoutAuthorId,
        createdAt: createdAtDate?.toISOString?.() || post.createdAt,
        updatedAt: post.updatedAt?.toDate?.()?.toISOString?.() || post.updatedAt,
        scheduledDate: post.scheduledDate?.toDate?.()?.toISOString?.() || post.scheduledDate,
        timeAgo: createdAtDate ? communityService.getTimeAgo(new Date(createdAtDate)) : "",
        communityPath: `communities/${post.communityId}`,
        rewardGiven: post.rewardGiven || false,
        reportsCount: post.reportsCount || 0,
        viewCount: post.viewCount || 0,
        profileImageUrl: userProfile.profileImageUrl || null,
      };

      processedPost.preview = post.preview || communityService.createPreview(post);
      
      // thumbnailUrl이 있으면 preview의 thumbnail URL을 썸네일로 교체
      if (post.thumbnailUrl && processedPost.preview && processedPost.preview.thumbnail) {
        processedPost.preview.thumbnail.url = post.thumbnailUrl;
      } else if (post.thumbnailUrl && processedPost.preview) {
        // preview에 thumbnail이 없으면 생성
        processedPost.preview.thumbnail = {
          url: post.thumbnailUrl,
          width: null,
          height: null,
          blurHash: null,
        };
      }
      
      // imageCount 추가 (media 배열의 길이, media 삭제 전에 계산)
      processedPost.imageCount = Array.isArray(post.media) ? post.media.length : 0;
      
      delete processedPost.content;
      delete processedPost.media;
      delete processedPost.communityId;

      return processedPost;
    };

    return allPosts.map(processPost);
  }

  /**
   * 미션 게시글을 ID 배열로 조회하여 커뮤니티 스키마와 유사하게 매핑
   * @param {Array<string>} postIds - 미션 게시글 ID 배열
   * @return {Promise<Array<Object>>} 게시글 목록
   */
  async getMissionPostsByIds(postIds = []) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return [];
    }

    try {
      const missionPostService = require("./missionPostService");
      const missionPosts = [];
      const userIds = [];

      const chunks = [];
      for (let i = 0; i < postIds.length; i += 10) {
        chunks.push(postIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const snapshot = await db
          .collection("missionPosts")
          .where("__name__", "in", chunk)
          .get();

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data) return;

          const authorId = data.authorId;
          if (authorId) {
            userIds.push(authorId);
          }

          missionPosts.push({
            id: doc.id,
            ...data,
          });
        });
      }

      // 사용자 프로필 배치 조회
      const profileMap = userIds.length > 0 ? await missionPostService.loadUserProfiles(userIds) : {};

      // 프로필 정보 매핑하여 응답 생성
    const processedPosts = missionPosts
      .filter((post) => post.isLocked !== true)
      .map((post) => {
        const data = post;
        const createdAtDate = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
        const updatedAtDate = data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : null);
        const authorId = data.authorId;
        const userProfile = profileMap[authorId] || {};

        return {
          id: post.id,
          title: data.title || "",
          preview: missionPostService.createPreview(data),
          author: userProfile.nickname || "",
          profileImageUrl: userProfile.profileImageUrl || null,
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          reportsCount: data.reportsCount || 0,
          viewCount: data.viewCount || 0,
          createdAt: createdAtDate?.toISOString?.() || data.createdAt,
          updatedAt: updatedAtDate?.toISOString?.() || data.updatedAt,
          timeAgo: createdAtDate ? missionPostService.getTimeAgo(createdAtDate) : "",
          communityPath: null,
          community: null,
          programType: null,
          type: null,
          isReview: false,
          channel: data.missionTitle || "",
          category: null,
          scheduledDate: null,
          isLocked: data.isLocked || false,
          isPublic: true,
          rewardGiven: data.rewardGiven || false,
        };
      });

      return processedPosts;
    } catch (error) {
      console.error("미션 게시글 조회 실패:", error.message);
      return [];
    }
  }

  /**
   * 사용자 서브컬렉션에서 게시글 조회 (공통 헬퍼)
   * @param {string} userId - 사용자 ID
   * @param {string} subCollectionName - 서브컬렉션 이름 (authoredPosts, likedPosts, commentedPosts)
   * @param {string} orderBy - 정렬 필드
   * @param {Object} options - 조회 옵션
   * @param {string} errorMessage - 에러 메시지
   * @return {Promise<Object>} 게시글 목록과 페이지네이션
   */
  async getMyPostsFromSubCollection(userId, subCollectionName, orderBy, options = {}, errorMessage) {
    try {
      const { page = 0, size = 10, type = "all" } = options; // type: all | program | mission

      const postsService = new FirestoreService(`users/${userId}/${subCollectionName}`);
      const result = await postsService.getWithPagination({
        page: parseInt(page),
        size: parseInt(size),
        orderBy,
        orderDirection: "desc",
      });

      // 추가: 내가 작성한 게시글(authoredPosts)일 때 미션 작성 목록도 포함
      let missionAuthoredRefs = [];
      if (subCollectionName === "authoredPosts" && (type === "all" || type === "mission")) {
        try {
          const missionPostsService = new FirestoreService(`users/${userId}/missionPosts`);
          missionAuthoredRefs = await missionPostsService.getAll();
        } catch (e) {
          console.warn("[USER] missionPosts fetch failed:", e.message);
        }
      }

      // 분류: 커뮤니티(postId+communityId) vs 미션(postId+missionId)
      const communityPostIds = [];
      const communityIdMap = {};
      const missionPostIds = [];

      const mergedRefs = [...result.content];
      if (missionAuthoredRefs.length > 0) {
        missionAuthoredRefs.forEach((ref) => mergedRefs.push(ref));
      }

      mergedRefs.forEach(({ postId, communityId, missionId, missionNotionPageId }) => {
        if (!postId) return;
        if (communityId && (type === "all" || type === "program")) {
          communityPostIds.push(postId);
          communityIdMap[postId] = communityId;
        } else if ((missionId || missionNotionPageId) && (type === "all" || type === "mission")) {
          missionPostIds.push(postId);
        }
      });

      if (communityPostIds.length === 0 && missionPostIds.length === 0) {
        return {
          content: [],
          pagination: result.pageable || {
            pageNumber: page,
            pageSize: size,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
            isFirst: true,
            isLast: true,
          },
        };
      }

      // 커뮤니티 게시글 조회
      const communityPostsPromise =
        communityPostIds.length > 0
          ? this.getPostsByIds(communityPostIds, communityIdMap)
          : Promise.resolve([]);

      // 미션 게시글 조회 (루트 컬렉션 missionPosts에서 id로 조회)
      const missionPostsPromise =
        missionPostIds.length > 0
          ? this.getMissionPostsByIds(missionPostIds)
          : Promise.resolve([]);

      const [communityPosts, missionPosts] = await Promise.all([
        communityPostsPromise,
        missionPostsPromise,
      ]);

      // 원본 정렬 유지: subcollection 결과 순서대로 매핑
      const communityMapById = {};
      communityPosts.forEach((p) => {
        if (p?.id) communityMapById[p.id] = p;
      });
      const missionMapById = {};
      missionPosts.forEach((p) => {
        if (p?.id) missionMapById[p.id] = p;
      });

      const merged = [];
      for (const item of mergedRefs) {
        const { postId, communityId, missionId, missionNotionPageId } = item;
        if (!postId) continue;
        if (communityId && (type === "all" || type === "program")) {
          const post = communityMapById[postId];
          if (post) merged.push(post);
        } else if ((missionId || missionNotionPageId) && (type === "all" || type === "mission")) {
          const post = missionMapById[postId];
          if (post) merged.push(post);
        }
      }

      // 내가 작성한 게시글(authoredPosts)에서는 커뮤니티/미션을 함께 최신순 정렬
      if (subCollectionName === "authoredPosts") {
        merged.sort((a, b) => {
          const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        });
      }

      return {
        content: merged,
        pagination: result.pageable || {},
      };
    } catch (error) {
      console.error(`${errorMessage} error:`, error.message);
      if (error.code) {
        throw error;
      }
      const wrapped = new Error(errorMessage);
      wrapped.code = "INTERNAL_ERROR";
      throw wrapped;
    }
  }

  /**
   * 내가 작성한 게시글 조회
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 조회 옵션
   * @return {Promise<Object>} 게시글 목록과 페이지네이션
   */
  async getMyAuthoredPosts(userId, options = {}) {
    return this.getMyPostsFromSubCollection(
      userId,
      "authoredPosts",
      "createdAt",
      options,
      "내가 작성한 게시글 조회에 실패했습니다"
    );
  }

  /**
   * 내가 좋아요한 게시글 조회
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 조회 옵션
   * @return {Promise<Object>} 게시글 목록과 페이지네이션
   */
  async getMyLikedPosts(userId, options = {}) {
    return this.getMyPostsFromSubCollection(
      userId,
      "likedPosts",
      "lastLikedAt",
      options,
      "내가 좋아요한 게시글 조회에 실패했습니다"
    );
  }

  /**
   * 내가 댓글 단 게시글 조회
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 조회 옵션
   * @return {Promise<Object>} 게시글 목록과 페이지네이션
   */
  async getMyCommentedPosts(userId, options = {}) {
    return this.getMyPostsFromSubCollection(
      userId,
      "commentedPosts",
      "lastCommentedAt",
      options,
      "내가 댓글 단 게시글 조회에 실패했습니다"
    );
  }

  /**
   * 내가 참여한 커뮤니티 조회를 status 기준으로 필터링
   * @param {string} userId - 사용자 ID
   * @param {"ongoing"|"completed"|null} status - 조회 상태 (null이면 필터링 없이 모두 반환)
   * @return {Promise<Object>} postType별로 그룹화된 커뮤니티 목록 (programStatus 필드 포함)
   */
  async getMyCommunities(userId, status = "ongoing") {
    try {
      // Admin 사용자는 모든 커뮤니티 반환
      const isAdmin = await isAdminUser(userId);
      if (isAdmin) {
        const allCommunities = await this.firestoreService.getCollection("communities");
        const PROGRAM_TYPE_ALIASES = {
          ROUTINE: ["ROUTINE", "한끗루틴", "루틴"],
          GATHERING: ["GATHERING", "월간 소모임", "월간소모임", "소모임"],
          TMI: ["TMI", "티엠아이"],
        };

        const normalizeProgramType = (value) => {
          if (!value || typeof value !== "string") {
            return null;
          }
          const trimmed = value.trim();
          const upper = trimmed.toUpperCase();

          for (const [programType, aliases] of Object.entries(PROGRAM_TYPE_ALIASES)) {
            if (aliases.some((alias) => {
              if (typeof alias !== "string") return false;
              const aliasTrimmed = alias.trim();
              return aliasTrimmed === trimmed || aliasTrimmed.toUpperCase() === upper;
            })) {
              return programType;
            }
          }

          return null;
        };

        const programTypeMapping = {
          ROUTINE: {key: "routine", label: "한끗루틴"},
          GATHERING: {key: "gathering", label: "월간 소모임"},
          TMI: {key: "tmi", label: "TMI"},
        };

        const toDate = (value) => {
          if (!value) return null;
          if (typeof value.toDate === "function") {
            try {
              return value.toDate();
            } catch (_) {
              return null;
            }
          }
          if (value instanceof Date) {
            return value;
          }
          try {
            return new Date(value);
          } catch (_) {
            return null;
          }
        };

        const resolveProgramState = (community) => {
          if (!community) return null;
          const startDate = toDate(community.startDate);
          const endDate = toDate(community.endDate);
          const now = new Date();

          if (startDate && endDate) {
            if (now < startDate) {
              return "ongoing"; // 시작 전이지만 "ongoing"으로 표시
            } else if (now >= startDate && now <= endDate) {
              return "ongoing";
            } else {
              return "finished";
            }
          } else if (startDate) {
            return now >= startDate ? "ongoing" : "ongoing";
          } else if (endDate) {
            return now <= endDate ? "ongoing" : "finished";
          }
          return "ongoing";
        };

        const grouped = {
          "routine": {label: "한끗루틴", items: []},
          "gathering": {label: "월간 소모임", items: []},
          "tmi": {label: "TMI", items: []}
        };

        allCommunities.forEach((community) => {
          const programType = normalizeProgramType(community.programType);
          const communityState = resolveProgramState(community);
          
          // status가 null이면 시작 전인 것은 제외
          if (status === null || status === undefined) {
            const startDate = toDate(community.startDate);
            const now = new Date();
            // 시작 전인 것은 제외
            if (startDate && startDate > now) {
              return;
            }
          } else {
            // status가 null이 아니면 필터링
            const statusToCheck = status === "completed" ? "finished" : status;
            
            if (statusToCheck === "ongoing" && communityState !== "ongoing") {
              return;
            }
            if (statusToCheck === "finished" && communityState !== "finished") {
              return;
            }
          }

          if (programType && programTypeMapping[programType]) {
            const mapping = programTypeMapping[programType];
            const programStatus = communityState === "finished" ? "completed" : "ongoing";
            grouped[mapping.key].items.push({
              id: community.id,
              name: community.name,
              status: "approved", // Admin은 members에 없으므로 기본값으로 "approved" 설정
              programStatus: programStatus,
            });
          }
        });

        return grouped;
      }

      const tempService = new FirestoreService("temp");

      let allMembers = [];
      let currentPage = 0;
      const pageSize = 100;
      let hasMore = true;

      const memberWhereConditions = [
        {field: "userId", operator: "==", value: userId},
      ];
      const memberStatusMap = {};

      while (hasMore) {
        try {
          const pageResult = await tempService.getCollectionGroup("members", {
            where: memberWhereConditions,
            size: pageSize,
            page: currentPage,
            orderBy: "joinedAt",
            orderDirection: "desc"
          });

          const members = pageResult.content || [];
          allMembers = allMembers.concat(members);
          members.forEach((member) => {
            const communityId = member.communityId;
            if (!communityId || memberStatusMap[communityId]) {
              return;
            }
            const status = typeof member.status === "string" ? member.status.trim() : null;
            if (status) {
              memberStatusMap[communityId] = status;
            }
          });
          hasMore = pageResult.pageable?.hasNext || false;
          currentPage++;

          if (currentPage >= 10) {
            break;
          }
        } catch (error) {
          if (error.code === 9 || error.message.includes("FAILED_PRECONDITION") || error.message.includes("AggregateQuery")) {
            const fallbackResult = await tempService.getCollectionGroupWithoutCount("members", {
              where: memberWhereConditions,
              size: 1000,
              orderBy: "joinedAt",
              orderDirection: "desc"
            });
            const members = fallbackResult.content || [];
            allMembers = members;
            members.forEach((member) => {
              const communityId = member.communityId;
              if (!communityId || memberStatusMap[communityId]) {
                return;
              }
              const status = typeof member.status === "string" ? member.status.trim() : null;
              if (status) {
                memberStatusMap[communityId] = status;
              }
            });
            hasMore = false;
          } else {
            throw error;
          }
          break;
        }
      }

      const communityIds = [...new Set(
        allMembers
          .map(member => member.communityId)
          .filter(id => id)
      )];

      const emptyGrouped = () => ({
        "routine": {label: "한끗루틴", items: []},
        "gathering": {label: "월간 소모임", items: []},
        "tmi": {label: "TMI", items: []}
      });

      if (communityIds.length === 0) {
        return emptyGrouped();
      }

      const chunkedIds = [];
      for (let i = 0; i < communityIds.length; i += 10) {
        chunkedIds.push(communityIds.slice(i, i + 10));
      }

      const communitiesChunked = await Promise.all(
        chunkedIds.map(chunk =>
          this.firestoreService.getCollectionWhereIn("communities", "id", chunk)
        )
      );

      const communities = communitiesChunked.flat();

      const PROGRAM_TYPE_ALIASES = {
        ROUTINE: ["ROUTINE", "한끗루틴", "루틴"],
        GATHERING: ["GATHERING", "월간 소모임", "월간소모임", "소모임"],
        TMI: ["TMI", "티엠아이"],
      };

      const normalizeProgramType = (value) => {
        if (!value || typeof value !== "string") {
          return null;
        }
        const trimmed = value.trim();
        const upper = trimmed.toUpperCase();

        for (const [programType, aliases] of Object.entries(PROGRAM_TYPE_ALIASES)) {
          if (aliases.some((alias) => {
            if (typeof alias !== "string") return false;
            const aliasTrimmed = alias.trim();
            return aliasTrimmed === trimmed || aliasTrimmed.toUpperCase() === upper;
          })) {
            return programType;
          }
        }

        return null;
      };

      const legacyPostTypeToProgramType = {
        ROUTINE_CERT: "ROUTINE",
        ROUTINE_REVIEW: "ROUTINE",
        GATHERING_CERT: "GATHERING",
        GATHERING_REVIEW: "GATHERING",
        TMI_CERT: "TMI",
        TMI_REVIEW: "TMI",
        TMI: "TMI",
        ROUTINE: "ROUTINE",
        GATHERING: "GATHERING",
      };

      const programTypeMapping = {
        ROUTINE: {key: "routine", label: "한끗루틴"},
        GATHERING: {key: "gathering", label: "월간 소모임"},
        TMI: {key: "tmi", label: "TMI"},
      };

      const toDate = (value) => {
        if (!value) return null;
        if (typeof value.toDate === "function") {
          try {
            return value.toDate();
          } catch (_) {
            return null;
          }
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      };

      const now = new Date();

      const filteredCommunities = communities.filter((community) => {
        const startDate = toDate(community.startDate);
        const endDate = toDate(community.endDate);

        // status가 null이면 진행중 + 완료된 것만 반환 (시작 전 제외)
        if (status === null || status === undefined) {
          // 시작 전인 것은 제외
          if (startDate && startDate > now) {
            return false;
          }
          // 나머지는 모두 포함 (진행중 + 완료)
          return true;
        }

        if (status === "completed") {
          return !!endDate && endDate < now;
        }

        // default ongoing
        if (endDate && endDate < now) {
          return false;
        }
        if (startDate && startDate > now) {
          return false;
        }
        return true;
      });

      const grouped = emptyGrouped();

      filteredCommunities.forEach(community => {
        let programType = normalizeProgramType(community.programType);
        if (!programType && community.postType && legacyPostTypeToProgramType[community.postType]) {
          programType = legacyPostTypeToProgramType[community.postType];
        }

        if (programType && programTypeMapping[programType]) {
          const typeInfo = programTypeMapping[programType];
          const startDate = toDate(community.startDate);
          const endDate = toDate(community.endDate);
          
          // programStatus 결정
          let programStatus = "ongoing";
          if (endDate && endDate < now) {
            programStatus = "completed";
          }
          
          grouped[typeInfo.key].items.push({
            id: community.id,
            name: community.name,
            status: memberStatusMap[community.id] || null,
            programStatus: programStatus,
          });
        }
      });

      return grouped;
    } catch (error) {
      console.error("내가 참여 중인 커뮤니티 조회 에러:", error.message);
      if (error.code) {
        throw error;
      }
      const e = new Error("내가 참여 중인 커뮤니티 조회에 실패했습니다");
      e.code = "INTERNAL_ERROR";
      throw e;
    }
  }

  /**
   * 내가 참여 중인 커뮤니티 조회 (진행 중 + 완료된 커뮤니티 모두 포함)
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>} programStatus 필드가 포함된 커뮤니티 목록
   */
  async getMyParticipatingCommunities(userId) {
    // status를 null로 전달하면 필터링 없이 모든 커뮤니티 반환
    return this.getMyCommunities(userId, null);
  }

  /**
   * 내가 완료한 커뮤니티 조회 (종료)
   * @param {string} userId - 사용자 ID
   * @return {Promise<Object>}
   */
  async getMyCompletedCommunities(userId) {
    return this.getMyCommunities(userId, "completed");
  }
}

module.exports = UserService;