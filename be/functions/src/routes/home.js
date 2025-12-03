const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");

/**
 * @swagger
 * tags:
 *   name: Home
 *   description: 홈 화면 관리 API
 */

/**
 * @swagger
 * /home:
 *   get:
 *     summary: 홈 화면 데이터 조회
 *     description: |
 *       노션에서 관리되는 홈 화면 데이터를 운영 배포일자 기준으로 가장 최신 항목을 조회합니다.
 *       - 운영 배포일자(date 타입)가 설정된 항목만 조회됩니다.
 *       - 가장 최신 배포일자를 가진 1개 항목을 반환합니다.
 *       - 페이지 내부의 블록 콘텐츠(텍스트, 이미지, 링크 등)를 포함합니다.
 *       - Notion data_source를 통해 조회됩니다.
 *     tags: [Home]
 *     responses:
 *       200:
 *         description: 홈 화면 데이터 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "홈 화면 데이터를 성공적으로 조회했습니다."
 *                 data:
 *                   type: object
 *                   required:
 *                     - id
 *                     - name
 *                     - content
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: 홈 화면 페이지 ID
 *                       example: "29b1f705-fa4a-8031-848c-000b2f2261a3"
 *                     name:
 *                       type: string
 *                       description: 홈 화면 이름
 *                       example: "메인 홈 화면"
 *                     backgroundImage:
 *                       type: array
 *                       description: 배경 이미지 파일 정보 목록
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "background.jpg"
 *                           url:
 *                             type: string
 *                             example: "https://notion.so/image/background.jpg"
 *                           type:
 *                             type: string
 *                             enum: [file, external]
 *                             example: "file"
 *                       example: []
 *                     activityReview:
 *                       type: boolean
 *                       description: "활동후기 여부 (Notion DB 필드: 활동후기 여부)"
 *                       example: true
 *                     nadaumExhibition:
 *                       type: boolean
 *                       description: "나다움전시 여부 (Notion DB 필드: 나다움전시 여부)"
 *                       example: false
 *                     deployDate:
 *                       type: string
 *                       format: date
 *                       description: 운영 배포일자 (date 타입, 가장 최신 배포일자 기준으로 조회됨)
 *                       example: "2025-10-30"
 *                       nullable: true
 *                     content:
 *                       type: array
 *                       description: 페이지 내부 블록 콘텐츠 (빈 paragraph 포함)
 *                       items:
 *                         type: object
 *                         required:
 *                           - type
 *                           - id
 *                         properties:
 *                           type:
 *                             type: string
 *                             description: 블록 타입
 *                             enum: [paragraph, heading_1, heading_2, heading_3, bulleted_list_item, numbered_list_item, to_do, toggle, quote, callout, image, video, file, divider]
 *                             example: "image"
 *                           id:
 *                             type: string
 *                             description: 블록 ID
 *                             example: "29b1f705-fa4a-8013-bee5-de7a37443870"
 *                           text:
 *                             type: string
 *                             description: 텍스트 내용 (텍스트 블록인 경우)
 *                             example: "환영합니다"
 *                           url:
 *                             type: string
 *                             description: 이미지/비디오/파일 URL (미디어 블록인 경우)
 *                             example: "https://notion.so/image.jpg"
 *                           caption:
 *                             type: string
 *                             description: 이미지/비디오 캡션 (미디어 블록인 경우)
 *                             example: "https://youth-it.vercel.app/routines"
 *                           links:
 *                             type: array
 *                             description: 블록에 포함된 링크 목록
 *                             items:
 *                               type: object
 *                               properties:
 *                                 text:
 *                                   type: string
 *                                   description: 링크 텍스트
 *                                   example: "https://youth-it.vercel.app/routines"
 *                                 url:
 *                                   type: string
 *                                   description: 링크 URL
 *                                   example: "https://youth-it.vercel.app/routines"
 *                             example: []
 *                           checked:
 *                             type: boolean
 *                             description: 체크 상태 (to_do 블록인 경우)
 *                             example: false
 *                       example:
 *                         - type: "paragraph"
 *                           id: "29b1f705-fa4a-8051-a51b-c4658ae008d7"
 *                           text: ""
 *                           links: []
 *                         - type: "image"
 *                           id: "29b1f705-fa4a-8013-bee5-de7a37443870"
 *                           url: "https://notion.so/image.jpg"
 *                           caption: ""
 *                           links: []
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: 생성 일시
 *                       example: "2025-10-29T15:41:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: 최종 수정 일시
 *                       example: "2025-10-30T16:04:00.000Z"
 *                     url:
 *                       type: string
 *                       description: 노션 페이지 URL
 *                       example: "https://notion.so/29b1f705fa4a8031848c000b2f2261a3"
 *       404:
 *         description: 운영 배포된 홈 화면 데이터가 존재하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "운영 배포된 홈 화면 데이터가 존재하지 않습니다."
 *                 code:
 *                   type: string
 *                   example: "HOME_NOT_FOUND"
 *       429:
 *         description: Notion API 요청 한도 초과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요."
 *                 code:
 *                   type: string
 *                   example: "RATE_LIMITED"
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "홈 화면 데이터 조회 중 오류가 발생했습니다"
 *                 code:
 *                   type: string
 *                   example: "NOTION_API_ERROR"
 */
router.get("/", homeController.getHomeScreen);

module.exports = router;

