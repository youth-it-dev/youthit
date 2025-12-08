const UserService = require("../services/userService");
const NicknameService = require("../services/nicknameService");
const RewardService = require("../services/rewardService");

// 서비스 인스턴스 생성
const userService = new UserService();
const nicknameService = new NicknameService();
const rewardService = new RewardService();

class UserController {
  
  /**
   * 모든 사용자 조회 API
   */
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      return res.success({users, count: users.length});
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 본인 정보 조회
   * (lastLoginAt은 카카오 로그인 시 syncKakaoProfile에서 업데이트됨)
   */
  async getMe(req, res, next) {
    try {
      const {uid} = req.user;
      
      // 사용자 정보 조회
      const user = await userService.getUserById(uid);
      if (!user) {
        const err = new Error("사용자를 찾을 수 없습니다");
        err.code = "NOT_FOUND";
        throw err;
      }

      // 로그인 시점: 리워드 만료 검증 및 차감 (비동기, 실패해도 계속 진행)
      rewardService.checkAndDeductExpiredRewards(uid)
        .then(result => {
          if (result.count > 0) {
            console.log(`[LOGIN] userId=${uid}, 만료된 리워드 ${result.count}건 차감 완료 (${result.totalDeducted}포인트)`);
          }
        })
        .catch(error => {
          console.error(`[LOGIN] userId=${uid}, 리워드 만료 체크 실패:`, error.message);
        });

      return res.success({user});
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 특정 사용자 정보 조회 (본인만)
   */
  async getUserById(req, res, next) {
    try {
      const {userId} = req.params;
      const {uid} = req.user; // authGuard에서 설정

      // 권한 체크: 본인이거나 Admin만 조회 가능
      const isOwner = userId === uid;

      if (!isOwner) {
        const err = new Error("권한이 없습니다");
        err.code = "FORBIDDEN";
        throw err;
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        const err = new Error("사용자를 찾을 수 없습니다");
        err.code = "NOT_FOUND";
        throw err;
      }
      return res.success(user);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 온보딩 정보 업데이트
   * @param {Object} req.body - { nickname, profileImageUrl?, bio? }
   */
  async updateOnboarding(req, res, next) {
    try {
      const {uid} = req.user;
      const {nickname, profileImageUrl, bio} = req.body || {};

      const result = await userService.updateOnboarding({
        uid,
        payload: {nickname, profileImageUrl, bio},
      });

      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 사용자 정보 수정 (테스트용)
   */
  async updateUser(req, res, next) {
    try {
      const {userId} = req.params;
      const {
        name, profileImageUrl, birthDate, level, badges,
        mainProfileId, uploadQuotaBytes,
        usedStorageBytes,
        rewards,
        activityParticipationCount, certificationPosts, reportCount,
        suspensionReason,
        suspensionStartAt, suspensionEndAt,
      } = req.body;

      const updateData = {};

      // 입력 검증은 서비스 레이어에서 수행 (컨트롤러는 DTO 수집만)
      if (name !== undefined) {
        updateData.name = name;
      }
      if (profileImageUrl !== undefined) {
        updateData.profileImageUrl = profileImageUrl;
      }
      if (mainProfileId !== undefined) {
        updateData.mainProfileId = mainProfileId;
      }
      if (level !== undefined) {
        updateData.level = level;
      }
      if (uploadQuotaBytes !== undefined) {
        updateData.uploadQuotaBytes = uploadQuotaBytes;
      }
      if (usedStorageBytes !== undefined) {
        updateData.usedStorageBytes = usedStorageBytes;
      }
      if (badges !== undefined) {
        updateData.badges = badges;
      }
      if (birthDate !== undefined) {
        updateData.birthDate = birthDate;
      }
      if (rewards !== undefined) {
        updateData.rewards = rewards;
      }
      if (activityParticipationCount !== undefined) {
        updateData.activityParticipationCount = activityParticipationCount;
      }
      if (certificationPosts !== undefined) {
        updateData.certificationPosts = certificationPosts;
      }
      if (reportCount !== undefined) {
        updateData.reportCount = reportCount;
      }
      if (suspensionReason !== undefined) {
        updateData.suspensionReason = suspensionReason;
      }
      if (suspensionStartAt !== undefined) {
        updateData.suspensionStartAt = suspensionStartAt;
      }
      if (suspensionEndAt !== undefined) {
        updateData.suspensionEndAt = suspensionEndAt;
      }

      if (Object.keys(updateData).length === 0) {
        const err = new Error("업데이트할 유효한 필드가 없습니다");
        err.code = "BAD_REQUEST";
        throw err;
      }

      const result = await userService.updateUser(userId, updateData);

      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 카카오 프로필 동기화
   * @param {Object} req.body - { accessToken }
   */
  async syncKakaoProfile(req, res, next) {
    try {
      const {uid} = req.user;
      const {accessToken} = req.body || {};
      if (!accessToken || typeof accessToken !== "string") {
        const err = new Error("INVALID_INPUT: accessToken required");
        err.code = "INVALID_INPUT";
        throw err;
      }

      const result = await userService.syncKakaoProfile(uid, accessToken);
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 닉네임 가용성 확인
   */
  async checkNicknameAvailability(req, res, next) {
    try {
      const {nickname} = req.query;
      
      if (!nickname || typeof nickname !== "string" || !nickname.trim()) {
        const err = new Error("닉네임을 입력해주세요");
        err.code = "BAD_REQUEST";
        throw err;
      }

      const available = await nicknameService.checkAvailability(nickname);
      
      return res.success({available});
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 사용자 삭제 API
   * - 본인이 요청하면: 계정 탈퇴 (게시글, 댓글, 프로필 이미지 등 모든 데이터 정리)
   */
  async deleteUser(req, res, next) {
    try {
      const {userId} = req.params;
      // 본인이 요청한 경우: 계정 탈퇴 로직 실행
      if (userId) {
        const result = await userService.deleteAccount(userId);
        return res.success(result);
      }

      // 본인이 아닌 경우: 권한 없음
      const err = new Error("권한이 없습니다");
      err.code = "FORBIDDEN";
      throw err;
    } catch (error) {
      console.error("사용자 삭제 에러:", error);
      return next(error);
    }
  }

  /**
   * 마이페이지 정보 조회 API
   */
  async getMyPage(req, res, next) {
    try {
      const {uid} = req.user;
      const myPageData = await userService.getMyPage(uid);
      return res.success(myPageData);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 내가 작성한 게시글 조회 API
   */
  async getMyAuthoredPosts(req, res, next) {
    try {
      const {uid} = req.user;
      const { page = 0, size = 10, type = "all" } = req.query;
      
      const result = await userService.getMyAuthoredPosts(uid, {
        page: parseInt(page),
        size: parseInt(size),
        type,
      });
      
      return res.success({
        posts: result.content || [],
        pagination: result.pagination || {},
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 내가 좋아요한 게시글 조회 API
   */
  async getMyLikedPosts(req, res, next) {
    try {
      const {uid} = req.user;
      const { page = 0, size = 10, type = "all" } = req.query;
      
      const result = await userService.getMyLikedPosts(uid, {
        page: parseInt(page),
        size: parseInt(size),
        type,
      });
      
      return res.success({
        posts: result.content || [],
        pagination: result.pagination || {},
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 내가 댓글 단 게시글 조회 API
   */
  async getMyCommentedPosts(req, res, next) {
    try {
      const {uid} = req.user;
      const { page = 0, size = 10, type = "all" } = req.query;
      
      const result = await userService.getMyCommentedPosts(uid, {
        page: parseInt(page),
        size: parseInt(size),
        type,
      });
      
      return res.success({
        posts: result.content || [],
        pagination: result.pagination || {},
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 내가 참여 중인 커뮤니티 조회 API
   */
  async getMyParticipatingCommunities(req, res, next) {
    try {
      const {uid} = req.user;
      const result = await userService.getMyParticipatingCommunities(uid);
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 내가 완료한 커뮤니티 조회 API
   */
  async getMyCompletedCommunities(req, res, next) {
    try {
      const {uid} = req.user;
      const result = await userService.getMyCompletedCommunities(uid);
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 지급받은 나다움 목록 조회 API
   */
  async getRewardsEarned(req, res, next) {
    try {
      const {uid} = req.user;
      const { page = 0, size = 20 } = req.query;
      
      const result = await rewardService.getRewardsEarned(uid, {
        page: parseInt(page),
        size: parseInt(size),
      });
      
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }


  /**
   * 알림 설정 토글 API
   * - pushTermsAgreed 필드를 현재 값의 반대로 변경
   */
  async togglePushNotification(req, res, next) {
    try {
      const {uid} = req.user;
      
      const user = await userService.togglePushNotification(uid);
      
      // pushTermsAgreed 필드만 반환
      return res.success({ pushTermsAgreed: user.pushTermsAgreed });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 마케팅 약관 토글 API
   * - marketingTermsAgreed 필드를 현재 값의 반대로 변경
   * - 카카오 서비스 약관 API 연동 (동의/철회)
   */
  async toggleMarketingTerms(req, res, next) {
    try {
      const {uid} = req.user;
      const {accessToken} = req.body || {};

      if (!accessToken || typeof accessToken !== "string") {
        const err = new Error("INVALID_INPUT: accessToken required");
        err.code = "INVALID_INPUT";
        throw err;
      }

      const result = await userService.toggleMarketingTerms(uid, accessToken);
      
      return res.success({marketingTermsAgreed: result.marketingTermsAgreed});
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UserController();
