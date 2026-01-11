const { db } = require('../config/database');

/**
 * UUID 정규화 (하이픈 추가)
 * @param {string} id - 프로그램 ID (하이픈 있거나 없거나)
 * @returns {string} UUID 형식의 ID (8-4-4-4-12)
 */
function normalizeUUID(id) {
  if (!id) return id;
  
  // 이미 하이픈이 있으면 그대로 반환
  if (id.includes('-')) return id;
  
  // 32자 hex 문자열이면 UUID 형식으로 변환
  if (/^[0-9a-fA-F]{32}$/.test(id)) {
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }
  
  // 그 외는 그대로 반환
  return id;
}

/**
 * Program Monitoring Service
 * 프로그램 참가자들의 일별 인증글 작성 여부를 추적하는 서비스
 */
class ProgramMonitoringService {
  /**
   * 모니터링 데이터 생성
   * @param {Object} options - { programId?, month? }
   * @param {string} options.programId - 프로그램 ID (선택)
   * @param {string} options.month - 조회 월 YYYY-MM 형식 (선택)
   * @returns {Promise<Object>} { programGroups: [{ programId, programName, leaderNickname, startDate, endDate, dateColumns, participants, matrix }] }
   */
  async generateMonitoringData(options = {}) {
    let { programId, month } = options;
    
    // programId UUID 정규화
    if (programId) {
      programId = normalizeUUID(programId);
    }
    
    let programIds = [];
    
    if (programId) {
      // 특정 프로그램만
      programIds = [programId];
    } else {
      // 모든 프로그램 조회
      const communitiesSnapshot = await db.collection('communities').get();
      programIds = communitiesSnapshot.docs.map(doc => doc.id);
    }
    
    console.log(`[ProgramMonitoringService] ${programIds.length}개 프로그램 처리 시작`);
    
    // 프로그램별로 데이터 생성
    const programGroups = [];
    
    for (const progId of programIds) {
      try {
        const groupData = await this.generateProgramGroupData(progId, month);
        if (groupData && groupData.participants.length > 0) {
          programGroups.push(groupData);
        }
      } catch (error) {
        console.warn(`[ProgramMonitoringService] 프로그램 ${progId} 처리 실패:`, error.message);
      }
    }
    
    console.log(`[ProgramMonitoringService] ${programGroups.length}개 프로그램 그룹 생성 완료`);
    
    return { programGroups };
  }

  /**
   * 특정 프로그램의 모니터링 데이터 생성
   * @param {string} programId - 프로그램 ID
   * @param {string} month - 조회 월 (선택)
   * @returns {Promise<Object>} { programId, programName, startDate, endDate, dateColumns, participants, matrix }
   */
  async generateProgramGroupData(programId, month) {
    // programId UUID 정규화
    programId = normalizeUUID(programId);
    
    // 1. 프로그램 정보 조회 (Firestore에서 직접 조회 - Notion 의존성 제거)
    const programDoc = await db.collection('communities').doc(programId).get();
    
    if (!programDoc.exists) {
      console.warn(`[ProgramMonitoringService] 프로그램 ${programId} 정보 없음`);
      return null;
    }
    
    const programData = programDoc.data();
    const program = {
      title: programData.title || programData.name || '제목 없음',
      startDate: programData.startDate?.toDate?.() || new Date(programData.startDate),
      endDate: programData.endDate?.toDate?.() || new Date(programData.endDate)
    };
    
    // 2. 날짜 범위 결정 (활동기간과 month의 교집합)
    const { startDate, endDate, dateColumns } = this.getProgramDateRange(program, month);
    
    if (dateColumns.length === 0) {
      // 활동기간과 month가 겹치지 않음
      return null;
    }
    
    // 3. 참가자 조회
    const participants = await this.getProgramParticipants(programId);
    
    if (participants.length === 0) {
      return null;
    }
    
    // 4. 인증글 조회
    const posts = await this.getCertificationPostsForProgram(programId, startDate, endDate);
    
    // 5. 매트릭스 생성
    const matrix = this.buildMatrix(participants, posts, dateColumns);
    
    return {
      programId,
      programName: program.title || '제목 없음',
      startDate,
      endDate,
      dateColumns,
      participants,
      matrix
    };
  }

  /**
   * 프로그램의 날짜 범위 결정 (활동기간과 month의 교집합)
   * @param {Object} program - 프로그램 객체
   * @param {string} month - 조회 월 (YYYY-MM, 선택)
   * @returns {Object} { startDate, endDate, dateColumns }
   */
  getProgramDateRange(program, month) {
    let startDate = new Date(program.startDate);
    let endDate = new Date(program.endDate);
    
    // month가 있으면 교집합 계산
    if (month) {
      const [year, monthNum] = month.split('-');
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);
      
      // 교집합 계산
      startDate = startDate > monthStart ? startDate : monthStart;
      endDate = endDate < monthEnd ? endDate : monthEnd;
      
      // 교집합이 없으면 빈 배열
      if (startDate > endDate) {
        return { startDate, endDate, dateColumns: [] };
      }
    }
    
    // 날짜 컬럼 생성
    const dateColumns = this.generateDateColumns(startDate, endDate);
    
    return { startDate, endDate, dateColumns };
  }

  /**
   * 날짜 컬럼 생성
   * @param {Date} startDate - 시작 날짜
   * @param {Date} endDate - 종료 날짜
   * @returns {string[]} ['10.15', '10.16', ...]
   */
  generateDateColumns(startDate, endDate) {
    const columns = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const month = (current.getMonth() + 1).toString();
      const day = current.getDate().toString();
      columns.push(`${month}.${day}`);
      current.setDate(current.getDate() + 1);
    }
    
    return columns;
  }

  /**
   * 특정 프로그램의 참가자 조회
   * @param {string} programId - 프로그램 ID
   * @returns {Promise<Array>} [{ userId, nickname, name }]
   */
  async getProgramParticipants(programId) {
    // programId UUID 정규화
    programId = normalizeUUID(programId);
    
    const snapshot = await db
      .collection(`communities/${programId}/members`)
      .where('status', '==', 'approved')
      .get();
    
    const memberIds = snapshot.docs.map(doc => doc.data().userId);
    return await this.enrichWithUserData(memberIds);
  }


  /**
   * 참가자 조회 (레거시, 사용 안함)
   * @param {string} programId - 프로그램 ID (선택)
   * @returns {Promise<Array>} [{ userId, nickname, name }]
   */
  async getParticipants(programId) {
    let memberIds = [];
    
    if (programId) {
      // 특정 프로그램의 승인된 참가자
      const snapshot = await db
        .collection(`communities/${programId}/members`)
        .where('status', '==', 'approved')
        .get();
      
      memberIds = snapshot.docs.map(doc => doc.data().userId);
    } else {
      // 전체 프로그램의 승인된 참가자 - 인덱스 없이 각 커뮤니티 순회
      const communitiesSnapshot = await db.collection('communities').get();
      const allMemberIds = new Set();
      
      console.log(`[ProgramMonitoringService] 참가자 조회 시작: ${communitiesSnapshot.docs.length}개 커뮤니티`);
      
      for (const communityDoc of communitiesSnapshot.docs) {
        const communityId = communityDoc.id;
        try {
          const membersSnapshot = await db
            .collection(`communities/${communityId}/members`)
            .where('status', '==', 'approved')
            .get();
          
          membersSnapshot.docs.forEach(doc => {
            const userId = doc.data().userId;
            if (userId) {
              allMemberIds.add(userId);
            }
          });
        } catch (error) {
          console.warn(`[ProgramMonitoringService] 커뮤니티 ${communityId} 멤버 조회 실패:`, error.message);
        }
      }
      
      memberIds = [...allMemberIds];
      console.log(`[ProgramMonitoringService] 참가자 조회 완료: ${memberIds.length}명`);
    }
    
    // 사용자 정보 조회
    return await this.enrichWithUserData(memberIds);
  }

  /**
   * 사용자 정보로 보강
   * @param {string[]} userIds - 사용자 ID 배열
   * @returns {Promise<Array>} [{ userId, nickname, name }]
   */
  async enrichWithUserData(userIds) {
    if (userIds.length === 0) {
      return [];
    }
    
    const users = [];
    
    // Firestore 'in' 쿼리는 최대 10개씩만 가능
    for (let i = 0; i < userIds.length; i += 10) {
      const chunk = userIds.slice(i, i + 10);
      const userDocs = await db.collection('users')
        .where('__name__', 'in', chunk)
        .get();
      
      userDocs.forEach(doc => {
        const data = doc.data();
        users.push({
          userId: doc.id,
          nickname: data.nickname || '',
          name: data.name || ''
        });
      });
    }
    
    return users;
  }

  /**
   * 특정 프로그램의 인증글 조회
   * @param {string} programId - 프로그램 ID
   * @param {Date} startDate - 시작 날짜
   * @param {Date} endDate - 종료 날짜
   * @returns {Promise<Array>} 인증글 배열
   */
  async getCertificationPostsForProgram(programId, startDate, endDate) {
    // programId UUID 정규화
    programId = normalizeUUID(programId);
    
    const snapshot = await db
      .collection(`communities/${programId}/posts`)
      .where('type', '==', 'ROUTINE_CERT')
      .orderBy('createdAt', 'desc')
      .get();
    
    // 메모리에서 날짜 범위 필터링
    return snapshot.docs
      .map(doc => doc.data())
      .filter(post => {
        if (!post.createdAt) return false;
        const createdAt = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });
  }

  /**
   * 인증글 조회 (레거시, 사용 안함)
   * @param {string} programId - 프로그램 ID (선택)
   * @param {Date} startDate - 시작 날짜
   * @param {Date} endDate - 종료 날짜
   * @returns {Promise<Array>} 인증글 배열
   */
  async getCertificationPosts(programId, startDate, endDate) {
    try {
      if (programId) {
        // 특정 프로그램의 인증글 - 기존 인덱스 사용
        // 범위 쿼리 대신 type 필터만 사용하고 메모리에서 날짜 필터링
        const snapshot = await db
          .collection(`communities/${programId}/posts`)
          .where('type', '==', 'ROUTINE_CERT')
          .orderBy('createdAt', 'desc')
          .get();
        
        // 메모리에서 날짜 범위 필터링
        return snapshot.docs
          .map(doc => doc.data())
          .filter(post => {
            if (!post.createdAt) return false;
            const createdAt = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
            return createdAt >= startDate && createdAt <= endDate;
          });
      } else {
        // 전체 프로그램의 인증글 - collectionGroup 대신 모든 communities 순회
        // 인덱스 없이도 작동하도록 범위 쿼리 제거, 메모리에서 필터링
        const communitiesSnapshot = await db.collection('communities').get();
        const allPosts = [];
        
        console.log(`[ProgramMonitoringService] 전체 조회 시작: ${communitiesSnapshot.docs.length}개 커뮤니티`);
        
        // 각 커뮤니티의 posts 조회 (범위 쿼리 없이)
        for (const communityDoc of communitiesSnapshot.docs) {
          const communityId = communityDoc.id;
          try {
            const postsSnapshot = await db
              .collection(`communities/${communityId}/posts`)
              .where('type', '==', 'ROUTINE_CERT')
              .get();
            
            // 메모리에서 날짜 범위 필터링
            postsSnapshot.docs.forEach(doc => {
              const post = doc.data();
              if (!post.createdAt) return;
              
              const createdAt = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
              if (createdAt >= startDate && createdAt <= endDate) {
                allPosts.push(post);
              }
            });
          } catch (error) {
            console.warn(`[ProgramMonitoringService] 커뮤니티 ${communityId} 조회 실패:`, error.message);
            // 개별 커뮤니티 조회 실패는 무시하고 계속 진행
          }
        }
        
        console.log(`[ProgramMonitoringService] 전체 조회 완료: ${allPosts.length}개 인증글`);
        
        return allPosts;
      }
    } catch (error) {
      console.error('[ProgramMonitoringService] Firestore 쿼리 에러:', {
        code: error.code,
        message: error.message,
        details: error.details,
        programId,
        startDate,
        endDate
      });
      
      // FAILED_PRECONDITION 에러인 경우 더 친절한 메시지
      if (error.code === 9 || error.message?.includes('FAILED_PRECONDITION')) {
        // 에러 메시지에서 인덱스 생성 링크 추출 시도
        const errorDetails = error.message || '';
        const indexLinkMatch = errorDetails.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        
        const indexError = new Error(
          `Firestore 인덱스가 필요합니다.\n` +
          (indexLinkMatch ? `인덱스 생성 링크: ${indexLinkMatch[0]}\n` : '') +
          `필요한 인덱스:\n` +
          `Collection Group: posts\n` +
          `Fields: type (Ascending), createdAt (Descending)\n` +
          `Query Scope: Collection group\n\n` +
          `또는 Firebase Console에서 직접 생성:\n` +
          `https://console.firebase.google.com/project/youthvoice-2025/firestore/indexes`
        );
        indexError.code = 'MISSING_FIRESTORE_INDEX';
        indexError.statusCode = 500;
        indexError.originalError = error;
        throw indexError;
      }
      
      throw error;
    }
  }

  /**
   * 매트릭스 생성
   * @param {Array} participants - 참가자 배열
   * @param {Array} posts - 인증글 배열
   * @param {string[]} dateColumns - 날짜 컬럼 배열
   * @returns {Object} { userId: { '10.15': true, '10.16': false, ... } }
   */
  buildMatrix(participants, posts, dateColumns) {
    const matrix = {};
    
    // 초기화: 모든 참가자의 모든 날짜를 false로 설정
    participants.forEach(p => {
      matrix[p.userId] = {};
      dateColumns.forEach(date => {
        matrix[p.userId][date] = false;
      });
    });
    
    // 게시글 데이터로 채우기
    posts.forEach(post => {
      if (!post.createdAt) {
        return;
      }
      
      const createdAt = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      const month = (createdAt.getMonth() + 1).toString();
      const day = createdAt.getDate().toString();
      const dateKey = `${month}.${day}`;
      
      // 해당 사용자의 해당 날짜를 true로 설정
      if (matrix[post.authorId] && dateColumns.includes(dateKey)) {
        matrix[post.authorId][dateKey] = true;
      }
    });
    
    return matrix;
  }
}

module.exports = new ProgramMonitoringService();

