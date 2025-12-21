const { Client } = require('@notionhq/client');
const programService = require('./programService');
const programCommunityService = require('./programCommunityService');
const CommunityService = require('./communityService');
const FirestoreService = require('./firestoreService');
const { db, FieldValue } = require('../config/database');
const { validateNicknameOrThrow } = require('../utils/nicknameValidator');
const fcmHelper = require('../utils/fcmHelper');
const { NOTIFICATION_LINKS } = require('../constants/urlConstants');

// Notion 버전
const NOTION_VERSION = process.env.NOTION_VERSION || "2025-09-03";

/**
 * ProgramApplicationService
 * 프로그램 신청, 승인, 거절 처리를 담당하는 서비스
 */
class ProgramApplicationService {
  constructor() {
    const {
      NOTION_API_KEY,
      NOTION_PROGRAM_APPLICATION_DB_ID,
    } = process.env;

    // 환경 변수 검증
    if (!NOTION_API_KEY) {
      const error = new Error("NOTION_API_KEY가 필요합니다");
      error.code = 'MISSING_NOTION_API_KEY';
      throw error;
    }
    if (!NOTION_PROGRAM_APPLICATION_DB_ID) {
      const error = new Error("NOTION_PROGRAM_APPLICATION_DB_ID가 필요합니다");
      error.code = 'MISSING_DB_ID';
      throw error;
    }

    // Notion 클라이언트 초기화
    this.notion = new Client({
      auth: NOTION_API_KEY,
      notionVersion: NOTION_VERSION,
    });

    this.applicationDataSource = NOTION_PROGRAM_APPLICATION_DB_ID;
    this.firestoreService = new FirestoreService();
    this.communityService = new CommunityService();
  }

  /**
   * 프로그램 신청 처리
   * @param {string} programId - 프로그램 ID
   * @param {Object} applicationData - 신청 데이터 { applicantId, nickname }
   * @returns {Promise<Object>} 신청 결과
   * @throws {Error} NICKNAME_DUPLICATE - 닉네임 중복
   * @throws {Error} PROGRAM_NOT_FOUND - 프로그램을 찾을 수 없음
   * @throws {Error} NOTION_API_ERROR - Notion API 호출 실패
   */
  async applyToProgram(programId, applicationData) {
    try {
      const { applicantId, nickname } = applicationData;
      const { ERROR_CODES, normalizeProgramIdForFirestore } = require('./programService');
      
      // 1. 프로그램 존재 확인 및 조회
      const program = await programService.getProgramById(programId);
      
      if (!program) {
        const notFoundError = new Error('해당 프로그램을 찾을 수 없습니다.');
        notFoundError.code = ERROR_CODES.PROGRAM_NOT_FOUND;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      // 1-1. 모집 기간 체크
      if (program.recruitmentStatus !== '모집 중') {
        const periodError = new Error('현재 모집 기간이 아닙니다.');
        periodError.code = ERROR_CODES.RECRUITMENT_PERIOD_CLOSED;
        periodError.statusCode = 400;
        throw periodError;
      }

      // 2. Community 존재 확인 및 생성 (Firestore용 ID로 정규화)
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      await programCommunityService.ensureCommunityExists(normalizedProgramId, program);

      validateNicknameOrThrow(nickname);
      
      // 3. Transaction으로 중복 체크, 선착순 체크, 멤버 추가를 원자적으로 처리
      const membersService = new FirestoreService(`communities/${normalizedProgramId}/members`);
      
      const memberResult = await membersService.runTransaction(async (transaction, collectionRef) => {
        // 3-1. Members 전체 조회 (Transaction 내에서 Lock)
        const allMembers = await membersService.getAllInTransaction(transaction);
        
        // 3-2. 중복 신청 체크
        const existingMember = allMembers.find(m => m.id === applicantId || m.userId === applicantId);
        if (existingMember) {
          const duplicateError = new Error('같은 프로그램은 또 신청할 수 없습니다.');
          duplicateError.code = ERROR_CODES.DUPLICATE_APPLICATION;
          duplicateError.statusCode = 409;
          throw duplicateError;
        }
        
        // 3-3. 닉네임 중복 체크
        const nicknameExists = allMembers.some(m => m.nickname === nickname.trim());
        if (nicknameExists) {
          const error = new Error("이미 사용 중인 닉네임입니다");
          error.code = ERROR_CODES.NICKNAME_DUPLICATE;
          error.statusCode = 409;
          throw error;
        }
        
        // 3-4. 승인된 멤버 수 카운트
        const approvedCount = allMembers.filter(m => m.status === 'approved').length;
        
        // 3-5. 선착순 마감 체크
        if (program.isFirstComeDeadlineEnabled && 
            program.firstComeCapacity && 
            approvedCount >= program.firstComeCapacity) {
          const capacityError = new Error('선착순 마감되었습니다.');
          capacityError.code = ERROR_CODES.FIRST_COME_DEADLINE_REACHED;
          capacityError.statusCode = 400;
          throw capacityError;
        }
        
        // 3-6. 멤버 추가 (원자적 실행)
        const newMemberRef = collectionRef.doc(applicantId);
        transaction.set(newMemberRef, {
          userId: applicantId,
          nickname: nickname.trim(),
          role: "member",
          status: 'pending',
          joinedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp()
        });
        
        return {
          id: applicantId,
          userId: applicantId,
          nickname: nickname.trim(),
          role: "member",
          status: 'pending'
        };
      });

      // 6. Notion 프로그램신청자DB에 저장 (Firestore 성공 후)
      const applicantsPageId = await this.saveToNotionApplication(programId, applicationData, program);
      
      // 7. Notion 페이지 ID를 Firestore 멤버에 업데이트
      try {
        await membersService.update(applicantId, {
          applicantsPageId: applicantsPageId
        });
      } catch (updateError) {
        console.warn('[ProgramApplicationService] Notion 페이지 ID 업데이트 실패:', updateError.message);
        // 업데이트 실패해도 신청은 완료된 것으로 처리
      }

      return {
        applicationId: memberResult.id,
        programId,
        applicantId,
        nickname,
        appliedAt: new Date().toISOString(), // 클라이언트 응답용
        applicantsPageId
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 프로그램 신청 오류:', error.message);
      
      // 클라이언트 에러(4xx)는 그대로 전달
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      const { ERROR_CODES } = require('./programService');
      
      // 특정 에러 코드는 그대로 전달
      if (error.code === ERROR_CODES.NICKNAME_DUPLICATE || 
          error.code === ERROR_CODES.DUPLICATE_APPLICATION ||
          error.code === ERROR_CODES.PROGRAM_NOT_FOUND ||
          error.code === ERROR_CODES.FIRST_COME_DEADLINE_REACHED ||
          error.code === ERROR_CODES.RECRUITMENT_PERIOD_CLOSED ||
          error.code === 'BAD_REQUEST') {
        throw error;
      }
      
      const serviceError = new Error(`프로그램 신청 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * Firebase UID로 Notion "회원 관리" DB에서 사용자 페이지 찾기
   * @param {string} firebaseUid - Firebase UID
   * @returns {Promise<string|null>} Notion 페이지 ID 또는 null
   */
  async findUserNotionPageId(firebaseUid) {
    try {
      const userDbId = process.env.NOTION_USER_ACCOUNT_DB_ID2;
      if (!userDbId) {
        console.warn('[ProgramApplicationService] NOTION_USER_ACCOUNT_DB_ID2 환경변수가 설정되지 않음');
        return null;
      }

      // Notion "회원 관리" DB에서 사용자ID로 검색
      const response = await this.notion.dataSources.query({
        data_source_id: userDbId,
        filter: {
          property: '사용자ID',
          rich_text: {
            equals: firebaseUid
          }
        },
        page_size: 1
      });

      if (response.results && response.results.length > 0) {
        return response.results[0].id;
      }

      console.warn(`[ProgramApplicationService] Notion "회원 관리"에서 사용자를 찾을 수 없음: ${firebaseUid}`);
      return null;
    } catch (error) {
      console.error('[ProgramApplicationService] Notion 사용자 검색 오류:', error.message);
      return null;
    }
  }

  /**
   * Notion 프로그램신청자DB에 저장
   * @param {string} programId - 프로그램 ID (Notion 페이지 ID)
   * @param {Object} applicationData - 신청 데이터
   * @param {string} applicationData.applicantId - Firebase UID
   * @param {string} applicationData.nickname - 참여용 닉네임
   * @param {string} [applicationData.phoneNumber] - 참여용 전화번호
   * @param {string} [applicationData.email] - 신청자 이메일
   * @param {Object} [applicationData.region] - 거주 지역 { city, district }
   * @param {string} [applicationData.currentSituation] - 현재 상황
   * @param {string} [applicationData.applicationSource] - 신청 경로
   * @param {string} [applicationData.applicationMotivation] - 참여 동기
   * @param {boolean} [applicationData.canAttendEvents] - 필참 일정 확인 여부
   * @param {Object} program - 프로그램 정보
   * @returns {Promise<string>} Notion 페이지 ID
   */
  async saveToNotionApplication(programId, applicationData, program) {
    try {
      const { 
        applicantId, 
        nickname, 
        phoneNumber, 
        email,
        region,
        currentSituation,
        applicationSource,
        applicationMotivation,
        canAttendEvents
      } = applicationData;
      
      // 거주 지역 포맷팅
      let regionText = '';
      if (region) {
        if (region.city && region.district) {
          regionText = `${region.city} ${region.district}`;
        } else if (region.city) {
          regionText = region.city;
        } else if (region.district) {
          regionText = region.district;
        }
      }

      // "회원 관리" DB에서 사용자 찾기
      const userNotionPageId = await this.findUserNotionPageId(applicantId);

      const properties = {
        '이름': {
          title: [
            {
              text: {
                content: nickname || '익명'
              }
            }
          ]
        },
        '참여용 닉네임': {
          rich_text: [
            {
              text: {
                content: nickname || ''
              }
            }
          ]
        },
        '프로그램명': {
          relation: [
            {
              id: programId
            }
          ]
        },
        '서비스 이용약관 동의여부': {
          checkbox: true
        },
        '필참 일정 확인 여부': {
          checkbox: canAttendEvents || false
        },
        '승인여부': {
          select: {
            name: '승인대기'
          }
        }
      };

      // "신청자 페이지" relation 추가 (사용자를 찾은 경우에만)
      if (userNotionPageId) {
        properties['신청자 페이지'] = {
          relation: [
            {
              id: userNotionPageId
            }
          ]
        };
      } else {
        console.warn(`[ProgramApplicationService] "신청자 페이지" relation 연결 실패: 사용자를 찾을 수 없음 (UID: ${applicantId})`);
      }

      // 선택적 필드 추가
      if (phoneNumber) {
        properties['참여용 전화번호'] = {
          phone_number: phoneNumber
        };
      }

      if (email) {
        properties['신청자 이메일'] = {
          email: email
        };
      }

      if (regionText) {
        properties['거주 지역'] = {
          rich_text: [
            {
              text: {
                content: regionText
              }
            }
          ]
        };
      }

      if (currentSituation) {
        properties['현재 상황'] = {
          rich_text: [
            {
              text: {
                content: currentSituation
              }
            }
          ]
        };
      }

      if (applicationSource) {
        properties['신청 경로'] = {
          rich_text: [
            {
              text: {
                content: applicationSource
              }
            }
          ]
        };
      }

      if (applicationMotivation) {
        properties['참여 동기'] = {
          rich_text: [
            {
              text: {
                content: applicationMotivation
              }
            }
          ]
        };
      }

      const notionData = {
        parent: {
          data_source_id: this.applicationDataSource,
          type: "data_source_id"
        },
        properties
      };

      const response = await this.notion.pages.create(notionData);
      return response.id;

    } catch (error) {
      console.error('[ProgramApplicationService] Notion 저장 오류:', error.message);
      throw new Error(`Notion 신청 정보 저장에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 프로그램 신청 승인
   * @param {string} programId - 프로그램 ID
   * @param {string} applicationId - 신청 ID (Firestore member ID)
   * @returns {Promise<Object>} 승인 결과
   */
  async approveApplication(programId, applicationId) {
    try {
      const { ERROR_CODES, normalizeProgramIdForFirestore } = require('./programService');
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      console.log(`[ProgramApplicationService] 승인 요청 - programId: ${programId}, applicationId: ${applicationId}`);
      
      const member = await this.firestoreService.getDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId
      );

      if (!member) {
        console.error(`[ProgramApplicationService] 멤버를 찾을 수 없음 - programId: ${programId}, applicationId: ${applicationId}`);
        const error = new Error('신청 정보를 찾을 수 없습니다.');
        error.code = ERROR_CODES.NOT_FOUND;
        error.statusCode = 404;
        throw error;
      }

      await this.firestoreService.updateDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId,
        {
          status: 'approved',
          approvedAt: FieldValue.serverTimestamp()
        }
      );

      if (member.applicantsPageId) {
        try {
          await this.notion.pages.update({
            page_id: member.applicantsPageId,
            properties: {
              '승인여부': {
                select: {
                  name: '승인'
                }
              }
            }
          });
        } catch (notionError) {
          console.warn('[ProgramApplicationService] Notion 업데이트 실패:', notionError.message);
        }
      }

      if (member.userId) {
        try {
          const community = await this.communityService.getCommunityMapping(normalizedProgramId);
          const programName = community?.name || "프로그램";
          
          await fcmHelper.sendNotification(
            member.userId,
            "프로그램 신청 승인",
            `"${programName}" 프로그램 신청이 승인되었습니다.`,
            "ANNOUNCEMENT",
            "",
            "",
            NOTIFICATION_LINKS.PROGRAM(programId)
          );
          
          console.log(`[ProgramApplicationService] 승인 알림 발송 완료 - userId: ${member.userId}, programName: ${programName}`);
        } catch (notificationError) {
          console.warn('[ProgramApplicationService] 승인 알림 발송 실패:', notificationError.message);
        }
      }

      return {
        applicationId,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 신청 승인 오류:', error.message);
      
      const { ERROR_CODES } = require('./programService');
      
      if (error.code === ERROR_CODES.NOT_FOUND) {
        throw error;
      }
      
      const serviceError = new Error(`신청 승인 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 프로그램 신청 승인 취소
   * @param {string} programId - 프로그램 ID
   * @param {string} applicationId - 신청 ID (Firestore member ID)
   * @returns {Promise<Object>} 승인 취소 결과
   */
  async rejectApplication(programId, applicationId) {
    try {
      const { ERROR_CODES, normalizeProgramIdForFirestore } = require('./programService');
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      console.log(`[ProgramApplicationService] 거절 요청 - programId: ${programId}, applicationId: ${applicationId}`);
      
      const member = await this.firestoreService.getDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId
      );

      if (!member) {
        console.error(`[ProgramApplicationService] 멤버를 찾을 수 없음 - programId: ${programId}, applicationId: ${applicationId}`);
        const error = new Error('신청 정보를 찾을 수 없습니다.');
        error.code = ERROR_CODES.NOT_FOUND;
        error.statusCode = 404;
        throw error;
      }

      await this.firestoreService.updateDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId,
        {
          status: 'rejected',
          rejectedAt: FieldValue.serverTimestamp()
        }
      );

      if (member.applicantsPageId) {
        try {
          await this.notion.pages.update({
            page_id: member.applicantsPageId,
            properties: {
              '승인여부': {
                select: {
                  name: '승인거절'
                }
              }
            }
          });
        } catch (notionError) {
          console.warn('[ProgramApplicationService] Notion 업데이트 실패:', notionError.message);
        }
      }

      if (member.userId) {
        try {
          const community = await this.communityService.getCommunityMapping(normalizedProgramId);
          const programName = community?.name || "프로그램";
          
          await fcmHelper.sendNotification(
            member.userId,
            "프로그램 신청 거절",
            `"${programName}" 프로그램 신청이 거절되었습니다.`,
            "ANNOUNCEMENT",
            "",
            "",
            NOTIFICATION_LINKS.PROGRAM(programId)
          );
          
          console.log(`[ProgramApplicationService] 거절 알림 발송 완료 - userId: ${member.userId}, programName: ${programName}`);
        } catch (notificationError) {
          console.warn('[ProgramApplicationService] 거절 알림 발송 실패:', notificationError.message);
        }
      }

      return {
        applicationId,
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 신청 승인 취소 오류:', error.message);
      
      // 이미 정의된 에러는 그대로 전달
      if (error.code === 'NOT_FOUND') {
        throw error;
      }
      
      const { ERROR_CODES } = require('./programService');
      
      const serviceError = new Error(`신청 승인 취소 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 프로그램 신청을 대기 상태로 변경
   * @param {string} programId - 프로그램 ID
   * @param {string} applicationId - 신청 ID (Firestore member ID)
   * @returns {Promise<Object>} 대기 처리 결과
   */
  async pendingApplication(programId, applicationId) {
    try {
      const { ERROR_CODES, normalizeProgramIdForFirestore } = require('./programService');
      const normalizedProgramId = normalizeProgramIdForFirestore(programId);
      console.log(`[ProgramApplicationService] 대기 처리 요청 - programId: ${programId}, applicationId: ${applicationId}`);
      
      const member = await this.firestoreService.getDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId
      );

      if (!member) {
        console.error(`[ProgramApplicationService] 멤버를 찾을 수 없음 - programId: ${programId}, applicationId: ${applicationId}`);
        const error = new Error('신청 정보를 찾을 수 없습니다.');
        error.code = ERROR_CODES.NOT_FOUND;
        error.statusCode = 404;
        throw error;
      }

      await this.firestoreService.updateDocument(
        `communities/${normalizedProgramId}/members`,
        applicationId,
        {
          status: 'pending',
          pendingAt: FieldValue.serverTimestamp()
        }
      );

      if (member.applicantsPageId) {
        try {
          await this.notion.pages.update({
            page_id: member.applicantsPageId,
            properties: {
              '승인여부': {
                select: {
                  name: '승인대기'
                }
              }
            }
          });
        } catch (notionError) {
          console.warn('[ProgramApplicationService] Notion 업데이트 실패:', notionError.message);
        }
      }

      // 대기 처리 시에는 알림 발송하지 않음

      return {
        applicationId,
        status: 'pending',
        pendingAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 대기 처리 오류:', error.message);
      
      const { ERROR_CODES } = require('./programService');
      
      if (error.code === ERROR_CODES.NOT_FOUND) {
        throw error;
      }
      
      const serviceError = new Error(`대기 처리 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.originalError = error;
      throw serviceError;
    }
  }

  /**
   * 성공한 항목들의 '선택' 체크박스를 해제
   * @param {Array} successResults - 성공한 결과 배열
   * @returns {Promise<void>}
   */
  async resetSelectionCheckboxes(successResults) {
    const resetPromises = successResults.map(r => {
      const pageId = r.value.pageId;
      return this.notion.pages.update({
        page_id: pageId,
        properties: {
          '선택': {
            checkbox: false
          }
        }
      }).catch(error => {
        console.warn(`[ProgramApplicationService] 체크박스 해제 실패 (pageId: ${pageId}):`, error.message);
      });
    });

    await Promise.allSettled(resetPromises);
  }

  /**
   * 프로그램별 통계 생성
   * @param {Array} successResults - 성공한 결과 배열
   * @returns {Object} 프로그램별 건수 { "프로그램A": 5, "프로그램B": 3 }
   */
  generateProgramStats(successResults) {
    const programStats = {};
    successResults.forEach(r => {
      const { programName } = r.value;
      programStats[programName] = (programStats[programName] || 0) + 1;
    });
    return programStats;
  }

  /**
   * Notion 속성에서 사용자ID 추출 (formula, rollup, rich_text 지원)
   * @param {Object} properties - Notion 페이지 properties
   * @returns {string|null} Firebase UID
   */
  extractUserIdFromProperties(properties) {
    const userIdProperty = properties['사용자ID'];
    
    if (!userIdProperty) {
      return null;
    }

    // 방법 1: Formula 필드 (가장 일반적)
    if (userIdProperty.type === 'formula') {
      const formula = userIdProperty.formula;
      if (formula.type === 'string' && formula.string) {
        return formula.string;
      }
    }

    // 방법 2: Rich Text 필드
    if (userIdProperty.rich_text && userIdProperty.rich_text.length > 0) {
      return userIdProperty.rich_text[0].plain_text;
    }

    // 방법 3: Rollup 필드
    if (userIdProperty.rollup) {
      const rollup = userIdProperty.rollup;
      if (rollup.type === 'string' && rollup.string) {
        return rollup.string;
      }
      if (rollup.type === 'array' && rollup.array?.length > 0) {
        const firstValue = rollup.array[0];
        if (firstValue.rich_text && firstValue.rich_text.length > 0) {
          return firstValue.rich_text[0].plain_text;
        }
      }
    }

    return null;
  }

  /**
   * Notion에서 '선택' 체크박스가 true인 신청자 조회 (페이지네이션 지원)
   * @returns {Promise<Array>} 선택된 신청자 목록 [{ pageId, programId, userId, currentStatus, programName }]
   */
  async getSelectedApplications() {
    try {
      const allPages = [];
      let hasMore = true;
      let startCursor = undefined;

      // 페이지네이션으로 모든 선택된 항목 조회
      console.log('[ProgramApplicationService] 선택된 신청자 조회 시작...');
      while (hasMore) {
        const response = await this.notion.dataSources.query({
          data_source_id: this.applicationDataSource,
          filter: {
            property: '선택',
            checkbox: {
              equals: true
            }
          },
          page_size: 100,
          start_cursor: startCursor
        });

        allPages.push(...response.results);
        hasMore = response.has_more;
        startCursor = response.next_cursor;

        console.log(`[ProgramApplicationService] ${allPages.length}건 조회 중... (hasMore: ${hasMore})`);
        
        // 다음 페이지 조회 전 delay (rate limit 고려)
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }

      console.log(`[ProgramApplicationService] 총 ${allPages.length}건 조회 완료, 데이터 처리 중...`);

      // 각 페이지에서 필요한 정보 추출 (추가 API 호출 없음!)
      const applications = [];
      const missingUserIds = [];
      
      for (const page of allPages) {
        try {
          // 프로그램명 relation에서 programId 추출
          const programRelation = page.properties['프로그램명']?.relation || [];
          const programId = programRelation.length > 0 ? programRelation[0].id : null;

          // 신청자 페이지 relation
          const applicantRelation = page.properties['신청자 페이지']?.relation || [];
          const applicantPageId = applicantRelation.length > 0 ? applicantRelation[0].id : null;

          // 사용자ID 추출 (Formula 필드에서)
          const userId = this.extractUserIdFromProperties(page.properties);

          // 프로그램명 rollup에서 이름 추출
          const programNameRollup = page.properties['신청한 프로그램명']?.rollup?.array || [];
          let programName = '알 수 없음';
          if (programNameRollup.length > 0 && programNameRollup[0].type === 'title') {
            const titleArray = programNameRollup[0].title || [];
            programName = titleArray.map(t => t.plain_text).join('') || '알 수 없음';
          }

          if (programId && userId) {
            applications.push({
              pageId: page.id,
              programId,
              userId,
              programName
            });
          } else {
            // Formula에서 userId를 가져오지 못한 경우 (드물게 발생)
            if (!userId && applicantPageId) {
              missingUserIds.push({ pageId: page.id, applicantPageId, programId, programName });
            } else {
              console.warn(`[ProgramApplicationService] 필수 정보 누락 - pageId: ${page.id}, programId: ${programId}, userId: ${userId}`);
            }
          }
        } catch (itemError) {
          console.error(`[ProgramApplicationService] 항목 처리 오류 (pageId: ${page.id}):`, itemError.message);
        }
      }

      // Formula에서 userId를 가져오지 못한 경우만 추가 조회 (Fallback)
      if (missingUserIds.length > 0) {
        console.warn(`[ProgramApplicationService] Formula에서 사용자ID를 가져오지 못한 ${missingUserIds.length}건 발견. 추가 조회 시도...`);
        
        // 배치로 조회 (rate limit 고려)
        const BATCH_SIZE = 3;
        for (let i = 0; i < missingUserIds.length; i += BATCH_SIZE) {
          const batch = missingUserIds.slice(i, i + BATCH_SIZE);
          
          const results = await Promise.allSettled(
            batch.map(async (item) => {
              try {
                const userPage = await this.notion.pages.retrieve({ page_id: item.applicantPageId });
                const userIdProperty = userPage.properties['사용자ID'];
                
                let userId = null;
                if (userIdProperty?.rich_text && userIdProperty.rich_text.length > 0) {
                  userId = userIdProperty.rich_text[0].plain_text;
                } else if (userIdProperty?.title && userIdProperty.title.length > 0) {
                  userId = userIdProperty.title[0].plain_text;
                }
                
                if (userId) {
                  return {
                    pageId: item.pageId,
                    programId: item.programId,
                    userId,
                    programName: item.programName
                  };
                }
                return null;
              } catch (error) {
                console.warn(`[ProgramApplicationService] 사용자ID 조회 실패 (pageId: ${item.applicantPageId}):`, error.message);
                return null;
              }
            })
          );

          // 성공한 조회 결과를 applications에 추가
          results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
              applications.push(result.value);
            }
          });

          // rate limit 고려 delay
          if (i + BATCH_SIZE < missingUserIds.length) {
            await new Promise(resolve => setTimeout(resolve, 350));
          }
        }
      }

      console.log(`[ProgramApplicationService] 선택된 신청자 ${applications.length}건 조회 완료 (전체 ${allPages.length}건 중)`);
      return applications;

    } catch (error) {
      console.error('[ProgramApplicationService] 선택된 신청자 조회 오류:', error.message);
      throw new Error(`선택된 신청자 조회에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 선택된 신청자들을 일괄 승인 처리
   * @returns {Promise<Object>} 처리 결과 { totalCount, successCount, failedCount, results, programStats }
   */
  async bulkApproveApplications() {
    try {
      const applications = await this.getSelectedApplications();

      if (applications.length === 0) {
        return {
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          results: [],
          programStats: {}
        };
      }

      const results = await Promise.allSettled(
        applications.map(app => 
          this.approveApplication(app.programId, app.userId)
            .then(() => ({ success: true, pageId: app.pageId, programId: app.programId, programName: app.programName }))
            .catch(error => ({ success: false, pageId: app.pageId, error: error.message, programId: app.programId, programName: app.programName }))
        )
      );

      const successResults = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failedResults = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      // 성공한 항목의 '선택' 체크박스 해제
      await this.resetSelectionCheckboxes(successResults);

      // 프로그램별 통계 생성
      const programStats = this.generateProgramStats(successResults);

      return {
        totalCount: applications.length,
        successCount: successResults.length,
        failedCount: failedResults.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
        programStats
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 일괄 승인 오류:', error.message);
      throw new Error(`일괄 승인 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 선택된 신청자들을 일괄 거절 처리
   * @returns {Promise<Object>} 처리 결과 { totalCount, successCount, failedCount, results, programStats }
   */
  async bulkRejectApplications() {
    try {
      const applications = await this.getSelectedApplications();

      if (applications.length === 0) {
        return {
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          results: [],
          programStats: {}
        };
      }

      const results = await Promise.allSettled(
        applications.map(app => 
          this.rejectApplication(app.programId, app.userId)
            .then(() => ({ success: true, pageId: app.pageId, programId: app.programId, programName: app.programName }))
            .catch(error => ({ success: false, pageId: app.pageId, error: error.message, programId: app.programId, programName: app.programName }))
        )
      );

      const successResults = results.filter(r => r.status === 'fulfilled' && r.value.success);

      // 성공한 항목의 '선택' 체크박스 해제
      await this.resetSelectionCheckboxes(successResults);

      // 프로그램별 통계 생성
      const programStats = this.generateProgramStats(successResults);

      return {
        totalCount: applications.length,
        successCount: successResults.length,
        failedCount: applications.length - successResults.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
        programStats
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 일괄 거절 오류:', error.message);
      throw new Error(`일괄 거절 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 선택된 신청자들을 일괄 대기 상태로 변경
   * @returns {Promise<Object>} 처리 결과 { totalCount, successCount, failedCount, results, programStats }
   */
  async bulkPendingApplications() {
    try {
      const applications = await this.getSelectedApplications();

      if (applications.length === 0) {
        return {
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          results: [],
          programStats: {}
        };
      }

      const results = await Promise.allSettled(
        applications.map(app => 
          this.pendingApplication(app.programId, app.userId)
            .then(() => ({ success: true, pageId: app.pageId, programId: app.programId, programName: app.programName }))
            .catch(error => ({ success: false, pageId: app.pageId, error: error.message, programId: app.programId, programName: app.programName }))
        )
      );

      const successResults = results.filter(r => r.status === 'fulfilled' && r.value.success);

      // 성공한 항목의 '선택' 체크박스 해제
      await this.resetSelectionCheckboxes(successResults);

      // 프로그램별 통계 생성
      const programStats = this.generateProgramStats(successResults);

      return {
        totalCount: applications.length,
        successCount: successResults.length,
        failedCount: applications.length - successResults.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
        programStats
      };

    } catch (error) {
      console.error('[ProgramApplicationService] 일괄 대기 처리 오류:', error.message);
      throw new Error(`일괄 대기 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }
}

module.exports = new ProgramApplicationService();

