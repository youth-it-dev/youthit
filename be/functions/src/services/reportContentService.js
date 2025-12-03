const { Client } = require('@notionhq/client');
const { db, FieldValue, admin } = require("../config/database");
const FirestoreService = require("./firestoreService");
const { Timestamp } = require("firebase-admin/firestore");
const notionUserService = require("./notionUserService");
const { MISSION_POSTS_COLLECTION } = require("../constants/missionConstants");


class ReportContentService {
  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });
    
    this.reportsDatabaseId = process.env.NOTION_REPORT_CONTENT_DB_ID;
    this.reportedDatabaseId = process.env.NOTION_REPORTED_CONTENT_DB_ID;
  }

/**
   * 게시글/댓글 신고 생성
   */
async createReport(reportData) {
  try {
    const { 
      targetType, 
      targetId, 
      targetUserId,
      communityId,
      missionId,
      reporterId, 
      reportReason 
    } = reportData;


    // 1. 중복 신고 체크
    const existingReport = await this.checkDuplicateReport(reporterId, targetType, targetId);
    if (existingReport) {
      const error = new Error("이미 신고한 콘텐츠입니다.");
      error.code = "DUPLICATE_REPORT";
      error.status = 400;
      throw error;
    }

    // 2. 신고 대상 존재 여부 확인
    await this.validateTargetExists(targetType, targetId, communityId, missionId);

    // 3. 신고 카운트 증가 (먼저 실행)
    let reportsCount = 0;
    let isLocked = false;
    try {
      if (targetType === "comment") {
        const commentDoc = await db.collection("comments").doc(targetId).get();
        if (!commentDoc.exists) {
          throw new Error("댓글을 찾을 수 없습니다.");
        }
        const commentData = commentDoc.data();
        
        // 미션 댓글인지 확인 (communityId가 없으면 미션 댓글)
        const isMissionComment = !commentData.communityId;
        
        await db.collection("comments").doc(targetId).update({
          reportsCount: FieldValue.increment(1),
        });
        const updatedCommentDoc = await db.collection("comments").doc(targetId).get();
        reportsCount = updatedCommentDoc.data()?.reportsCount || 0;
        
        // comment는 3회 이상이면 잠금
        if (reportsCount >= 3) {
          isLocked = true;
          await db.collection("comments").doc(targetId).update({
            isLocked: true,
          });
          console.log(`[신고 처리] ${isMissionComment ? '미션' : '커뮤니티'} 댓글 ${targetId} 잠금 처리 (신고 카운트: ${reportsCount})`);
        }
      } else if (targetType === "post") {
        // 미션 인증글인 경우
        if (missionId) {
          const postDoc = await db.collection(MISSION_POSTS_COLLECTION).doc(targetId).get();
          if (!postDoc.exists) {
            throw new Error("인증글을 찾을 수 없습니다.");
          }
          
          await db.collection(MISSION_POSTS_COLLECTION).doc(targetId).update({
            reportsCount: FieldValue.increment(1),
          });
          const updatedPostDoc = await db.collection(MISSION_POSTS_COLLECTION).doc(targetId).get();
          reportsCount = updatedPostDoc.data()?.reportsCount || 0;
          
          // post는 5회 이상이면 잠금
          if (reportsCount >= 5) {
            isLocked = true;
            await db.collection(MISSION_POSTS_COLLECTION).doc(targetId).update({
              isLocked: true,
            });
            console.log(`[신고 처리] 미션 인증글 ${targetId} 잠금 처리 (신고 카운트: ${reportsCount})`);
          }
        } else {
          // 커뮤니티 게시글인 경우
          if (!communityId) {
            const err = new Error("게시글 신고에는 communityId 또는 missionId가 필요합니다.");
            err.code = "MISSING_COMMUNITY_ID";
            err.status = 400;
            throw err;
          }
          await db
            .collection("communities")
            .doc(communityId)
            .collection("posts")
            .doc(targetId)
            .update({
              reportsCount: FieldValue.increment(1),
            });
          const postDoc = await db
            .collection("communities")
            .doc(communityId)
            .collection("posts")
            .doc(targetId)
            .get();
          reportsCount = postDoc.data()?.reportsCount || 0;
          
          // post는 5회 이상이면 잠금
          if (reportsCount >= 5) {
            isLocked = true;
            await db
              .collection("communities")
              .doc(communityId)
              .collection("posts")
              .doc(targetId)
              .update({
                isLocked: true,
              });
            console.log(`[신고 처리] 커뮤니티 게시글 ${targetId} 잠금 처리 (신고 카운트: ${reportsCount})`);
          }
        }
      }
    } catch (countUpdateError) {
      const error = new Error(
        `신고 카운트 증가 실패: ${countUpdateError.message || "알 수 없는 오류"}`
      );
      error.code = "REPORT_COUNT_UPDATE_FAILED";
      error.status = 500;
      error.originalError = countUpdateError;
      throw error;
    }
    
    // 4. Notion에 저장 (신고 카운트 + 잠김 상태 포함)
    const notionReport = {
      targetType,
      targetId,
      targetUserId,
      communityId: communityId || null,
      missionId: missionId || null,
      reporterId,
      reportReason,
      status: false,
      reviewedBy: null,
      reviewedAt: null,
      memo: null,
      createdAt: new Date().toISOString(),
      notionUpdatedAt: new Date().toISOString(),
      reportsCount,
      isLocked, // 잠김 상태 추가
    };
    const notionPage = await this.syncToNotion(notionReport);



    // 6. 필요 시 Notion 결과 반환
    return {
      ...notionReport,
      notionPageId: notionPage?.id || null,
      message: "신고가 정상적으로 접수되었습니다 (Notion에 저장됨)."
    };

  } catch (error) {
    console.error("Create report error:", error);
    throw error;
  }
}

/**
 * 동일 신고(중복 신고) 여부 체크 - 노션 데이터베이스에서 확인
 * reportsDatabaseId와 reportedDatabaseId 두 데이터베이스 모두에서 확인
 */
async checkDuplicateReport(reporterId, targetType, targetId) {
  try {
    const notionTargetType = this.mapTargetType(targetType);

    // 두 데이터베이스에서 중복 체크를 위한 공통 필터
    const filter = {
      and: [
        { property: '신고자ID', rich_text: { equals: reporterId } },
        { property: '신고 타입', title: { equals: notionTargetType } },
        { property: '신고 콘텐츠', rich_text: { equals: targetId } },
      ]
    };

    // 1. reportsDatabaseId에서 중복 체크
    const response1 = await fetch(`https://api.notion.com/v1/databases/${this.reportsDatabaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: filter,
        page_size: 1
      })
    });

    const data1 = await response1.json();

    if (!response1.ok) {
      throw new Error(`Notion duplicate check failed (reportsDatabaseId): ${data1.message || response1.statusText}`);
    }

    // reportsDatabaseId에서 중복 발견
    if (data1.results && data1.results.length > 0) {
      const page = data1.results[0];
      return { id: page.id, reporterId, targetType, targetId, database: 'reportsDatabaseId' };
    }

    // 2. reportedDatabaseId에서 중복 체크
    const response2 = await fetch(`https://api.notion.com/v1/databases/${this.reportedDatabaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: filter,
        page_size: 1
      })
    });

    const data2 = await response2.json();

    if (!response2.ok) {
      throw new Error(`Notion duplicate check failed (reportedDatabaseId): ${data2.message || response2.statusText}`);
    }

    // reportedDatabaseId에서 중복 발견
    if (data2.results && data2.results.length > 0) {
      const page = data2.results[0];
      return { id: page.id, reporterId, targetType, targetId, database: 'reportedDatabaseId' };
    }

    // 두 데이터베이스 모두에서 중복 없음
    return null;

  } catch (error) {
    console.error('Notion 중복 신고 확인 실패:', error);
    throw error;
  }
}



/**
 * 신고 대상 존재 여부 확인
 */
async validateTargetExists(targetType, targetId, communityId, missionId) {
  try {
    if (targetType === 'post') {
      // 미션 인증글인 경우
      if (missionId) {
        const postDoc = await db.collection(MISSION_POSTS_COLLECTION).doc(targetId).get();
        if (!postDoc.exists) {
          const error = new Error("신고하려는 인증글을 찾을 수 없습니다.");
          error.code = "NOTION_POST_NOT_FOUND";
          error.status = 404;
          throw error;
        }
        const postData = postDoc.data();
        // missionId가 일치하는지 확인
        if (postData.missionNotionPageId !== missionId) {
          const error = new Error("인증글이 해당 미션에 속하지 않습니다.");
          error.code = "BAD_REQUEST";
          error.status = 400;
          throw error;
        }
      } else {
        // 커뮤니티 게시글인 경우
        if (!communityId) {
          const error1 = new Error("communityId 또는 missionId가 필요합니다. 게시글은 반드시 커뮤니티 또는 미션 하위에 존재합니다.");
          error1.code = "MISSING_COMMUNITY_ID";
          error1.status = 400;
          throw error1;
        }

        const postDoc = await db.doc(`communities/${communityId}/posts/${targetId}`).get();
        if (!postDoc.exists) {
          const error2 = new Error("신고하려는 게시글을 찾을 수 없습니다.");
          error2.code = "NOTION_POST_NOT_FOUND";
          error2.status = 404;
          throw error2;
        }
      }
    } else if (targetType === 'comment') {
      const commentDoc = await db.doc(`comments/${targetId}`).get();
      if (!commentDoc.exists) {
        const error3 = new Error("신고하려는 댓글을 찾을 수 없습니다.");
        error3.code = "COMMENT_NOT_FOUND";
        error3.status = 404;
        throw error3;
      }
      
      const commentData = commentDoc.data();
      
      // 미션 댓글인 경우 missionId 검증
      if (missionId) {
        if (commentData.communityId) {
          const error = new Error("커뮤니티 댓글은 미션 신고 API를 사용할 수 없습니다.");
          error.code = "BAD_REQUEST";
          error.status = 400;
          throw error;
        }
        // 댓글이 속한 게시글의 missionId 확인
        if (commentData.postId) {
          const postDoc = await db.collection(MISSION_POSTS_COLLECTION).doc(commentData.postId).get();
          if (postDoc.exists) {
            const postData = postDoc.data();
            if (postData.missionNotionPageId !== missionId) {
              const error = new Error("댓글이 해당 미션에 속하지 않습니다.");
              error.code = "BAD_REQUEST";
              error.status = 400;
              throw error;
            }
          } else {
            const error = new Error("댓글이 속한 게시글을 찾을 수 없습니다.");
            error.code = "POST_NOT_FOUND";
            error.status = 404;
            throw error;
          }
        }
      }
    }
  } catch (error) {
    console.error("Validate target exists error:", error);
    throw error;
  }
}


unmapTargetType(label) {
  switch (label) {
    case "게시글": return "post";
    case "댓글": return "comment";
    default: return label;
  }
}


/**
 * 사용자 신고 목록 조회 (cursor 기반 페이지네이션)
 * + Firestore -> Reports컬렉션 Index추가(reporterId, createdAt, _name_)
 * {
    "reporterId": "2JJJUVyFPyRRRiyOgGfEqIZS3123",  
    "size": 1,
    "cursor" : "28a1f705-fa4a-80a7-9369-c7049596b9c2" -> 다음 페이지를 조회하는 경우만 요청
  }
 */
async getReportsByReporter(reporterId, { size = 10, cursor }) {
  try {
    const body = {
      filter: {
        property: '신고자ID',
        rich_text: { equals: reporterId }
      },
      sorts: [
        { property: '신고일시', direction: 'descending' } // 최신 순 정렬
      ],
      page_size: size
    };

    if (cursor) {
      body.start_cursor = cursor;
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${this.reportsDatabaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return { reports: [], hasMore: false, nextCursor: null };
    }

    const reports = data.results.map(page => {
      const props = page.properties;
      return {
        notionPageId: page.id,
        targetType: this.unmapTargetType(props['신고 타입']?.title?.[0]?.text?.content),
        targetId: props['신고 콘텐츠']?.rich_text?.[0]?.text?.content || null,
        targetUserId: props['작성자']?.rich_text?.[0]?.text?.content || null,
        reporterId: props['신고자ID']?.rich_text?.[0]?.text?.content || null,
        reportReason: props['신고 사유']?.rich_text?.[0]?.text?.content || null,
        communityId: props['커뮤니티 ID']?.rich_text?.[0]?.text?.content || null,
        missionId: props['미션 ID']?.rich_text?.[0]?.text?.content || null,
        status : props['선택']?.checkbox || false,
        reportedAt: props['신고일시']?.date?.start || null,
        syncNotionAt: props['동기화 시간(Notion)']?.date?.start || null,
        syncNotionFirebase: props['동기화 시간(Firebase)']?.date?.start || null
      };
    });

    return {
      reports,
      hasMore: data.has_more,
      nextCursor: data.next_cursor || null
    };

  } catch (error) {
    console.error("Notion 신고 조회 실패:", error);
    throw new Error("Notion에서 신고 데이터를 조회하는 중 오류가 발생했습니다.");
  }
}



/**
 * Notion에 동기화
 */
async syncToNotion(reportData) {
  try {
    const notionResult = await this.syncReportToNotion(reportData);
    return notionResult;
  } catch (error) {
    console.error("Sync to Notion error:", error);
    throw error;
  }
}


/**
 * 신고 데이터를 Notion에 동기화(요청에 대한)
 */
async syncReportToNotion(reportData) {
  try {
    
    const { targetType, targetId, targetUserId, communityId, missionId, reporterId, reportReason, firebaseUpdatedAt, notionUpdatedAt, status = false, reportsCount = 0, isLocked = false} = reportData;
    
    /*
    TODO : 로그인 토큰 관련 이슈가 해결되면
    - 작성자 ID를 저장하고 노션에 보여줄때는 users컬렉션에서 작성자 이름 + 해당 작성자 이름을 클릭하면 작성자 정보 데이터베이스 추가필요
    - 신고자 ID를 저장하고 노션에 보여줄때는 users컬렉션에서 신고자 이름을 + 해당 신고자를 클릭하는 경우 해당 사용자에 대한 데이터베이스 만들기
    */
    const userFirestoreService = new FirestoreService("users");

    async function getUserDisplayNameById(userId, label) {
      if (!userId) return "";

      try {
        const user = await userFirestoreService.getById(userId);
        if (!user) {
          console.warn(
            `[REPORT][USER_NOT_FOUND] ${label} 사용자 문서를 찾을 수 없습니다. userId=${userId}`,
          );
          return "";
        }

        // 닉네임이 있는 경우에만 표시, 없으면 빈 문자열
        return user.nickname || "";
      } catch (e) {
        console.error(
          `[REPORT][USER_LOOKUP_ERROR] ${label} 사용자 조회 실패 userId=${userId}:`,
          e.message,
        );
        return "";
      }
    }

    // 신고자 / 작성자 닉네임을 병렬로 조회 (N+1 방지)
    const [reporterName, authorName] = await Promise.all([
      getUserDisplayNameById(reporterId, "신고자"),
      getUserDisplayNameById(targetUserId, "작성자"),
    ]);


    // URL 생성 로직
    let contentUrl = null;
    if (targetType === 'post') {
      // 게시글인 경우
      if (missionId) {
        // 미션 인증글
        contentUrl = `https://youth-it.vercel.app/community/mission/${targetId}`;
      } else if (communityId) {
        // 커뮤니티 게시글
        contentUrl = `https://youth-it.vercel.app/community/post/${targetId}?communityId=${communityId}`;
      }
    } else if (targetType === 'comment') {
      // 댓글인 경우 - comments 컬렉션에서 postId 가져오기
      try {
        const commentDoc = await db.collection("comments").doc(targetId).get();
        if (commentDoc.exists) {
          const commentData = commentDoc.data();
          const postId = commentData.postId;
          
          if (missionId && postId) {
            // 미션 댓글
            contentUrl = `https://youth-it.vercel.app/community/mission/${postId}`;
          } else if (postId && communityId) {
            // 커뮤니티 댓글
            contentUrl = `https://youth-it.vercel.app/community/post/${postId}?communityId=${communityId}`;
          }
        }
      } catch (commentError) {
        console.error('댓글 데이터 조회 실패:', commentError);
        // URL 생성 실패해도 계속 진행
      }
    }


    // 1. 같은 "신고 콘텐츠" 값을 가진 기존 페이지들 조회 및 업데이트
    try {
      // targetId를 문자열로 변환 (노션에 저장된 형식과 일치시키기 위해)
      const targetIdString = String(targetId);
      let cursor = undefined;
      let hasMore = true;
      let totalUpdated = 0;
      
      while (hasMore) {
        const queryBody = {
          filter: {
            property: '신고 콘텐츠',
            rich_text: {
              equals: targetIdString
            }
          },
          page_size: 100
        };
        
        if (cursor) {
          queryBody.start_cursor = cursor;
        }
        
        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${this.reportsDatabaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryBody)
        });
        
        if (!queryResponse.ok) {
          const errorText = await queryResponse.text();
          throw new Error(`Notion API 요청 실패: ${queryResponse.status} - ${errorText}`);
        }
        
        const queryData = await queryResponse.json();
        
        if (queryData.results && queryData.results.length > 0) {
          // 조회된 페이지들의 "신고 카운트" 필드 업데이트
          const updatePromises = queryData.results.map(async (page) => {
            try {
              await this.notion.pages.update({
                page_id: page.id,
                properties: {
                  '신고 카운트': { number: reportsCount },
                  '잠김 상태': { rich_text: [{ text: { content: String(isLocked) } }] }
                }
              });
              return true;
            } catch (pageError) {
              console.error(`페이지 ${page.id} 업데이트 실패:`, pageError.message);
              return false;
            }
          });
          
          const results = await Promise.all(updatePromises);
          const successCount = results.filter(r => r === true).length;
          totalUpdated += successCount;
          
          console.log(`[Notion 동기화] ${successCount}/${queryData.results.length}개 기존 신고의 카운트 업데이트 완료 (targetId: ${targetIdString}, reportsCount: ${reportsCount})`);
        }
        
        hasMore = queryData.has_more || false;
        cursor = queryData.next_cursor;
      }
      
      if (totalUpdated > 0) {
        console.log(`[Notion 동기화] 총 ${totalUpdated}개 기존 신고의 카운트를 ${reportsCount}로 업데이트 완료`);
      }
    } catch (updateError) {
      console.error('기존 신고 카운트 업데이트 실패:', updateError);
      // 업데이트 실패해도 새 신고 추가는 계속 진행
    }

    // 2. 새로운 신고 페이지 생성
    const notionProperties = {
      '신고 타입': { title: [{ text: { content: this.mapTargetType(targetType) } }] },
      '신고 콘텐츠': { rich_text: [{ text: { content: `${targetId}` } }] },
      // 작성자: 닉네임(또는 이름)을 표시
      '작성자': { rich_text: [{ text: { content: authorName } }] },
      // 작성자 ID: 게시글/댓글 작성자 UID (null/undefined인 경우 빈 문자열)
      '작성자ID': { rich_text: [{ text: { content: targetUserId ? `${targetUserId}` : "" } }] },
      '신고 사유': { rich_text: [{ text: { content: reportReason } }] },
      '신고자': { rich_text: [{ text: { content: reporterName } }] },
      '신고자ID': { rich_text: [{ text: { content: `${reporterId}` } }] },
      '신고일시': { date: { start: new Date().toISOString() } },
      '선택': { checkbox: status },
      '신고 카운트': { number: reportsCount }, 
      '잠김 상태': { rich_text: [{ text: { content: String(isLocked) } }] },
      '동기화 시간(Firebase)': { 
        date: { 
          start: new Date(new Date().getTime()).toISOString()
        },
      },
    };
    
    // 커뮤니티 ID 필드 추가 (커뮤니티 신고인 경우만)
    if (communityId) {
      notionProperties['커뮤니티 ID'] = { rich_text: [{ text: { content: communityId } }] };
    }
    
    // 미션 ID 필드 추가 (미션 신고인 경우만)
    // Note: 커뮤니티 신고와 미션 신고는 동시에 발생하지 않음
    // - 커뮤니티 신고: communityId만 있음
    // - 미션 신고: missionId만 있고 communityId는 null
    if (missionId) {
      notionProperties['미션 ID'] = { rich_text: [{ text: { content: missionId } }] };
    }
    
    // URL 필드 추가 (contentUrl이 있을 때만)
    if (contentUrl) {
      notionProperties['URL'] = { url: contentUrl };
    }
    
    const notionData = {
      parent: { database_id: this.reportsDatabaseId },
      properties: notionProperties
    };


    const response = await this.notion.pages.create(notionData);
    console.log('Notion 동기화 성공:', response.id);
    return { success: true, notionPageId: response.id };
  } catch (error) {
    console.error('Notion 동기화 실패:', error);
    console.error('Notion 동기화 실패 상세:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body,
      stack: error.stack
    });
    // Notion API 에러의 경우 body에 상세 정보가 있을 수 있음
    let errorMessage = error.message || '알 수 없는 오류';
    if (error.body && typeof error.body === 'object') {
      const notionError = error.body;
      if (notionError.message) {
        errorMessage = `${errorMessage}: ${notionError.message}`;
      }
    }
    const customError = new Error(`Notion 동기화 중 오류가 발생했습니다: ${errorMessage}`);
    customError.code = "NOTION_SYNC_FAILED";
    customError.status = 500;
    throw customError;
  }
}



mapTargetType(targetType) {
  return { post: '게시글', comment: '댓글' }[targetType] || '기타';
}


/**
 * Notion 데이터베이스의 모든 페이지 삭제
 */
async clearNotionDatabase() {
  try {
    let cursor = undefined;
    do {
      const response = await this.notion.databases.query({
        database_id: this.reportsDatabaseId,
        start_cursor: cursor,
      });

      for (const page of response.results) {
        // Notion API에서는 실제로 페이지를 'delete'하는 것이 아니라 'archived' 처리
        await this.notion.pages.update({
          page_id: page.id,
          archived: true,
        });
        console.log(`페이지 삭제 처리 완료: ${page.id}`);
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error('Notion 데이터베이스 초기화 실패:', error);
    throw new Error(`Notion 데이터베이스 초기화 실패: ${error.message}`);
  }
}

/**
 * 노션DB 와 Firebase 동기화
 */
async syncResolvedReports() {
  let cursor = undefined;
  const reports = [];
  const errorDetails = [];
  const errorCounts = {
    firebaseNotFound: 0,
    notionMoveFailed: 0,
    userUpdateFailed: 0,
    unknown: 0,
  };

  try {
    // 1. Notion에서 데이터 조회
    while (true) {
      const body = { start_cursor: cursor };
      const response = await fetch(`https://api.notion.com/v1/databases/${this.reportsDatabaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!data.results) break;

      for (const page of data.results) {
        const props = page.properties;
        const targetType = props['신고 타입']?.title?.[0]?.text?.content || null;
        const targetId = props['신고 콘텐츠']?.rich_text?.[0]?.text?.content || null;
        const communityId = props['커뮤니티 ID']?.rich_text?.[0]?.text?.content || null;
        const missionId = props['미션 ID']?.rich_text?.[0]?.text?.content || null;
        const status = props['선택']?.checkbox || false;
        const notionUpdatedAt = new Date().toISOString();

        reports.push({
          notionPageId: page.id,
          notionPage: page, // 전체 페이지 객체도 저장 (properties 복사용)
          targetType,
          targetId,
          communityId,
          missionId,
          status,
          notionUpdatedAt
        });
      }

      if (!data.has_more) break;
      cursor = data.next_cursor;
    }

    console.log("Notion 신고 데이터 개수:", reports.length);

    // 2. targetId별로 그룹화하고, 그룹 내 하나라도 status=true이면 모두 true로 처리
    const reportsByTarget = {};

    for (const report of reports) {
      const { targetId, targetType, communityId } = report;
      if (!targetId || !targetType) continue;
      
      // Notion에서 missionId 가져오기
      const missionId = report.notionPage?.properties['미션 ID']?.rich_text?.[0]?.text?.content || null;
      
      // targetId를 키로 사용 (게시글은 communityId 또는 missionId 포함, 댓글은 targetId만)
      const key = targetType === "게시글" 
        ? `${targetType}_${communityId || missionId || 'unknown'}_${targetId}` 
        : `${targetType}_${targetId}`;
      
      if (!reportsByTarget[key]) {
        reportsByTarget[key] = {
          targetType,
          targetId,
          communityId,
          missionId,
          reports: [],
          hasResolved: false
        };
      }
      
      reportsByTarget[key].reports.push(report);
      
      // 그룹 내 하나라도 status=true이면 hasResolved를 true로 설정
      if (report.status) {
        reportsByTarget[key].hasResolved = true;
      }
    }

    // 2-1. 신고 카운트가 0인 그룹 처리 (삭제 및 Firestore 업데이트)
    const groupsToDelete = [];
    for (const key in reportsByTarget) {
      const group = reportsByTarget[key];
      
      // 그룹 내 첫 번째 리포트의 신고 카운트 확인 (모든 리포트가 같은 targetId이므로 동일한 카운트를 가짐)
      const firstReport = group.reports[0];
      const reportsCount = firstReport.notionPage?.properties['신고 카운트']?.number ?? null;
      
      if (reportsCount === 0) {
        groupsToDelete.push({ key, group }); // key와 group을 함께 저장
      }
    }

    // 신고 카운트가 0인 그룹들 처리
    for (const { key, group } of groupsToDelete) {
      try {
        const { targetType, targetId, communityId, missionId, reports } = group;
        
        // Firestore 업데이트: isLocked = false, reportsCount = 0
        if (targetType === "게시글") {
          if (missionId) {
            // 미션 인증글
            const postRef = db.collection(MISSION_POSTS_COLLECTION).doc(targetId);
            await postRef.update({
              isLocked: false,
              reportsCount: 0
            });
            console.log(`[미션 인증글] ${targetId} → isLocked: false, reportsCount: 0으로 설정`);
          } else if (communityId) {
            // 커뮤니티 게시글
            const postRef = db.doc(`communities/${communityId}/posts/${targetId}`);
            await postRef.update({
              isLocked: false,
              reportsCount: 0
            });
            console.log(`[커뮤니티 게시글] ${targetId} → isLocked: false, reportsCount: 0으로 설정`);
          }
        } else if (targetType === "댓글") {
          const commentRef = db.doc(`comments/${targetId}`);
          await commentRef.update({
            isLocked: false,
            reportsCount: 0
          });
          console.log(`[댓글] ${targetId} → isLocked: false, reportsCount: 0으로 설정`);
        }
        
        // 노션에서 해당 그룹의 모든 페이지 삭제 (archived)
        for (const report of reports) {
          try {
            await this.notion.pages.update({
              page_id: report.notionPageId,
              archived: true
            });
            console.log(`[삭제] 노션 페이지 ${report.notionPageId} 아카이브 완료`);
          } catch (archiveError) {
            console.error(`[삭제 실패] 노션 페이지 ${report.notionPageId}:`, archiveError.message);
          }
        }
        
        // 그룹을 reportsByTarget에서 제거 (이후 처리에서 제외)
        delete reportsByTarget[key];
        console.log(`[그룹 삭제] ${key} → 신고 카운트 0으로 인해 삭제 처리 완료`);
      } catch (deleteError) {
        console.error(`[그룹 삭제 실패] ${group.targetId}:`, deleteError.message);
      }
    }

    // 3. hasResolved가 true인 그룹의 모든 리포트를 status=true로 처리
    const processedReports = [];
    for (const key in reportsByTarget) {
      const group = reportsByTarget[key];
      
      if (group.hasResolved) {
        // 그룹 내 모든 리포트를 status=true로 처리
        for (const report of group.reports) {
          processedReports.push({
            ...report,
            status: true // 모두 true로 설정
          });
        }
      } else {
        // hasResolved가 false인 경우는 그대로 유지
        processedReports.push(...group.reports);
      }
    }

    console.log(`처리된 신고 데이터 개수: ${processedReports.length} (그룹화 후)`);

  // 3-1. 그룹별로 penaltyCount 증가 및 정지 기간 업데이트 (그룹당 한 번만 실행)
  const processedGroups = new Set(); // 이미 처리된 그룹을 추적
  for (const key in reportsByTarget) {
    const group = reportsByTarget[key];
    
    // hasResolved가 true인 그룹만 처리
    if (!group.hasResolved) continue;
    
    // 이미 처리된 그룹은 건너뛰기
    if (processedGroups.has(key)) continue;
    
    try {
      // 그룹의 첫 번째 리포트에서 정보 가져오기 (모든 리포트가 같은 targetUserId를 가짐)
      const firstReport = group.reports[0];
      if (!firstReport || !firstReport.notionPage) continue;
      
      // 작성자 ID는 '작성자ID' 필드에서만 읽는다. (작성자 닉네임 필드는 절대 UID로 사용하지 않음)
      const targetUserId =
        firstReport.notionPage.properties['작성자ID']?.rich_text?.[0]?.text?.content ||
        null;
      const reportsCount = firstReport.notionPage.properties['신고 카운트']?.number ?? null;

      // targetUserId 유효성 검사 (없거나 비어 있으면 패널티 스킵)
      if (typeof targetUserId !== "string" || targetUserId.trim().length === 0) {
        console.warn(
          `[REPORT][SKIP] targetUserId가 없거나 비어 있어 패널티 적용을 건너뜁니다. key=${key}`,
        );
        continue;
      }
      
      // 신고 카운트가 0이 아닌 경우에만 penaltyCount 증가 및 정지 기간 업데이트
      if (reportsCount !== null && reportsCount > 0) {
        const userRef = db.collection("users").doc(targetUserId);
        
        await db.runTransaction(async (t) => {
          const userSnap = await t.get(userRef);
          
          if (!userSnap.exists) {
            console.warn(`[Users] ${targetUserId} 사용자를 찾을 수 없음`);
            return;
          }
          
          const userData = userSnap.data();
          const currentPenaltyCount = userData.penaltyCount || 0;
          const newPenaltyCount = currentPenaltyCount + 1;
          
          // 기존 정지 기간 확인
          const suspensionStartAt = userData.suspensionStartAt;
          const suspensionEndAt = userData.suspensionEndAt;
          
          // suspensionEndAt이 9999년 12월 31일인지 확인
          let isPermanentSuspension = false;

          if (suspensionEndAt) {
            // string 타입이므로 Date 객체로 변환
            const endDate = new Date(suspensionEndAt);
            
            // 연도, 월, 일만 비교
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth() + 1; // getMonth()는 0부터 시작
            const endDay = endDate.getDate();
            
            isPermanentSuspension = endYear === 9999 && endMonth === 12 && endDay === 31;
          }
          
          const now = new Date();
          const updateData = {
            penaltyCount: newPenaltyCount
          };

          console.log("=================================================")
          console.log(`[그룹 처리] ${key}`);
          console.log("isPermanentSuspension:", isPermanentSuspension);
          console.log("newPenaltyCount:", newPenaltyCount);
          console.log("suspensionStartAt:", suspensionStartAt);
          console.log("suspensionEndAt:", suspensionEndAt);
          console.log("=================================================")
          
          // 영구 정지가 아닌 경우에만 정지 기간 업데이트
          if (!isPermanentSuspension) {

            // 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
            const formatDateOnly = (date) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            };

            if (newPenaltyCount === 1) {
              // penaltyCount가 1일 경우: 2주 정지
              if (!suspensionStartAt && !suspensionEndAt) {
                // 둘 다 빈값: 현재 시점부터 2주 후
                const twoWeeksLater = new Date(now);
                twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
                updateData.suspensionStartAt = formatDateOnly(now);
                updateData.suspensionEndAt = formatDateOnly(twoWeeksLater);
              } else if (suspensionStartAt && suspensionEndAt) {
                // 둘 다 값이 있음: suspensionEndAt에 2주 추가, suspensionStartAt도 날짜만 포함하도록 정규화
                const baseStart = new Date(suspensionEndAt); // 새 정지 시작 = 이전 정지 종료
                const baseEnd = new Date(baseStart);
                baseEnd.setDate(baseEnd.getDate() + 14);
                updateData.suspensionStartAt = formatDateOnly(baseStart);
                updateData.suspensionEndAt = formatDateOnly(baseEnd);
              }
            } else if (newPenaltyCount >= 2) {
              // penaltyCount가 2 이상일 경우: 1개월 정지
              if (!suspensionStartAt && !suspensionEndAt) {
                // 둘 다 빈값: 현재 시점부터 1개월 후
                const oneMonthLater = new Date(now);
                oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                updateData.suspensionStartAt = formatDateOnly(now);
                updateData.suspensionEndAt = formatDateOnly(oneMonthLater);
              } else if (suspensionStartAt && suspensionEndAt) {
                // 둘 다 값이 있음: suspensionEndAt에 1개월 추가, suspensionStartAt도 날짜만 포함하도록 정규화
                const currentStart = new Date(suspensionStartAt);
                const currentEnd = new Date(suspensionEndAt);
                const newEnd = new Date(currentEnd);
                newEnd.setMonth(newEnd.getMonth() + 1);
                updateData.suspensionStartAt = formatDateOnly(currentStart);
                updateData.suspensionEndAt = formatDateOnly(newEnd);
              }
            }
          }
          
          t.update(userRef, updateData);
          console.log(`[Users] ${targetUserId} → penaltyCount: ${newPenaltyCount}, 정지 기간 업데이트 완료 (그룹: ${key})`);
          
        });
        
        // 그룹 처리 완료 표시
        processedGroups.add(key);
      }
    } catch (userPenaltyError) {
      console.error(`[Users] 그룹 ${key}의 penaltyCount 증가 실패:`, userPenaltyError.message);
      // penaltyCount 업데이트 실패는 전체 프로세스를 중단하지 않음
    }
  }

 // 4. Firebase 동기화 및 Notion 데이터베이스 이동
 let syncedCount = 0;
 let failedCount = 0;

 for (const report of processedReports) {
   try {
     const { targetType, targetId, communityId, status, notionPage } = report;
     if (!targetId || !targetType) continue;

     // status=true인 경우에만 동기화 진행
     // (그룹화 단계에서 동일한 신고 콘텐츠에 status=true가 하나라도 있으면 모두 true로 처리됨)
     if (!status) {
       console.log(`[건너뜀] ${targetId} → status가 false이므로 동기화하지 않음`);
       continue;
     }

    let syncSuccess = false;

    // Firebase 동기화 (status=true인 경우만 여기 도달)
    if (targetType === "게시글") {
      // Notion에서 missionId 가져오기
      const missionId = notionPage?.properties['미션 ID']?.rich_text?.[0]?.text?.content || null;
      
      if (missionId) {
        // 미션 인증글
        const postRef = db.collection(MISSION_POSTS_COLLECTION).doc(targetId);
        await db.runTransaction(async (t) => {
          const postSnap = await t.get(postRef);

          if (!postSnap.exists) {
              const err = new Error("POST_NOT_FOUND");
              err.code = "POST_NOT_FOUND";
              throw err;
          }
          // status=true이므로 항상 isLocked: true로 설정
          t.update(postRef, { isLocked: true });

          console.log(`[미션 인증글] ${targetId} → locked`);
        });
        syncSuccess = true;
      } else if (communityId) {
        // 커뮤니티 게시글
        const postRef = db.doc(`communities/${communityId}/posts/${targetId}`);
        await db.runTransaction(async (t) => {
          const postSnap = await t.get(postRef);

          if (!postSnap.exists) {
              const err = new Error("POST_NOT_FOUND");
              err.code = "POST_NOT_FOUND";
              throw err;
          }
          // status=true이므로 항상 isLocked: true로 설정
          t.update(postRef, { isLocked: true });

          console.log(`[커뮤니티 게시글] ${targetId} → locked`);
        });
        syncSuccess = true;
      }

    } else if (targetType === "댓글") {
      const commentRef = db.doc(`comments/${targetId}`);

      await db.runTransaction(async (t) => {
        const commentSnap = await t.get(commentRef);

        if (!commentSnap.exists) {
              const err = new Error("COMMENT_NOT_FOUND");
              err.code = "COMMENT_NOT_FOUND";
              throw err;
        }
        // status=true이므로 항상 isLocked: true로 설정
        t.update(commentRef, { isLocked: true });

        console.log(`[댓글] ${targetId} → locked`);
      });
      syncSuccess = true;
    }

    // penaltyCount 증가 및 정지 기간 업데이트는 위에서 그룹별로 이미 처리했으므로 여기서는 제거

     // Firebase 동기화 성공 시 Notion 데이터베이스 이동 및 users 컬렉션 reportCount 증가
     if (syncSuccess) {
       try {
         // 원본 페이지의 모든 properties 복사
         const sourceProps = notionPage.properties;
         const backupProperties = {};

         // 각 필드 타입별로 복사
         for (const [key, value] of Object.entries(sourceProps)) {
           if (!value || !value.type) continue;

           // Notion API 형식 그대로 복사
           if (value.type === "title") {
             backupProperties[key] = { title: value.title || [] };
           } else if (value.type === "rich_text") {
             backupProperties[key] = { rich_text: value.rich_text || [] };
           } else if (value.type === "select") {
             backupProperties[key] = value.select ? { select: value.select } : { select: null };
           } else if (value.type === "date") {
             backupProperties[key] = value.date ? { date: value.date } : { date: null };
           } else if (value.type === "number") {
             backupProperties[key] = { number: value.number ?? null };
           } else if (value.type === "checkbox") {
             backupProperties[key] = { checkbox: value.checkbox ?? false };
           } else if (value.type === "files") {
             backupProperties[key] = { files: value.files || [] };
           } else if (value.type === "multi_select") {
             backupProperties[key] = { multi_select: value.multi_select || [] };
           } else if (value.type === "relation") {
             backupProperties[key] = { relation: value.relation || [] };
           } else if (value.type === "rollup") {
             backupProperties[key] = { rollup: value.rollup || null };
           } else if (value.type === "formula") {
             backupProperties[key] = { formula: value.formula || null };
           } else if (value.type === "created_time") {
             backupProperties[key] = { created_time: value.created_time || null };
           } else if (value.type === "created_by") {
             backupProperties[key] = { created_by: value.created_by || null };
           } else if (value.type === "last_edited_time") {
             backupProperties[key] = { last_edited_time: value.last_edited_time || null };
           } else if (value.type === "last_edited_by") {
             backupProperties[key] = { last_edited_by: value.last_edited_by || null };
           } else if (value.type === "url") {
             backupProperties[key] = { url: value.url || null };
          }
         }

        // "선택" 필드는 적용된 신고 콘텐츠 및 회원 데이터베이스에 없으므로 제거
        delete backupProperties['선택'];
   

         // 동기화 시간 추가
         backupProperties['동기화 시간(Notion)'] = {
           date: {
             start: new Date(report.notionUpdatedAt).toISOString()
           }
         };

         // reportedDatabaseId에 새 페이지 생성
         await this.notion.pages.create({
           parent: { database_id: this.reportedDatabaseId },
           properties: backupProperties
         });

         // 원본 데이터베이스에서 페이지 아카이브 (삭제)
         await this.notion.pages.update({
           page_id: report.notionPageId,
           archived: true
         });


         /*
         초기에 reportCount를 게시글/댓글 컬렉션에서 가지고 있지 않고 users컬렉션에서 가지고 있을때 추가한 코드???
         현재는 users컬렉션에 reportCount필드는 필요없다??? -> 확인필요 -> 우선주석
         
         Notion 페이지 이동이 모두 성공한 후에 reportCount 증가
         users 컬렉션의 reportCount 증가 (작성자가 있는 경우만)
         */
        // const targetUserId = notionPage.properties['작성자']?.rich_text?.[0]?.text?.content || null;
        //  if (targetUserId) {
        //   try {
        //     const userRef = db.collection("users").doc(targetUserId);
        //     await userRef.set({
        //       reportCount: FieldValue.increment(1)
        //     }, { merge: true });
        //     console.log(`[Users] ${targetUserId}의 reportCount 증가 완료`);
        //   } catch (userError) {
        //     console.error(`[Users] ${targetUserId}의 reportCount 증가 실패:`, userError.message);
        //     // users 업데이트 실패는 전체 프로세스를 중단하지 않음
        //     errorCounts.userUpdateFailed++;
        //     errorDetails.push({
        //       targetId,
        //       targetType,
        //       stage: "USER_UPDATE",
        //       message: userError.message
        //     });
        //   }
        // }

         syncedCount++;
         console.log(`[성공] ${targetId} → reportedDatabaseId로 이동 완료`);
       } catch (notionError) {
         console.error(`[Notion 이동 실패] ${targetId}:`, notionError.message);
         failedCount++;
         errorCounts.notionMoveFailed++;
        errorDetails.push({
          targetId,
          targetType,
          stage: "NOTION_MOVE",
          message: notionError.message
        });
       }
     } else {
       failedCount++;
     }

   } catch (err) {
     console.error(`동기화 중 오류 (targetId: ${report.targetId}):`, err);
     failedCount++;
     if (err.code === "POST_NOT_FOUND" || err.code === "COMMENT_NOT_FOUND") {
           errorCounts.firebaseNotFound++;
     } else {
           errorCounts.unknown++;
     }
           errorDetails.push({
             targetId: report.targetId,
             targetType: report.targetType,
             stage: "FIREBASE_SYNC",
             message: err.message || String(err)
           });
   }
 }

    console.log(`Notion → Firebase 동기화 완료: 성공 ${syncedCount}개, 실패 ${failedCount}개`);
    return { 
      total: reports.length, 
      synced: syncedCount, 
      failed: failedCount,
      reports: processedReports,
      errorCounts,
      errors: errorDetails
    };
  } catch (error) {
    console.error("Notion 데이터 가져오기 실패:", error);
    throw error;
  }
}



}
module.exports = new ReportContentService();