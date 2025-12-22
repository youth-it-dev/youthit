const { Client } = require('@notionhq/client');
const { db, FieldValue } = require("../config/database");
const { ADMIN_LOG_ACTIONS } = require("../constants/adminLogActions");
const {admin} = require("../config/database");
const crypto = require("crypto");

/*
- 1초, 10배치 : 100명에서 끊어짐
- 1.5초, 20배치 : 200명 문제X
- 1.5초, 50배치 : 200명 문제X
- 1.5초, 100배치 : 200명 문제X
- 1.5초, 150배치 : 300명 문제X
- 1.5초, 300배치 : 300명 문제X
- 1.5초, 500배치 : 500명 문제X
- 1초, 500배치 : 500명 문제X (한번에 500명을 진행하는 경우 속도가 느려지는 느낌이 있음)
※ 문서상 초당 평균 3번의 요청, 실제로는 15분 동안 2700번 api 호출
-> 유스보이스 사용자가 최대 3,000명 이라고 가정하면 1초에 1000배치로 처리 가능 (3000명을 넘어갈까...?)
 */
const DELAY_MS = 1200; // 지연시간
const BATCH_SIZE = 500; // 배치 사이즈
const DEFAULT_PROFILE_AVATAR_URL = "https://storage.googleapis.com/youthvoice-2025.firebasestorage.app/files/cVZGcXR0yH67/Profile_Default_Ah5nnOc4lAVw.png";

class NotionUserService {

  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY,

    });

    this.notionUserAccountDB = process.env.NOTION_USER_ACCOUNT_DB_ID;
    this.activeUserDB  = process.env.NOTION_ACTIVE_USER;
    this.withdrawUserDB = process.env.NOTION_WITHDRAWN_USER;
    this.pendingUserDB = process.env.NOTION_PENDING_USER;
    this.notionUserAccountBackupDB = process.env.NOTION_USER_ACCOUNT_BACKUP_DB_ID;
  }

  /**
   * fcmTokens 서브컬렉션에서 pushTermsAgreed 값을 확인하여 상태 반환
   * @param {string} userId - 사용자 ID
   * @return {Promise<string>} "동의", "거부", "미설정" 중 하나
   */
  async getPushAdvertisingStatusFromFcmTokens(userId) {
    try {
      const fcmTokensSnapshot = await db.collection(`users/${userId}/fcmTokens`).get();
      
      // fcmTokens가 없으면 미설정
      if (fcmTokensSnapshot.empty) {
        return "미설정";
      }

      // pushTermsAgreed가 true인 토큰이 하나라도 있으면 동의
      const hasAgreedToken = fcmTokensSnapshot.docs.some(doc => {
        const data = doc.data();
        return data.pushTermsAgreed === true;
      });

      if (hasAgreedToken) {
        return "동의";
      }

      // 하나도 true가 없으면 거부
      return "거부";
    } catch (error) {
      console.warn(`[getPushAdvertisingStatusFromFcmTokens] 사용자 ${userId}의 fcmTokens 조회 실패:`, error.message);
      // 조회 실패 시 미설정 반환
      return "미설정";
    }
  }


  /**
   * Firebase의 users 컬렉션에서 전체회원 조회 후 -> Notion 데이터베이스에 등록
   */  
  async syncUserAccounts() {
    
    const snapshot = await db.collection("users").get();

    // Firebase에 lastUpdated 필드 존재 여부 확인
    const hasLastUpdated = snapshot.docs.every(doc => !!doc.data().lastUpdatedAt);

    const now = new Date();

    // 현재 노션에 있는 사용자 목록 가져오기 (ID와 lastUpdated 매핑)
    const notionUsers = await this.getNotionUsers(this.notionUserAccountDB);

    let syncedCount = 0;
    let failedCount = 0;
    const syncedUserIds = []; // 동기화된 사용자 ID 목록
    const failedUserIds = []; // 동기화 실패한 사용자 ID 목록

    // 배치 처리로 변경
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = snapshot.docs.slice(i, i + BATCH_SIZE);
      console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(snapshot.docs.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, snapshot.docs.length)}번째)`);

      // 배치 내에서 병렬 처리
      const batchPromises = batch.map(async (doc) => {
        try {
          const user = doc.data();
          const userId = doc.id;

          // 신고 카운트(게시글 + 댓글) 합산
          let reportCount = 0;
          try {

            // collectionGroup 쿼리로 모든 posts에서 authorId로 필터링 (인덱스 필요)
            const postsSnapshot = await db
              .collectionGroup("posts")
              .where("authorId", "==", userId)
              .get();
            
            const postReports = postsSnapshot.docs.reduce((sum, postDoc) => {
              const reportsCount = postDoc.data().reportsCount || 0;
              return sum + reportsCount;
            }, 0);
        

            // 2) comments 컬렉션에서 userId가 동일한 문서의 reportsCount 합산
            const commentSnapshot = await db
              .collection("comments")
              .where("userId", "==", userId)
              .get();

            const commentReports = commentSnapshot.docs.reduce((sum, commentDoc) => {
              const reportsCount = commentDoc.data().reportsCount || 0;
              return sum + reportsCount;
            }, 0);
            
            reportCount = postReports + commentReports;
          } catch (countError) {
            console.warn(
              `[WARN] 사용자 ${userId}의 신고 카운트 조회 실패: ${countError.message}`
            );
          }

          //문자열 or timestamp로 저장되어도 모두 조회
          const firebaseLastUpdatedDate = safeTimestampToDate(user.lastUpdatedAt);
          const firebaseLastUpdated = firebaseLastUpdatedDate
            ? firebaseLastUpdatedDate.getTime()
            : 0;
          
          /*
          - 노션에서 제공하는 최종 편집 일시를 사용하지 않고 동기화 시간으로 관리하는 이유 : 노션에서 변경사항이 생겼을때 비교하는게 아니라 동기화 버튼을 클릭했을 경우의 시간과 비교하기 위함
            + 노션 데이터
          */
          const notionLastUpdated = notionUsers[userId]?.lastUpdated
            ? new Date(notionUsers[userId].lastUpdated).getTime()
            : 0;

          // Firebase가 더 최신이면 or lastUpdated가 없는 경우 업데이트 필요
          if (!user.lastUpdatedAt || firebaseLastUpdated > notionLastUpdated || !notionUsers[userId]) {
            // 날짜 변환
            const createdAtIso = safeDateToIso(user.createdAt);
            const lastLoginIso = safeDateToIso(user.lastLoginAt);
            const lastUpdatedIso = now;
            
            // fcmTokens 서브컬렉션에서 Push 광고 수신 여부 확인
            const pushAdvertisingStatus = await this.getPushAdvertisingStatusFromFcmTokens(userId);
            
            // 노션 페이지 데이터 구성
            const notionPage = {
              '기본 닉네임': { title: [{ text: { content: user.nickname || "" } }] },
              "프로필 사진": {
                files: [
                  {
                    name: "profile-image",
                    type: "external",
                    external: { url: user.profileImageUrl || DEFAULT_PROFILE_AVATAR_URL },
                  },
                ],
              },
              "사용자ID": { rich_text: [{ text: { content: userId } }] },
              "사용자 실명": { rich_text: [{ text: { content: user.name || "" } }] },
              // "상태": {
              //   select: {
              //     name: (user.deletedAt !== undefined && user.deletedAt !== null && user.deletedAt !== "") 
              //       ? "탈퇴" 
              //       : "가입"
              //   }
              // },
              "전화번호": { rich_text: [{ text: { content: user.phoneNumber || "" } }] },
              "생년월일": { rich_text: [{ text: { content: user.birthDate || "" } }] },
              "이메일": { rich_text: [{ text: { content: user.email || "" } }] },
              "가입완료 일시": createdAtIso ? { date: { start: createdAtIso } } : undefined,
              //"가입 방법": { select: { name: user.authType || "email" } },
              "앱 첫 로그인": createdAtIso ? { date: { start: createdAtIso } } : undefined,
              "최근 앱 활동 일시": lastLoginIso ? { date: { start: lastLoginIso } } : undefined,
              "유입경로": { rich_text: [{ text: { content: user.utmSource || "" } }] },
              "성별": { 
                select: { 
                  name: 
                    user.gender === 'male' ? "남성" : user.gender === 'female' ? "여성" : "미선택",
                } 
              },
              "Push 광고 수신 여부": {
                select: {
                  name: pushAdvertisingStatus,
                },
              },
              "자격정지 기간(시작)": user.suspensionStartAt ? {
                date: { 
                  start: user.suspensionStartAt 
                }
              } : { date: null },
              "자격정지 기간(종료)": user.suspensionEndAt ? {
                date: { 
                  start: user.suspensionEndAt 
                }
              } : { date: null },
              "정지 사유": user.suspensionReason ? {
                rich_text: [{
                  text: { content: user.suspensionReason }
                }]
              } : {
                rich_text: []
              },
              "패널티 카운트": {
                number: (user.penaltyCount !== null && user.penaltyCount !== undefined) ? user.penaltyCount : 0
              },
              "신고 카운트": { number: reportCount },
              "동기화 시간": { date: { start: lastUpdatedIso.toISOString() } },
              "관리자 타입": {
                checkbox: user.userType === "admin"
              },
              "이벤트 및 홍보 동의": {
                select: {
                  name:
                    user.marketingTermsAgreed === true
                      ? "동의"
                      : user.marketingTermsAgreed === false
                      ? "거부"
                      : "미설정",
                },
              },
            };
      
            // Upsert: 기존 페이지가 있으면 업데이트, 없으면 생성
            if (notionUsers[userId]) {
              // 기존 페이지 업데이트
              await this.updateNotionPageWithRetry(notionUsers[userId].pageId, notionPage);
            } else {
              // 새 페이지 생성
              await this.createNotionPageWithRetry(notionPage);
            }

            // Firebase lastUpdated가 없는 경우에만 초기 설정
            if (!user.lastUpdated) {
              await db.collection("users").doc(userId).update({
                lastUpdatedAt: lastUpdatedIso,
              });
            }
      
            syncedCount++;
            syncedUserIds.push(userId); // 동기화된 사용자 ID 저장
            return { success: true, userId };
          } else {
            // 동기화 불필요한 경우
            return { success: true, userId, skipped: true };
          }
        } catch (error) {
          // 동기화 실패 처리
          failedCount++;
          failedUserIds.push(doc.id);
          console.error(`[동기화 실패] 사용자 ${doc.id}:`, error.message || error);
          return { success: false, userId: doc.id, error: error.message };
        }
      });

      // 배치 결과 처리
      const batchResults = await Promise.all(batchPromises);
      const batchSuccess = batchResults.filter(r => r.success && !r.skipped).length;
      const batchSkipped = batchResults.filter(r => r.success && r.skipped).length;
      const batchFailed = batchResults.filter(r => !r.success).length;

      console.log(`배치 완료: 성공 ${batchSuccess}명, 건너뜀 ${batchSkipped}명, 실패 ${batchFailed}명 (총 진행률: ${syncedCount + failedCount}/${snapshot.docs.length})`);

      // 마지막 배치가 아니면 지연
      if (i + BATCH_SIZE < snapshot.docs.length) {
        console.log(`${DELAY_MS/1000}초 대기 중...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    // Firebase에는 없지만 노션에만 있는 사용자 아카이브 처리
    const firebaseUserIds = new Set(snapshot.docs.map(doc => doc.id));
    
    // 노션의 모든 페이지 가져오기 (사용자ID가 빈값인 페이지도 포함)
    const allNotionPages = await this.getAllNotionPages(this.notionUserAccountDB);
    
    // 아카이브 대상 페이지 찾기
    const pagesToArchive = [];
    for (const page of allNotionPages) {
      const props = page.properties;
      const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text || "";
      
      // 사용자ID가 빈값이거나, 사용자ID가 있지만 Firebase에 없는 경우 아카이브 대상
      if (!userId || !firebaseUserIds.has(userId)) {
        pagesToArchive.push({
          pageId: page.id,
          userId: userId || "(사용자ID 없음)",
        });
      }
    }
    
    let archivedCount = 0;
    if (pagesToArchive.length > 0) {
      console.log(`Firebase에 없거나 사용자ID가 빈값인 노션 페이지 ${pagesToArchive.length}개 아카이브 처리 중...`);
      
      // 배치 처리로 아카이브 (syncAllUserAccounts와 동일한 패턴)
      for (let i = 0; i < pagesToArchive.length; i += BATCH_SIZE) {
        const batch = pagesToArchive.slice(i, i + BATCH_SIZE);
        console.log(`아카이브 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pagesToArchive.length / BATCH_SIZE)} 처리 중...`);
        
        await Promise.all(batch.map(async (page) => {
          try {
            await this.archiveNotionPageWithRetry(page.pageId);
            archivedCount++;
            console.log(`[아카이브 성공] 페이지 ${page.pageId} (사용자ID: ${page.userId})`);
          } catch (error) {
            console.error(`[아카이브 실패] 페이지 ${page.pageId} (사용자ID: ${page.userId}):`, error.message);
          }
        }));
        
        // 마지막 배치가 아니면 지연
        if (i + BATCH_SIZE < pagesToArchive.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
    }
    
    console.log(`동기화 완료: ${syncedCount}명 갱신됨, ${archivedCount}개 페이지 아카이브됨`);


    // 동기화 완료 후 백업 실행
    let backupResult = null;
    let backupSuccess = false;
    let backupError = null;
    try {
      console.log('동기화 완료 후 백업을 시작합니다...');
      backupResult = await this.backupNotionUserDatabase();
      backupSuccess = true;
      console.log(`백업 완료: ${backupResult.backedUp}개 페이지 백업됨 (생성: ${backupResult.created}개, 업데이트: ${backupResult.updated}개, 삭제: ${backupResult.deleted}개, 실패: ${backupResult.failed}개)`);
    } catch (error) {
      backupSuccess = false;
      backupError = error.message || '알 수 없는 오류가 발생했습니다';
      console.error('백업 실패:', error);
    }


    // 백업 결과 이력 저장 (별도 action으로 저장)
    try {
      const backupLogRef = db.collection("adminLogs").doc();
      await backupLogRef.set({
        adminId: "Notion 관리자",
        action: backupSuccess ? ADMIN_LOG_ACTIONS.NOTION_BACKUP_COMPLETED : ADMIN_LOG_ACTIONS.NOTION_BACKUP_FAILED,
        targetId: "", // 백업 작업이므로 빈 값
        timestamp: new Date(),
        metadata: backupSuccess && backupResult ? {
          syncedCount: backupResult.backedUp,
          created: backupResult.created,
          archivedCount: backupResult.deleted,
          total: backupResult.backedUp + backupResult.failed,
          failedCount: backupResult.failed,
          ...(backupResult.errors && backupResult.errors.length > 0 && { errors: backupResult.errors })
        } : {
          logMessage : backupError
        }
      });
      if (backupSuccess) {
        console.log(`[adminLogs] 백업 결과 저장 완료: 성공 (${backupResult.backedUp}개 백업)`);
      } else {
        console.log(`[adminLogs] 백업 결과 저장 완료: 실패 - ${backupError}`);
      }
    } catch (backupLogError) {
      console.error("[adminLogs] 백업 로그 저장 실패:", backupLogError);
      // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러를 throw하지 않음
    }


    try {
      const logRef = db.collection("adminLogs").doc();
      await logRef.set({
        adminId: "Notion 관리자",
        action: ADMIN_LOG_ACTIONS.USER_PART_SYNCED,
        targetId: "", // 전체 동기화 작업이므로 빈 값
        timestamp: new Date(),
        metadata: {
          syncedCount: syncedCount,
          failedCount: failedCount,
          archivedCount: archivedCount,  //Firebase -> Notion으로 동기화 하는 경우 존재
          total: syncedCount + failedCount,
          syncedUserIds: syncedUserIds, // 동기화된 사용자 ID 목록
          failedUserIds: failedUserIds, // 동기화 실패한 사용자 ID 목록
        }
      });
      console.log(`[adminLogs] 회원 동기화 이력 저장 완료: ${syncedCount}명`);
    } catch (logError) {
      console.error("[adminLogs] 로그 저장 실패:", logError);
      // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러를 throw하지 않음
    }

    return { syncedCount, failedCount, archivedCount };
  }



// Notion DB에서 모든 사용자 정보 조회
async getNotionUsers(databaseId) {
  let results = [];
  let hasMore = true;
  let startCursor;

  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: startCursor,
      }),
    });

    // HTTP 응답 상태 확인
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Notion API Error] Status: ${res.status}, Response: ${errorText}`);
      const err = new Error(`Notion API 요청 실패: ${res.status} - ${errorText}`);
      err.code = "INTERNAL_ERROR";
      throw err;
    }

    const data = await res.json();

    // Notion API 에러 응답 확인
    if (data.error) {
      console.error(`[Notion API Error]`, data.error);
      const err = new Error(`Notion API 에러: ${data.error.message || JSON.stringify(data.error)}`);
      err.code = "INTERNAL_ERROR";
      throw err;
    }

    results = results.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  const userMap = {};
  for (const page of results) {
    const props = page.properties;
    const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text || null;
    const lastUpdated = props["동기화 시간"]?.date?.start || null;
    if (userId) {
      userMap[userId] = { pageId: page.id, lastUpdated };
    }
  }
  return userMap;
}

// 페이지 아카이브(삭제)
async archiveNotionPage(pageId) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ archived: true }),
  });
}

/**
 - 전체 사용자 동기화(firebase -> Notion)
   + 기존 :  기존 부분동기화를 진행하는 경우 lastUpate값을 비교해서 노션 동기화 데이터 이후에 변경된 데이터만 동기화
   + 문제점 : 관리자가 노션에서 사용자 정보를 실수로 수정했거나 하는 경우 실제 firebae의 데이터와 다르게 노션에 보여질 수 있는 문제
   + 해결방안 : 주기적으로 관리자가 전체동기화를 진행
   + 참고 : 기존 전체삭제 -> 전체 동기화  순서로 진행을 했는데 노션 api에 너무 많은 요청을 보내게 되면 연결이 끊기는 문제가 있음
     + 해결방법 : 한번에 많은 요청을 보내지 않고 배치 작업으로 요청 분배
 */
async syncAllUserAccounts() {
  try {
    console.log('=== 전체 사용자 동기화 시작 (Upsert 방식) ===');
    
    // 1. Firebase users 컬렉션 전체 가져오기
    const snapshot = await db.collection("users").get();
    console.log(`Firebase에서 ${snapshot.docs.length}명의 사용자 데이터를 가져왔습니다.`);

    // 2. 노션에 있는 기존 사용자 목록 가져오기 (ID와 pageId 매핑)
    const notionUsers = await this.getNotionUsers(this.notionUserAccountDB);
    console.log(`노션에 기존 사용자 ${Object.keys(notionUsers).length}명이 존재합니다.`);

    const now = new Date();
    let syncedCount = 0; //동기화 성공 : update+created
    let updatedCount = 0; //노션에 기존 페이지에 있어서 업데이트 카운트
    let createdCount = 0; //노션에 없어서 새로 생성한 카운트
    let failedCount = 0; //동기화 실패 카운트
    const syncedUserIds = [];
    const failedUserIds = [];

    // 3. 사용자 데이터를 배치로 처리
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = snapshot.docs.slice(i, i + BATCH_SIZE);
      console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(snapshot.docs.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, snapshot.docs.length)}번째)`);

      // 배치 내에서 병렬 처리
      const batchPromises = batch.map(async (doc) => {
        try {
          const user = doc.data();
          const userId = doc.id;
          const existingNotionUser = notionUsers[userId];

          // 신고 카운트(게시글 + 댓글) 합산
          let reportCount = 0;
          try {
            // collectionGroup 쿼리로 모든 posts에서 authorId로 필터링 (인덱스 필요)
            const postsSnapshot = await db
              .collectionGroup("posts")
              .where("authorId", "==", userId)
              .get();
            
            const postReports = postsSnapshot.docs.reduce((sum, postDoc) => {
              const reportsCount = postDoc.data().reportsCount || 0;
              return sum + reportsCount;
            }, 0);

            // 2) comments 컬렉션에서 userId가 동일한 문서의 reportsCount 합산
            const commentSnapshot = await db
              .collection("comments")
              .where("userId", "==", userId)
              .get();

            const commentReports = commentSnapshot.docs.reduce((sum, commentDoc) => {
              const reportsCount = commentDoc.data().reportsCount || 0;
              return sum + reportsCount;
            }, 0);
            
            reportCount = postReports + commentReports;
          } catch (countError) {
            console.warn(
              `[WARN] 사용자 ${userId}의 신고 카운트 조회 실패: ${countError.message}`
            );
          }

          // 날짜 처리
          const createdAtIso = safeDateToIso(user.createdAt);
          const lastLoginIso = safeDateToIso(user.lastLoginAt);
          const lastUpdatedIso = now;

          // fcmTokens 서브컬렉션에서 Push 광고 수신 여부 확인
          const pushAdvertisingStatus = await this.getPushAdvertisingStatusFromFcmTokens(userId);

          // Notion 페이지 데이터 구성
          const notionPage = {
            '기본 닉네임': { title: [{ text: { content: user.nickname || "" } }] },
            "프로필 사진": {
              files: [
                {
                  name: "profile-image",
                  type: "external",
                  external: { url: user.profileImageUrl || DEFAULT_PROFILE_AVATAR_URL },
                },
              ],
            },
            "사용자ID": { rich_text: [{ text: { content: userId } }] },
            "사용자 실명": { rich_text: [{ text: { content: user.name || "" } }] },
            // "상태": {
            //   select: {
            //     name: (user.deletedAt !== undefined && user.deletedAt !== null && user.deletedAt !== "") 
            //       ? "탈퇴" 
            //       : "가입"
            //   }
            // },
            "전화번호": { rich_text: [{ text: { content: user.phoneNumber || "" } }] },
            "생년월일": { rich_text: [{ text: { content: user.birthDate || "" } }] },
            "이메일": { rich_text: [{ text: { content: user.email || "" } }] },
            "가입완료 일시": createdAtIso ? { date: { start: createdAtIso } } : undefined,
            //"가입 방법": { select: { name: user.authType || "email" } },
            "앱 첫 로그인": createdAtIso ? { date: { start: createdAtIso } } : undefined,
            "최근 앱 활동 일시": lastLoginIso ? { date: { start: lastLoginIso } } : undefined,
            "유입경로": { rich_text: [{ text: { content: user.utmSource || "" } }] },
            "성별": { 
              select: { 
                name: 
                  user.gender === 'male' ? "남성" : user.gender === 'female' ? "여성" : "미선택",
              } 
            },
            "Push 광고 수신 여부": {
              select: {
                name: pushAdvertisingStatus,
              },
            },
            "자격정지 기간(시작)": user.suspensionStartAt ? {
              date: { 
                start: user.suspensionStartAt 
              }
            } : { date: null },
            "자격정지 기간(종료)": user.suspensionEndAt ? {
              date: { 
                start: user.suspensionEndAt 
              }
            } : { date: null },
            "정지 사유": user.suspensionReason ? {
              rich_text: [{
                text: { content: user.suspensionReason }
              }]
            } : {
              rich_text: []
            },
            "패널티 카운트": {
              number: (user.penaltyCount !== null && user.penaltyCount !== undefined) ? user.penaltyCount : 0
            },
            "신고 카운트": { number: reportCount },
            "동기화 시간": { date: { start: lastUpdatedIso.toISOString() } },
            "관리자 타입": {
              checkbox: user.userType === "admin"
            },
            "이벤트 및 홍보 동의": {
              select: {
                name:
                  user.marketingTermsAgreed === true
                    ? "동의"
                    : user.marketingTermsAgreed === false
                    ? "거부"
                    : "미설정",
              },
            },
          };

          // Upsert: 기존 페이지가 있으면 업데이트, 없으면 생성
          if (existingNotionUser) {
            // 기존 페이지 업데이트
            await this.updateNotionPageWithRetry(existingNotionUser.pageId, notionPage);
            updatedCount++;
          } else {
            // 새 페이지 생성
            await this.createNotionPageWithRetry(notionPage);
            createdCount++;
          }

          syncedCount++;
          syncedUserIds.push(userId);

          return { success: true, userId, action: existingNotionUser ? 'update' : 'create' };
        } catch (error) {
          failedCount++;
          failedUserIds.push(doc.id);
          console.error(`사용자 ${doc.id} 처리 실패:`, error.message);
          return { success: false, userId: doc.id, error: error.message };
        }
      });

      // 배치 결과 처리
      const batchResults = await Promise.all(batchPromises);
      const batchSuccess = batchResults.filter(r => r.success).length;
      const batchFailed = batchResults.filter(r => !r.success).length;

      console.log(`배치 완료: 성공 ${batchSuccess}명, 실패 ${batchFailed}명 (총 진행률: ${syncedCount + failedCount}/${snapshot.docs.length})`);

      // 마지막 배치가 아니면 지연
      if (i + BATCH_SIZE < snapshot.docs.length) {
        console.log(`${DELAY_MS/1000}초 대기 중...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }


    // 4. Firebase에는 없거나 사용자ID가 빈값인 노션 페이지 아카이브 처리
    const firebaseUserIds = new Set(snapshot.docs.map(doc => doc.id));
    
    // 노션의 모든 페이지 가져오기 (사용자ID가 빈값인 페이지도 포함)
    const allNotionPages = await this.getAllNotionPages(this.notionUserAccountDB);
    
    // 아카이브 대상 페이지 찾기
    const pagesToArchive = [];
    for (const page of allNotionPages) {
      const props = page.properties;
      const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text || "";
      
      // 사용자ID가 빈값이거나, 사용자ID가 있지만 Firebase에 없는 경우 아카이브 대상
      if (!userId || !firebaseUserIds.has(userId)) {
        pagesToArchive.push({
          pageId: page.id,
          userId: userId || "(사용자ID 없음)",
          reason: !userId ? "사용자ID 빈값" : "Firebase에 없음"
        });
      }
    }
    

    let archivedCount = 0;
    let archiveFailedCount = 0;
    
    if (pagesToArchive.length > 0) {
      console.log(`아카이브 대상 페이지 ${pagesToArchive.length}개 발견 (사용자ID 빈값: ${pagesToArchive.filter(p => p.reason === "사용자ID 빈값").length}개, Firebase에 없음: ${pagesToArchive.filter(p => p.reason === "Firebase에 없음").length}개)`);
      
      // 배치 처리로 아카이브
      for (let i = 0; i < pagesToArchive.length; i += BATCH_SIZE) {
        const batch = pagesToArchive.slice(i, i + BATCH_SIZE);
        console.log(`아카이브 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pagesToArchive.length / BATCH_SIZE)} 처리 중...`);
        
        await Promise.all(batch.map(async (page) => {
          try {
            await this.archiveNotionPageWithRetry(page.pageId);
            archivedCount++;
            console.log(`[아카이브 성공] 페이지 ${page.pageId} (사용자ID: ${page.userId}, 사유: ${page.reason})`);
          } catch (error) {
            archiveFailedCount++;
            console.error(`[아카이브 실패] 페이지 ${page.pageId} (사용자ID: ${page.userId}):`, error.message);
          }
        }));
        
        // 마지막 배치가 아니면 지연
        if (i + BATCH_SIZE < pagesToArchive.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
    }

    console.log(`=== 전체 동기화 완료 ===`);
    console.log(`총 ${syncedCount}명 동기화 (업데이트: ${updatedCount}명, 생성: ${createdCount}명)`);
    console.log(`실패: ${failedCount}명, 아카이브: ${archivedCount}명`);



    // 동기화 완료 후 백업 실행
    let backupResult = null;
    let backupSuccess = false;
    let backupError = null;
    try {
      console.log('동기화 완료 후 백업을 시작합니다...');
      backupResult = await this.backupNotionUserDatabase();
      backupSuccess = true;
      console.log(`백업 완료: ${backupResult.backedUp}개 페이지 백업됨 (생성: ${backupResult.created}개, 업데이트: ${backupResult.updated}개, 삭제: ${backupResult.deleted}개, 실패: ${backupResult.failed}개)`);
    } catch (error) {
      backupSuccess = false;
      backupError = error.message || '알 수 없는 오류가 발생했습니다';
      console.error('백업 실패:', error);
    }


    // 백업 결과 이력 저장 (별도 action으로 저장)
    try {
      const backupLogRef = db.collection("adminLogs").doc();
      await backupLogRef.set({
        adminId: "Notion 관리자",
        action: backupSuccess ? ADMIN_LOG_ACTIONS.NOTION_BACKUP_COMPLETED : ADMIN_LOG_ACTIONS.NOTION_BACKUP_FAILED,
        targetId: "", // 백업 작업이므로 빈 값
        timestamp: new Date(),
        metadata: backupSuccess && backupResult ? {
          syncedCount: backupResult.backedUp,
          created: backupResult.created,
          archivedCount: backupResult.deleted,
          total: backupResult.backedUp + backupResult.failed,
          failedCount: backupResult.failed,
          ...(backupResult.errors && backupResult.errors.length > 0 && { errors: backupResult.errors })
        } : {
          logMessage : backupError
        }
      });
      if (backupSuccess) {
        console.log(`[adminLogs] 백업 결과 저장 완료: 성공 (${backupResult.backedUp}개 백업)`);
      } else {
        console.log(`[adminLogs] 백업 결과 저장 완료: 실패 - ${backupError}`);
      }
    } catch (backupLogError) {
      console.error("[adminLogs] 백업 로그 저장 실패:", backupLogError);
      // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러를 throw하지 않음
    }



    try {
      const logRef = db.collection("adminLogs").doc();
      await logRef.set({
        adminId: "Notion 관리자",
        action: ADMIN_LOG_ACTIONS.USER_ALL_SYNCED,
        targetId: "",
        timestamp: new Date(),
        metadata: {
          syncedCount: syncedCount,
          failedCount: failedCount,
          archivedCount: archivedCount, //Firebase -> Notion으로 동기화 하는 경우 존재
          total: snapshot.docs.length,
          syncedUserIds: syncedUserIds,
          failedUserIds: failedUserIds,
        }
      });
      console.log(`[adminLogs] 전체 동기화 이력 저장 완료`);
    } catch (logError) {
      console.error("[adminLogs] 로그 저장 실패:", logError);
    }

    return { 
      syncedCount, 
      updatedCount, 
      createdCount, 
      archivedCount,
      failedCount, 
      total: snapshot.docs.length 
    };

  } catch (error) {
    console.error('syncAllUserAccounts 전체 오류:', error);
    throw error;
  }
}


// 재시도 로직이 포함된 Notion 페이지 업데이트
async updateNotionPageWithRetry(pageId, notionPage, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.notion.pages.update({
        page_id: pageId,
        properties: notionPage,
      });
      return; // 성공하면 종료
    } catch (error) {
      console.warn(`Notion 페이지 업데이트 시도 ${attempt}/${maxRetries} 실패 (pageId: ${pageId}):`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Notion 페이지 업데이트 최종 실패 (pageId: ${pageId}): ${error.message}`);
      }
      
      // 지수 백오프: 1초, 2초, 4초...
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`${delay/1000}초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}




// 페이지들을 배치로 아카이브 처리
async archivePagesInBatches(pages) {
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    console.log(`아카이브 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)} 처리 중...`);

    // 배치 내에서 병렬 처리
    await Promise.all(batch.map(page => this.archiveNotionPageWithRetry(page.id)));

    // 마지막 배치가 아니면 지연
    if (i + BATCH_SIZE < pages.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
}

// 재시도 로직이 포함된 Notion 페이지 생성
async createNotionPageWithRetry(notionPage, maxRetries = 3, databaseId = null) {
  const targetDatabaseId = databaseId || this.notionUserAccountDB;
  
  // notionPage가 { parent: ..., properties: ... } 형태인지 확인
  let properties, parent;
  if (notionPage.parent && notionPage.properties) {
    // 백업 메서드에서 전달한 형태
    parent = notionPage.parent;
    properties = notionPage.properties;
  } else {
    // 기존 형태 (properties만)
    parent = { database_id: targetDatabaseId };
    properties = notionPage;
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.notion.pages.create({
        parent: parent,
        properties: properties,
      });
      return; // 성공하면 종료
    } catch (error) {
      console.warn(`Notion 페이지 생성 시도 ${attempt}/${maxRetries} 실패:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Notion 페이지 생성 최종 실패: ${error.message}`);
      }
      
      // 지수 백오프: 1초, 2초, 4초...
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`${delay/1000}초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 재시도 로직이 포함된 페이지 아카이브
async archiveNotionPageWithRetry(pageId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });
      return; // 성공하면 종료
    } catch (error) {
      console.warn(`페이지 아카이브 시도 ${attempt}/${maxRetries} 실패 (pageId: ${pageId}):`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`페이지 아카이브 최종 실패 (pageId: ${pageId}): ${error.message}`);
      }
      
      // 지수 백오프
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async getAllNotionPages(databaseId) {
  let results = [];
  let hasMore = true;
  let startCursor;

  /*
  1. 첫 번째 요청: start_cursor: undefined, page_size: 100
    - 처음 100개 레코드 가져옴
    - has_more: true이면 계속 진행
  2. 두 번째 요청: start_cursor: "이전_응답의_next_cursor", page_size: 100
    - 다음 100개 레코드 가져옴
    - has_more: true이면 계속 진행
   3. 반복: has_more: false가 될 때까지 계속
   4. 완료: 모든 레코드를 results 배열에 누적하여 반환
  */
  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: startCursor,
      }),
    });

    const data = await res.json();
    results = results.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return results;
}



async syncPenaltyUsers() {
  let hasMore = true;
  let startCursor = undefined;
  let syncedCount = 0;
  let failedCount = 0;
  const syncedUserIds = []; // 동기화된 사용자 ID 목록
  const failedUserIds = []; // 동기화 실패한 사용자 ID 목록

  // 모든 페이지를 순회하며 Notion DB 전체 조회
  while (hasMore) {
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${this.notionUserAccountDB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "선택",
          checkbox: { equals: true },
        },
        page_size: 100,
        start_cursor: startCursor,
      }),
    });

    const data = await notionResponse.json();
    const pages = data.results || [];

    // 각 페이지(회원)에 대해 Firebase 업데이트
    for (const page of pages) {
      const pageId = page.id;
      const props = page.properties;

      const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text;
      if (!userId) continue;
      const userName = props["사용자 실명"]?.rich_text?.[0]?.plain_text || "";
      const penaltyReason = props["정지 사유"]?.rich_text?.[0]?.plain_text || "";
      const penaltyPeriodStart = props["자격정지 기간(시작)"]?.date?.start || "";
      const penaltyPeriodEnd = props["자격정지 기간(종료)"]?.date?.start || "";

      console.log("================================================");
      console.log("penaltyPeriodStart:", penaltyPeriodStart);
      console.log("penaltyPeriodEnd:", penaltyPeriodEnd);
      console.log("================================================");

      // 시작 값은 빈 값인데 종료 값만 있는 경우 검증
      if (!penaltyPeriodStart && penaltyPeriodEnd) {
        failedCount++;
        failedUserIds.push(userId);
        console.log("사용자 ${userName}의 자격정지 기간(시작)이 없는데 자격정지 기간(종료)이 설정되어 있습니다");
        continue;
      }

      // Firebase users 컬렉션에서 해당 사용자 찾기
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.warn(`[WARN] Firebase에 ${userId} 사용자가 존재하지 않음`);
        continue;
      }

      // Firebase 자격정지 정보 업데이트
      await userRef.update({
        suspensionReason: penaltyReason,
        suspensionStartAt: penaltyPeriodStart,
        suspensionEndAt: penaltyPeriodEnd,
      });

      // Firebase 업데이트 후 최신 데이터 가져오기
      const updatedUserDoc = await userRef.get();
      const updatedUserData = updatedUserDoc.data();

      console.log("updatedUserData:", updatedUserData);

      // 노션에 Firebase 동기화된 데이터로 업데이트
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          "자격정지 기간(시작)": {
            date: updatedUserData.suspensionStartAt ? { 
              start: updatedUserData.suspensionStartAt 
            } : null
          },
          "자격정지 기간(종료)": {
            date: updatedUserData.suspensionEndAt  ? { 
              start: updatedUserData.suspensionEndAt  
            } : null
          },
          "정지 사유": {
            rich_text: updatedUserData.suspensionReason ? [{
              text: { content: updatedUserData.suspensionReason }
            }] : []
          }
        },
      });

      syncedCount++;
      syncedUserIds.push(userId); // 동기화된 사용자 ID 저장
    }

    // 다음 페이지가 있으면 cursor 갱신
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  console.log(`자격정지 회원 전체 동기화 완료: ${syncedCount}명`);


  try {
    const logRef = db.collection("adminLogs").doc();
    await logRef.set({
      adminId: "Notion 관리자",
      action: ADMIN_LOG_ACTIONS.USER_ALL_SYNCED,
      targetId: "", // 전체 동기화 작업이므로 빈 값
      timestamp: new Date(),
      metadata: {
        syncedCount: syncedCount,
        failedCount: failedCount,
        total: syncedCount + failedCount,
        syncedUserIds: syncedUserIds, // 동기화된 사용자 ID 목록
        failedUserIds: failedUserIds, // 동기화 실패한 사용자 ID 목록
      }
    });
    console.log(`[adminLogs] 회원 동기화 이력 저장 완료: ${syncedCount}명 성공, ${failedCount}명 실패`);
  } catch (logError) {
    console.error("[adminLogs] 로그 저장 실패:", logError);
    // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러를 throw하지 않음
  }


  return { syncedCount };
}



async syncSelectedUsers() {
  let hasMore = true;
  let startCursor = undefined;
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const syncedUserIds = []; // 동기화된 사용자 ID 목록
  const failedUserIds = []; // 건너뜀한 사용자 ID 목록
  let validateErrorCount = 0; //값이 잘못된 경우

  
  // 모든 페이지를 순회하며 "선택" 필드가 체크된 데이터만 조회
  while (hasMore) {
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${this.notionUserAccountDB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "선택",
          checkbox: { equals: true },
        },
        page_size: 100,
        start_cursor: startCursor,
      }),
    });

    const data = await notionResponse.json();
    const pages = data.results || [];

    // 각 페이지(회원)에 대해 Firebase 업데이트
    for (const page of pages) {
      const pageId = page.id;
      const props = page.properties;

      const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text
      
      if (!userId) {
        console.warn(`[WARN] 사용자ID가 없는 노션 페이지: ${pageId}`);
        skippedCount++;
        failedUserIds.push(userId);
        continue;
      }

      // Firebase users 컬렉션에서 해당 사용자 찾기
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.warn(`[WARN] Firebase에 ${userId} 사용자가 존재하지 않음`);
        skippedCount++;
        failedUserIds.push(userId);
        continue;
      }

      // 노션 필드에서 데이터 추출
      const nickname = props["기본 닉네임"]?.title?.[0]?.plain_text ||  "";

      //닉네임의 경우 정책상 유일한 값
      if (nickname) {
        const duplicateSnapshot = await db
          .collection("users")
          .where("nickname", "==", nickname)
          .get();

        const conflictingDoc = duplicateSnapshot.docs.find((doc) => doc.id !== userId);

        if (conflictingDoc) {
          console.warn(
            `사용자 ${userId}의 노션 기본 닉네임(${nickname})이 다른 사용자(${conflictingDoc.id})와 중복되어 동기화를 중단합니다`
          );
          validateErrorCount++;
          failedUserIds.push(userId);
          continue;
        }
      }

      const name = props["사용자 실명"]?.rich_text?.[0]?.plain_text || "";
      
      // 프로필 사진 URL 추출 (files 타입)
      let profileImageUrl = "";
      if (props["프로필 사진"]?.files && props["프로필 사진"].files.length > 0) {
        const file = props["프로필 사진"].files[0];
        profileImageUrl = file.external?.url || file.file?.url || "";
      }

      const phoneNumber = props["전화번호"]?.rich_text?.[0]?.plain_text || "";
      const birthDate = props["생년월일"]?.rich_text?.[0]?.plain_text || 
                        (props["생년월일"]?.number ? String(props["생년월일"].number) : "");
      const email = props["이메일"]?.rich_text?.[0]?.plain_text || "";

      // 날짜 필드 추출
      const createdAtDate = props["가입완료 일시"]?.date?.start || null;
      const lastLoginDate = props["최근 앱 활동 일시"]?.date?.start || 
                           props["앱 첫 로그인"]?.date?.start || null;

      // 가입 방법 매핑
      const authTypeSelect = props["가입 방법"]?.select?.name || "";


      // Push 광고 수신 여부
      const pushAgreeSelect = props["Push 광고 수신 여부"]?.select?.name || "";
      let pushTermsAgreed = undefined;
      if (pushAgreeSelect === "동의" || pushAgreeSelect === "true") {
        pushTermsAgreed = true;
      } else if (pushAgreeSelect === "거부" || pushAgreeSelect === "false") {
        pushTermsAgreed = false;
      }

      // 이벤트 및 홍보 동의
      const marketingTermsSelect = props["이벤트 및 홍보 동의"]?.select?.name || "";
      const marketingTermsAgreed = marketingTermsSelect === "동의" ? true : false;

      // 성별 매핑
      const genderSelect = props["성별"]?.select?.name || "";
      let gender = undefined;
      if (genderSelect === "남자" || genderSelect === "남성" || genderSelect === "male") {
        gender = "male";
      } else if (genderSelect === "여자" || genderSelect === "여성" || genderSelect === "female") {
        gender = "female";
      }

      // 자격정지 관련 필드
      const suspensionStartAt = props["자격정지 기간(시작)"]?.date?.start || null;
      const suspensionEndAt = props["자격정지 기간(종료)"]?.date?.start || null;
      const suspensionReason = props["정지 사유"]?.rich_text?.[0]?.plain_text || "";

      // 패널티 카운트 필드 추출 (number 타입)
      const penaltyCount = props["패널티 카운트"]?.number ?? 0;

      // 관리자 타입 체크박스 필드 추출
      const isAdminChecked = props["관리자 타입"]?.checkbox || false;
      const userType = isAdminChecked ? "admin" : "user";
      
      // 업데이트할 데이터 객체 생성 (undefined가 아닌 값만 업데이트)
      const updateData = {};
      
      if (nickname) updateData.nickname = nickname;
      if (name) updateData.name = name;
      if (profileImageUrl) updateData.profileImageUrl = profileImageUrl;
      if (phoneNumber) updateData.phoneNumber = phoneNumber;
      if (birthDate) updateData.birthDate = birthDate;
      if (email) updateData.email = email;
      if (pushTermsAgreed !== undefined) updateData.pushTermsAgreed = pushTermsAgreed;
      if (gender) updateData.gender = gender;

      // 이벤트 및 홍보 동의 필드 처리
      updateData.marketingTermsAgreed = marketingTermsAgreed;
      
      // 날짜 필드 처리
      if (createdAtDate) {
        updateData.createdAt = createdAtDate;
      }
      if (lastLoginDate) {
        updateData.lastLoginAt = lastLoginDate;
      }

      // 자격정지 필드 처리 - 값이 없어도 명시적으로 null/빈 문자열로 저장
      updateData.suspensionReason = suspensionReason || "";
      updateData.suspensionStartAt = suspensionStartAt || null;
      updateData.suspensionEndAt = suspensionEndAt || null;


      if(!suspensionStartAt && !suspensionEndAt && suspensionReason){
        console.warn(`사용자 ${name}의 자격정지 기간(시작)과 자격정지 기간(종료)가 없는데 정지 사유가 설정되어 있습니다`);
        validateErrorCount++;
        failedUserIds.push(userId);
        continue;
      }

      // lastUpdated 업데이트 (lastUpdated : 노션 동기화 시간, lastUpdatedAt : PWA에서 갱신한 시간)
      const now = new Date();
      updateData.lastUpdated = now;

      // 자격정지 시작날짜만 존재하고 종료날짜가 없는 경우
      if (suspensionStartAt && !suspensionEndAt) {
        console.warn(
          `사용자 ${name}의 자격정지 기간(시작)만 있고 종료가 없습니다. 당일 자격정지를 원하면 종료 날짜를 시작 날짜와 동일하게 입력해 주세요.`
        );
        validateErrorCount++;
        failedUserIds.push(userId);
        continue;
      }

      // 시작 값은 빈 값인데 종료 값만 있는 경우 검증
      if (!suspensionStartAt && suspensionEndAt) {
          const endDate = new Date(suspensionEndAt);
          const isPermanentSuspension = endDate.getFullYear() === 9999 && 
                                      endDate.getMonth() === 11 && // 12월은 11 (0부터 시작)
                                      endDate.getDate() === 31;
                                      
          if (!isPermanentSuspension) {
              console.warn(`사용자 ${name}의 자격정지 기간(시작)이 없는데 자격정지 기간(종료)이 설정되어 있습니다`);
              validateErrorCount++;
              failedUserIds.push(userId);
              continue;
          }
                                     
      }

      
      // 자격정지 관련 유효성 검사를 통과한 경우: suspensionStartAt/suspensionEndAt 비교 및 penaltyCount 처리
      const userData = userDoc.data();
      const existingSuspensionStartAt = userData.suspensionStartAt || null;
      const existingSuspensionEndAt = userData.suspensionEndAt || null;
      const existingPenaltyCount = userData.penaltyCount || 0;
      

      // suspensionStartAt과 suspensionEndAt에 모두 값이 있거나, suspensionEndAt에만 값이 있는 경우
      if ((suspensionStartAt && suspensionEndAt) || (!suspensionStartAt && suspensionEndAt)) {
        // 기존 값과 비교
        const isStartAtChanged = suspensionStartAt !== existingSuspensionStartAt;
        const isEndAtChanged = suspensionEndAt !== existingSuspensionEndAt;

        if (isStartAtChanged || isEndAtChanged) {
          // 다른 값이면 신고 카운트 1 증가
          updateData.penaltyCount = existingPenaltyCount + 1;
          console.log(`[패널티 카운트 증가] 사용자 ${userId} (${name || nickname}): ${existingPenaltyCount} -> ${updateData.penaltyCount}`);
        } else {
          // 같은 값이면 신고 카운트 증가 없이 노션의 신고 카운트 값 적용
          if (penaltyCount !== null) {
            updateData.penaltyCount = penaltyCount;
          }
        }
      } else {
        // suspensionStartAt과 suspensionEndAt이 모두 없는 경우, 노션의 신고 카운트 값만 적용
        if (penaltyCount !== null) {
          updateData.penaltyCount = penaltyCount;
        }
      }

      // userType 설정 (관리자 타입 체크박스에 따라)
      updateData.userType = userType;

      // Firebase 업데이트 실행
      await userRef.update(updateData);

      console.log(`[SUCCESS] ${userId} (${name || nickname}) 업데이트 완료`);

       // Firebase에서 업데이트된 최신 데이터 가져오기
       const updatedUserDoc = await userRef.get();
       const updatedUserData = updatedUserDoc.data();
 
       // 날짜 변환
       const createdAtIso = safeDateToIso(updatedUserData.createdAt);
       const lastLoginIso = safeDateToIso(updatedUserData.lastLoginAt);
       const lastUpdatedIso = new Date();

      const notionPageUpdate = {
        '기본 닉네임': { title: [{ text: { content: updatedUserData.nickname || "" } }] },
        "프로필 사진": {
          files: [
            {
              name: "profile-image",
              type: "external",
              external: { url: updatedUserData.profileImageUrl || DEFAULT_PROFILE_AVATAR_URL },
            },
          ],
        },
        "사용자ID": { rich_text: [{ text: { content: userId } }] },
        "사용자 실명": { rich_text: [{ text: { content: updatedUserData.name || "" } }] },
        // "상태": {
        //   select: {
        //     name: (updatedUserData.deletedAt !== undefined && updatedUserData.deletedAt !== null && updatedUserData.deletedAt !== "") 
        //       ? "탈퇴" 
        //       : "가입"
        //   }
        // },
        "전화번호": { rich_text: [{ text: { content: updatedUserData.phoneNumber || "" } }] },
        "생년월일": { rich_text: [{ text: { content: updatedUserData.birthDate || "" } }] },
        "이메일": { rich_text: [{ text: { content: updatedUserData.email || "" } }] },
        "가입완료 일시": createdAtIso ? { date: { start: createdAtIso } } : undefined,
        //"가입 방법": { select: { name: updatedUserData.authType || "email" } },
        "앱 첫 로그인": createdAtIso ? { date: { start: createdAtIso } } : undefined,
        "최근 앱 활동 일시": lastLoginIso ? { date: { start: lastLoginIso } } : undefined,
        "유입경로": { rich_text: [{ text: { content: updatedUserData.utmSource || "" } }] },
        "성별": { 
          select: { 
            name: 
              updatedUserData.gender === 'male' ? "남성" : updatedUserData.gender === 'female' ? "여성" : "미선택",
          } 
        },
        "Push 광고 수신 여부": {
          select: {
            name:
              updatedUserData.pushTermsAgreed === true
                ? "동의"
                : updatedUserData.pushTermsAgreed === false
                ? "거부"
                : "미설정",
          },
        },
        "자격정지 기간(시작)": updatedUserData.suspensionStartAt ? {
          date: { 
            start: updatedUserData.suspensionStartAt 
          }
        } : { date: null },
        "자격정지 기간(종료)": updatedUserData.suspensionEndAt ? {
          date: { 
            start: updatedUserData.suspensionEndAt 
          }
        } : { date: null },
        "정지 사유": updatedUserData.suspensionReason ? {
          rich_text: [{
            text: { content: updatedUserData.suspensionReason }
          }]
        } : {
          rich_text: []
        },
        "패널티 카운트": {
          number: (updatedUserData.penaltyCount !== null && updatedUserData.penaltyCount !== undefined) ? updatedUserData.penaltyCount : 0
        },
        "선택": {
          checkbox: false
        },
         "동기화 시간": { 
            date: { start: lastUpdatedIso.toISOString() } 
        },
        "관리자 타입": {
                checkbox: updatedUserData.userType === "admin"
        },
      };

      // 노션 페이지 업데이트 (Firebase의 최신 데이터로)
      try {
        await this.updateNotionPageWithRetry(pageId, notionPageUpdate);
        console.log(`[SUCCESS] ${userId} (${name || nickname}) 노션 동기화 완료`);
      } catch (notionUpdateError) {
        console.warn(`[WARN] 노션 페이지 ${pageId} 업데이트 실패:`, notionUpdateError.message);
      }

      syncedCount++;
      syncedUserIds.push(userId); // 동기화된 사용자 ID 저장
    }

    // 다음 페이지가 있으면 cursor 갱신
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  console.log(`선택된 회원 동기화 완료: ${syncedCount}명 업데이트, ${skippedCount}명 건너뜀, 잘못된 값: ${validateErrorCount}`);
 
  
  try {
    const logRef = db.collection("adminLogs").doc();
    await logRef.set({
      adminId: "Notion 관리자",
      action: ADMIN_LOG_ACTIONS.USER_ALL_SYNCED,
      targetId: "", // 전체 동기화 작업이므로 빈 값
      timestamp: new Date(),
      metadata: {
        syncedCount: syncedCount,
        failedCount: skippedCount + validateErrorCount,
        total: syncedCount + skippedCount + validateErrorCount,
        syncedUserIds: syncedUserIds, // 동기화된 사용자 ID 목록
        failedUserIds: failedUserIds, // 동기화 실패한 사용자 ID 목록
      }
    });
    console.log(`[adminLogs] 회원 동기화 이력 저장 완료: ${syncedCount}명 성공, ${failedCount}명 실패`);
  } catch (logError) {
    console.error("[adminLogs] 로그 저장 실패:", logError);
    // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러를 throw하지 않음
  }
 
 
  return { syncedCount, skippedCount, validateErrorCount };
}



  /**
   * 노션 데이터베이스 전체 백업
   * notionUserAccountDB의 모든 데이터를 notionUserAccountBackupDB에 복제
   * @return {Promise<{backedUp: number, failed: number, errors?: Array}>}
   */
  async backupNotionUserDatabase() {
    try {
      console.log('=== 노션 사용자 데이터베이스 백업 시작 ===');

      // 백업 시작 시점의 시간 기록
      const backupTimestamp = new Date().toISOString();
      
      // 1. 원본 데이터베이스의 모든 페이지 가져오기
      const sourcePages = await this.getAllNotionPages(this.notionUserAccountDB);
      console.log(`원본 데이터베이스에서 ${sourcePages.length}개의 페이지를 가져왔습니다.`);

      if (sourcePages.length === 0) {
        console.log('백업할 페이지가 없습니다.');
        return { backedUp: 0, failed: 0 };
      }

      // 2. 백업 데이터베이스의 기존 페이지 조회 (사용자ID 기준)
      const backupUsers = await this.getNotionUsers(this.notionUserAccountBackupDB);
      console.log(`백업 데이터베이스에 기존 ${Object.keys(backupUsers).length}개의 페이지가 있습니다.`);

       // 원본에 있는 사용자ID Set 생성
       const sourceUserIds = new Set();
       for (const page of sourcePages) {
         const userId = page.properties["사용자ID"]?.rich_text?.[0]?.plain_text || null;
         if (userId) {
           sourceUserIds.add(userId);
         }
       }

      let backedUpCount = 0;
      let updatedCount = 0;
      let createdCount = 0;
      let failedCount = 0;
      let deletedCount = 0;
      const errors = [];

      // 3. 배치 처리로 백업
      for (let i = 0; i < sourcePages.length; i += BATCH_SIZE) {
        const batch = sourcePages.slice(i, i + BATCH_SIZE);
        console.log(`백업 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sourcePages.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, sourcePages.length)}번째)`);

        const batchPromises = batch.map(async (sourcePage) => {
          try {
            const sourceProps = sourcePage.properties;
            const userId = sourceProps["사용자ID"]?.rich_text?.[0]?.plain_text || null;

            // properties 복사 (모든 필드 복제)
            const backupProperties = {};

            // 읽기 전용 타입 목록 (페이지 생성/업데이트 시 설정 불가)
            const readOnlyTypes = ['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by'];
            
            
            // 각 필드 타입별로 복사
            for (const [key, value] of Object.entries(sourceProps)) {
              if (key === "선택") continue; // 선택 필드는 백업하지 않음

               // value가 유효한지 확인
               if (!value || !value.type) {
                console.warn(`[WARN] 필드 ${key}의 값이 유효하지 않습니다. 건너뜁니다.`);
                continue;
              }

              // 읽기 전용 타입은 백업에서 제외
              if (readOnlyTypes.includes(value.type)) {
                continue;
              }
              
              // Notion API 형식 그대로 복사
              if (value.type === "title") {
                backupProperties[key] = { title: value.title || [] };
              } else if (value.type === "rich_text") {
                backupProperties[key] = { rich_text: value.rich_text || [] };
              } 
              else if (value.type === "select") {
                // select 필드는 name만 사용 (id는 제외)
                if (value.select && value.select.name) {
                  backupProperties[key] = { select: { name: value.select.name } };
                } else {
                  backupProperties[key] = { select: null };
                }
              } 
              else if (value.type === "date") {
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
              }
            }

             // 백업 시점의 동기화 시간 추가 (백업 DB에만 추가되는 필드)
             backupProperties["백업 시간"] = {
              date: { start: backupTimestamp }
            };

             // 백업 결과 필드 추가 (select 타입, 빈 값으로 초기화)
             backupProperties["백업 결과"] = {
              select: null
            };

            // 백업 페이지 생성 또는 업데이트
            if (userId && backupUsers[userId]) {
                // 기존 페이지 업데이트
                await this.updateNotionPageWithRetry(
                  backupUsers[userId].pageId,
                  backupProperties
                );
                updatedCount++;
               } else {
               // 새 페이지 생성
               await this.createNotionPageWithRetry({
                  parent: { database_id: this.notionUserAccountBackupDB },
                  properties: backupProperties,
               });
               createdCount++;
            }


            backedUpCount++;
            return { success: true, userId: userId || "unknown" };
          } catch (error) {
            failedCount++;
            const userId = sourcePage.properties["사용자ID"]?.rich_text?.[0]?.plain_text || "unknown";
            errors.push({
              userId,
              pageId: sourcePage.id,
              error: error.message
            });
            console.error(`[백업 실패] 페이지 ${sourcePage.id} (사용자ID: ${userId}):`, error.message);
            
            
            return { success: false, userId, error: error.message };
          }
        });

        await Promise.all(batchPromises);

        // 배치 사이 지연
        if (i + BATCH_SIZE < sourcePages.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }


      // 4. 원본에 없는데 백업 DB에만 있는 데이터 삭제
      const backupAllPages = await this.getAllNotionPages(this.notionUserAccountBackupDB);
      const pagesToDelete = [];
      
      for (const backupPage of backupAllPages) {
        const backupUserId = backupPage.properties["사용자ID"]?.rich_text?.[0]?.plain_text || null;
        
        // 사용자ID가 없거나, 원본에 없는 경우 삭제 대상
        if (!backupUserId || !sourceUserIds.has(backupUserId)) {
          pagesToDelete.push({
            pageId: backupPage.id,
            userId: backupUserId || "(사용자ID 없음)",
          });
        }
      }

      if (pagesToDelete.length > 0) {
        console.log(`원본에 없는데 백업 DB에만 있는 페이지 ${pagesToDelete.length}개 삭제 중...`);
        
        // 배치 처리로 삭제
        for (let i = 0; i < pagesToDelete.length; i += BATCH_SIZE) {
          const batch = pagesToDelete.slice(i, i + BATCH_SIZE);
          console.log(`삭제 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pagesToDelete.length / BATCH_SIZE)} 처리 중...`);
          
          await Promise.all(batch.map(async (page) => {
            try {
              await this.archiveNotionPageWithRetry(page.pageId);
              deletedCount++;
              console.log(`[삭제 성공] 페이지 ${page.pageId} (사용자ID: ${page.userId})`);
            } catch (error) {
              console.error(`[삭제 실패] 페이지 ${page.pageId} (사용자ID: ${page.userId}):`, error.message);
            }
          }));
          
          // 마지막 배치가 아니면 지연
          if (i + BATCH_SIZE < pagesToDelete.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }
        }
      }

      console.log(`=== 백업 완료 ===`);
      console.log(`총 ${backedUpCount}개 백업 (생성: ${createdCount}개, 업데이트: ${updatedCount}개, 실패: ${failedCount}개)`);

      return {
        backedUp: backedUpCount,
        created: createdCount,
        updated: updatedCount,
        failed: failedCount,
        deleted: deletedCount,
        ...(errors.length > 0 && { errors })
      };
    } catch (error) {
      console.error('백업 중 오류 발생:', error);
      throw error;
    }
  }


  /**
   * 백업 DB에서 전체 데이터를 기반으로 Firebase 업데이트
   * notionUserAccountBackupDB의 모든 데이터를 조회하여 Firebase에 업데이트
   * @return {Promise<{syncedCount: number, skippedCount: number, validateErrorCount: number}>}
   */
  async allUsersRollback() {
    let hasMore = true;
    let startCursor = undefined;
    let syncedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const syncedUserIds = [];
    const failedUserIds = [];
    let validateErrorCount = 0;

    console.log('=== 백업 DB에서 전체 회원 복원 시작 ===');

    // 1. 먼저 모든 페이지를 수집
    const allPages = [];
    while (hasMore) {
      const notionResponse = await fetch(`https://api.notion.com/v1/databases/${this.notionUserAccountBackupDB}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: startCursor,
        }),
      });

      const data = await notionResponse.json();
      const pages = data.results || [];
      allPages.push(...pages);

      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    console.log(`백업 DB에서 총 ${allPages.length}개의 페이지를 가져왔습니다.`);

    // 2. 배치로 나누어 처리
    for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
      const batch = allPages.slice(i, i + BATCH_SIZE);
      console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allPages.length / BATCH_SIZE)} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, allPages.length)}번째)`);

      // 배치 내에서 병렬 처리
      const batchPromises = batch.map(async (page) => {
        try {
          const pageId = page.id;
          const props = page.properties;

          const userId = props["사용자ID"]?.rich_text?.[0]?.plain_text;
          
          if (!userId) {
            console.warn(`[WARN] 사용자ID가 없는 노션 페이지: ${pageId}`);
            skippedCount++;
            failedUserIds.push("unknown");
            return { success: false, userId: "unknown", reason: "no_user_id" };
          }

          // Firebase users 컬렉션에서 해당 사용자 찾기
          const userRef = db.collection("users").doc(userId);
          const userDoc = await userRef.get();

          if (!userDoc.exists) {

            if (pageId) {
              try {
                await this.notion.pages.update({
                  page_id: pageId,
                  properties: {
                    "백업 결과": {
                      select: { name: "실패" }
                    }
                  }
                });
              } catch (updateError) {
                console.warn(`[WARN] 원본 페이지 ${pageId}의 백업 결과 업데이트 실패:`, updateError.message);
              }
            }


            console.warn(`[WARN] Firebase에 ${userId} 사용자가 존재하지 않음`);
            skippedCount++;
            failedUserIds.push(userId);
            return { success: false, userId, reason: "not_found_in_firebase" };
          }

          // 노션 필드에서 데이터 추출 (syncSelectedUsers와 동일한 로직)
          const nickname = props["기본 닉네임"]?.title?.[0]?.plain_text || "";
          const name = props["사용자 실명"]?.rich_text?.[0]?.plain_text || "";
          
          // 프로필 사진 URL 추출 (files 타입)
          let profileImageUrl = "";
          if (props["프로필 사진"]?.files && props["프로필 사진"].files.length > 0) {
            const file = props["프로필 사진"].files[0];
            profileImageUrl = file.external?.url || file.file?.url || "";
          }

          const phoneNumber = props["전화번호"]?.rich_text?.[0]?.plain_text || "";
          const birthDate = props["생년월일"]?.rich_text?.[0]?.plain_text || 
                            (props["생년월일"]?.number ? String(props["생년월일"].number) : "");
          const email = props["이메일"]?.rich_text?.[0]?.plain_text || "";

          // 날짜 필드 추출
          const createdAtDate = props["가입완료 일시"]?.date?.start || null;
          const lastLoginDate = props["최근 앱 활동 일시"]?.date?.start || 
                               props["앱 첫 로그인"]?.date?.start || null;

          // 가입 방법 매핑
          //const authTypeSelect = props["가입 방법"]?.select?.name || "";

          // Push 광고 수신 여부
          const pushAgreeSelect = props["Push 광고 수신 여부"]?.select?.name || "";
          let pushTermsAgreed = undefined;
          if (pushAgreeSelect === "동의" || pushAgreeSelect === "true") {
            pushTermsAgreed = true;
          } else if (pushAgreeSelect === "거부" || pushAgreeSelect === "false") {
            pushTermsAgreed = false;
          }

          // 이벤트 및 홍보 동의
          const marketingTermsSelect = props["이벤트 및 홍보 동의"]?.select?.name || "";
          const marketingTermsAgreed = marketingTermsSelect === "동의" ? true : false;

          // 성별 매핑
          const genderSelect = props["성별"]?.select?.name || "";
          let gender = undefined;
          if (genderSelect === "남자" || genderSelect === "남성" || genderSelect === "male") {
            gender = "male";
          } else if (genderSelect === "여자" || genderSelect === "여성" || genderSelect === "female") {
            gender = "female";
          }else{
            gender = "unknown";
          }

          // 자격정지 관련 필드
          const suspensionStartAt = props["자격정지 기간(시작)"]?.date?.start || null;
          const suspensionEndAt = props["자격정지 기간(종료)"]?.date?.start || null;
          const suspensionReason = props["정지 사유"]?.rich_text?.[0]?.plain_text || "";

          // 패널티 카운트 필드 추출 (number 타입)
          const penaltyCount = props["패널티 카운트"]?.number ?? null;

          // 관리자 타입 체크박스 필드 추출
          const isAdminChecked = props["관리자 타입"]?.checkbox || false;
          const userType = isAdminChecked ? "admin" : "user";

          // 업데이트할 데이터 객체 생성
          const updateData = {};
          
          if (nickname) updateData.nickname = nickname;
          if (name) updateData.name = name;
          if (profileImageUrl) updateData.profileImageUrl = profileImageUrl;
          if (phoneNumber) updateData.phoneNumber = phoneNumber;
          if (birthDate) updateData.birthDate = birthDate;
          if (email) updateData.email = email;
          if (pushTermsAgreed !== undefined) updateData.pushTermsAgreed = pushTermsAgreed;
          if (gender) updateData.gender = gender;

          // 이벤트 및 홍보 동의 필드 처리
          updateData.marketingTermsAgreed = marketingTermsAgreed;
          
          // 날짜 필드 처리
          if (createdAtDate) {
            updateData.createdAt = createdAtDate;
          }
          if (lastLoginDate) {
            updateData.lastLoginAt = lastLoginDate;
          }

          // 자격정지 필드 처리 - 값이 없어도 명시적으로 null/빈 문자열로 저장
         updateData.suspensionReason = suspensionReason || "";
         updateData.suspensionStartAt = suspensionStartAt || null;
         updateData.suspensionEndAt = suspensionEndAt || null;

          // 패널티 카운트 필드 처리 (null이 아니면 적용, null이면 0으로 설정)
          if (penaltyCount !== null && penaltyCount !== undefined) {
            updateData.penaltyCount = penaltyCount;
          } else {
            updateData.penaltyCount = 0;
          }

          // lastUpdated 업데이트
          const now = new Date();
          updateData.lastUpdated = now;

          // adminType 설정 (관리자 타입 체크박스에 따라)
          updateData.userType = userType;

          if(!suspensionStartAt && !suspensionEndAt && suspensionReason){
            console.warn(`사용자 ${name}의 자격정지 기간(시작)과 자격정지 기간(종료)가 없는데 정지 사유가 설정되어 있습니다`);
            validateErrorCount++;
            failedUserIds.push(userId);

            if (pageId) {
              try {
                await this.notion.pages.update({
                  page_id: pageId,
                  properties: {
                    "백업 결과": {
                      select: { name: "실패" }
                    }
                  }
                });
              } catch (updateError) {
                console.warn(`[WARN] 원본 페이지 ${pageId}의 백업 결과 업데이트 실패:`, updateError.message);
              }
            }
            return { success: false, userId, reason: "validation_error" };
          }

          // 자격정지 시작날짜만 존재하고 종료날짜가 없는 경우
          if (suspensionStartAt && !suspensionEndAt) {
            console.warn(
              `사용자 ${name}의 자격정지 기간(시작)만 있고 종료가 없습니다. 당일 자격정지를 원하면 종료 날짜를 시작 날짜와 동일하게 입력해 주세요.`
            );
            validateErrorCount++;
            failedUserIds.push(userId);

            if (pageId) {
              try {
                await this.notion.pages.update({
                  page_id: pageId,
                  properties: {
                    "백업 결과": {
                      select: { name: "실패" }
                    }
                  }
                });
              } catch (updateError) {
                console.warn(
                  `[WARN] 원본 페이지 ${pageId}의 백업 결과 업데이트 실패:`,
                  updateError.message
                );
              }
            }

            return { success: false, userId, reason: "validation_error" };
          }

          // 자격정지 기간 검증
          if (!suspensionStartAt && suspensionEndAt) {
            const endDate = new Date(suspensionEndAt);
            const isPermanentSuspension = endDate.getFullYear() === 9999 && 
                                         endDate.getMonth() === 11 &&
                                         endDate.getDate() === 31;
                                                  
            if (!isPermanentSuspension) {
              console.warn(`사용자 ${name}의 자격정지 기간(시작)이 없는데 자격정지 기간(종료)이 설정되어 있습니다`);
              validateErrorCount++;
              failedUserIds.push(userId);


              if (pageId) {
                try {
                  await this.notion.pages.update({
                    page_id: pageId,
                    properties: {
                      "백업 결과": {
                        select: { name: "실패" }
                      }
                    }
                  });
                } catch (updateError) {
                  console.warn(`[WARN] 원본 페이지 ${pageId}의 백업 결과 업데이트 실패:`, updateError.message);
                }
              }

              return { success: false, userId, reason: "validation_error" };
            }
          }

          // Firebase 업데이트 실행
          await userRef.update(updateData);


          if (pageId) {
            try {
              await this.notion.pages.update({
                page_id: pageId,
                properties: {
                  "백업 결과": {
                    select: { name: "성공" }
                  }
                }
              });
            } catch (updateError) {
              console.warn(`[WARN] 원본 페이지 ${pageId}의 백업 결과 업데이트 실패:`, updateError.message);
            }
          }

          syncedCount++;
          syncedUserIds.push(userId);

          return { success: true, userId };
        } catch (error) {
          failedCount++;
          const userId = page.properties["사용자ID"]?.rich_text?.[0]?.plain_text || "unknown";
          failedUserIds.push(userId);
          console.error(`사용자 ${userId} 처리 실패:`, error.message);
          return { success: false, userId, error: error.message };
        }
      });

      // 배치 결과 처리
      const batchResults = await Promise.all(batchPromises);
      const batchSuccess = batchResults.filter(r => r.success).length;
      const batchFailed = batchResults.filter(r => !r.success).length;

      console.log(`배치 완료: 성공 ${batchSuccess}명, 실패 ${batchFailed}명 (총 진행률: ${syncedCount + skippedCount + validateErrorCount + failedCount}/${allPages.length})`);

      // 마지막 배치가 아니면 지연
      if (i + BATCH_SIZE < allPages.length) {
        console.log(`${DELAY_MS/1000}초 대기 중...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(`백업 DB에서 전체 회원 복원 완료: ${syncedCount}명 업데이트, ${skippedCount}명 건너뜀, 잘못된 값: ${validateErrorCount}`);

    try {
      const logRef = db.collection("adminLogs").doc();
      await logRef.set({
        adminId: "Notion 관리자",
        action: ADMIN_LOG_ACTIONS.USER_ALL_SYNCED,
        targetId: "",
        timestamp: new Date(),
        metadata: {
          syncedCount: syncedCount,
          failedCount: skippedCount + validateErrorCount,
          total: syncedCount + skippedCount + validateErrorCount,
          syncedUserIds: syncedUserIds,
          failedUserIds: failedUserIds,
        }
      });
      console.log(`[adminLogs] 백업 DB 복원 이력 저장 완료: ${syncedCount}명 성공, ${skippedCount + validateErrorCount}명 실패`);
    } catch (logError) {
      console.error("[adminLogs] 로그 저장 실패:", logError);
    }

    return { syncedCount, skippedCount, validateErrorCount };
  }



/**
   * 테스트 사용자 대량 생성
   * @param {number} count - 생성할 사용자 수
   * @return {Promise<{created: number, failed: number, users: Array, errors?: Array}>}
   */
async createTestUsers(count) {
  if (!count || count < 1 || count > 100) {
    const e = new Error("생성할 사용자 수는 1~100 사이여야 합니다");
    e.code = "BAD_REQUEST";
    throw e;
  }

  const createdUsers = [];
  const errors = [];

  for (let i = 0; i < count; i++) {
    try {
      // UUID v4 생성
      const uuid = crypto.randomUUID();
      const uid = `dev-user-${uuid}`;
      const email = `${uid}@dev.example.com`;

      // Firebase Auth 사용자 생성
      const userRecord = await admin.auth().createUser({
        uid: uid,
        email: email,
        displayName: `Dev User ${uuid}`,
        emailVerified: true
      });

      createdUsers.push({
        uid: uid,
        email: email,
        displayName: userRecord.displayName
      });

      // Auth Trigger가 Firestore 문서를 생성할 시간을 주기 위해 약간의 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      errors.push({
        index: i,
        error: error.message
      });
      console.error(`사용자 ${i + 1}번 생성 실패:`, error.message);
    }
  }

  return {
    created: createdUsers.length,
    failed: errors.length,
    users: createdUsers,
    ...(errors.length > 0 && { errors })
  };
}


/**
   * 특정 사용자만 Notion에 동기화
   * @param {string} userId - 동기화할 사용자 ID
   * @return {Promise<{success: boolean, userId: string}>}
   */
async syncSingleUserToNotion(userId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      console.warn(`[동기화 건너뜀] 사용자 ${userId}가 Firebase에 존재하지 않음`);
      return { success: false, userId, reason: 'not_found' };
    }

    const user = userDoc.data();
    const now = new Date();

    // 현재 노션에 있는 사용자 목록 가져오기 (ID와 lastUpdated 매핑)
    const notionUsers = await this.getNotionUsers(this.notionUserAccountDB);

    // 날짜 변환
    const createdAtIso = safeDateToIso(user.createdAt);
    const lastLoginIso = safeDateToIso(user.lastLoginAt);
    const lastUpdatedIso = now;

    // fcmTokens 서브컬렉션에서 Push 광고 수신 여부 확인
    const pushAdvertisingStatus = await this.getPushAdvertisingStatusFromFcmTokens(userId);

    // 노션 페이지 데이터 구성
    const notionPage = {
      '기본 닉네임': { title: [{ text: { content: user.nickname || "" } }] },
      "프로필 사진": {
        files: [
          {
            name: "profile-image",
            type: "external",
            external: { url: user.profileImageUrl || DEFAULT_PROFILE_AVATAR_URL },
          },
        ],
      },
      "사용자ID": { rich_text: [{ text: { content: userId } }] },
      "사용자 실명": { rich_text: [{ text: { content: user.name || "" } }] },
      // "상태": {
      //   select: {
      //     name: (user.deletedAt !== undefined && user.deletedAt !== null && user.deletedAt !== "") 
      //       ? "탈퇴" 
      //       : "가입"
      //   }
      // },
      "전화번호": { rich_text: [{ text: { content: user.phoneNumber || "" } }] },
      "생년월일": { rich_text: [{ text: { content: user.birthDate || "" } }] },
      "이메일": { rich_text: [{ text: { content: user.email || "" } }] },
      "가입완료 일시": createdAtIso ? { date: { start: createdAtIso } } : undefined,
      //"가입 방법": { select: { name: user.authType || "email" } },
      "앱 첫 로그인": createdAtIso ? { date: { start: createdAtIso } } : undefined,
      "최근 앱 활동 일시": lastLoginIso ? { date: { start: lastLoginIso } } : undefined,
      "유입경로": { rich_text: [{ text: { content: user.utmSource || "" } }] },
      "성별": { 
        select: { 
          name: 
            user.gender === 'male' ? "남성" : user.gender === 'female' ? "여성" : "미선택",
        } 
      },
      "Push 광고 수신 여부": {
        select: {
          name: pushAdvertisingStatus,
        },
      },
      "자격정지 기간(시작)": user.suspensionStartAt ? {
        date: { 
          start: user.suspensionStartAt 
        }
      } : { date: null },
      "자격정지 기간(종료)": user.suspensionEndAt ? {
        date: { 
          start: user.suspensionEndAt 
        }
      } : { date: null },
      "정지 사유": user.suspensionReason ? {
        rich_text: [{
          text: { content: user.suspensionReason }
        }]
      } : {
        rich_text: []
      },
      "동기화 시간": { date: { start: lastUpdatedIso.toISOString() } },
      "관리자 타입": {
        checkbox: false
      },
    };

    // Upsert: 기존 페이지가 있으면 업데이트, 없으면 생성
    if (notionUsers[userId]) {
      // 기존 페이지 업데이트
      await this.updateNotionPageWithRetry(notionUsers[userId].pageId, notionPage);
      console.log(`[Notion 동기화] 사용자 ${userId} 업데이트 완료`);
    } else {
      // 새 페이지 생성
      await this.createNotionPageWithRetry(notionPage);
      console.log(`[Notion 동기화] 사용자 ${userId} 생성 완료`);
    }

    // Firebase lastUpdated 업데이트
    await db.collection("users").doc(userId).update({
      lastUpdated: lastUpdatedIso,
      userType: "user",
    });

    return { success: true, userId };
  } catch (error) {
    console.error(`[Notion 동기화 실패] 사용자 ${userId}:`, error.message || error);
    return { success: false, userId, error: error.message };
  }
}





}


function safeDateToIso(dateValue) {
  if (!dateValue) return null;

  let date;
  if (typeof dateValue === "object" && dateValue.seconds) {
    // Firestore Timestamp 객체 처리
    date = new Date(dateValue.seconds * 1000);
  } else {
    // 문자열 혹은 숫자형 처리
    date = new Date(dateValue);
  }

  if (isNaN(date.getTime())) {
    console.warn("잘못된 날짜 값:", dateValue);
    return null;
  }

  return date.toISOString();
}


function safeTimestampToDate(value) {
  if (!value) return null;

  try {
    // Firestore Timestamp인 경우
    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    // 객체 형태의 Timestamp (예: { seconds, nanoseconds })
    if (typeof value === "object" && value.seconds) {
      return new Date(value.seconds * 1000);
    }

    // 문자열 또는 숫자형인 경우
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;

  } catch (e) {
    console.warn("Invalid date format:", value);
  }

  return null;
}


module.exports = new NotionUserService();