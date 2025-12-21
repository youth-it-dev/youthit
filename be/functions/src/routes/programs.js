const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');


/**
 * @swagger
 * /programs:
 *   get:
 *     summary: 프로그램 목록 조회
 *     description: |
 *       모집상태 및 프로그램진행여부로 필터링된 프로그램 목록을 조회합니다.
 *       
 *       **기본 동작:**
 *       - recruitmentStatus 파라미터가 없으면 '모집 중'인 프로그램만 조회됩니다.
 *       - recruitmentStatus 파라미터를 명시하면 해당 상태의 프로그램을 조회합니다.
 *     tags: [Programs]
 *     parameters:
 *       - in: query
 *         name: recruitmentStatus
 *         schema:
 *           type: string
 *           enum: [before, ongoing, completed]
 *         description: 모집상태 필터 (before=모집 전, ongoing=모집 중, completed=모집 완료)
 *       - in: query
 *         name: programStatus
 *         schema:
 *           type: string
 *           enum: [before, ongoing, completed]
 *         description: 프로그램진행여부 필터 (before=진행 전, ongoing=진행 중, completed=종료됨)
 *       - in: query
 *         name: programType
 *         schema:
 *           type: string
 *           enum: [ROUTINE, TMI, GATHERING]
 *         description: 프로그램 종류 필터
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지 크기
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: 페이지네이션 커서
 *     responses:
 *       200:
 *         description: 프로그램 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProgramListResponse'
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
router.get('/', programController.getPrograms);

/**
 * @swagger
 * /programs/search:
 *   get:
 *     summary: 프로그램 검색
 *     description: |
 *       제목, 설명을 기반으로 프로그램을 검색합니다.
 *       
 *       **기본 동작:**
 *       - recruitmentStatus 파라미터가 없으면 '모집 중'인 프로그램만 검색됩니다.
 *       - recruitmentStatus 파라미터를 명시하면 해당 상태의 프로그램을 검색합니다.
 *     tags: [Programs]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: recruitmentStatus
 *         schema:
 *           type: string
 *           enum: [before, ongoing, completed]
 *         description: 모집상태 필터 (before=모집 전, ongoing=모집 중, completed=모집 완료)
 *       - in: query
 *         name: programStatus
 *         schema:
 *           type: string
 *           enum: [before, ongoing, completed]
 *         description: 프로그램진행여부 필터 (before=진행 전, ongoing=진행 중, completed=종료됨)
 *       - in: query
 *         name: programType
 *         schema:
 *           type: string
 *           enum: [ROUTINE, TMI, GATHERING]
 *         description: 프로그램 종류 필터
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지 크기
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: 페이지네이션 커서
 *     responses:
 *       200:
 *         description: 검색 결과 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProgramSearchResponse'
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
router.get('/search', programController.searchPrograms);


/**
 * @swagger
 * /programs/{programId}:
 *   get:
 *     summary: 프로그램 상세 조회
 *     description: 특정 프로그램의 상세 정보를 조회합니다.
 *     tags: [Programs]
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *         description: 프로그램 ID
 *     responses:
 *       200:
 *         description: 프로그램 상세 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProgramDetailResponse'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 프로그램을 찾을 수 없음
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
router.get('/:programId', programController.getProgramById);

/**
 * @swagger
 * components:
 *   schemas:
 *     ProgramApplicationRequest:
 *       type: object
 *       required:
 *         - applicantId
 *         - activityNickname
 *       properties:
 *         applicantId:
 *           type: string
 *           description: 신청자 ID
 *           example: "user_123456"
 *         activityNickname:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: 참여용 닉네임
 *           example: "홍길동"
 *         activityPhoneNumber:
 *           type: string
 *           description: 참여용 전화번호
 *           example: "010-1234-5678"
 *         email:
 *           type: string
 *           format: email
 *           description: 신청자 이메일
 *           example: "user@example.com"
 *         region:
 *           type: object
 *           description: 거주 지역
 *           properties:
 *             city:
 *               type: string
 *               description: 시/도
 *               example: "서울시"
 *             district:
 *               type: string
 *               description: 군/구
 *               example: "성동구"
 *         currentSituation:
 *           type: string
 *           description: 현재 상황 (자유 텍스트)
 *           example: "현재 학교를 다니고 있지 않아요"
 *         applicationSource:
 *           type: string
 *           description: 신청 경로 (자유 텍스트)
 *           example: "SNS(인스타그램, 블로그 등)"
 *         applicationMotivation:
 *           type: string
 *           description: 참여 동기 (자유 텍스트)
 *           example: "일상을 좀 더 규칙적으로 관리하고 싶어서"
 *         canAttendEvents:
 *           type: boolean
 *           description: 필참 일정 확인 여부
 *           example: true
 *     
 *     ProgramApplicationResponse:
 *       type: object
 *       properties:
 *         applicationId:
 *           type: string
 *           description: 신청 ID
 *           example: "app_123456"
 *         programId:
 *           type: string
 *           description: 프로그램 ID
 *           example: "program_123"
 *         applicantId:
 *           type: string
 *           description: 신청자 ID
 *           example: "user_123456"
 *         nickname:
 *           type: string
 *           description: 참여용 닉네임
 *           example: "홍길동"
 *         appliedAt:
 *           type: string
 *           format: date-time
 *           description: 신청일시
 *           example: "2024-01-01T00:00:00.000Z"
 *         notionPageId:
 *           type: string
 *           description: Notion 페이지 ID
 *           example: "notion_page_123"
 */

/**
 * @swagger
 * /programs/{programId}/apply:
 *   post:
 *     summary: 프로그램 신청
 *     description: 특정 프로그램에 신청합니다.
 *     tags: [Programs]
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *         description: 프로그램 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProgramApplicationRequest'
 *     responses:
 *       201:
 *         description: 프로그램 신청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "프로그램 신청이 완료되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/ProgramApplicationResponse'
 *       400:
 *         description: 잘못된 요청 또는 모집 기간이 아님
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
 *                   description: 에러 유형에 따른 메시지
 *                   examples:
 *                     RECRUITMENT_PERIOD_CLOSED:
 *                       value: "현재 모집 기간이 아닙니다."
 *                     BAD_REQUEST:
 *                       value: "프로그램 ID가 필요합니다."
 *                 code:
 *                   type: string
 *                   example: "RECRUITMENT_PERIOD_CLOSED"
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *       409:
 *         description: 중복 신청
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
 *                   description: 중복 신청 유형에 따른 메시지
 *                   examples:
 *                     DUPLICATE_APPLICATION:
 *                       value: "같은 프로그램은 또 신청할 수 없습니다."
 *                     NICKNAME_ALREADY_TAKEN:
 *                       value: "중복된 닉네임입니다."
 *                     SAME_EMAIL:
 *                       value: "이미 이 프로그램에 신청하셨습니다. (이메일 중복)"
 *                     SAME_PHONE:
 *                       value: "이미 이 프로그램에 신청하셨습니다. (전화번호 중복)"
 *                 code:
 *                   type: string
 *                   example: "DUPLICATE_APPLICATION"
 *                 statusCode:
 *                   type: integer
 *                   example: 409
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:programId/apply', programController.applyToProgram);

/**
 * @swagger
 * /programs/{programId}/applications/{applicationId}/approve:
 *   get:
 *     summary: 프로그램 신청 승인
 *     description: 특정 프로그램 신청을 승인합니다. (Notion에서 링크로 호출)
 *     tags: [Programs]
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *         description: 프로그램 ID
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 신청 ID (Firestore member ID)
 *     responses:
 *       200:
 *         description: 신청 승인 성공
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>신청이 승인되었습니다!</h1><p>이 페이지를 닫아도 됩니다.</p></body></html>"
 *       404:
 *         description: 신청을 찾을 수 없음
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>오류: 신청을 찾을 수 없습니다.</h1></body></html>"
 *       500:
 *         description: 서버 오류
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>서버 오류가 발생했습니다.</h1></body></html>"
 */
router.get('/:programId/applications/:applicationId/approve', programController.approveApplication);

/**
 * @swagger
 * /programs/{programId}/applications/{applicationId}/reject:
 *   get:
 *     summary: 프로그램 신청 거부
 *     description: 특정 프로그램 신청을 거부합니다. (Notion에서 링크로 호출)
 *     tags: [Programs]
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *         description: 프로그램 ID
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 신청 ID (Firestore member ID)
 *     responses:
 *       200:
 *         description: 신청 거부 성공
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>신청이 거부되었습니다!</h1><p>이 페이지를 닫아도 됩니다.</p></body></html>"
 *       404:
 *         description: 신청을 찾을 수 없음
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>오류: 신청을 찾을 수 없습니다.</h1></body></html>"
 *       500:
 *         description: 서버 오류
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>서버 오류가 발생했습니다.</h1></body></html>"
 */
router.get('/:programId/applications/:applicationId/reject', programController.rejectApplication);

/**
 * @swagger
 * /programs/approve:
 *   get:
 *     summary: 선택된 신청자 일괄 승인
 *     description: |
 *       Notion "프로그램 신청자 관리" DB에서 '선택' 체크박스가 true인 모든 신청자를 일괄 승인합니다.
 *       
 *       **처리 과정:**
 *       1. Notion에서 '선택' 체크박스가 true인 항목 조회
 *       2. 각 항목의 프로그램ID와 사용자ID 추출
 *       3. 모든 선택된 신청자를 승인 처리
 *       4. Firestore member 상태를 'approved'로 변경
 *       5. Notion '승인여부'를 '승인'으로 변경
 *       6. FCM 승인 알림 발송
 *       7. 성공한 항목의 '선택' 체크박스 자동 해제
 *       
 *       **주의사항:**
 *       - 프로그램 구분 없이 선택된 모든 신청자를 처리합니다.
 *       - 일부 항목이 실패해도 다른 항목은 계속 처리됩니다.
 *       - 실패한 항목은 '선택' 상태가 유지되어 재시도 가능합니다.
 *     tags: [Programs]
 *     responses:
 *       200:
 *         description: 일괄 승인 처리 완료 (성공/실패 건수 포함)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>✅ 일괄 승인 완료</h1><p>총 15건 중 13건 승인 완료, 2건 실패</p><p>처리된 프로그램: 프로그램A (5건), 프로그램B (8건)</p></body></html>"
 *       500:
 *         description: 서버 오류
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>❌ 오류 발생</h1><p>일괄 승인 처리 중 오류가 발생했습니다.</p></body></html>"
 */
router.get('/approve', programController.bulkApproveApplications);

/**
 * @swagger
 * /programs/reject:
 *   get:
 *     summary: 선택된 신청자 일괄 거절
 *     description: |
 *       Notion "프로그램 신청자 관리" DB에서 '선택' 체크박스가 true인 모든 신청자를 일괄 거절합니다.
 *       
 *       **처리 과정:**
 *       1. Notion에서 '선택' 체크박스가 true인 항목 조회
 *       2. 각 항목의 프로그램ID와 사용자ID 추출
 *       3. 모든 선택된 신청자를 거절 처리
 *       4. Firestore member 상태를 'rejected'로 변경
 *       5. Notion '승인여부'를 '승인거절'로 변경
 *       6. FCM 거절 알림 발송
 *       7. 성공한 항목의 '선택' 체크박스 자동 해제
 *       
 *       **주의사항:**
 *       - 프로그램 구분 없이 선택된 모든 신청자를 처리합니다.
 *       - 일부 항목이 실패해도 다른 항목은 계속 처리됩니다.
 *       - 실패한 항목은 '선택' 상태가 유지되어 재시도 가능합니다.
 *     tags: [Programs]
 *     responses:
 *       200:
 *         description: 일괄 거절 처리 완료 (성공/실패 건수 포함)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>🚫 일괄 거절 완료</h1><p>총 10건 중 9건 거절 완료, 1건 실패</p><p>처리된 프로그램: 프로그램C (9건)</p></body></html>"
 *       500:
 *         description: 서버 오류
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>❌ 오류 발생</h1><p>일괄 거절 처리 중 오류가 발생했습니다.</p></body></html>"
 */
router.get('/reject', programController.bulkRejectApplications);

/**
 * @swagger
 * /programs/pending:
 *   get:
 *     summary: 선택된 신청자 일괄 대기 상태 변경
 *     description: |
 *       Notion "프로그램 신청자 관리" DB에서 '선택' 체크박스가 true인 모든 신청자를 승인대기 상태로 변경합니다.
 *       
 *       **처리 과정:**
 *       1. Notion에서 '선택' 체크박스가 true인 항목 조회
 *       2. 각 항목의 프로그램ID와 사용자ID 추출
 *       3. 모든 선택된 신청자를 대기 상태로 변경
 *       4. Firestore member 상태를 'pending'으로 변경
 *       5. Notion '승인여부'를 '승인대기'로 변경
 *       6. 성공한 항목의 '선택' 체크박스 자동 해제
 *       
 *       **주의사항:**
 *       - 프로그램 구분 없이 선택된 모든 신청자를 처리합니다.
 *       - 일부 항목이 실패해도 다른 항목은 계속 처리됩니다.
 *       - 실패한 항목은 '선택' 상태가 유지되어 재시도 가능합니다.
 *       - 알림은 발송되지 않습니다.
 *     tags: [Programs]
 *     responses:
 *       200:
 *         description: 일괄 대기 처리 완료 (성공/실패 건수 포함)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>⏸️ 일괄 대기 처리 완료</h1><p>총 8건 중 8건 처리 완료</p><p>처리된 프로그램: 프로그램D (8건)</p></body></html>"
 *       500:
 *         description: 서버 오류
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body><h1>❌ 오류 발생</h1><p>일괄 대기 처리 중 오류가 발생했습니다.</p></body></html>"
 */
router.get('/pending', programController.bulkPendingApplications);

module.exports = router;
