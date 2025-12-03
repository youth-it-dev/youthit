const express = require("express");
const userController = require("../controllers/userController");
const authGuard = require("../middleware/authGuard");

const router = express.Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Firebase ID Token
 *   schemas:
 *     StandardResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: number
 *           example: 200
 *         data:
 *           type: object
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: abc123def456
 *         email:
 *           type: string
 *           example: user@example.com
 *         name:
 *           type: string
 *           example: 홍길동
 *         nickname:
 *           type: string
 *           example: gildong
 *         authType:
 *           type: string
 *           example: kakao
 *         snsProvider:
 *           type: string
 *           example: kakao
 *         phoneNumber:
 *           type: string
 *           example: 01012345678
 *         gender:
 *           type: string
 *           example: male
 *         birthDate:
 *           type: string
 *           example: 1990-01-01
 *         status:
 *           type: string
 *           enum: [pending, active, suspended]
 *           example: active
 *         serviceTermsVersion:
 *           type: string
 *           example: "v1"
 *         privacyTermsVersion:
 *           type: string
 *           example: "v1"
 *         age14TermsAgreed:
 *           type: boolean
 *           example: true
 *         pushTermsAgreed:
 *           type: boolean
 *           example: false
 *         termsAgreedAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-01T00:00:00Z
 *         profileImageUrl:
 *           type: string
 *           example: https://example.com/profile.jpg
 *         bio:
 *           type: string
 *           example: 안녕하세요!
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-01T00:00:00Z
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-01T00:00:00Z
 *         lastUpdatedAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-01T00:00:00Z
 * 
 * @swagger
 * tags:
 *   name: Users
 *   description: 사용자 관리 API
 */

/**
 * @swagger
 * /users/me/onboarding:
 *   patch:
 *     summary: 온보딩 정보 업데이트
 *     description: |
 *       최초 온보딩 정보를 업데이트합니다.
 *       - nickname (필수)
 *       - profileImageUrl (선택)
 *       - bio (선택)

 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 description: 닉네임 (필수)
 *               profileImageUrl:
 *                 type: string
 *                 description: 프로필 이미지 URL (선택)
 *               bio:
 *                 type: string
 *                 description: 자기소개 (선택)
 *             required: [nickname]
 *             example:
 *               nickname: gildong
 *               profileImageUrl: https://example.com/profile.jpg
 *               bio: 안녕하세요!
 *     responses:
 *       200:
 *         description: 온보딩 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [pending, active, suspended]
 *                       example: active
 *       400:
 *         description: 잘못된 입력 (필드 형식 오류/필수값 누락)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       409:
 *         description: 닉네임 중복 등 충돌(NICKNAME_TAKEN)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: 본인 정보 조회
 *     description: 인증된 사용자의 정보를 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authGuard, userController.getMe);

/**
 * @swagger
 * /users/me/my-page:
 *   get:
 *     summary: 마이페이지 정보 조회
 *     description: 인증된 사용자의 마이페이지 정보를 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 마이페이지 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     activityParticipationCount:
 *                       type: number
 *                       example: 5
 *                     certificationPosts:
 *                       type: number
 *                       example: 10
 *                     rewardPoints:
 *                       type: number
 *                       example: 500
 *                     name:
 *                       type: string
 *                       example: 홍길동
 *                     profileImageUrl:
 *                       type: string
 *                       example: https://example.com/profile.jpg
 *                     bio:
 *                       type: string
 *                       example: 안녕하세요!
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me/my-page", authGuard, userController.getMyPage);

/**
 * @swagger
 * /users/me/posts:
 *   get:
 *     summary: 내가 작성한 게시글 조회
 *     description: 로그인한 사용자가 작성한 게시글 목록을 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지 번호
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 게시글 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "62u4J1Dgjs1k7soZ7ltD"
 *                           author:
 *                             type: string
 *                             example: "익명"
 *                           title:
 *                             type: string
 *                             example: "수정된 루틴 인증!"
 *                           type:
 *                             type: string
 *                             example: "GATHERING_REVIEW"
 *                           channel:
 *                             type: string
 *                             example: "독서 모임 후기"
 *                           category:
 *                             type: string
 *                             example: "한끗루틴"
 *                           scheduledDate:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-10-03T00:00:00.000Z"
 *                           visibility:
 *                             type: string
 *                             example: "PUBLIC"
 *                           isLocked:
 *                             type: boolean
 *                             example: false
 *                           rewardGiven:
 *                             type: boolean
 *                             example: false
 *                           likesCount:
 *                             type: integer
 *                             example: 0
 *                           commentsCount:
 *                             type: integer
 *                             example: 0
 *                           reportsCount:
 *                             type: integer
 *                             example: 0
 *                           viewCount:
 *                             type: integer
 *                             example: 0
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-01T15:28:39.101Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-01T15:28:39.101Z"
 *                           community:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "CP:G7C66H69GK"
 *                               name:
 *                                 type: string
 *                                 example: "독서 모임"
 *                           timeAgo:
 *                             type: string
 *                             example: "1시간 전"
 *                           communityPath:
 *                             type: string
 *                             example: "communities/CP:G7C66H69GK"
 *                           preview:
 *                             type: object
 *                             properties:
 *                               description:
 *                                 type: string
 *                                 example: "수정된 내용입니다!"
 *                               thumbnail:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url:
 *                                     type: string
 *                                     example: "https://example.com/updated-image.jpg"
 *                                   width:
 *                                     type: integer
 *                                     example: 1080
 *                                   height:
 *                                     type: integer
 *                                     example: 1080
 *                                   blurHash:
 *                                     type: string
 *                                     example: "L6PZfSi_.AyE_3t7t7R**0o#DgR4"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         pageNumber:
 *                           type: integer
 *                           example: 1
 *                         pageSize:
 *                           type: integer
 *                           example: 10
 *                         totalElements:
 *                           type: integer
 *                           example: 12
 *                         totalPages:
 *                           type: integer
 *                           example: 2
 *                         hasNext:
 *                           type: boolean
 *                           example: false
 *                         hasPrevious:
 *                           type: boolean
 *                           example: true
 *                         isFirst:
 *                           type: boolean
 *                           example: false
 *                         isLast:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/me/posts", authGuard, userController.getMyAuthoredPosts);

/**
 * @swagger
 * /users/me/liked-posts:
 *   get:
 *     summary: 내가 좋아요한 게시글 조회
 *     description: 로그인한 사용자가 좋아요한 게시글 목록을 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지 번호
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 게시글 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "62u4J1Dgjs1k7soZ7ltD"
 *                           author:
 *                             type: string
 *                             example: "익명"
 *                           title:
 *                             type: string
 *                             example: "수정된 루틴 인증!"
 *                           type:
 *                             type: string
 *                             example: "GATHERING_REVIEW"
 *                           channel:
 *                             type: string
 *                             example: "독서 모임 후기"
 *                           category:
 *                             type: string
 *                             example: "한끗루틴"
 *                           scheduledDate:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-10-03T00:00:00.000Z"
 *                           visibility:
 *                             type: string
 *                             example: "PUBLIC"
 *                           isLocked:
 *                             type: boolean
 *                             example: false
 *                           rewardGiven:
 *                             type: boolean
 *                             example: false
 *                           likesCount:
 *                             type: integer
 *                             example: 0
 *                           commentsCount:
 *                             type: integer
 *                             example: 0
 *                           reportsCount:
 *                             type: integer
 *                             example: 0
 *                           viewCount:
 *                             type: integer
 *                             example: 0
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-01T15:28:39.101Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-01T15:28:39.101Z"
 *                           community:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "CP:G7C66H69GK"
 *                               name:
 *                                 type: string
 *                                 example: "독서 모임"
 *                           timeAgo:
 *                             type: string
 *                             example: "1시간 전"
 *                           communityPath:
 *                             type: string
 *                             example: "communities/CP:G7C66H69GK"
 *                           preview:
 *                             type: object
 *                             properties:
 *                               description:
 *                                 type: string
 *                                 example: "수정된 내용입니다!"
 *                               thumbnail:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url:
 *                                     type: string
 *                                     example: "https://example.com/updated-image.jpg"
 *                                   width:
 *                                     type: integer
 *                                     example: 1080
 *                                   height:
 *                                     type: integer
 *                                     example: 1080
 *                                   blurHash:
 *                                     type: string
 *                                     example: "L6PZfSi_.AyE_3t7t7R**0o#DgR4"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         pageNumber:
 *                           type: integer
 *                           example: 1
 *                         pageSize:
 *                           type: integer
 *                           example: 10
 *                         totalElements:
 *                           type: integer
 *                           example: 12
 *                         totalPages:
 *                           type: integer
 *                           example: 2
 *                         hasNext:
 *                           type: boolean
 *                           example: false
 *                         hasPrevious:
 *                           type: boolean
 *                           example: true
 *                         isFirst:
 *                           type: boolean
 *                           example: false
 *                         isLast:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/me/liked-posts", authGuard, userController.getMyLikedPosts);

/**
 * @swagger
 * /users/me/commented-posts:
 *   get:
 *     summary: 내가 댓글 단 게시글 조회
 *     description: 로그인한 사용자가 댓글을 단 게시글 목록을 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지 번호
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 게시글 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "62u4J1Dgjs1k7soZ7ltD"
 *                           author:
 *                             type: string
 *                             example: "익명"
 *                           title:
 *                             type: string
 *                             example: "수정된 루틴 인증!"
 *                           type:
 *                             type: string
 *                             example: "GATHERING_REVIEW"
 *                           channel:
 *                             type: string
 *                             example: "독서 모임 후기"
 *                           category:
 *                             type: string
 *                             example: "한끗루틴"
 *                           scheduledDate:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-10-03T00:00:00.000Z"
 *                           visibility:
 *                             type: string
 *                             example: "PUBLIC"
 *                           isLocked:
 *                             type: boolean
 *                             example: false
 *                           rewardGiven:
 *                             type: boolean
 *                             example: false
 *                           likesCount:
 *                             type: integer
 *                             example: 0
 *                           commentsCount:
 *                             type: integer
 *                             example: 0
 *                           reportsCount:
 *                             type: integer
 *                             example: 0
 *                           viewCount:
 *                             type: integer
 *                             example: 0
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-01T15:28:39.101Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-01T15:28:39.101Z"
 *                           community:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "CP:G7C66H69GK"
 *                               name:
 *                                 type: string
 *                                 example: "독서 모임"
 *                           timeAgo:
 *                             type: string
 *                             example: "1시간 전"
 *                           communityPath:
 *                             type: string
 *                             example: "communities/CP:G7C66H69GK"
 *                           preview:
 *                             type: object
 *                             properties:
 *                               description:
 *                                 type: string
 *                                 example: "수정된 내용입니다!"
 *                               thumbnail:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url:
 *                                     type: string
 *                                     example: "https://example.com/updated-image.jpg"
 *                                   width:
 *                                     type: integer
 *                                     example: 1080
 *                                   height:
 *                                     type: integer
 *                                     example: 1080
 *                                   blurHash:
 *                                     type: string
 *                                     example: "L6PZfSi_.AyE_3t7t7R**0o#DgR4"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         pageNumber:
 *                           type: integer
 *                           example: 1
 *                         pageSize:
 *                           type: integer
 *                           example: 10
 *                         totalElements:
 *                           type: integer
 *                           example: 12
 *                         totalPages:
 *                           type: integer
 *                           example: 2
 *                         hasNext:
 *                           type: boolean
 *                           example: false
 *                         hasPrevious:
 *                           type: boolean
 *                           example: true
 *                         isFirst:
 *                           type: boolean
 *                           example: false
 *                         isLast:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/me/commented-posts", authGuard, userController.getMyCommentedPosts);

/**
 * @swagger
 * /users/me/participating-communities:
 *   get:
 *     summary: 내가 참여 중인 커뮤니티 조회
 *     description: 로그인한 사용자가 참여 중인 커뮤니티(진행 중 + 완료된 커뮤니티 모두 포함)를 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 참여 중인 커뮤니티 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     routine:
 *                       type: object
 *                       description: 한끗루틴 그룹
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "한끗루틴"
 *                         items:
 *                           type: array
 *                           description: 한끗루틴 커뮤니티 목록
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 description: 커뮤니티 ID
 *                                 example: "CP:G7C66H69GK"
 *                               name:
 *                                 type: string
 *                                 description: 커뮤니티 이름
 *                                 example: "15일 동안 음악 일기 쓰기"
 *                               status:
 *                                 type: string
 *                                 description: 신청 상태
 *                                 example: "approved"
 *                               programStatus:
 *                                 type: string
 *                                 enum: [ongoing, completed]
 *                                 description: 프로그램 상태 (ongoing=진행중, completed=종료)
 *                                 example: "ongoing"
 *                     gathering:
 *                       type: object
 *                       description: 월간 소모임 그룹
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "월간 소모임"
 *                         items:
 *                           type: array
 *                           description: 월간 소모임 커뮤니티 목록
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 description: 커뮤니티 ID
 *                                 example: "CP:VYTTZW33IH"
 *                               name:
 *                                 type: string
 *                                 description: 커뮤니티 이름
 *                                 example: "하루 한조각, 일상 속 퍼즐 찾기"
 *                               status:
 *                                 type: string
 *                                 description: 신청 상태
 *                                 example: "pending"
 *                               programStatus:
 *                                 type: string
 *                                 enum: [ongoing, completed]
 *                                 description: 프로그램 상태 (ongoing=진행중, completed=종료)
 *                                 example: "ongoing"
 *                     tmi:
 *                       type: object
 *                       description: TMI 그룹
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "TMI"
 *                         items:
 *                           type: array
 *                           description: TMI 커뮤니티 목록
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 description: 커뮤니티 ID
 *                                 example: "CP:I4U3J7TM07"
 *                               name:
 *                                 type: string
 *                                 description: 커뮤니티 이름
 *                                 example: "TMI 자아탐색"
 *                               status:
 *                                 type: string
 *                                 description: 신청 상태
 *                                 example: "approved"
 *                               programStatus:
 *                                 type: string
 *                                 enum: [ongoing, completed]
 *                                 description: 프로그램 상태 (ongoing=진행중, completed=종료)
 *                                 example: "completed"
 *             example:
 *               status: 200
 *               data:
 *                 routine:
 *                   label: "한끗루틴"
 *                   items:
 *                     - id: "CP:G7C66H69GK"
 *                       name: "15일 동안 음악 일기 쓰기"
 *                       status: "approved"
 *                       programStatus: "ongoing"
 *                     - id: "CP:ABC123DEF456"
 *                       name: "플래너 작성하기"
 *                       status: "pending"
 *                       programStatus: "completed"
 *                 gathering:
 *                   label: "월간 소모임"
 *                   items:
 *                     - id: "CP:VYTTZW33IH"
 *                       name: "하루 한조각, 일상 속 퍼즐 찾기"
 *                       status: "approved"
 *                       programStatus: "ongoing"
 *                 tmi:
 *                   label: "TMI"
 *                   items:
 *                     - id: "CP:I4U3J7TM07"
 *                       name: "TMI 자아탐색"
 *                       status: "pending"
 *                       programStatus: "completed"
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               status: 401
 *               message: 인증이 필요합니다
 *               code: UNAUTHORIZED
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               status: 500
 *               message: 내부 서버 오류가 발생했습니다
 *               code: INTERNAL_ERROR
 */
router.get("/me/participating-communities", authGuard, userController.getMyParticipatingCommunities);

/**
 * @swagger
 * /users/me/completed-communities:
 *   get:
 *     summary: 내가 완료한 커뮤니티 조회
 *     description: 로그인한 사용자가 종료된 커뮤니티를 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 완료한 커뮤니티 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     routine:
 *                       type: object
 *                       description: 한끗루틴 그룹
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "한끗루틴"
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "CP:G7C66H69GK"
 *                               name:
 *                                 type: string
 *                                 example: "15일 동안 음악 일기 쓰기"
 *                               status:
 *                                 type: string
 *                                 description: 신청 상태
 *                                 example: "approved"
 *                     gathering:
 *                       type: object
 *                       description: 월간 소모임 그룹
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "월간 소모임"
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "CP:VYTTZW33IH"
 *                               name:
 *                                 type: string
 *                                 example: "하루 한조각, 일상 속 퍼즐 찾기"
 *                               status:
 *                                 type: string
 *                                 description: 신청 상태
 *                                 example: "approved"
 *                     tmi:
 *                       type: object
 *                       description: TMI 그룹
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "TMI"
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "CP:I4U3J7TM07"
 *                               name:
 *                                 type: string
 *                                 example: "TMI 자아탐색"
 *                               status:
 *                                 type: string
 *                                 description: 신청 상태
 *                                 example: "approved"
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me/completed-communities", authGuard, userController.getMyCompletedCommunities);

/**
 * @swagger
 * /users/me/rewards-earned:
 *   get:
 *     summary: 지급/차감(관리자)받은 나다움 목록 조회
 *     description: 본인이 지급/차감(관리자)받은 나다움 내역을 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지 번호 (0부터 시작)
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: 히스토리 ID
 *                             example: "COMMENT-abc123"
 *                           amount:
 *                             type: number
 *                             description: 지급된 나다움 포인트
 *                             example: 10
 *                           reason:
 *                             type: string
 *                             description: 지급 사유
 *                             example: "댓글 작성"
 *                           actionKey:
 *                             type: string
 *                             nullable: true
 *                             description: 액션 키
 *                             example: "comment"
 *                           changeType:
 *                             type: string
 *                             enum: [add, deduct]
 *                             description: 변경 타입 (add=지급, deduct=차감)
 *                             example: "add"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: 지급 일시
 *                             example: "2024-01-01T00:00:00Z"
 *                           expiresAt:
 *                             type: string
 *                             format: date-time
 *                             description: 만료 일시 (createdAt + 120일)
 *                             example: "2024-05-01T00:00:00Z"
 *                           isProcessed:
 *                             type: boolean
 *                             description: 스토어에서 사용되었는지 여부
 *                             example: false
 *                           isExpired:
 *                             type: boolean
 *                             description: 만료되었는지 여부
 *                             example: false
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         pageNumber:
 *                           type: number
 *                           example: 0
 *                         pageSize:
 *                           type: number
 *                           example: 20
 *                         totalElements:
 *                           type: number
 *                           example: 100
 *                         totalPages:
 *                           type: number
 *                           example: 5
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrevious:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me/rewards-earned", authGuard, userController.getRewardsEarned);

/**
 * @swagger
 * /users/me/rewards-used:
 *   get:
 *     summary: 사용한 나다움 목록 조회 
 *     description: 본인이 스토어에서 구매한 나다움 사용 내역을 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지 번호 (0부터 시작)
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: 히스토리 ID
 *                             example: "abc123"
 *                           amount:
 *                             type: number
 *                             description: 사용된 나다움 포인트
 *                             example: 80
 *                           reason:
 *                             type: string
 *                             description: 사용 사유 (상품명)
 *                             example: "기프티콘 구매"
 *                           changeType:
 *                             type: string
 *                             enum: [deduct]
 *                             description: 변경 타입 (항상 deduct)
 *                             example: "deduct"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: 사용 일시
 *                             example: "2024-01-01T00:00:00Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         pageNumber:
 *                           type: number
 *                           example: 0
 *                         pageSize:
 *                           type: number
 *                           example: 20
 *                         totalElements:
 *                           type: number
 *                           example: 100
 *                         totalPages:
 *                           type: number
 *                           example: 5
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrevious:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me/rewards-used", authGuard, userController.getRewardsUsed);

/**
 * @swagger
 * /users/nickname-availability:
 *   get:
 *     summary: 닉네임 가용성 확인
 *     description: 닉네임 중복 여부를 확인합니다.
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: nickname
 *         required: true
 *         schema:
 *           type: string
 *         description: 확인할 닉네임
 *     responses:
 *       200:
 *         description: 가용성 확인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/nickname-availability", userController.checkNicknameAvailability);

router.patch("/me/onboarding", authGuard, userController.updateOnboarding);


/**
 * @swagger
 * /users/me/sync-kakao-profile:
 *   post:
 *     summary: 카카오 프로필 동기화
 *     description: 카카오 Access Token으로 OIDC userinfo를 조회해 사용자 정보를 저장합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *             required: [accessToken]
 *     responses:
 *       200:
 *         description: 동기화 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: 잘못된 입력 또는 카카오 호출 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/me/sync-kakao-profile", authGuard, userController.syncKakaoProfile);

/**
 * @swagger
 * /users/me/push-notification-toggle:
 *   post:
 *     summary: 알림 설정 토글
 *     description: |
 *       사용자의 푸시 알림 동의 설정을 토글합니다.
 *       - pushTermsAgreed가 true이면 false로 변경
 *       - pushTermsAgreed가 false이면 true로 변경
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 알림 설정 토글 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         pushTermsAgreed:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/me/push-notification-toggle", authGuard, userController.togglePushNotification);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: 모든 사용자 조회 (인증 필요)
 *     description: 시스템의 모든 사용자 목록을 조회합니다.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
 *                         count:
 *                           type: number
 *                           example: 1
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authGuard, userController.getAllUsers);

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: 사용자 상세 조회
 *     description: 특정 사용자의 상세 정보를 조회합니다 (본인만 조회 가능)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *         example: abc123def456
 *     responses:
 *       200:
 *         description: 사용자 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:userId", authGuard, userController.getUserById);

/**
 * @swagger
 * /users/{userId}:
 *   put:
 *     summary: 사용자 정보 수정 (관리자용)
 *     description: |
 *       사용자의 다양한 정보를 수정합니다 (모든 필드 수정 가능)
 *       
 *       **수정 가능한 필드:**
 *       - email, nickname, name, birthDate, gender, phoneNumber
 *       - profileImageUrl, bio, authType, snsProvider
 *       - status, 약관 관련 필드들
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *         example: abc123def456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               nickname:
 *                 type: string
 *                 example: gildong
 *               name:
 *                 type: string
 *                 example: 홍길동
 *               birthDate:
 *                 type: string
 *                 example: 1990-01-01
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 example: male
 *               phoneNumber:
 *                 type: string
 *                 example: 01012345678
 *               profileImageUrl:
 *                 type: string
 *                 example: https://example.com/profile.jpg
 *               bio:
 *                 type: string
 *                 example: 안녕하세요!
 *               rewards:
 *                 type: number
 *                 description: 리워드 총합
 *                 example: 0
 *               authType:
 *                 type: string
 *                 example: sns
 *               snsProvider:
 *                 type: string
 *                 example: kakao
 *               status:
 *                 type: string
 *                 enum: [pending, approved, suspended]
 *                 example: active
 *               serviceTermsVersion:
 *                 type: string
 *                 example: "v1"
 *               privacyTermsVersion:
 *                 type: string
 *                 example: "v1"
 *               age14TermsAgreed:
 *                 type: boolean
 *                 example: true
 *               pushTermsAgreed:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: 사용자 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:userId", userController.updateUser);

/**
 * @swagger
 * /users/deletePost/{userId}:
 *   get:
 *     summary: 사용자 게시글 및 댓글 삭제
 *     description: 특정 사용자의 게시글과 댓글을 삭제합니다
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *         example: abc123def456
 *     responses:
 *       200:
 *         description: 사용자 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: 사용자가 성공적으로 삭제되었습니다
 *                     data:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                           example: abc123def456
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/deletePost/:userId", userController.deleteUser);

module.exports = router;

