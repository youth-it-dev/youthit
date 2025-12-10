# 인증 아키텍처 플로우

## 기술 스택
- **프론트엔드**: Firebase Client SDK (`firebase/auth`)
- **백엔드**: Firebase Admin SDK (`firebase-admin`)
- **소셜 로그인**: 카카오 OpenID Connect (OIDC)
- **인증 방식**: Firebase ID Token (Bearer Token)

---

## 1. 카카오 로그인 플로우

```
사용자 → 카카오 로그인 버튼 클릭
  ↓
signInWithPopup() 시도 (우선)
  ↓ 실패 시
signInWithRedirect() 자동 폴백
  ↓
Firebase Auth 사용자 생성
  ↓
authTrigger.onCreate 트리거 실행 → Firestore users/{uid} 문서 생성
  ↓
신규 회원: 온보딩 페이지 → syncKakaoProfile → 닉네임 설정
기존 회원: 사용자 정보 조회 → 닉네임 여부에 따라 라우팅
```

---

## 2. 백엔드 인증 가드 (authGuard)

모든 보호된 API는 `authGuard` 미들웨어로 검증합니다.

```
1. Authorization 헤더에서 Bearer 토큰 추출
2. Firebase Admin SDK로 ID 토큰 검증
3. Revoked Token 체크 (로그아웃된 토큰 거부)
4. 자격정지 상태 체크 (423 에러)
5. req.user에 사용자 정보 저장
```

---

## 3. 카카오 프로필 동기화

신규 회원 온보딩 시 카카오 프로필 정보를 동기화합니다.

```
1. 카카오 API 호출 (GET /v2/user/me)
2. 데이터 정규화 (전화번호, 생년월일 등)
3. Firestore users/{uid} 문서 업데이트
```

---

## 4. 로그아웃 / 회원 탈퇴

**로그아웃**:
```
1. revokeRefreshTokens() → 모든 Refresh Token 무효화
2. auth.signOut() → 로컬 세션 정리
```

**회원 탈퇴**:
```
1. 카카오 재인증 → 새로운 액세스 토큰 발급
2. 카카오 연결 해제
3. Firestore 개인정보 가명처리 (생년월일만 YYYY-**-** 형태로 보존)
4. Firebase Auth 사용자 삭제
5. auth.signOut()
```

---

## 5. 토큰 관리

- **Firebase ID Token**: API 요청 시 Authorization 헤더에 사용
- **Firebase Refresh Token**: ID Token 자동 갱신용 (백엔드 관리)
- **카카오 Access Token**: 프로필 동기화 시에만 사용 후 폐기

로그아웃 시 `revokeRefreshTokens()`로 모든 Refresh Token 무효화, `authGuard`에서 `tokensValidAfterTime` 체크로 무효화된 토큰 거부

