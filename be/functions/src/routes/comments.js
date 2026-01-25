const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const authGuard = require("../middleware/authGuard");
const rewardHandler = require("../middleware/rewardHandler");
const optionalAuth = require("../middleware/optionalAuth");

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 댓글 ID
 *         author:
 *           type: string
 *           description: 작성자 ID
 *         content:
 *           type: array
 *           description: 댓글 내용
 *         parent_id:
 *           type: string
 *           nullable: true
 *           description: 부모 댓글 ID (대댓글인 경우)
 *         vote_score:
 *           type: integer
 *           description: 투표 점수
 *         up_vote_score:
 *           type: integer
 *           description: 추천 점수
 *         deleted:
 *           type: boolean
 *           description: 삭제 여부
 *         replies_count:
 *           type: integer
 *           description: 대댓글 수
 *         created_at:
 *           type: integer
 *           description: 생성일 (timestamp)
 *         updated_at:
 *           type: integer
 *           description: 수정일 (timestamp)
 *         isMine:
 *           type: boolean
 *           description: 내가 작성한 댓글 여부
 *         hasVideo:
 *           type: boolean
 *           description: 비디오 포함 여부
 *         hasImage:
 *           type: boolean
 *           description: 이미지 포함 여부
 *         hasAuthorReply:
 *           type: boolean
 *           description: 작성자 답글 여부
 *         hasAuthorVote:
 *           type: boolean
 *           description: 작성자 투표 여부
 *         isOriginalAuthor:
 *           type: boolean
 *           description: 원글 작성자 여부
 *         isLiked:
 *           type: boolean
 *           nullable: true
 *           description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 */

// 댓글 목록 조회
/**
 * @swagger
 * /comments/communities/{communityId}/posts/{postId}:
 *   get:
 *     tags: [Comments]
 *     summary: 댓글 목록 조회
 *     description: 특정 게시글의 댓글 목록 조회
 *     parameters:
 *       - in: path
 *         name: communityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 커뮤니티 ID
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 게시글 ID
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
 *                           communityId:
 *                             type: string
 *                             description: 커뮤니티 ID
 *                             example: "tmi-community"
 *                           postId:
 *                             type: string
 *                             description: 게시글 ID
 *                             example: "post_123"
 *                           author:
 *                             type: string
 *                             description: 작성자 닉네임
 *                             example: "사용자닉네임"
 *                           userId:
 *                             type: string
 *                             nullable: true
 *                             description: 작성자 UID
 *                             example: "user_123"
 *                           profileImageUrl:
 *                             type: string
 *                             nullable: true
 *                             description: 작성자 프로필 이미지 URL
 *                             example: "https://example.com/profile.jpg"
 *                           content:
 *                             type: string
 *                             description: 댓글 HTML 내용
 *                             example: "<p>댓글 내용입니다!</p>"
 *                           parentId:
 *                             type: string
 *                             nullable: true
 *                             description: 부모 댓글 ID
 *                             example: "comment_456"
 *                           parentAuthor:
 *                             type: string
 *                             nullable: true
 *                             description: 부모 댓글 작성자 닉네임 (대댓글인 경우)
 *                             example: "사용자닉네임"
 *                           depth:
 *                             type: number
 *                             description: 댓글 깊이
 *                             example: 0
 *                           isLocked:
 *                             type: boolean
 *                             description: 잠금 여부
 *                             example: false
 *                           isDeleted:
 *                             type: boolean
 *                             description: 삭제 여부
 *                             example: false
 *                           likesCount:
 *                             type: number
 *                             description: 좋아요 수
 *                             example: 0
 *                           isLiked:
 *                             type: boolean
 *                             nullable: true
 *                             description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 *                           role:
 *                             type: string
 *                             nullable: true
 *                             enum: [member, admin]
 *                             description: 댓글 작성자의 커뮤니티 역할 (해당 커뮤니티 멤버일 때만 포함, moderator는 admin으로 normalize)
 *                             example: "member"
 *                           repliesCount:
 *                             type: number
 *                             description: 대댓글 수
 *                             example: 2
 *                           reportsCount:
 *                             type: number
 *                             description: 신고 횟수
 *                             example: 0
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: 생성일시
 *                             example: "2025-10-03T17:15:07.862Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             description: 수정일시
 *                             example: "2025-10-03T17:15:07.862Z"
 *                           replies:
 *                             type: array
 *                             description: 대댓글 목록
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                   description: 댓글 ID
 *                                   example: "comment_456"
 *                                 communityId:
 *                                   type: string
 *                                   description: 커뮤니티 ID
 *                                   example: "tmi-community"
 *                                 postId:
 *                                   type: string
 *                                   description: 게시글 ID
 *                                   example: "post_123"
 *                                 author:
 *                                   type: string
 *                                   description: 작성자 닉네임
 *                                   example: "사용자닉네임2"
 *                                 userId:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 작성자 UID
 *                                   example: "user_456"
 *                                 profileImageUrl:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 작성자 프로필 이미지 URL
 *                                   example: "https://example.com/profile.jpg"
 *                                 content:
 *                                   type: string
 *                                   description: 댓글 HTML 내용
 *                                   example: "<p>대댓글 내용입니다!</p>"
 *                                 parentId:
 *                                   type: string
 *                                   description: 부모 댓글 ID
 *                                   example: "comment_123"
 *                                 parentAuthor:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 부모 댓글 작성자 닉네임 (대댓글인 경우)
 *                                   example: "사용자닉네임"
 *                                 depth:
 *                                   type: number
 *                                   description: 댓글 깊이
 *                                   example: 1
 *                                 isLocked:
 *                                   type: boolean
 *                                   description: 잠금 여부
 *                                   example: false
 *                                 isDeleted:
 *                                   type: boolean
 *                                   description: 삭제 여부
 *                                   example: false
 *                                 likesCount:
 *                                   type: number
 *                                   description: 좋아요 수
 *                                   example: 0
 *                                 isLiked:
 *                                   type: boolean
 *                                   nullable: true
 *                                   description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
 *                                   example: false
 *                                 role:
 *                                   type: string
 *                                   nullable: true
 *                                   enum: [member, admin]
 *                                   description: 대댓글 작성자의 커뮤니티 역할 (해당 커뮤니티 멤버일 때만 포함, moderator는 admin으로 normalize)
 *                                   example: "member"
 *                                 reportsCount:
 *                                   type: number
 *                                   description: 신고 횟수
 *                                   example: 0
 *                                 createdAt:
 *                                   type: string
 *                                   format: date-time
 *                                   description: 생성일시
 *                                   example: "2025-10-03T17:20:07.862Z"
 *                                 updatedAt:
 *                                   type: string
 *                                   format: date-time
 *                                   description: 수정일시
 *                                   example: "2025-10-03T17:20:07.862Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         pageNumber:
 *                           type: integer
 *                           example: 0
 *                         pageSize:
 *                           type: integer
 *                           example: 20
 *                         totalElements:
 *                           type: integer
 *                           example: 50
 *                         totalPages:
 *                           type: integer
 *                           example: 3
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrevious:
 *                           type: boolean
 *                           example: false
 *                         isFirst:
 *                           type: boolean
 *                           example: true
 *                         isLast:
 *                           type: boolean
 *                           example: false
 *                     commentAuthorName:
 *                       type: string
 *                       nullable: true
 *                       description: 현재 로그인 사용자의 댓글 작성 시 표시될 닉네임 (TMI는 실명, 멤버면 멤버 닉네임, 그 외는 전역 닉네임, 인증된 요청일 때만 포함)
 *                       example: "멤버닉네임"
 *       404:
 *         description: 게시글을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get(
    "/communities/:communityId/posts/:postId",
    optionalAuth,
    commentController.getComments,
);

// 댓글 작성
/**
 * @swagger
 * /comments/communities/{communityId}/posts/{postId}:
 *   post:
 *     tags: [Comments]
 *     summary: 댓글 작성
 *     description: 특정 게시글에 댓글 작성
 *     parameters:
 *       - in: path
 *         name: communityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 커뮤니티 ID
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: 게시글 ID
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
 *                 example: "<p>정말 좋은 글이네요!</p><img src=\"https://example.com/comment-image.jpg\" width=\"1080\" height=\"1080\" data-blurhash=\"L6PZfSi_.AyE_3t7t7R**0o#DgR4\" data-mimetype=\"image/jpeg\"/>"
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: 부모 댓글 ID (대댓글인 경우)
 *                 example: "comment_123"
 *           example:
 *             content: "<p>정말 좋은 글이네요!</p><img src=\"https://example.com/image.jpg\" width=\"1080\" height=\"1080\"/>"
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
 *                     communityId:
 *                       type: string
 *                       description: 커뮤니티 ID
 *                       example: "tmi-community"
 *                     postId:
 *                       type: string
 *                       description: 게시글 ID
 *                       example: "post_123"
 *                     author:
 *                       type: string
 *                       description: 작성자 닉네임
 *                       example: "사용자닉네임"
 *                     content:
 *                       type: string
 *                       description: 댓글 HTML 내용
 *                       example: "<p>좋은 글입니다!</p><img src=\"url\" width=\"1080\" height=\"1080\"/>"
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
 *                     isLocked:
 *                       type: boolean
 *                       description: 잠금 여부
 *                       example: false
 *                     likesCount:
 *                       type: number
 *                       description: 좋아요 수
 *                       example: 0
 *                     isLiked:
 *                       type: boolean
 *                       nullable: true
 *                       description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
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
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "잘못된 요청입니다"
 *       404:
 *         description: 게시글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "게시글을 찾을 수 없습니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류가 발생했습니다"
 */
router.post(
    "/communities/:communityId/posts/:postId",
    authGuard,
    rewardHandler,
    commentController.createComment,
);

// 댓글 수정
/**
 * @swagger
 * /comments/{commentId}:
 *   put:
 *     tags: [Comments]
 *     summary: 댓글 수정
 *     description: 특정 댓글 수정
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
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
 *                 example: "<p>수정된 댓글 내용입니다!</p><img src=\"https://example.com/updated-comment-image.jpg\" width=\"1080\" height=\"1080\" data-blurhash=\"L6PZfSi_.AyE_3t7t7R**0o#DgR4\" data-mimetype=\"image/jpeg\"/>"
 *           example:
 *             content: "<p>수정된 댓글 내용입니다!</p><img src=\"https://example.com/image.jpg\" width=\"1080\" height=\"1080\"/>"
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
 *                     communityId:
 *                       type: string
 *                       description: 커뮤니티 ID
 *                       example: "tmi-community"
 *                     postId:
 *                       type: string
 *                       description: 게시글 ID
 *                       example: "post_123"
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
 *                     depth:
 *                       type: number
 *                       description: 댓글 깊이
 *                       example: 0
 *                     isLocked:
 *                       type: boolean
 *                       description: 잠금 여부
 *                       example: false
 *                     likesCount:
 *                       type: number
 *                       description: 좋아요 수
 *                       example: 0
 *                     isLiked:
 *                       type: boolean
 *                       nullable: true
 *                       description: 사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)
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
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "잘못된 요청입니다"
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "권한이 없습니다"
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "댓글을 찾을 수 없습니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류가 발생했습니다"
 */
router.put("/:commentId", authGuard, commentController.updateComment);

// 댓글 삭제
/**
 * @swagger
 * /comments/{commentId}:
 *   delete:
 *     tags: [Comments]
 *     summary: 댓글 삭제
 *     description: 특정 댓글 삭제
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
 *     responses:
 *       204:
 *         description: 댓글 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "잘못된 요청입니다"
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "권한이 없습니다"
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "댓글을 찾을 수 없습니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류가 발생했습니다"
 */
router.delete("/:commentId", authGuard, commentController.deleteComment);

// 댓글 좋아요 토글
/**
 * @swagger
 * /comments/{commentId}/like:
 *   post:
 *     tags: [Comments]
 *     summary: 댓글 좋아요 토글
 *     description: 특정 댓글의 좋아요 토글
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 댓글 ID
 *     responses:
 *       200:
 *         description: 댓글 좋아요 토글 성공
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
 *                     userId:
 *                       type: string
 *                     isLiked:
 *                       type: boolean
 *                       example: true
 *                     likesCount:
 *                       type: integer
 *                       example: 3
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "잘못된 요청입니다"
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "댓글을 찾을 수 없습니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류가 발생했습니다"
 */
router.post("/:commentId/like", authGuard, commentController.toggleCommentLike);

module.exports = router;
