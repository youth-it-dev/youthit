const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {admin} = require("../config/database");
const {TERMS_VERSIONS, TERMS_TAGS} = require("../constants/termsConstants");
const {KAKAO_API_TIMEOUT, KAKAO_API_RETRY_DELAY, KAKAO_API_MAX_RETRIES} = require("../constants/kakaoConstants");
const {fetchKakaoAPI} = require("../utils/kakaoApiHelper");
const FirestoreService = require("./firestoreService");

/**
 * 약관 관리 서비스
 * 약관 동의 저장 및 카카오 약관 동기화
 */
class TermsService {
  constructor() {
    this.firestoreService = new FirestoreService("users");
  }

  /**
   * 약관 데이터 검증 (필수 정보 확인)
   * @param {Object} termsData
   * @param {string} uid
   * @throws {Error} 약관 정보가 없으면 에러
   */
  validateTermsData(termsData, uid) {
    const {serviceVersion, privacyVersion, personalVersion, age14Agreed, marketingAgreed} = termsData;
    
    if (!serviceVersion && !privacyVersion && !personalVersion && !age14Agreed && !marketingAgreed) {
      console.error(`[KAKAO_TERMS_EMPTY] uid=${uid} - 약관 정보 없음`);
      const e = new Error("카카오 약관 정보를 받아올 수 없습니다. 카카오 계정 설정에서 약관 동의를 확인해주세요.");
      e.code = "KAKAO_TERMS_MISSING";
      throw e;
    }
  }

  /**
   * 약관 데이터를 Firestore 업데이트 객체로 변환
   * @param {Object} termsData
   * @param {string} uid
   * @return {Object} Firestore 업데이트 객체
   */
  prepareTermsUpdate(termsData, uid) {
    const {serviceVersion, privacyVersion, personalVersion, age14Agreed, marketingAgreed, termsAgreedAt} = termsData;
    
    const termsUpdate = {};
    if (serviceVersion) termsUpdate.serviceTermsVersion = serviceVersion;
    if (privacyVersion) termsUpdate.privacyTermsVersion = privacyVersion;
    if (personalVersion) termsUpdate.personalTermsVersion = personalVersion;
    termsUpdate.age14TermsAgreed = !!age14Agreed;
    termsUpdate.marketingTermsAgreed = !!marketingAgreed;
    
    if (termsAgreedAt) {
      termsUpdate.termsAgreedAt = Timestamp.fromDate(new Date(termsAgreedAt));
    } else {
      termsUpdate.termsAgreedAt = FieldValue.serverTimestamp();
    }
    
    console.log(`[KAKAO_TERMS_PARSED] uid=${uid}`, {
      hasService: !!serviceVersion,
      hasPrivacy: !!privacyVersion,
      hasPersonal: !!personalVersion,
      age14: !!age14Agreed,
      marketing: !!marketingAgreed,
    });
    
    return termsUpdate;
  }

  /**
   * 에뮬레이터 약관 파싱 (테스트용)
   * @param {string} uid
   */
  async parseEmulatorTerms(uid) {
    const userRecord = await admin.auth().getUser(uid);
    const customClaims = userRecord.customClaims || {};
    
    const mockTerms = customClaims.kakaoTerms || [];
    console.log(`[TermsService] 에뮬레이터: 약관 ${mockTerms.length}개 발견`);
    
    let serviceVersion = null;
    let privacyVersion = null;
    let personalVersion = null;
    let age14Agreed = false;
    let marketingAgreed = false;
    let termsAgreedAt = null;

    for (const term of mockTerms) {
      if (term.tag === TERMS_TAGS.SERVICE) {
        serviceVersion = TERMS_VERSIONS.SERVICE;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.PRIVACY) {
        privacyVersion = TERMS_VERSIONS.PRIVACY;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.PERSONAL) {
        personalVersion = TERMS_VERSIONS.PERSONAL;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.AGE14) {
        age14Agreed = true;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.MARKETING) {
        marketingAgreed = true;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
    }

    return {
      serviceVersion,
      privacyVersion,
      personalVersion,
      age14Agreed,
      marketingAgreed,
      termsAgreedAt
    };
  }

  /**
   * 카카오 약관 API 호출 (타임아웃 설정, 실패 시 에러 throw)
   * @param {string} accessToken - 카카오 액세스 토큰
   * @param {number} maxRetries - 시도 횟수 (기본 1회, 재시도 없음)
   * @private
   */
  async _fetchKakaoTerms(accessToken, maxRetries = KAKAO_API_MAX_RETRIES) {
    const termsUrl = "https://kapi.kakao.com/v2/user/service_terms";
    
    return fetchKakaoAPI(termsUrl, accessToken, {
      maxRetries,
      retryDelay: KAKAO_API_RETRY_DELAY,
      timeout: KAKAO_API_TIMEOUT,
      throwOnError: true,
      serviceName: "TermsService",
    });
  }

  /**
   * 실제 카카오 API에서 약관 정보 조회
   * @param {string} accessToken
   */
  async fetchKakaoTerms(accessToken) {
    const termsRes = await this._fetchKakaoTerms(accessToken);
    const termsJson = await termsRes.json();
    const allowedTerms = termsJson.service_terms || [];
    
    // 카카오 API 응답 구조 확인용 로그 (디버깅)
    console.log(`[TermsService] 카카오 약관 API 응답 - 약관 개수: ${allowedTerms.length}`);
    if (allowedTerms.length > 0) {
      console.log('[TermsService] 첫 번째 약관 구조:', JSON.stringify(allowedTerms[0]));
    }
    
    let serviceVersion = null;
    let privacyVersion = null;
    let personalVersion = null;
    let age14Agreed = false;
    let marketingAgreed = false;
    let termsAgreedAt = null;

    // 카카오 태그 매핑으로 약관 동의 여부 확인
    for (const term of allowedTerms) {
      if (term.tag === TERMS_TAGS.SERVICE) {
        serviceVersion = TERMS_VERSIONS.SERVICE;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.PRIVACY) {
        privacyVersion = TERMS_VERSIONS.PRIVACY;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.PERSONAL) {
        personalVersion = TERMS_VERSIONS.PERSONAL;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.AGE14) {
        age14Agreed = true;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
      if (term.tag === TERMS_TAGS.MARKETING) {
        marketingAgreed = true;
        if (term.agreed_at && (!termsAgreedAt || term.agreed_at > termsAgreedAt)) {
          termsAgreedAt = term.agreed_at;
        }
      }
    }

    return {
      serviceVersion,
      privacyVersion,
      personalVersion,
      age14Agreed,
      marketingAgreed,
      termsAgreedAt
    };
  }

  /**
   * 사용자 약관 정보 업데이트
   * @param {string} uid
   * @param {Object} termsData
   */
  async updateUserTerms(uid, termsData) {
    const {serviceVersion, privacyVersion, personalVersion, age14Agreed, marketingAgreed, termsAgreedAt} = termsData;

    const update = {};

    // 약관 정보가 있으면 추가
    if (serviceVersion || privacyVersion || personalVersion || age14Agreed || marketingAgreed) {
      if (serviceVersion) update.serviceTermsVersion = serviceVersion;
      if (privacyVersion) update.privacyTermsVersion = privacyVersion;
      if (personalVersion) update.personalTermsVersion = personalVersion;
      update.age14TermsAgreed = !!age14Agreed;
      update.marketingTermsAgreed = !!marketingAgreed;
      
      // 만 14세 동의가 없는 경우 모니터링 로그 (카카오 정책 변경 감지)
      if (!age14Agreed) {
        console.warn(`⚠️ [TermsService] 만 14세 동의 없음 (uid: ${uid}) - 카카오 정책 확인 필요`);
      }
      if (termsAgreedAt) {
        update.termsAgreedAt = Timestamp.fromDate(new Date(termsAgreedAt));
      } else {
        update.termsAgreedAt = FieldValue.serverTimestamp();
      }
    } else {
      // 약관 정보가 없으면 기본값으로 초기화 (최초 동기화 시)
      console.log(`[TermsService] 약관 정보 없음, 기본값으로 초기화 (uid: ${uid})`);
      update.serviceTermsVersion = null;
      update.privacyTermsVersion = null;
      update.personalTermsVersion = null;
      update.age14TermsAgreed = false;
      update.marketingTermsAgreed = false;
      update.termsAgreedAt = null;
    }

    await this.firestoreService.update(uid, update);
    return {success: true};
  }

  /**
   * 카카오 서비스 약관 동의 API 호출
   * @param {string} accessToken - 카카오 액세스 토큰
   * @param {string} uid - 사용자 ID
   * @return {Promise<{marketingTermsAgreed: boolean}>}
   */
  async agreeMarketingTerms(accessToken, uid) {
    const agreeUrl = "https://kapi.kakao.com/v2/user/upgrade/service_terms";
    
    console.log(`[TermsService] 마케팅 약관 동의 요청 시작 (uid: ${uid})`);
    
    try {
      // 카카오 API 호출 (POST with form data)
      const response = await fetchKakaoAPI(agreeUrl, accessToken, {
        method: "POST",
        maxRetries: KAKAO_API_MAX_RETRIES,
        retryDelay: KAKAO_API_RETRY_DELAY,
        timeout: KAKAO_API_TIMEOUT,
        throwOnError: true,
        serviceName: "TermsService",
        body: new URLSearchParams({
          tags: TERMS_TAGS.MARKETING,
        }),
      });
      
      const result = await response.json();
      console.log(`[TermsService] 카카오 약관 동의 API 응답:`, result);
      
      // Firestore 업데이트
      await this.firestoreService.update(uid, {
        marketingTermsAgreed: true,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[TermsService] 마케팅 약관 동의 완료 (uid: ${uid})`);
      
      return {marketingTermsAgreed: true};
    } catch (error) {
      console.error(`[TermsService] 마케팅 약관 동의 실패 (uid: ${uid}):`, error.message);
      throw error;
    }
  }

  /**
   * 카카오 서비스 약관 철회 API 호출
   * @param {string} accessToken - 카카오 액세스 토큰
   * @param {string} uid - 사용자 ID
   * @return {Promise<{marketingTermsAgreed: boolean}>}
   */
  async revokeMarketingTerms(accessToken, uid) {
    const revokeUrl = "https://kapi.kakao.com/v2/user/revoke/service_terms";
    
    console.log(`[TermsService] 마케팅 약관 철회 요청 시작 (uid: ${uid})`);
    
    try {
      // 카카오 API 호출 (POST with form data)
      const response = await fetchKakaoAPI(revokeUrl, accessToken, {
        method: "POST",
        maxRetries: KAKAO_API_MAX_RETRIES,
        retryDelay: KAKAO_API_RETRY_DELAY,
        timeout: KAKAO_API_TIMEOUT,
        throwOnError: true,
        serviceName: "TermsService",
        body: new URLSearchParams({
          tags: TERMS_TAGS.MARKETING,
        }),
      });
      
      const result = await response.json();
      console.log(`[TermsService] 카카오 약관 철회 API 응답:`, result);
      
      // Firestore 업데이트
      await this.firestoreService.update(uid, {
        marketingTermsAgreed: false,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[TermsService] 마케팅 약관 철회 완료 (uid: ${uid})`);
      
      return {marketingTermsAgreed: false};
    } catch (error) {
      console.error(`[TermsService] 마케팅 약관 철회 실패 (uid: ${uid}):`, error.message);
      throw error;
    }
  }
}

module.exports = TermsService;
