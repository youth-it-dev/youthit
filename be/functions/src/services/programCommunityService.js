const CommunityService = require('./communityService');
const FirestoreService = require('./firestoreService');
const { FieldValue } = require('../config/database');
const { normalizeProgramTypeValue } = require('./programService');

/**
 * ProgramCommunityService
 * 프로그램과 Community 간의 동기화 및 관리를 담당하는 서비스
 */
class ProgramCommunityService {
  constructor() {
    this.firestoreService = new FirestoreService();
    this.communityService = new CommunityService();
  }

  /**
   * Community 존재 보장 (없으면 생성, 있으면 동기화)
   * @param {string} programId - 프로그램 ID (정규화된 ID)
   * @param {Object} program - 프로그램 정보
   * @returns {Promise<Object>} Community 정보
   */
  async ensureCommunityExists(programId, program) {
    try {
      let community = await this.communityService.getCommunityMapping(programId);
      
      if (!community) {
        // Community가 없으면 생성
        community = await this.createCommunityFromProgram(programId, program);
        console.log(`[ProgramCommunityService] Community 생성 완료 - programId: ${programId}`);
      } else {
        // Community가 존재하면 동기화
        await this.syncCommunityWithNotion(programId, program);
        console.log(`[ProgramCommunityService] Community 동기화 완료 - programId: ${programId}`);
      }
      
      return community;
    } catch (error) {
      console.error('[ProgramCommunityService] Community 보장 오류:', error.message);
      throw error;
    }
  }

  /**
   * 날짜 문자열을 Date 객체로 변환 (한국 시간대 UTC+9 기준)
   * @param {string|null|Date} dateValue - 날짜 값
   * @param {boolean} isEndDate - endDate인 경우 true (23:59:59 설정)
   * @returns {Date|null} 변환된 Date 객체 또는 null
   */
  _parseDateWithTime(dateValue, isEndDate = false) {
    if (!dateValue) {
      return null;
    }

    if (dateValue instanceof Date) {
      return dateValue;
    }

    const dateString = String(dateValue);
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const time = isEndDate ? '23:59:59' : '00:00:00';
      const kstTimeString = `${dateString}T${time}+09:00`;
      const date = new Date(kstTimeString);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * 프로그램 정보로 Community 생성
   * @param {string} programId - 프로그램 ID (Community ID)
   * @param {Object} program - 프로그램 정보
   * @returns {Promise<Object>} 생성된 Community 정보
   */
  async createCommunityFromProgram(programId, program) {
    try {
      const communityData = {
        id: programId,
        name: program?.programName || program?.title || null,
        programType: normalizeProgramTypeValue(program?.programType) || null,
        startDate: this._parseDateWithTime(program?.startDate, false),
        endDate: this._parseDateWithTime(program?.endDate, true),
        createdAt: FieldValue.serverTimestamp(),
      };

      // Community 생성
      await this.firestoreService.setDocument('communities', programId, communityData);
      return communityData;

    } catch (error) {
      console.error('[ProgramCommunityService] Community 생성 오류:', error.message);
      throw new Error('Community 생성에 실패했습니다.');
    }
  }

  /**
   * Community와 Notion 데이터 동기화
   * @param {string} programId - 프로그램 ID (Community ID)
   * @param {Object} program - Notion에서 가져온 최신 프로그램 정보
   * @returns {Promise<Object|null>} 업데이트된 필드 정보 또는 null (동기화 불필요 시)
   */
  async syncCommunityWithNotion(programId, program) {
    try {
      // Community 전체 데이터 조회
      const community = await this.firestoreService.getDocument('communities', programId);
      if (!community) {
        // Community가 없으면 동기화 불필요
        return null;
      }

      // Notion 데이터에서 동기화할 필드 추출
      const notionName = program?.programName || program?.title || null;
      const notionProgramType = normalizeProgramTypeValue(program?.programType) || null;
      const notionStartDate = this._parseDateWithTime(program?.startDate, false);
      const notionEndDate = this._parseDateWithTime(program?.endDate, true);

      // 업데이트할 필드 확인
      const updateData = {};
      let needsUpdate = false;

      // name 비교 및 업데이트
      if (community.name !== notionName) {
        updateData.name = notionName;
        needsUpdate = true;
      }

      // programType 비교 및 업데이트
      const normalizedCommunityProgramType = normalizeProgramTypeValue(community.programType);
      if (normalizedCommunityProgramType !== notionProgramType) {
        updateData.programType = notionProgramType;
        needsUpdate = true;
      }

      // startDate 비교 및 업데이트
      if (!this._compareDates(community.startDate, notionStartDate)) {
        updateData.startDate = notionStartDate;
        needsUpdate = true;
      }

      // endDate 비교 및 업데이트
      if (!this._compareDates(community.endDate, notionEndDate)) {
        updateData.endDate = notionEndDate;
        needsUpdate = true;
      }

      // 업데이트가 필요한 경우에만 실행
      if (needsUpdate) {
        updateData.updatedAt = FieldValue.serverTimestamp();
        await this.firestoreService.updateDocument('communities', programId, updateData);
        console.log(`[ProgramCommunityService] Community 동기화 완료 - programId: ${programId}, 업데이트된 필드: ${Object.keys(updateData).join(', ')}`);
        return updateData;
      }

      return null;
    } catch (error) {
      console.error('[ProgramCommunityService] Community 동기화 오류:', error.message);
      // 동기화 실패해도 신청 프로세스는 계속 진행
      return null;
    }
  }

  /**
   * 두 날짜 값이 동일한지 비교 (Firestore Timestamp 및 다양한 형식 지원)
   * @param {any} date1 - 첫 번째 날짜 (Firestore Timestamp, Date, string 등)
   * @param {any} date2 - 두 번째 날짜 (Firestore Timestamp, Date, string 등)
   * @returns {boolean} 두 날짜가 동일하면 true, 다르면 false
   */
  _compareDates(date1, date2) {
    // CommunityService의 toDate 헬퍼 사용
    const d1 = CommunityService.toDate(date1);
    const d2 = CommunityService.toDate(date2);
    
    // 둘 다 null이면 동일
    if (!d1 && !d2) return true;
    
    // 하나만 null이면 다름
    if (!d1 || !d2) return false;
    
    // 타임스탬프 비교 (밀리초 단위)
    return d1.getTime() === d2.getTime();
  }
}

module.exports = new ProgramCommunityService();

