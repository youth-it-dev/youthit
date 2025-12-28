const {FieldValue} = require("firebase-admin/firestore");
const FirestoreService = require("./firestoreService");
const {Client} = require("@notionhq/client");
const {
  getTitleValue,
  getTextContent,
  getCheckboxValue,
  getNumberValue,
  getFileUrls,
  getRelationValues,
  getRollupValues,
  getPhoneNumberValue,
  formatNotionBlocks,
  getCoverImageUrl,
} = require("../utils/notionHelper");

// 상수 정의
const NOTION_VERSION = process.env.NOTION_VERSION || "2025-09-03";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

// Notion 스토어 구매신청 DB ID
const STORE_PURCHASE_DB_ID = process.env.NOTION_STORE_PURCHASE_DB_ID;

// page_size 검증 및 클램프 함수
function normalizePageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(num)));
}

// 에러 코드 정의
const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_NOTION_API_KEY",
  MISSING_DB_ID: "MISSING_NOTION_DB_ID",
  NOTION_API_ERROR: "NOTION_API_ERROR",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  INVALID_PAGE_SIZE: "INVALID_PAGE_SIZE",
};

// Notion 필드명 상수
const NOTION_FIELDS = {
  NAME: "이름",
  DESCRIPTION: "설명",
  THUMBNAIL: "썸네일",
  REQUIRED_POINTS: "필요한 나다움",
  ON_SALE: "판매 여부",
};

// Notion 스토어 구매신청 필드명 상수
const PURCHASE_FIELDS = {
  TITLE: "제목", // title 타입
  ORDERER_ID: "주문자 ID", // rich_text 타입으로 변경됨
  ORDERER_NICKNAME: "주문자 기본 닉네임",
  PRODUCT_NAME: "주문한 상품명",
  QUANTITY: "개수",
  RECIPIENT_NAME: "수령인 이름",
  RECIPIENT_PHONE: "수령인 전화번호",
  DELIVERY_COMPLETED: "지급 완료 여부",
  ORDER_DATE: "주문 완료 일시",
  REQUIRED_POINTS_ROLLUP: "필요한 나다움", // rollup 타입
  PRODUCT_IMAGE_ROLLUP: "상품 이미지", // rollup 타입
};

/**
 * Store Service (비즈니스 로직 계층)
 * Notion 기반 상품 조회 + Firestore 기반 구매/좋아요/QnA 처리
 */
class StoreService {
  constructor() {
    this.firestoreService = new FirestoreService("products");

    // Notion 클라이언트 초기화
    const {NOTION_API_KEY, NOTION_STORE_DB_ID} = process.env;

    if (NOTION_API_KEY && NOTION_STORE_DB_ID) {
      this.notion = new Client({
        auth: NOTION_API_KEY,
        notionVersion: NOTION_VERSION,
      });
      this.storeDataSource = NOTION_STORE_DB_ID;
    } else {
      console.warn("[StoreService] Notion 환경변수가 설정되지 않았습니다. Notion 기능이 비활성화됩니다.");
    }
  }

  /**
   * 상품 목록 조회 (Notion 기반)
   * @param {Object} filters - 필터 조건
   * @param {boolean} [filters.onSale] - 판매 여부 필터
   * @param {number} [pageSize=20] - 페이지 크기 (1-100)
   * @param {string} [startCursor] - 페이지네이션 커서
   * @return {Promise<Object>} 상품 목록
   */
  async getProducts(filters = {}, pageSize = DEFAULT_PAGE_SIZE, startCursor = null) {
    try {
      if (!this.notion || !this.storeDataSource) {
        const error = new Error("Notion이 설정되지 않았습니다.");
        error.code = ERROR_CODES.MISSING_API_KEY;
        error.statusCode = 500;
        throw error;
      }

      const queryBody = {
        page_size: normalizePageSize(pageSize),
        sorts: [
          {
            timestamp: "last_edited_time",
            direction: "descending",
          },
        ],
      };

      // 판매 여부 필터 추가
      if (filters.onSale !== undefined && filters.onSale !== null) {
        queryBody.filter = {
          property: NOTION_FIELDS.ON_SALE,
          checkbox: {
            equals: filters.onSale,
          },
        };
      }

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      const data = await this.notion.dataSources.query({
        data_source_id: this.storeDataSource,
        ...queryBody,
      });

      const products = data.results.map((page) => this.formatProductData(page));

      return {
        products,
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
        currentPageCount: data.results.length,
      };
    } catch (error) {
      console.error("[StoreService] 상품 목록 조회 오류:", error.message);

      if (error.code === "object_not_found") {
        const notFoundError = new Error("스토어 데이터 소스를 찾을 수 없습니다.");
        notFoundError.code = ERROR_CODES.MISSING_DB_ID;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      if (error.code === "rate_limited") {
        const rateLimitError = new Error("Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
        rateLimitError.code = "RATE_LIMITED";
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }

      const serviceError = new Error(`상품 목록 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      throw serviceError;
    }
  }

  /**
   * 상품 상세 조회 (Notion 기반 - 페이지 내용 포함)
   * @param {string} productId - 상품 ID (Notion 페이지 ID)
   * @return {Promise<Object>} 상품 상세 정보
   */
  async getProductById(productId) {
    try {
      if (!this.notion || !this.storeDataSource) {
        const error = new Error("Notion이 설정되지 않았습니다.");
        error.code = ERROR_CODES.MISSING_API_KEY;
        error.statusCode = 500;
        throw error;
      }

      // 상품 페이지 정보 조회
      const page = await this.notion.pages.retrieve({
        page_id: productId,
      });

      const productData = this.formatProductData(page, true);

      // 상품 페이지 블록 내용 조회
      const pageBlocks = await this.getProductPageBlocks(productId);
      productData.pageContent = pageBlocks;

      return productData;
    } catch (error) {
      console.error("[StoreService] 상품 상세 조회 오류:", error.message);

      if (error.code === "object_not_found") {
        const notFoundError = new Error("해당 상품을 찾을 수 없습니다.");
        notFoundError.code = ERROR_CODES.PRODUCT_NOT_FOUND;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      if (error.code === "rate_limited") {
        const rateLimitError = new Error("Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
        rateLimitError.code = "RATE_LIMITED";
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }

      const serviceError = new Error(`상품 상세 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      throw serviceError;
    }
  }

  /**
   * 상품 페이지 블록 내용 조회 (페이지네이션 처리)
   * @param {string} productId - 상품 ID
   * @return {Promise<Array>} 페이지 블록 내용
   */
  async getProductPageBlocks(productId) {
    try {
      const blocks = [];
      let cursor;
      let hasMore = true;

      // 모든 블록을 가져올 때까지 반복 (100개 제한 우회)
      while (hasMore) {
        const response = await this.notion.blocks.children.list({
          block_id: productId,
          start_cursor: cursor,
        });
        blocks.push(...response.results);
        cursor = response.next_cursor;
        hasMore = response.has_more;
      }

      return formatNotionBlocks(blocks, {
        includeRichText: true,
        includeMetadata: true,
      });
    } catch (error) {
      console.warn("[StoreService] 상품 페이지 블록 조회 오류:", error.message);
      return [];
    }
  }

  /**
   * 상품 데이터 포맷팅 (Notion DB 구조에 맞춤)
   * @param {Object} page - Notion 페이지 객체
   * @param {boolean} includeDetails - 상세 정보 포함 여부
   * @return {Object} 포맷팅된 상품 데이터
   */
  formatProductData(page, includeDetails = false) {
    const props = page.properties;

    return {
      id: page.id,
      name: getTitleValue(props[NOTION_FIELDS.NAME]),
      description: getTextContent(props[NOTION_FIELDS.DESCRIPTION]),
      thumbnail: getFileUrls(props[NOTION_FIELDS.THUMBNAIL]),
      coverImage: getCoverImageUrl(page),
      requiredPoints: getNumberValue(props[NOTION_FIELDS.REQUIRED_POINTS]) || 0,
      onSale: getCheckboxValue(props[NOTION_FIELDS.ON_SALE]),
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
    };
  }

  /**
   * @typedef {Object} RollbackInfo
   * @property {string[]} processedDocIds - 만료 처리한 문서 ID 배열
   * @property {string[]} createdDocIds - 생성한 잔여 이력 문서 ID 배열
   * @property {string|null} deductDocId - 차감 이력 문서 ID
   */

  /**
   * FIFO 방식으로 포인트 차감 (내부 메서드)
   * @private
   * @param {string} userId - 사용자 ID
   * @param {number} totalPoints - 차감할 포인트
   * @param {string} reason - 차감 사유
   * @param {Object} transaction - Firestore 트랜잭션 객체
   * @param {Object} userRef - 사용자 문서 참조 (rewards 필드 업데이트용)
   * @return {Promise<RollbackInfo>} 롤백 정보 객체
   */
  async _deductRewardsFIFO(userId, totalPoints, reason, transaction, userRef) {
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      const error = new Error("유효하지 않은 사용자 ID입니다.");
      error.code = "INVALID_INPUT";
      error.statusCode = 400;
      throw error;
    }

    if (!totalPoints || totalPoints <= 0) {
      const error = new Error("차감할 포인트는 0보다 커야 합니다.");
      error.code = "INVALID_INPUT";
      error.statusCode = 400;
      throw error;
    }

    /** @type {RollbackInfo} */
    const rollbackInfo = {
      processedDocIds: [],  // isProcessed: true로 변경한 문서 ID들
      createdDocIds: [],    // 새로 생성한 잔여 이력 문서 ID들
      deductDocId: null,    // 차감 이력 문서 ID
    };

    // 1. 사용 가능한 포인트 이력 조회 (changeType: "add", isProcessed: false)
    const historyRef = this.firestoreService.db
        .collection(`users/${userId}/rewardsHistory`);

    const availableHistoryQuery = historyRef
        .where("changeType", "==", "add")
        .where("isProcessed", "==", false);

    let availableHistorySnapshot;
    try {
      availableHistorySnapshot = await transaction.get(availableHistoryQuery);
    } catch (queryError) {
      console.error(`[StoreService] 포인트 이력 조회 실패: ${queryError.message}`);
      const error = new Error("포인트 이력 조회 중 오류가 발생했습니다.");
      error.code = "QUERY_ERROR";
      error.statusCode = 500;
      throw error;
    }

    // 2. expiresAt 기반 FIFO 정렬 (성능 최적화: 단일 순회)
    const now = new Date();
    const availableHistory = availableHistorySnapshot.docs
        .reduce((acc, doc) => {
          const data = doc.data();

          // expiresAt이 없으면 스킵 (필수 필드)
          if (!data.expiresAt) {
            console.warn(`[StoreService] rewardsHistory에 expiresAt이 없습니다: ${doc.id}`);
            return acc;
          }

          // Firestore Timestamp를 Date로 변환
          const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

          // expiresAt이 유효한 날짜인지 확인
          if (isNaN(expiresAt.getTime())) {
            console.warn(`[StoreService] rewardsHistory에 유효하지 않은 expiresAt: ${doc.id}`);
            return acc;
          }

          // amount 검증 및 만료 체크
          const amount = data.amount || 0;
          if (amount <= 0 || expiresAt <= now) {
            return acc;
          }

          acc.push({
            id: doc.id,
            ...data,
            expiresAt: expiresAt,
            expiresAtTimestamp: data.expiresAt, // 원본 Timestamp 보관 (나중에 사용)
          });

          return acc;
        }, [])
        .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()); // 만료일이 가까운 순으로 정렬

    // 3. 사용 가능한 총 포인트 계산
    const totalAvailable = availableHistory.reduce((sum, item) => sum + (item.amount || 0), 0);

    if (totalAvailable < totalPoints) {
      const error = new Error(`리워드(나다움)가 부족합니다. (필요: ${totalPoints}, 사용 가능: ${totalAvailable})`);
      error.code = "INSUFFICIENT_REWARDS";
      error.statusCode = 400;
      throw error;
    }

    // 4. FIFO 방식으로 차감
    let remainingDeduct = totalPoints;

    for (const historyItem of availableHistory) {
      if (remainingDeduct <= 0) break;

      const historyDocRef = historyRef.doc(historyItem.id);
      const itemAmount = historyItem.amount || 0;

      // amount가 0 이하인 경우 스킵 (이미 필터링했지만 안전장치)
      if (itemAmount <= 0) continue;

      if (itemAmount <= remainingDeduct) {
        // 전체 금액 차감: 기존 이력을 만료 처리
        transaction.update(historyDocRef, {
          isProcessed: true,
        });
        rollbackInfo.processedDocIds.push(historyItem.id);  // 롤백 정보 추가
        remainingDeduct -= itemAmount;
      } else {
        // 부분 차감: 기존 이력 만료 처리 + 잔금으로 새 이력 생성
        transaction.update(historyDocRef, {
          isProcessed: true,
        });
        rollbackInfo.processedDocIds.push(historyItem.id);  // 롤백 정보 추가

        // 잔금으로 새 이력 생성 (원본의 createdAt과 expiresAt을 그대로 복사)
        const newHistoryRef = historyRef.doc();
        // 원본 Timestamp를 그대로 사용 (이미 Firestore Timestamp 객체)
        const createdAtTimestamp = historyItem.createdAt;
        const expiresAtTimestamp = historyItem.expiresAtTimestamp;

        // 필수 필드 검증 (더 상세한 검증)
        if (!createdAtTimestamp || !expiresAtTimestamp) {
          console.error(`[StoreService] createdAt 또는 expiresAt이 없습니다: ${historyItem.id}`, {
            hasCreatedAt: !!historyItem.createdAt,
            hasExpiresAtTimestamp: !!historyItem.expiresAtTimestamp,
            historyItemKeys: Object.keys(historyItem),
          });
          const error = new Error("포인트 차감 처리 중 데이터 오류가 발생했습니다.");
          error.code = "DEDUCTION_ERROR";
          error.statusCode = 500;
          throw error;
        }

        // Timestamp 타입 검증 (Firestore Timestamp 객체인지 확인)
        if (!createdAtTimestamp.toDate || !expiresAtTimestamp.toDate) {
          console.error(`[StoreService] createdAt 또는 expiresAt이 Timestamp 타입이 아닙니다: ${historyItem.id}`, {
            createdAtType: typeof createdAtTimestamp,
            expiresAtType: typeof expiresAtTimestamp,
          });
          const error = new Error("포인트 차감 처리 중 데이터 타입 오류가 발생했습니다.");
          error.code = "DEDUCTION_ERROR";
          error.statusCode = 500;
          throw error;
        }

        const newHistoryData = {
          amount: itemAmount - remainingDeduct,
          changeType: "add",
          reason: historyItem.reason || "",
          isProcessed: false,
          createdAt: createdAtTimestamp, // 원본 createdAt 유지
          expiresAt: expiresAtTimestamp, // 원본 expiresAt 유지
        };

        // actionKey가 있는 경우에만 추가 (undefined 방지)
        if (historyItem.actionKey !== undefined && historyItem.actionKey !== null) {
          newHistoryData.actionKey = historyItem.actionKey;
        }

        transaction.set(newHistoryRef, newHistoryData);
        rollbackInfo.createdDocIds.push(newHistoryRef.id);  // 롤백 정보 추가

        remainingDeduct = 0;
      }
    }

    // 검증: remainingDeduct가 0이 아니면 로직 오류
    if (remainingDeduct > 0) {
      console.error(`[StoreService] 포인트 차감 로직 오류: remainingDeduct=${remainingDeduct}, totalPoints=${totalPoints}`);
      const error = new Error("포인트 차감 처리 중 오류가 발생했습니다.");
      error.code = "DEDUCTION_ERROR";
      error.statusCode = 500;
      throw error;
    }

    // 5. 차감 히스토리 기록
    const deductHistoryRef = historyRef.doc();
    transaction.set(deductHistoryRef, {
      amount: totalPoints,
      changeType: "deduct",
      actionKey: "store",
      reason: reason,
      isProcessed: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    rollbackInfo.deductDocId = deductHistoryRef.id;  // 롤백 정보 추가

    // 6. users rewards 차감
    if (userRef) {
      transaction.update(userRef, {
        rewards: FieldValue.increment(-totalPoints),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // 7. 롤백 정보 반환
    return rollbackInfo;
  }

  /**
   * 포인트 복구 보상 트랜잭션 (내부 메서드)
   * rollbackInfo가 있으면 정확한 복구, 없으면 쿼리로 찾아서 복구
   * @private
   * @param {string} userId - 사용자 ID
   * @param {number} totalPoints - 복구할 포인트
   * @param {string} productName - 상품명
   * @param {RollbackInfo|null} rollbackInfo - 롤백 정보 (선택적)
   * @return {Promise<void>}
   */
  async _rollbackRewardsDeduction(userId, totalPoints, productName, rollbackInfo = null) {
    // 입력 검증
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      console.error(`[StoreService] 유효하지 않은 사용자 ID입니다`);
      return;
    }

    if (!totalPoints || totalPoints <= 0) {
      console.warn(`[StoreService] 복구할 포인트가 0 이하입니다: ${totalPoints}`);
      return;
    }

    await this.firestoreService.runTransaction(async (transaction) => {
      const userRef = this.firestoreService.db.collection("users").doc(userId);
      const historyRef = this.firestoreService.db.collection(`users/${userId}/rewardsHistory`);

      if (rollbackInfo) {
        // ✅ 메모리 정보로 정확한 복구
        console.log(`[StoreService] 정확한 복구 시작: rollbackInfo 사용`);

        // 1. 만료시킨 이력들 복구 (isProcessed: false로 되돌림)
        for (const docId of rollbackInfo.processedDocIds) {
          transaction.update(historyRef.doc(docId), {
            isProcessed: false,
          });
        }

        // 2. 생성한 잔여 이력들 삭제
        for (const docId of rollbackInfo.createdDocIds) {
          transaction.delete(historyRef.doc(docId));
        }

        // 3. 차감 이력 삭제
        if (rollbackInfo.deductDocId) {
          transaction.delete(historyRef.doc(rollbackInfo.deductDocId));
        }

        console.log(`[StoreService] 완벽 복구 완료: ${totalPoints}P, 이력 ${rollbackInfo.processedDocIds.length}건 복구, 잔여 ${rollbackInfo.createdDocIds.length}건 삭제`);
      } else {
        // ⚠️ Fallback: 쿼리로 찾아서 복구 (rollbackInfo 없는 경우)
        console.warn(`[StoreService] rollbackInfo 없음, 쿼리 방식으로 복구`);

        const deductReason = `${productName} 구매`;
        const deductHistoryQuery = historyRef
            .where("changeType", "==", "deduct")
            .where("reason", "==", deductReason)
            .orderBy("createdAt", "desc")
            .limit(1);

        const deductHistorySnapshot = await transaction.get(deductHistoryQuery);

        if (deductHistorySnapshot.empty) {
          // 차감 이력을 찾을 수 없으면 포인트만 복구
          console.warn(`[StoreService] 차감 이력 없음, 포인트만 복구: ${productName}`);
        } else {
          // 차감 이력 삭제
          transaction.delete(deductHistorySnapshot.docs[0].ref);
        }

        console.log(`[StoreService] 불완전 복구 완료: ${totalPoints}P (이력 미복구)`);
      }

      // 4. 포인트 복구 (공통)
      transaction.update(userRef, {
        rewards: FieldValue.increment(totalPoints),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  /**
   * 스토어 구매신청 (Notion DB에 저장)
   * @param {string} userId - 사용자 ID (Firebase UID)
   * @param {Object} purchaseRequest - 구매신청 데이터
   * @param {string} purchaseRequest.productId - 상품 ID (Notion 페이지 ID)
   * @param {number} purchaseRequest.quantity - 구매 개수
   * @param {string} [purchaseRequest.recipientName] - 수령인 이름
   * @param {string} [purchaseRequest.recipientPhone] - 수령인 전화번호
   * @return {Promise<Object>} 구매신청 결과
   */
  async createStorePurchase(userId, purchaseRequest) {
    try {
      if (!this.notion || !STORE_PURCHASE_DB_ID) {
        const error = new Error("스토어 구매신청 DB가 설정되지 않았습니다.");
        error.code = ERROR_CODES.MISSING_DB_ID;
        error.statusCode = 500;
        throw error;
      }

      const {
        productId,
        quantity: rawQuantity,
        recipientName = "",
        recipientPhone = "",
      } = purchaseRequest;

      // 필수 검증
      if (!productId) {
        const error = new Error("상품 ID가 필요합니다.");
        error.code = "BAD_REQUEST";
        error.statusCode = 400;
        throw error;
      }

      // quantity 검증 및 정규화
      const quantity = rawQuantity !== undefined ? Number(rawQuantity) : 1;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        const error = new Error("구매 개수는 1 이상의 정수여야 합니다.");
        error.code = "BAD_REQUEST";
        error.statusCode = 400;
        throw error;
      }

      // 1. Notion에서 상품 정보 조회 (requiredPoints, onSale 확인)
      const product = await this.getProductById(productId);
      const requiredPoints = product.requiredPoints || 0;
      const totalPoints = requiredPoints * quantity;

      // totalPoints가 0이면 구매 불가
      if (totalPoints <= 0) {
        const error = new Error("상품의 필요한 나다움이 0 이하입니다.");
        error.code = "BAD_REQUEST";
        error.statusCode = 400;
        throw error;
      }

      // 2. 판매 중지된 상품 차단
      if (!product.onSale) {
        const error = new Error("판매 중지된 상품은 구매신청할 수 없습니다.");
        error.code = "BAD_REQUEST";
        error.statusCode = 400;
        throw error;
      }

      // 3. 트랜잭션으로 사용자 정보 조회 + FIFO 방식 포인트 차감 + 히스토리 기록
      let userNickname = "";
      let rollbackInfo = null;  // 롤백 정보를 메모리에 저장

      await this.firestoreService.runTransaction(async (transaction) => {
        const userRef = this.firestoreService.db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          const error = new Error("사용자를 찾을 수 없습니다.");
          error.code = "NOT_FOUND";
          error.statusCode = 404;
          throw error;
        }

        const userData = userDoc.data();
        userNickname = userData.nickname || "";

        // FIFO 방식으로 포인트 차감 (rewards 필드도 함께 차감) + rollbackInfo 받아옴
        rollbackInfo = await this._deductRewardsFIFO(userId, totalPoints, `${product.name} 구매`, transaction, userRef);
      });

      // 5. Notion 페이지 생성 (보상 트랜잭션 포함)
      // 제목 생성: "상품명 - 주문자닉네임 - 주문일시"
      const orderTitle = `${product.name} - ${userNickname} - ${new Date().toLocaleDateString('ko-KR')}`;
      
      const notionData = {
        parent: {
          data_source_id: STORE_PURCHASE_DB_ID,
          type: "data_source_id"
        },
        properties: {
          [PURCHASE_FIELDS.TITLE]: {
            title: [{text: {content: orderTitle}}],
          },
          [PURCHASE_FIELDS.ORDERER_ID]: {
            rich_text: [{text: {content: userId}}],
          },
          [PURCHASE_FIELDS.ORDERER_NICKNAME]: {
            rich_text: [{text: {content: userNickname || ""}}],
          },
          [PURCHASE_FIELDS.PRODUCT_NAME]: {
            relation: [{id: productId}],
          },
          [PURCHASE_FIELDS.QUANTITY]: {
            number: quantity,
          },
          [PURCHASE_FIELDS.RECIPIENT_NAME]: {
            rich_text: recipientName ? [{text: {content: recipientName}}] : [],
          },
          [PURCHASE_FIELDS.RECIPIENT_PHONE]: {
            phone_number: recipientPhone || null,
          },
          [PURCHASE_FIELDS.DELIVERY_COMPLETED]: {
            checkbox: false,
          },
          [PURCHASE_FIELDS.ORDER_DATE]: {
            date: {start: new Date().toISOString()},
          },
        },
      };

      try {
        const response = await this.notion.pages.create(notionData);

        console.log("[StoreService] 스토어 구매신청 성공:", response.id);

        return {
          purchaseId: response.id,
          userId,
          productId,
          quantity,
          recipientName,
          recipientPhone,
          orderDate: response.created_time,
          deliveryCompleted: false,
        };
      } catch (notionError) {
        // Notion API 실패 시 포인트 복구 (보상 트랜잭션)
        console.error("[StoreService] Notion 페이지 생성 실패, 포인트 복구 시작:", notionError.message);

        try {
          // rollbackInfo를 전달하여 정확한 복구 수행
          await this._rollbackRewardsDeduction(userId, totalPoints, product.name, rollbackInfo);
        } catch (rollbackError) {
          // 복구 실패 시 크리티컬 로그 (수동 처리 필요)
          console.error("[StoreService] 🚨 크리티컬: 포인트 복구 실패 🚨", {
            userIdHash: userId ? `${userId.substring(0, 8)}***` : 'unknown',  // PII 마스킹
            productId,
            productName: product.name,
            totalPoints,
            rollbackInfo: rollbackInfo ? {
              processedCount: rollbackInfo.processedDocIds?.length || 0,
              createdCount: rollbackInfo.createdDocIds?.length || 0,
              hasDeductId: !!rollbackInfo.deductDocId,
              // 실제 문서 ID는 보안상 로그하지 않음
            } : null,
            notionError: notionError.message,
            rollbackError: rollbackError.message,
            timestamp: new Date().toISOString(),
          });

          // 보안: userId는 로그에만 남기고 사용자 메시지에는 포함하지 않음
          const criticalError = new Error("구매신청 실패 및 포인트 복구 실패. 고객센터에 문의해주세요.");
          criticalError.code = "CRITICAL_ROLLBACK_FAILURE";
          criticalError.statusCode = 500;
          criticalError.originalError = notionError.message;
          throw criticalError;
        }

        // 원래 Notion 에러 재던지기
        throw notionError;
      }
    } catch (error) {
      console.error("[StoreService] 스토어 구매신청 오류:", error.message);

      // 명시적으로 처리해야 하는 에러 코드들
      if (
        error.code === "BAD_REQUEST" ||
        error.code === "NOT_FOUND" ||
        error.code === "INSUFFICIENT_REWARDS" ||
        error.code === "CRITICAL_ROLLBACK_FAILURE" ||
        error.code === ERROR_CODES.MISSING_DB_ID ||
        error.code === ERROR_CODES.PRODUCT_NOT_FOUND
      ) {
        throw error;
      }

      if (error.code === "object_not_found") {
        const notFoundError = new Error("스토어 구매신청 DB를 찾을 수 없습니다.");
        notFoundError.code = ERROR_CODES.MISSING_DB_ID;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      if (error.code === "rate_limited") {
        const rateLimitError = new Error("Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
        rateLimitError.code = "RATE_LIMITED";
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }

      const serviceError = new Error(`스토어 구매신청 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      serviceError.statusCode = 500;
      throw serviceError;
    }
  }

  /**
   * 스토어 구매신청내역 조회 (Notion DB에서 조회 - 날짜별 그룹핑)
   * @param {string} userId - 사용자 ID (Firebase UID)
   * @param {number} [pageSize=20] - 페이지 크기
   * @param {string} [startCursor] - 페이지네이션 커서
   * @return {Promise<Object>} 날짜별 그룹핑된 구매신청내역 목록
   */
  async getStorePurchases(userId, pageSize = DEFAULT_PAGE_SIZE, startCursor = null) {
    try {
      if (!this.notion || !STORE_PURCHASE_DB_ID) {
        const error = new Error("스토어 구매신청 DB가 설정되지 않았습니다.");
        error.code = ERROR_CODES.MISSING_DB_ID;
        error.statusCode = 500;
        throw error;
      }

      const queryBody = {
        page_size: normalizePageSize(pageSize),
        filter: {
          property: PURCHASE_FIELDS.ORDERER_ID,
          rich_text: {
            equals: userId,
          },
        },
        sorts: [
          {
            timestamp: "created_time",
            direction: "descending",
          },
        ],
      };

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      const data = await this.notion.dataSources.query({
        data_source_id: STORE_PURCHASE_DB_ID,
        ...queryBody,
      });

      const purchases = data.results.map((page) => this.formatPurchaseData(page));

      // 날짜별 그룹핑 (orderDate 기준)
      const groupedByDate = this.groupPurchasesByDate(purchases);

      return {
        purchasesByDate: groupedByDate,
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
      };
    } catch (error) {
      console.error("[StoreService] 스토어 구매신청내역 조회 오류:", error.message);

      if (error.code === "object_not_found") {
        const notFoundError = new Error("스토어 구매신청 DB를 찾을 수 없습니다.");
        notFoundError.code = ERROR_CODES.MISSING_DB_ID;
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      if (error.code === "rate_limited") {
        const rateLimitError = new Error("Notion API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
        rateLimitError.code = "RATE_LIMITED";
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }

      const serviceError = new Error(`스토어 구매신청내역 조회 중 오류가 발생했습니다: ${error.message}`);
      serviceError.code = ERROR_CODES.NOTION_API_ERROR;
      throw serviceError;
    }
  }

  /**
   * 구매신청 목록을 날짜별로 그룹핑
   * @private
   * @param {Array} purchases - 구매신청 목록
   * @return {Array} 날짜별로 그룹핑된 배열
   */
  groupPurchasesByDate(purchases) {
    // orderDate 기준으로 그룹핑 (Map 사용)
    const groupMap = new Map();
    const KST_OFFSET = 9 * 60 * 60 * 1000; // UTC+9 (한국 표준시)

    purchases.forEach((purchase) => {
      // orderDate를 YYYY-MM-DD 형식으로 변환 (KST 기준)
      const orderDate = purchase.orderDate ? new Date(purchase.orderDate) : null;
      if (!orderDate || isNaN(orderDate.getTime())) {
        // 유효하지 않은 날짜는 "날짜 없음" 그룹으로
        const unknownKey = "unknown";
        if (!groupMap.has(unknownKey)) {
          groupMap.set(unknownKey, []);
        }
        groupMap.get(unknownKey).push(purchase);
        return;
      }

      // KST 기준 날짜로 변환
      const kstDate = new Date(orderDate.getTime() + KST_OFFSET);
      const dateKey = kstDate.toISOString().split('T')[0]; // YYYY-MM-DD (KST)
      
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, []);
      }
      groupMap.get(dateKey).push(purchase);
    });

    // Map을 배열로 변환하고 정렬
    const groupedArray = Array.from(groupMap.entries())
        .map(([dateKey, items]) => {
          // 각 그룹 내에서도 최신순 정렬 (orderDate 기준)
          const sortedItems = items.sort((a, b) => {
            const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
            const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
            return dateB - dateA; // 최신순
          });

          // 날짜 라벨 생성
          let dateLabel;
          if (dateKey === "unknown") {
            dateLabel = "날짜 없음";
          } else {
            const date = new Date(dateKey + 'T00:00:00Z');
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth() + 1;
            const day = date.getUTCDate();
            dateLabel = `${year}년 ${month}월 ${day}일`;
          }

          return {
            date: dateKey,
            dateLabel: dateLabel,
            items: sortedItems,
            count: sortedItems.length,
          };
        })
        .sort((a, b) => {
          // "날짜 없음"은 맨 뒤로
          if (a.date === "unknown") return 1;
          if (b.date === "unknown") return -1;
          // 날짜별 최신순 정렬
          return b.date.localeCompare(a.date);
        });

    return groupedArray;
  }

  /**
   * 구매신청 데이터 포맷팅
   * @param {Object} page - Notion 페이지 객체
   * @return {Object} 포맷팅된 구매신청 데이터
   */
  formatPurchaseData(page) {
    const props = page.properties;

    // Relation에서 상품 ID 추출
    const productRelation = getRelationValues(props[PURCHASE_FIELDS.PRODUCT_NAME]);
    const productId = productRelation?.relations?.length > 0 ?
      productRelation.relations[0].id :
      null;

    // 주문 완료 일시 추출 (date 필드 또는 created_time 사용)
    const orderDateField = props[PURCHASE_FIELDS.ORDER_DATE];
    const orderDate = orderDateField?.date?.start || page.created_time;

    // Rollup 필드 추출 (상품의 "필요한 나다움")
    const requiredPointsRollup = getRollupValues(props[PURCHASE_FIELDS.REQUIRED_POINTS_ROLLUP]);

    // "필요한 나다움" 값 추출 (숫자 또는 첫 번째 배열 값)
    let requiredPoints = null;
    if (requiredPointsRollup.type === 'array' && requiredPointsRollup.value?.length > 0) {
      const firstValue = requiredPointsRollup.value[0].name;
      requiredPoints = firstValue ? Number(firstValue) : null;
    } else if (requiredPointsRollup.value !== null && requiredPointsRollup.value !== undefined) {
      requiredPoints = Number(requiredPointsRollup.value);
    }

    // Rollup 필드 추출 (상품 이미지) - 파일 배열
    const productImage = getFileUrls(props[PURCHASE_FIELDS.PRODUCT_IMAGE_ROLLUP]);

    return {
      purchaseId: page.id,
      title: getTitleValue(props[PURCHASE_FIELDS.TITLE]),
      userId: getTextContent(props[PURCHASE_FIELDS.ORDERER_ID]), // rich_text로 변경됨
      userNickname: getTextContent(props[PURCHASE_FIELDS.ORDERER_NICKNAME]),
      productId: productId,
      quantity: getNumberValue(props[PURCHASE_FIELDS.QUANTITY]) || 1,
      requiredPoints: requiredPoints, // 상품의 필요한 나다움 (rollup)
      productImage: productImage, // 상품 이미지 (rollup)
      recipientName: getTextContent(props[PURCHASE_FIELDS.RECIPIENT_NAME]),
      recipientPhone: getPhoneNumberValue(props[PURCHASE_FIELDS.RECIPIENT_PHONE]),
      deliveryCompleted: getCheckboxValue(props[PURCHASE_FIELDS.DELIVERY_COMPLETED]),
      orderDate: orderDate,
      lastEditedTime: page.last_edited_time,
    };
  }
}

module.exports = StoreService;
