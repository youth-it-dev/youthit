const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeController");
const authGuard = require("../middleware/authGuard");

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 상품 ID (Notion 페이지 ID)
 *           example: "29f1f705-fa4a-803c-9fdd-000b02c4884f"
 *         name:
 *           type: string
 *           description: 상품 이름
 *           example: "온라인 상품권 3만원 권"
 *         description:
 *           type: string
 *           description: 상품 설명
 *           example: "다양한 온라인 쇼핑몰에서 사용할 수 있는 3만원 상품권입니다."
 *         thumbnail:
 *           type: array
 *           description: 썸네일 이미지 배열
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 파일명
 *               url:
 *                 type: string
 *                 description: 이미지 URL
 *               type:
 *                 type: string
 *                 description: 파일 타입 (external/file)
 *         requiredPoints:
 *           type: number
 *           description: 필요한 나다움 포인트
 *           example: 350
 *         onSale:
 *           type: boolean
 *           description: 판매 여부
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 생성일
 *           example: "2025-11-02T14:48:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 수정일
 *           example: "2025-11-02T14:51:00.000Z"
 *
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 상품 ID (Notion 페이지 ID)
 *           example: "29f1f705-fa4a-803c-9fdd-000b02c4884f"
 *         name:
 *           type: string
 *           description: 상품 이름
 *           example: "온라인 상품권 3만원 권"
 *         description:
 *           type: string
 *           description: 상품 설명
 *           example: "다양한 온라인 쇼핑몰에서 사용할 수 있는 3만원 상품권입니다."
 *         thumbnail:
 *           type: array
 *           description: 썸네일 이미지 배열
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               type:
 *                 type: string
 *         requiredPoints:
 *           type: number
 *           description: 필요한 나다움 포인트
 *           example: 350
 *         onSale:
 *           type: boolean
 *           description: 판매 여부
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 생성일
 *           example: "2025-11-02T14:48:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 수정일
 *           example: "2025-11-02T14:51:00.000Z"
 *         pageContent:
 *           type: array
 *           description: 상품 페이지 상세 내용 (Notion 블록)
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: 블록 타입 (paragraph, heading_1, image 등)
 *                 example: "paragraph"
 *               id:
 *                 type: string
 *                 description: 블록 ID
 *               text:
 *                 type: string
 *                 description: 텍스트 내용
 *               url:
 *                 type: string
 *                 description: 이미지/비디오 URL
 *               caption:
 *                 type: string
 *                 description: 캡션
 *               links:
 *                 type: array
 *                 description: 포함된 링크
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     url:
 *                       type: string
 *               richText:
 *                 type: array
 *                 description: 리치 텍스트 (상세 정보)
 *               hasChildren:
 *                 type: boolean
 *                 description: 하위 블록 존재 여부
 *
 *     Purchase:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 구매 ID
 *         productId:
 *           type: string
 *           description: 상품 ID
 *         userId:
 *           type: string
 *           description: 사용자 ID
 *         quantity:
 *           type: integer
 *           description: 구매 수량
 *         totalPrice:
 *           type: number
 *           description: 총 가격
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED]
 *           description: 구매 상태
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 구매일
 *
 *     StorePurchase:
 *       type: object
 *       description: 스토어 구매신청 내역 (Notion DB 기반)
 *       properties:
 *         purchaseId:
 *           type: string
 *           description: 구매신청 ID (Notion 페이지 ID)
 *           example: "2a31f705-fa4a-805f-a163-000b30ce4dd4"
 *         title:
 *           type: string
 *           description: 구매신청 제목 (상품명 - 주문자닉네임 - 주문일시)
 *           example: "친환경 텀블러 - 나다움123 - 2025. 11. 20."
 *         userId:
 *           type: string
 *           description: 사용자 ID (Firebase UID)
 *           example: "firebase-uid-123"
 *         userNickname:
 *           type: string
 *           description: 주문자 닉네임
 *           example: "나다움123"
 *         productId:
 *           type: string
 *           description: 상품 ID (Notion 페이지 ID)
 *           example: "29f1f705-fa4a-803c-9fdd-000b02c4884f"
 *         quantity:
 *           type: integer
 *           description: 구매 개수
 *           example: 2
 *         requiredPoints:
 *           type: number
 *           nullable: true
 *           description: 상품의 필요한 나다움 포인트 (Rollup 필드)
 *           example: 500
 *         productImage:
 *           type: array
 *           nullable: true
 *           description: 상품 이미지 배열 (Rollup 필드)
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 파일명
 *               url:
 *                 type: string
 *                 description: 이미지 URL
 *               type:
 *                 type: string
 *                 description: 파일 타입 (external/file)
 *         recipientName:
 *           type: string
 *           description: 수령인 이름
 *           example: "홍길동"
 *         recipientPhone:
 *           type: string
 *           description: 수령인 전화번호
 *           example: "010-1234-5678"
 *         deliveryCompleted:
 *           type: boolean
 *           description: 지급 완료 여부
 *           example: false
 *         orderDate:
 *           type: string
 *           format: date-time
 *           description: 주문 완료 일시
 *           example: "2025-11-06T15:28:00.000Z"
 *         lastEditedTime:
 *           type: string
 *           format: date-time
 *           description: 마지막 수정 일시
 *           example: "2025-11-06T15:30:00.000Z"
 */

// 스토어 상품 목록 조회
/**
 * @swagger
 * /store/products:
 *   get:
 *     tags: [Store]
 *     summary: 스토어 상품 목록 조회 (Notion 기반)
 *     description: Notion 스토어 관리 DB에서 상품 목록을 커서 기반 페이지네이션으로 조회
 *     parameters:
 *       - in: query
 *         name: onSale
 *         schema:
 *           type: boolean
 *         description: 판매 여부 필터 (true=판매중만, false=미판매만, 생략=전체)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 페이지 크기 (1-100)
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: 페이지네이션 커서 (다음 페이지 조회 시 사용)
 *     responses:
 *       200:
 *         description: 상품 목록 조회 성공
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
 *                     message:
 *                       type: string
 *                       example: "상품 목록을 성공적으로 조회했습니다."
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProductListItem'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         hasMore:
 *                           type: boolean
 *                           description: 다음 페이지 존재 여부
 *                           example: false
 *                         nextCursor:
 *                           type: string
 *                           nullable: true
 *                           description: 다음 페이지 커서
 *                           example: null
 *                         currentPageCount:
 *                           type: integer
 *                           description: 현재 페이지 항목 수
 *                           example: 3
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
 *                   example: "페이지 크기는 1-100 사이의 숫자여야 합니다."
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
router.get("/products", storeController.getProducts);

// 스토어 상품 상세 조회 (Notion 페이지 내용 포함)
/**
 * @swagger
 * /store/products/{productId}:
 *   get:
 *     tags: [Store]
 *     summary: 스토어 상품 상세 조회 (Notion 기반)
 *     description: Notion 페이지 ID로 상품의 상세 정보 및 페이지 블록 내용 전체를 조회
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: 상품 ID (Notion 페이지 ID)
 *         example: "29f1f705-fa4a-803c-9fdd-000b02c4884f"
 *     responses:
 *       200:
 *         description: 상품 상세 조회 성공
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
 *                     message:
 *                       type: string
 *                       example: "상품 상세 정보를 성공적으로 조회했습니다."
 *                     product:
 *                       $ref: '#/components/schemas/Product'
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
 *                   example: "상품 ID가 필요합니다."
 *       404:
 *         description: 상품을 찾을 수 없음
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
 *                   example: "해당 상품을 찾을 수 없습니다."
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
router.get("/products/:productId", storeController.getProductById);

// 스토어 구매신청
/**
 * @swagger
 * /store/purchases:
 *   post:
 *     tags: [Store]
 *     summary: 스토어 구매신청
 *     description: 스토어 상품 구매를 신청하고 Notion DB에 저장
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *                 description: 상품 ID (Notion 페이지 ID)
 *                 example: "29f1f705-fa4a-803c-9fdd-000b02c4884f"
 *               quantity:
 *                 type: integer
 *                 default: 1
 *                 description: 구매 개수
 *                 example: 2
 *               recipientName:
 *                 type: string
 *                 description: 수령인 이름
 *                 example: "홍길동"
 *               recipientPhone:
 *                 type: string
 *                 description: 수령인 전화번호
 *                 example: "010-1234-5678"
 *     responses:
 *       201:
 *         description: 구매신청 성공
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
 *                     purchaseId:
 *                       type: string
 *                       description: 구매신청 ID
 *                       example: "2a31f705-fa4a-805f-a163-000b30ce4dd4"
 *                     title:
 *                       type: string
 *                       description: 구매신청 제목 (상품명 - 주문자닉네임 - 주문일시)
 *                       example: "친환경 텀블러 - 나다움123 - 2025. 11. 20."
 *                     userId:
 *                       type: string
 *                       description: 사용자 ID
 *                       example: "firebase-uid-123"
 *                     userNickname:
 *                       type: string
 *                       description: 주문자 닉네임
 *                       example: "나다움123"
 *                     productId:
 *                       type: string
 *                       description: 상품 ID
 *                       example: "29f1f705-fa4a-803c-9fdd-000b02c4884f"
 *                     quantity:
 *                       type: integer
 *                       description: 구매 개수
 *                       example: 2
 *                     requiredPoints:
 *                       type: number
 *                       nullable: true
 *                       description: 상품의 필요한 나다움 포인트 (Rollup 필드)
 *                       example: 500
 *                     recipientName:
 *                       type: string
 *                       description: 수령인 이름
 *                       example: "홍길동"
 *                     recipientPhone:
 *                       type: string
 *                       description: 수령인 전화번호
 *                       example: "010-1234-5678"
 *                     orderDate:
 *                       type: string
 *                       format: date-time
 *                       description: 주문 완료 일시
 *                       example: "2025-11-06T15:28:00.000Z"
 *                     deliveryCompleted:
 *                       type: boolean
 *                       description: 지급 완료 여부
 *                       example: false
 *                     lastEditedTime:
 *                       type: string
 *                       format: date-time
 *                       description: 마지막 수정 일시
 *                       example: "2025-11-06T15:30:00.000Z"
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
 *                   example: "상품 ID가 필요합니다."
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: "인증에 실패했습니다"

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
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류가 발생했습니다"
 */
router.post("/purchases", authGuard, storeController.createStorePurchase);

// 스토어 구매신청내역 조회
/**
 * @swagger
 * /store/purchases:
 *   get:
 *     tags: [Store]
 *     summary: 스토어 구매신청내역 조회 (날짜별 그룹핑)
 *     description: 본인의 스토어 구매신청내역을 날짜별로 그룹핑하여 조회 (Notion DB 기반, 타임라인 형태)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 페이지 크기 (1-100)
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: 페이지네이션 커서 (다음 페이지 조회 시 사용)
 *     responses:
 *       200:
 *         description: 구매신청내역 조회 성공 (날짜별 그룹핑)
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
 *                     message:
 *                       type: string
 *                       example: "날짜별 스토어 구매신청내역을 성공적으로 조회했습니다."
 *                     purchasesByDate:
 *                       type: array
 *                       description: 날짜별로 그룹핑된 구매신청 내역
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             description: 날짜 (YYYY-MM-DD 형식)
 *                             example: "2025-12-28"
 *                           dateLabel:
 *                             type: string
 *                             description: 날짜 라벨 (한글)
 *                             example: "2025년 12월 28일"
 *                           count:
 *                             type: integer
 *                             description: 해당 날짜의 구매신청 개수
 *                             example: 3
 *                           items:
 *                             type: array
 *                             description: 구매신청 목록 (해당 날짜, 최신순 정렬)
 *                             items:
 *                               $ref: '#/components/schemas/StorePurchase'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         hasMore:
 *                           type: boolean
 *                           description: 다음 페이지 존재 여부
 *                           example: false
 *                         nextCursor:
 *                           type: string
 *                           nullable: true
 *                           description: 다음 페이지 커서
 *                           example: null
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
 *                   example: "페이지 크기는 1-100 사이의 숫자여야 합니다."
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: "인증에 실패했습니다"

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
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류가 발생했습니다"
 */
router.get("/purchases", authGuard, storeController.getStorePurchases);

module.exports = router;
