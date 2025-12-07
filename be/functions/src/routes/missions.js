const express = require("express");
const router = express.Router();
const missionController = require("../controllers/missionController");
const optionalAuth = require("../middleware/optionalAuth");
const authGuard = require("../middleware/authGuard");

/**
 * @swagger
 * components:
 *   schemas:
 *     Mission:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 미션 ID (Notion 페이지 ID)
 *           example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522"
 *         title:
 *           type: string
 *           description: 미션 제목
 *           example: "친구와 함께 요리하기"
 *         missionIntroduction:
 *           type: string
 *           nullable: true
 *           description: 미션 소개
 *           example: "내가 좋아하는 책을 한권 선정해서 읽고 그 책을 쓴 작가를 위한 책 추천사 써보기"
 *         coverImage:
 *           type: string
 *           nullable: true
 *           description: 노션 페이지 커버 이미지 URL (unsplash 등)
 *           example: "https://images.unsplash.com/photo-1234567890"
 *         isRecruiting:
 *           type: boolean
 *           description: 현재 모집 여부
 *           example: true
 *         isUnlimited:
 *           type: boolean
 *           description: 무제한 여부
 *           example: false
 *         applicationDeadline:
 *           type: string
 *           nullable: true
 *           format: date-time
 *           description: 신청 마감일시 (무제한이 아닐 경우)
 *           example: "2024-12-31T23:59:59.000Z"
 *         certificationDeadline:
 *           type: string
 *           nullable: true
 *           format: date-time
 *           description: 인증 마감일시
 *           example: "2024-12-31T23:59:59.000Z"
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           description: 카테고리 목록
 *           example: ["자기 탐색", "자기 만족"]
 *         detailTags:
 *           type: string
 *           nullable: true
 *           description: 상세 태그
 *           example: "일상, 요리"
 *         targetAudience:
 *           type: string
 *           nullable: true
 *           description: 참여 대상
 *           example: "누구나"
 *         notes:
 *           type: string
 *           nullable: true
 *           description: 참고 사항
 *           example: "매일 인증해주세요"
 *         certificationMethod:
 *           type: array
 *           nullable: true
 *           description: 인증 방법 (Multi-select)
 *           items:
 *             type: string
 *           example: ["사진과 함께 인증글 작성", "3줄 이상 글 작성"]
 *         reactionCount:
 *           type: integer
 *           description: 찜 수
 *           example: 10
 *         faqRelation:
 *           type: object
 *           nullable: true
 *           description: FAQ 연동 정보
 *           properties:
 *             relations:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *             has_more:
 *               type: boolean
 *           example:
 *             relations:
 *               - id: "faq-page-1"
 *               - id: "faq-page-2"
 *             has_more: false
 *         isReviewRegistered:
 *           type: boolean
 *           description: 미션 후기 등록 여부
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 생성일시
 *           example: "2024-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 수정일시
 *           example: "2024-01-01T00:00:00.000Z"
 *         pageContent:
 *           type: array
 *           description: 페이지 내용 (상세 조회 시에만 포함)
 *           items:
 *             type: object
 *
 * @swagger
 * tags:
 *   name: Missions
 *   description: 미션 관리 API
 */

/**
 * @swagger
 * /missions/categories:
 *   get:
 *     summary: 미션 카테고리 목록 조회
 *     tags: [Missions]
 *     description: 노션 DB에 정의된 모든 미션 카테고리를 조회합니다.
 *     responses:
 *       200:
 *         description: 카테고리 목록 조회 성공
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["자기 탐색", "자기 만족", "자기 계발", "바깥 활동", "관계 형성"]
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "서버 내부 오류가 발생했습니다"
 */
router.get("/categories", missionController.getCategories);

/**
 * @swagger
 * /missions:
 *   get:
*     summary: 미션 목록 조회
 *     tags: [Missions]
 *     description: |
*       전체 미션 목록을 조회합니다. Notion cursor 기반 페이지네이션을 지원합니다.
 *       
 *       **자동 필터링:**
 *       - 현재 모집 여부가 체크된 미션만 조회됩니다.
 *       
 *       정렬:
 *       - latest: 최신순 (기본값)
 *       - popular: 인기순 (좋아요 많은 순)
 *       
*       필터:
*       - category: 카테고리 칩 (예: 자기 탐색, 자기 만족 등)
*       - excludeParticipated: 참여한 미션 제외 (로그인 필요)
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [latest, popular]
 *           default: latest
 *         description: 정렬 기준
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 카테고리 필터
 *       - in: query
 *         name: excludeParticipated
 *         schema:
 *           type: boolean
 *         description: 참여한 미션 제외 (로그인 필요)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: 페이지당 미션 수
 *       - in: query
 *         name: startCursor
 *         schema:
 *           type: string
 *         description: 다음 페이지 조회용 cursor (Notion next_cursor)
 *       - in: query
 *         name: likedOnly
 *         schema:
 *           type: boolean
 *         description: 찜한 미션만 조회 (로그인 필요)
 *     responses:
 *       200:
 *         description: 미션 목록 조회 성공
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
 *                     missions:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Mission"
 *                     pageInfo:
 *                       type: object
 *                       properties:
 *                         pageSize:
 *                           type: integer
 *                           example: 20
 *                         nextCursor:
 *                           type: string
 *                           nullable: true
 *                           example: "1f6a3..."
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "서버 내부 오류가 발생했습니다"
 */
router.get("/", optionalAuth, missionController.getMissions);

/**
 * @swagger
 * /missions/me:
 *   get:
 *     summary: 내 진행 중인 미션 목록 조회
 *     description: 로그인한 사용자가 진행 중인 미션 목록을 조회합니다.
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: 최대 조회 개수
 *     responses:
 *       200:
 *         description: 미션 목록 조회 성공
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
 *                     missions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           missionNotionPageId:
 *                             type: string
 *                           missionTitle:
 *                             type: string
 *                           detailTags:
 *                             type: string
 *                             nullable: true
 *                             description: 미션 태그
 *                           startedAt:
 *                             type: string
 *                             format: date-time
 *             example:
 *               status: 200
 *               data:
 *                 missions:
 *                   - id: "mission-test-user_2a645f52-4cd0-803b-8da5-e9fb9d16d263"
 *                     missionNotionPageId: "2a645f52-4cd0-803b-8da5-e9fb9d16d263"
 *                     missionTitle: "친구와 함께 요리하기"
 *                     detailTags: "일상, 요리"
 *                     startedAt: "2025-11-21T10:13:31.809Z"
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingBearer:
 *                 value:
 *                   status: 401
 *                   message: "Bearer 토큰이 필요합니다"

 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "서버 내부 오류가 발생했습니다"
 */
router.get("/me", authGuard, missionController.getMyMissions);

/**
 * @swagger
 * /missions/stats:
 *   get:
 *     summary: 미션 통계 조회
 *     description: 사용자의 미션 통계 정보를 조회합니다. (오늘의 미션 인증 현황, 연속 미션일, 진행 미션 수, 누적 게시글 수)
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 미션 통계 조회 성공
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
 *                     todayTotalCount:
 *                       type: integer
 *                       description: 오늘 신청한 미션 수 (QUIT 제외, IN_PROGRESS + COMPLETED)
 *                       example: 2
 *                     todayCompletedCount:
 *                       type: integer
 *                       description: 오늘 완료한 미션 수 (COMPLETED만)
 *                       example: 2
 *                     todayActiveCount:
 *                       type: integer
 *                       description: 진행 중인 미션 수 (오늘 신청한 미션 중 IN_PROGRESS만)
 *                       example: 0
 *                     consecutiveDays:
 *                       type: integer
 *                       description: 연속 미션일
 *                       example: 5
 *                     totalPostsCount:
 *                       type: integer
 *                       description: 누적 게시글 수
 *                       example: 15
 *             example:
 *               status: 200
 *               data:
 *                 todayTotalCount: 2
 *                 todayCompletedCount: 2
 *                 todayActiveCount: 0
 *                 consecutiveDays: 5
 *                 totalPostsCount: 15
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"

 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.get("/stats", authGuard, missionController.getMissionStats);

// 미션 인증글 목록 조회 (라우트 순서 중요: /posts가 /:missionId보다 먼저 정의되어야 함)
/**
 * @swagger
 * /missions/posts:
 *   get:
 *     summary: 미션 인증글 목록 조회
 *     tags: [Missions]
 *     description: 미션 인증글 목록을 조회합니다. cursor 기반 페이지네이션을 지원하며, 인증은 선택사항입니다.
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, popular]
 *           default: latest
 *         description: 정렬 기준 (latest=최신순, popular=좋아요 인기순)
 *         example: "latest"
 *       - in: query
 *         name: missionId
 *         schema:
 *           type: string
 *         description: 특정 미션의 인증글만 조회 (미션 상세 페이지에서 사용)
 *         example: "2b345f52-4cd0-81b3-81b8-ccd63ace93fc"
 *       - in: query
 *         name: categories
 *         schema:
 *           type: string
 *         description: 카테고리 필터 (콤마로 구분, 최대 10개)
 *         example: "자기만족,취미생활"
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: 내가 인증한 미션만 보기 (userId 필터)
 *         example: "user-123"
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: 페이지당 인증글 수
 *       - in: query
 *         name: startCursor
 *         schema:
 *           type: string
 *         description: 다음 페이지 조회용 cursor (마지막으로 받은 postId)
 *     responses:
 *       200:
 *         description: 미션 인증글 목록 조회 성공
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
 *                             example: "post-123"
 *                           title:
 *                             type: string
 *                             example: "오늘 하늘이 이뻤어요!"
 *                           missionTitle:
 *                             type: string
 *                             example: "일상 인증 미션"
 *                           missionNotionPageId:
 *                             type: string
 *                             example: "mission-page-123"
 *                           author:
 *                             type: string
 *                             example: "닉네임"
 *                           profileImageUrl:
 *                             type: string
 *                             nullable: true
 *                             example: "https://example.com/profile.jpg"
 *                           preview:
 *                             type: object
 *                             properties:
 *                               description:
 *                                 type: string
 *                                 example: "두줄까지 미리보기로 보이게!!! 구름이 뭉게뭉게..."
 *                               thumbnail:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url:
 *                                     type: string
 *                                     example: "https://example.com/image.jpg"
 *                                   width:
 *                                     type: number
 *                                     nullable: true
 *                                   height:
 *                                     type: number
 *                                     nullable: true
 *                                   blurHash:
 *                                     type: string
 *                                     nullable: true
 *                           mediaCount:
 *                             type: integer
 *                             example: 3
 *                           commentsCount:
 *                             type: integer
 *                             example: 12
 *                           likesCount:
 *                             type: integer
 *                             description: 좋아요 수
 *                             example: 5
 *                           viewCount:
 *                             type: integer
 *                             example: 100
 *                           categories:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 미션 카테고리 목록
 *                             example: ["자기만족", "취미생활"]
 *                           isLocked:
 *                             type: boolean
 *                             description: 신고로 인한 잠금 상태
 *                             example: false
 *                           isLiked:
 *                             type: boolean
 *                             nullable: true
 *                             description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 *                             example: false
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-20T10:00:00.000Z"
 *                           timeAgo:
 *                             type: string
 *                             example: "1시간 전"
 *                     pageInfo:
 *                       type: object
 *                       properties:
 *                         pageSize:
 *                           type: integer
 *                           example: 20
 *                         nextCursor:
 *                           type: string
 *                           nullable: true
 *                           example: "mission-post-abc123"
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *             example:
 *               status: 200
 *               data:
 *                 posts:
 *                   - id: "post-123"
 *                     title: "오늘 하늘이 이뻤어요!"
 *                     missionTitle: "일상 인증 미션"
 *                     missionNotionPageId: "mission-page-123"
 *                     author: "닉네임"
 *                     profileImageUrl: "https://example.com/profile.jpg"
 *                     preview:
 *                       description: "두줄까지 미리보기로 보이게!!! 구름이 뭉게뭉게..."
 *                       thumbnail:
 *                         url: "https://example.com/image.jpg"
 *                         width: 1080
 *                         height: 1080
 *                         blurHash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4"
 *                     mediaCount: 3
 *                     commentsCount: 12
 *                     likesCount: 5
 *                     viewCount: 100
 *                     categories: ["자기만족", "취미생활"]
 *                     isLocked: false
 *                     isLiked: false
 *                     createdAt: "2024-01-20T10:00:00.000Z"
 *                     timeAgo: "1시간 전"
 *                 pageInfo:
 *                   pageSize: 20
 *                   nextCursor: "mission-post-abc123"
 *                   hasNext: true
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               BadRequest:
 *                 value:
 *                   status: 400
 *                   message: "잘못된 요청입니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "인증글 목록을 조회할 수 없습니다."
 */
router.get("/posts", optionalAuth, missionController.getAllMissionPosts);

// 미션 인증글 상세 조회 (라우트 순서 중요: /posts/:postId가 /:missionId보다 먼저 정의되어야 함)
/**
 * @swagger
 * /missions/posts/{postId}:
 *   get:
 *     summary: 미션 인증글 상세 조회
 *     tags: [Missions]
 *     description: 특정 미션 인증글의 상세 정보를 조회합니다. 조회 시 조회수가 증가합니다. 인증은 선택사항이며, 인증 시 isAuthor 필드가 정확하게 표시됩니다.
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 인증글 ID
 *         example: "post-123"
 *     responses:
 *       200:
 *         description: 미션 인증글 상세 조회 성공
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
 *                     id:
 *                       type: string
 *                       example: "post-123"
 *                     authorId:
 *                       type: string
 *                       description: 인증글 작성자 UID
 *                       example: "user-123"
 *                     title:
 *                       type: string
 *                       example: "오늘 하늘이 이뻤어요!"
 *                     content:
 *                       type: string
 *                       example: "구름이 뭉게뭉게 있어서 하늘이 이뻐요!"
 *                     media:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
 *                     missionTitle:
 *                       type: string
 *                       example: "일상 인증 미션"
 *                     missionNotionPageId:
 *                       type: string
 *                       example: "mission-page-123"
 *                     author:
 *                       type: string
 *                       example: "닉네임"
 *                     profileImageUrl:
 *                       type: string
 *                       nullable: true
 *                       example: "https://example.com/profile.jpg"
 *                     commentsCount:
 *                       type: integer
 *                       example: 12
 *                     likesCount:
 *                       type: integer
 *                       description: 좋아요 수
 *                       example: 5
 *                     viewCount:
 *                       type: integer
 *                       example: 101
 *                     isLocked:
 *                       type: boolean
 *                       description: 신고로 인한 잠금 상태
 *                       example: false
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T10:00:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T10:00:00.000Z"
 *                     timeAgo:
 *                       type: string
 *                       example: "1시간 전"
 *                     isAuthor:
 *                       type: boolean
 *                       example: false
 *                     isLiked:
 *                       type: boolean
 *                       nullable: true
 *                       description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 *                       example: false
 *             example:
 *               status: 200
 *               data:
 *                 id: "post-123"
 *                 authorId: "user-123"
 *                 title: "오늘 하늘이 이뻤어요!"
 *                 content: "구름이 뭉게뭉게 있어서 하늘이 이뻐요!"
 *                 media: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
 *                 missionTitle: "일상 인증 미션"
 *                 missionNotionPageId: "mission-page-123"
 *                 author: "닉네임"
 *                 profileImageUrl: "https://example.com/profile.jpg"
 *                 commentsCount: 12
 *                 likesCount: 5
 *                 viewCount: 101
 *                 isLocked: false
 *                 createdAt: "2024-01-20T10:00:00.000Z"
 *                 updatedAt: "2024-01-20T10:00:00.000Z"
 *                 timeAgo: "1시간 전"
 *                 isAuthor: false
 *                 isLiked: false
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               BadRequest:
 *                 value:
 *                   status: 400
 *                   message: "인증글 ID가 필요합니다."
 *       404:
 *         description: 인증글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               NotFound:
 *                 value:
 *                   status: 404
 *                   message: "인증글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "인증글을 조회할 수 없습니다."
 */
router.get("/posts/:postId", optionalAuth, missionController.getMissionPostById);

/**
 * @swagger
 * /missions/posts/{postId}/comments:
 *   get:
 *     summary: 미션 인증글 댓글 목록 조회
 *     tags: [Missions]
 *     description: 특정 미션 인증글에 달린 댓글과 대댓글을 조회합니다. 인증은 선택 사항입니다.
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 인증글 ID
 *         example: "post-123"
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 20
 *         description: 페이지당 원댓글 수
 *       - in: query
 *         name: startCursor
 *         schema:
 *           type: string
 *         description: 다음 페이지 조회용 cursor (마지막으로 받은 원댓글 ID)
 *     responses:
 *       200:
 *         description: 댓글 목록 조회 성공
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
 *                     comments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: 댓글 ID
 *                             example: "comment_123"
 *                           postId:
 *                             type: string
 *                             description: 미션 인증글 ID
 *                             example: "post-123"
 *                           userId:
 *                             type: string
 *                             nullable: true
 *                             description: 작성자 UID
 *                           author:
 *                             type: string
 *                             description: 작성자 닉네임
 *                           profileImageUrl:
 *                             type: string
 *                             nullable: true
 *                             description: 작성자 프로필 이미지 URL
 *                             example: "https://example.com/profile.jpg"
 *                           content:
 *                             type: string
 *                             description: 댓글 HTML 내용
 *                           parentId:
 *                             type: string
 *                             nullable: true
 *                           parentAuthor:
 *                             type: string
 *                             nullable: true
 *                             description: 부모 댓글 작성자 닉네임 (대댓글인 경우)
 *                           depth:
 *                             type: number
 *                             description: "댓글 깊이 (0: 원댓글, 1: 대댓글)"
 *                           likesCount:
 *                             type: number
 *                             example: 0
 *                           isLiked:
 *                             type: boolean
 *                             nullable: true
 *                             description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 *                             example: false
 *                           isDeleted:
 *                             type: boolean
 *                           isLocked:
 *                             type: boolean
 *                           isMine:
 *                             type: boolean
 *                             description: 현재 사용자가 작성한 댓글 여부
 *                           isAuthor:
 *                             type: boolean
 *                             description: 인증글 작성자의 댓글 여부
 *                           repliesCount:
 *                             type: number
 *                             description: 대댓글 수
 *                           replies:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 userId:
 *                                   type: string
 *                                   nullable: true
 *                                 author:
 *                                   type: string
 *                                 profileImageUrl:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 작성자 프로필 이미지 URL
 *                                   example: "https://example.com/profile.jpg"
 *                                 content:
 *                                   type: string
 *                                 parentId:
 *                                   type: string
 *                                   description: 부모 댓글 ID
 *                                 parentAuthor:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 부모 댓글 작성자 닉네임 (대댓글인 경우)
 *                                 depth:
 *                                   type: number
 *                                 likesCount:
 *                                   type: number
 *                                 isLiked:
 *                                   type: boolean
 *                                   nullable: true
 *                                   description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 *                                   example: false
 *                                 isDeleted:
 *                                   type: boolean
 *                                 isLocked:
 *                                   type: boolean
 *                                 isMine:
 *                                   type: boolean
 *                                 isAuthor:
 *                                   type: boolean
 *                                 createdAt:
 *                                   type: string
 *                                   format: date-time
 *                                 updatedAt:
 *                                   type: string
 *                                   format: date-time
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pageInfo:
 *                       type: object
 *                       properties:
 *                         pageSize:
 *                           type: integer
 *                           example: 10
 *                         nextCursor:
 *                           type: string
 *                           nullable: true
 *                           example: "root-comment-123"
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       404:
 *         description: 인증글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *   post:
 *     summary: 미션 인증글 댓글 작성
 *     tags: [Missions]
 *     description: 특정 미션 인증글에 댓글을 작성합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 인증글 ID
 *         example: "post-123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: 댓글 HTML 내용
 *                 example: "<p>정말 좋은 인증이네요!</p>"
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: 부모 댓글 ID (대댓글인 경우)
 *                 example: "comment_123"
 *           example:
 *             content: "<p>정말 좋은 인증이네요!</p>"
 *             parentId: "comment_123"
 *     responses:
 *       201:
 *         description: 댓글 작성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: 댓글 ID
 *                       example: "comment_123"
 *                     postId:
 *                       type: string
 *                       description: 미션 인증글 ID
 *                       example: "post-123"
 *                     userId:
 *                       type: string
 *                       description: 작성자 UID
 *                       example: "user-123"
 *                     author:
 *                       type: string
 *                       description: 작성자 닉네임
 *                       example: "사용자닉네임"
 *                     content:
 *                       type: string
 *                       description: 댓글 HTML 내용
 *                       example: "<p>좋은 인증입니다!</p>"
 *                     parentId:
 *                       type: string
 *                       nullable: true
 *                       description: 부모 댓글 ID
 *                       example: "comment_456"
 *                     parentAuthor:
 *                       type: string
 *                       nullable: true
 *                       description: 부모 댓글 작성자 닉네임 (대댓글인 경우)
 *                       example: "사용자닉네임"
 *                     depth:
 *                       type: number
 *                       description: 댓글 깊이
 *                       example: 0
 *                     likesCount:
 *                       type: number
 *                       description: 좋아요 수
 *                       example: 0
 *                     isLocked:
 *                       type: boolean
 *                       description: 잠금 여부
 *                       example: false
 *                     isDeleted:
 *                       type: boolean
 *                       description: 삭제 여부
 *                       example: false
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: 생성일시
 *                       example: "2025-10-03T17:15:07.862Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: 수정일시
 *                       example: "2025-10-03T17:15:07.862Z"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ContentRequired:
 *                 value:
 *                   status: 400
 *                   message: "댓글 내용은 필수입니다."
 *               TextContentRequired:
 *                 value:
 *                   status: 400
 *                   message: "댓글에 텍스트 내용이 필요합니다."
 *               InvalidContent:
 *                 value:
 *                   status: 400
 *                   message: "sanitize 후 유효한 텍스트 내용이 없습니다."
 *               InvalidParentComment:
 *                 value:
 *                   status: 400
 *                   message: "부모 댓글이 해당 인증글의 댓글이 아닙니다."
 *               SelfParentError:
 *                 value:
 *                   status: 400
 *                   message: "자기 자신을 부모 댓글로 지정할 수 없습니다."
 *               CommunityCommentReplyError:
 *                 value:
 *                   status: 400
 *                   message: "커뮤니티 댓글에는 답글을 남길 수 없습니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"

 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       404:
 *         description: 리소스를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               PostNotFound:
 *                 value:
 *                   status: 404
 *                   message: "인증글을 찾을 수 없습니다."
 *               ParentCommentNotFound:
 *                 value:
 *                   status: 404
 *                   message: "부모 댓글을 찾을 수 없습니다."
 *               UserNotFound:
 *                 value:
 *                   status: 404
 *                   message: "사용자를 찾을 수 없습니다."
 *               NicknameNotFound:
 *                 value:
 *                   status: 404
 *                   message: "사용자 닉네임을 찾을 수 없습니다. 온보딩을 완료해주세요."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               CreateCommentError:
 *                 value:
 *                   status: 500
 *                   message: "댓글을 생성할 수 없습니다."
 *               UserInfoError:
 *                 value:
 *                   status: 500
 *                   message: "사용자 정보를 조회할 수 없습니다."
 */
router.get("/posts/:postId/comments", optionalAuth, missionController.getMissionPostComments);
router.post("/posts/:postId/comments", authGuard, missionController.createMissionPostComment);

/**
 * @swagger
 * /missions/posts/{postId}/comments/{commentId}:
 *   put:
 *     summary: 미션 인증글 댓글 수정
 *     tags: [Missions]
 *     description: 특정 미션 인증글 댓글을 수정합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 인증글 ID
 *         example: "post-123"
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
 *         example: "comment_123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: 수정된 댓글 HTML 내용
 *                 example: "<p>수정된 댓글 내용입니다!</p>"
 *           example:
 *             content: "<p>수정된 댓글 내용입니다!</p>"
 *     responses:
 *       200:
 *         description: 댓글 수정 성공
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
 *                     id:
 *                       type: string
 *                       description: 댓글 ID
 *                       example: "comment_123"
 *                     postId:
 *                       type: string
 *                       description: 미션 인증글 ID
 *                       example: "post-123"
 *                     userId:
 *                       type: string
 *                       description: 작성자 UID
 *                       example: "user-123"
 *                     author:
 *                       type: string
 *                       description: 작성자 닉네임
 *                       example: "사용자닉네임"
 *                     content:
 *                       type: string
 *                       description: 댓글 HTML 내용
 *                       example: "<p>수정된 댓글 내용입니다!</p>"
 *                     parentId:
 *                       type: string
 *                       nullable: true
 *                       description: 부모 댓글 ID
 *                       example: "comment_456"
 *                     parentAuthor:
 *                       type: string
 *                       nullable: true
 *                       description: 부모 댓글 작성자 닉네임 (대댓글인 경우)
 *                       example: "사용자닉네임"
 *                     depth:
 *                       type: number
 *                       description: "댓글 깊이 (0: 원댓글, 1: 대댓글)"
 *                       example: 0
 *                     likesCount:
 *                       type: number
 *                       description: 좋아요 수
 *                       example: 0
 *                     isLocked:
 *                       type: boolean
 *                       description: 잠금 여부
 *                       example: false
 *                     isDeleted:
 *                       type: boolean
 *                       description: 삭제 여부
 *                       example: false
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: 생성일시
 *                       example: "2025-10-03T17:15:07.862Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: 수정일시
 *                       example: "2025-10-03T18:30:15.123Z"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ContentRequired:
 *                 value:
 *                   status: 400
 *                   message: "댓글 내용은 필수입니다."
 *               TextContentRequired:
 *                 value:
 *                   status: 400
 *                   message: "댓글에 텍스트 내용이 필요합니다."
 *               InvalidContent:
 *                 value:
 *                   status: 400
 *                   message: "sanitize 후 유효한 텍스트 내용이 없습니다."
 *               CommentDeleted:
 *                 value:
 *                   status: 400
 *                   message: "삭제된 댓글은 수정할 수 없습니다."
 *               CommunityCommentError:
 *                 value:
 *                   status: 400
 *                   message: "커뮤니티 댓글은 이 API로 수정할 수 없습니다."
 *               InvalidPostComment:
 *                 value:
 *                   status: 400
 *                   message: "댓글이 해당 인증글에 속하지 않습니다."
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               Forbidden:
 *                 value:
 *                   status: 403
 *                   message: "댓글 수정 권한이 없습니다."
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               NotFound:
 *                 value:
 *                   status: 404
 *                   message: "댓글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "댓글을 수정할 수 없습니다."
 */
router.put("/posts/:postId/comments/:commentId", authGuard, missionController.updateMissionPostComment);

/**
 * @swagger
 * /missions/posts/{postId}/comments/{commentId}:
 *   delete:
 *     summary: 미션 인증글 댓글 삭제
 *     tags: [Missions]
 *     description: 특정 미션 인증글 댓글을 삭제합니다. 대댓글이 있으면 소프트 딜리트, 없으면 하드 딜리트됩니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 인증글 ID
 *         example: "post-123"
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
 *         example: "comment_123"
 *     responses:
 *       204:
 *         description: 댓글 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               CommunityCommentError:
 *                 value:
 *                   status: 400
 *                   message: "커뮤니티 댓글은 이 API로 삭제할 수 없습니다."
 *               InvalidPostComment:
 *                 value:
 *                   status: 400
 *                   message: "댓글이 해당 인증글에 속하지 않습니다."
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               Forbidden:
 *                 value:
 *                   status: 403
 *                   message: "댓글 삭제 권한이 없습니다."
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               NotFound:
 *                 value:
 *                   status: 404
 *                   message: "댓글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "댓글을 삭제할 수 없습니다."
 */
router.delete("/posts/:postId/comments/:commentId", authGuard, missionController.deleteMissionPostComment);

// 미션 인증글 좋아요 토글
/**
 * @swagger
 * /missions/posts/{postId}/like:
 *   post:
 *     tags: [Missions]
 *     summary: 미션 인증글 좋아요 토글
 *     description: |
 *       특정 미션 인증글의 좋아요를 추가하거나 취소합니다.
 *       - 이미 좋아요한 경우: 좋아요 취소 (isLiked: false)
 *       - 좋아요하지 않은 경우: 좋아요 추가 (isLiked: true)
 *       - 본인 게시글에도 좋아요 가능 (리워드 없음)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 인증글 ID
 *         example: "8nB99m2VfVyGAhdmsiFn"
 *     responses:
 *       200:
 *         description: 좋아요 토글 성공
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
 *                     postId:
 *                       type: string
 *                       description: 인증글 ID
 *                       example: "8nB99m2VfVyGAhdmsiFn"
 *                     userId:
 *                       type: string
 *                       description: 좋아요를 누른 사용자 ID
 *                       example: "user-123"
 *                     isLiked:
 *                       type: boolean
 *                       description: "좋아요 상태 (true: 좋아요 추가됨, false: 좋아요 취소됨)"
 *                       example: true
 *                     likesCount:
 *                       type: integer
 *                       description: 현재 좋아요 수
 *                       example: 5
 *             examples:
 *               LikeAdded:
 *                 summary: 좋아요 추가
 *                 value:
 *                   status: 200
 *                   data:
 *                     postId: "8nB99m2VfVyGAhdmsiFn"
 *                     userId: "user-123"
 *                     isLiked: true
 *                     likesCount: 5
 *               LikeRemoved:
 *                 summary: 좋아요 취소
 *                 value:
 *                   status: 200
 *                   data:
 *                     postId: "8nB99m2VfVyGAhdmsiFn"
 *                     userId: "user-123"
 *                     isLiked: false
 *                     likesCount: 4
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingPostId:
 *                 summary: 인증글 ID 누락
 *                 value:
 *                   status: 400
 *                   message: "인증글 ID가 필요합니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingBearer:
 *                 summary: Bearer 토큰 누락
 *                 value:
 *                   status: 401
 *                   message: "Bearer 토큰이 필요합니다"
 *       404:
 *         description: 인증글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               PostNotFound:
 *                 summary: 인증글 없음
 *                 value:
 *                   status: 404
 *                   message: "인증글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 summary: 서버 내부 오류
 *                 value:
 *                   status: 500
 *                   message: "게시글 좋아요 처리에 실패했습니다."
 */
router.post("/posts/:postId/like", authGuard, missionController.toggleMissionPostLike);

// 미션 인증글 댓글 좋아요 토글
/**
 * @swagger
 * /missions/posts/{postId}/comments/{commentId}/like:
 *   post:
 *     tags: [Missions]
 *     summary: 미션 인증글 댓글 좋아요 토글
 *     description: |
 *       특정 미션 인증글 댓글의 좋아요를 추가하거나 취소합니다.
 *       - 이미 좋아요한 경우: 좋아요 취소 (isLiked: false)
 *       - 좋아요하지 않은 경우: 좋아요 추가 (isLiked: true)
 *       - 본인 댓글에도 좋아요 가능 (리워드 없음)
 *       - 삭제된 댓글에는 좋아요 불가
 *       - 커뮤니티 댓글은 이 API로 좋아요 불가
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 인증글 ID
 *         example: "8nB99m2VfVyGAhdmsiFn"
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
 *         example: "mtj4zO8tw0EIfCNQv7Ws"
 *     responses:
 *       200:
 *         description: 좋아요 토글 성공
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
 *                     commentId:
 *                       type: string
 *                       description: 댓글 ID
 *                       example: "mtj4zO8tw0EIfCNQv7Ws"
 *                     userId:
 *                       type: string
 *                       description: 좋아요를 누른 사용자 ID
 *                       example: "user-123"
 *                     isLiked:
 *                       type: boolean
 *                       description: "좋아요 상태 (true: 좋아요 추가됨, false: 좋아요 취소됨)"
 *                       example: true
 *                     likesCount:
 *                       type: integer
 *                       description: 현재 좋아요 수
 *                       example: 3
 *             examples:
 *               LikeAdded:
 *                 summary: 좋아요 추가
 *                 value:
 *                   status: 200
 *                   data:
 *                     commentId: "mtj4zO8tw0EIfCNQv7Ws"
 *                     userId: "user-123"
 *                     isLiked: true
 *                     likesCount: 3
 *               LikeRemoved:
 *                 summary: 좋아요 취소
 *                 value:
 *                   status: 200
 *                   data:
 *                     commentId: "mtj4zO8tw0EIfCNQv7Ws"
 *                     userId: "user-123"
 *                     isLiked: false
 *                     likesCount: 2
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingCommentId:
 *                 summary: ID 누락
 *                 value:
 *                   status: 400
 *                   message: "인증글 ID와 댓글 ID가 필요합니다."
 *               InvalidPostComment:
 *                 summary: 댓글이 인증글에 속하지 않음
 *                 value:
 *                   status: 400
 *                   message: "댓글이 해당 인증글에 속하지 않습니다."
 *               CommunityComment:
 *                 summary: 커뮤니티 댓글
 *                 value:
 *                   status: 400
 *                   message: "커뮤니티 댓글은 이 API로 좋아요할 수 없습니다."
 *               DeletedComment:
 *                 summary: 삭제된 댓글
 *                 value:
 *                   status: 400
 *                   message: "삭제된 댓글에는 좋아요를 할 수 없습니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingBearer:
 *                 summary: Bearer 토큰 누락
 *                 value:
 *                   status: 401
 *                   message: "Bearer 토큰이 필요합니다"
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               CommentNotFound:
 *                 summary: 댓글 없음
 *                 value:
 *                   status: 404
 *                   message: "댓글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 summary: 서버 내부 오류
 *                 value:
 *                   status: 500
 *                   message: "댓글 좋아요 처리에 실패했습니다."
 */
router.post("/posts/:postId/comments/:commentId/like", authGuard, missionController.toggleMissionPostCommentLike);

/**
 * @swagger
 * /missions/{missionId}:
 *   get:
 *     summary: 미션 상세 조회
 *     tags: [Missions]
 *     parameters:
 *       - in: path
 *         name: missionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 ID (Notion 페이지 ID)
 *     responses:
 *       200:
 *         description: 미션 상세 조회 성공
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
 *                     mission:
 *                       $ref: "#/components/schemas/Mission"
 *       404:
 *         description: 미션을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissionNotFound:
 *                 value:
 *                   status: 404
 *                   message: "존재하지 않는 미션입니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "서버 내부 오류가 발생했습니다"
 */
router.get("/:missionId", optionalAuth, missionController.getMissionById);

/**
 * @swagger
 * /missions/{missionId}/faqs:
 *   get:
 *     summary: 미션 FAQ 목록 조회
 *     description: 특정 미션에 연결된 FAQ 목록을 조회합니다. 노션 FAQ 데이터베이스에서 미션 페이지와 Relation으로 연결된 FAQ만 반환합니다.
 *     tags: [Missions]
 *     parameters:
 *       - in: path
 *         name: missionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 ID (Notion 페이지 ID)
 *     responses:
 *       200:
 *         description: 미션 FAQ 목록 조회 성공
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
 *                     faqs:
 *                       type: array
 *                       description: 미션과 연결된 FAQ 목록
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: FAQ 페이지 ID
 *                           title:
 *                             type: string
 *                             description: FAQ 제목
 *                           recordMap:
 *                             type: object
 *                             description: NotionRenderer에서 사용할 recordMap 데이터
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: FAQ 생성일시
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             description: FAQ 수정일시
 *                     count:
 *                       type: integer
 *                       description: FAQ 개수
 *                       example: 8
 *                     hasMore:
 *                       type: boolean
 *                       description: 다음 페이지 존재 여부
 *                       example: false
 *                     nextCursor:
 *                       type: string
 *                       nullable: true
 *                       description: 다음 페이지를 위한 커서
 *                       example: "2a645f52-4cd0-80f3-b9b2-c796ab907c02"
 *       400:
 *         description: 잘못된 요청 (미션 ID 누락)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       404:
 *         description: 미션 또는 FAQ를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.get("/:missionId/faqs", optionalAuth, missionController.getMissionFaqs);

/**
 * @swagger
 * /missions/{missionId}/like:
 *   post:
 *     summary: 미션 찜 토글
 *     tags: [Missions]
 *     description: 미션 상세 또는 목록에서 찜(하트)을 토글합니다. 이미 찜한 상태라면 취소됩니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: missionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 ID (Notion 페이지 ID)
 *         example: "2b345f52-4cd0-81b3-81b8-ccd63ace93fc"
 *     responses:
 *       200:
 *         description: 찜 토글 성공
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
 *                     liked:
 *                       type: boolean
 *                       description: true면 찜됨, false면 찜 취소됨
 *                       example: true
 *                     likesCount:
 *                       type: integer
 *                       description: 전체 찜 수
 *                       example: 42
 *       400:
 *         description: 잘못된 요청 (미션 ID 누락 등)
 *       401:
 *         description: 인증 필요
 */
router.post("/:missionId/like", authGuard, missionController.toggleMissionLike);

/**
 * @swagger
 * /missions/{missionId}/apply:
 *   post:
 *     summary: 미션 신청
 *     description: 주어진 미션 ID로 사용자가 미션을 신청합니다. (동일 미션은 하루 한 번만 신청 가능)
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: missionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 ID (Notion 페이지 ID)
 *     requestBody:
 *       required: false
 *       description: 요청 본문은 필요 없습니다. Path 파라미터와 Bearer 토큰만 전송하세요.
 *     responses:
 *       201:
 *         description: 미션 신청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     missionId:
 *                       type: string
 *                       example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522"
 *                     status:
 *                       type: string
 *                       example: "IN_PROGRESS"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingMissionId:
 *                 value:
 *                   status: 400
 *                   message: "미션 ID가 필요합니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingBearer:
 *                 value:
 *                   status: 401
 *                   message: "Bearer 토큰이 필요합니다"

 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       404:
 *         description: 미션을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissionNotFound:
 *                 value:
 *                   status: 404
 *                   message: "존재하지 않는 미션입니다."
 *       409:
 *         description: 신청 제한 초과 혹은 중복 신청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               DuplicateOrLimited:
 *                 value:
 *                   status: 409
 *                   message: "이미 참여한 미션입니다. 다음 리셋 이후에 다시 신청해주세요."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "서버 내부 오류가 발생했습니다"
 */
router.post("/:missionId/apply", authGuard, missionController.applyMission);

/**
 * @swagger
 * /missions/{missionId}/quit:
 *   post:
 *     summary: 미션 그만두기
 *     description: 사용자가 신청한 진행 중인 미션을 그만둡니다.
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: missionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 ID (Notion 페이지 ID)
 *     responses:
 *       200:
 *         description: 미션 그만두기 성공
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
 *                     missionId:
 *                       type: string
 *                       example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522"
 *                     status:
 *                       type: string
 *                       example: "QUIT"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               BadRequest:
 *                 value:
 *                   status: 400
 *                   message: "미션 ID가 필요합니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"

 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               Forbidden:
 *                 value:
 *                   status: 403
 *                   message: "본인의 미션만 그만둘 수 있습니다."
 *       404:
 *         description: 미션을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissionNotFound:
 *                 value:
 *                   status: 404
 *                   message: "신청한 미션이 없습니다."
 *       409:
 *         description: 충돌
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissionNotInProgress:
 *                 value:
 *                   status: 409
 *                   message: "진행 중인 미션만 그만둘 수 있습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/:missionId/quit", authGuard, missionController.quitMission);

/**
 * @swagger
 * /missions/{missionId}/posts:
 *   post:
 *     summary: 미션 인증 글 작성 (완료 처리)
 *     description: 미션 인증 글을 작성하면서 해당 미션을 완료 상태로 전환합니다.
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: missionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 미션 ID (Notion 페이지 ID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 인증 글 제목
 *                 example: "미션 인증 완료!"
 *               content:
 *                 type: string
 *                 description: 인증 내용 (HTML 허용)
 *                 example: "<p>오늘의 미션을 이렇게 수행했어요.</p>"
 *               media:
 *                 type: array
 *                 description: 업로드된 파일 경로 배열
 *                 items:
 *                   type: string
 *                 example: ["files/abc123/sample.png"]
 *               postType:
 *                 type: string
 *                 description: 게시글 유형 (기본 CERT)
 *                 example: "CERT"
 *     responses:
 *       201:
 *         description: 인증 글 작성 및 미션 완료 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     missionId:
 *                       type: string
 *                       example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522"
 *                     postId:
 *                       type: string
 *                       example: "mission-post-123"
 *                     status:
 *                       type: string
 *                       example: "COMPLETED"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               InvalidPayload:
 *                 value:
 *                   status: 400
 *                   message: "제목, 내용 또는 미디어 중 최소 한 가지는 필요합니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingBearer:
 *                 value:
 *                   status: 401
 *                   message: "Bearer 토큰이 필요합니다"

 *       423:
 *         description: 계정 자격정지
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountSuspendedResponse'
 *       404:
 *         description: 미션 신청 기록 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissionNotApplied:
 *                 value:
 *                   status: 404
 *                   message: "미션 신청 기록을 찾을 수 없습니다."
 *       409:
 *         description: 이미 완료된 미션
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               AlreadyCompleted:
 *                 value:
 *                   status: 409
 *                   message: "이미 완료되었거나 종료된 미션입니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               ServerError:
 *                 value:
 *                   status: 500
 *                   message: "서버 내부 오류가 발생했습니다"
 */
router.post("/:missionId/posts", authGuard, missionController.createMissionPost);

// 미션 인증글 신고 (DEPRECATED: /reportContent API 사용 권장)
/**
 * @swagger
 * /missions/posts/{postId}/report:
 *   post:
 *     tags: [Missions]
 *     deprecated: true
 *     summary: "[DEPRECATED] 미션 인증글 신고"
 *     description: |
 *       ⚠️ 이 API는 더 이상 사용되지 않습니다. 
 *       대신 `POST /reportContent` API를 사용해주세요.
 *       
 *       예시:
 *       ```json
 *       {
 *         "targetType": "post",
 *         "targetId": "인증글ID",
 *         "targetUserId": "작성자ID",
 *         "missionId": "미션ID",
 *         "reportReason": "신고사유"
 *       }
 *       ```
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 인증글 ID
 *         example: "8nB99m2VfVyGAhdmsiFn"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - reportReason
 *               - missionId
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: 신고 대상 작성자 ID
 *                 example: "user-123"
 *               reportReason:
 *                 type: string
 *                 description: 신고 사유
 *                 example: "욕설"
 *               missionId:
 *                 type: string
 *                 description: 미션 ID
 *                 example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522"
 *     responses:
 *       201:
 *         description: 신고 접수 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "신고가 접수되었습니다."
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingPostId:
 *                 summary: 인증글 ID 누락
 *                 value:
 *                   status: 400
 *                   message: "인증글 ID가 필요합니다."
 *               MissingFields:
 *                 summary: 필수 필드 누락
 *                 value:
 *                   status: 400
 *                   message: "필수 필드가 누락되었습니다. (targetUserId, reportReason, missionId)"
 *               DuplicateReport:
 *                 summary: 중복 신고
 *                 value:
 *                   status: 400
 *                   message: "이미 신고한 콘텐츠입니다."
 *               InvalidMission:
 *                 summary: 미션 불일치
 *                 value:
 *                   status: 400
 *                   message: "인증글이 해당 미션에 속하지 않습니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               Unauthorized:
 *                 summary: 인증 필요
 *                 value:
 *                   status: 401
 *                   message: "로그인이 필요합니다."
 *       404:
 *         description: 인증글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               PostNotFound:
 *                 summary: 인증글 없음
 *                 value:
 *                   status: 404
 *                   message: "신고하려는 인증글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               NotionSyncFailed:
 *                 summary: Notion 동기화 실패
 *                 value:
 *                   status: 500
 *                   message: "Notion 동기화 중 오류가 발생했습니다."
 *               ReportCountUpdateFailed:
 *                 summary: 신고 카운트 업데이트 실패
 *                 value:
 *                   status: 500
 *                   message: "신고 카운트 증가 실패"
 */
router.post("/posts/:postId/report", authGuard, missionController.reportMissionPost);

// 미션 인증글 댓글 신고 (DEPRECATED: /reportContent API 사용 권장)
/**
 * @swagger
 * /missions/posts/{postId}/comments/{commentId}/report:
 *   post:
 *     tags: [Missions]
 *     deprecated: true
 *     summary: "[DEPRECATED] 미션 인증글 댓글 신고"
 *     description: |
 *       ⚠️ 이 API는 더 이상 사용되지 않습니다. 
 *       대신 `POST /reportContent` API를 사용해주세요.
 *       
 *       예시:
 *       ```json
 *       {
 *         "targetType": "comment",
 *         "targetId": "댓글ID",
 *         "targetUserId": "작성자ID",
 *         "missionId": "미션ID",
 *         "reportReason": "신고사유"
 *       }
 *       ```
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 인증글 ID
 *         example: "8nB99m2VfVyGAhdmsiFn"
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
 *         example: "mtj4zO8tw0EIfCNQv7Ws"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - reportReason
 *               - missionId
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: 신고 대상 작성자 ID
 *                 example: "user-123"
 *               reportReason:
 *                 type: string
 *                 description: 신고 사유
 *                 example: "욕설"
 *               missionId:
 *                 type: string
 *                 description: 미션 ID
 *                 example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522"
 *     responses:
 *       201:
 *         description: 신고 접수 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "신고가 접수되었습니다."
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               MissingIds:
 *                 summary: ID 누락
 *                 value:
 *                   status: 400
 *                   message: "인증글 ID와 댓글 ID가 필요합니다."
 *               MissingFields:
 *                 summary: 필수 필드 누락
 *                 value:
 *                   status: 400
 *                   message: "필수 필드가 누락되었습니다. (targetUserId, reportReason, missionId)"
 *               DuplicateReport:
 *                 summary: 중복 신고
 *                 value:
 *                   status: 400
 *                   message: "이미 신고한 콘텐츠입니다."
 *               CommunityComment:
 *                 summary: 커뮤니티 댓글
 *                 value:
 *                   status: 400
 *                   message: "커뮤니티 댓글은 미션 신고 API를 사용할 수 없습니다."
 *               InvalidMission:
 *                 summary: 미션 불일치
 *                 value:
 *                   status: 400
 *                   message: "댓글이 해당 미션에 속하지 않습니다."
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               Unauthorized:
 *                 summary: 인증 필요
 *                 value:
 *                   status: 401
 *                   message: "로그인이 필요합니다."
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               CommentNotFound:
 *                 summary: 댓글 없음
 *                 value:
 *                   status: 404
 *                   message: "신고하려는 댓글을 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               NotionSyncFailed:
 *                 summary: Notion 동기화 실패
 *                 value:
 *                   status: 500
 *                   message: "Notion 동기화 중 오류가 발생했습니다."
 *               ReportCountUpdateFailed:
 *                 summary: 신고 카운트 업데이트 실패
 *                 value:
 *                   status: 500
 *                   message: "신고 카운트 증가 실패"
 */
router.post("/posts/:postId/comments/:commentId/report", authGuard, missionController.reportMissionComment);

module.exports = router;


