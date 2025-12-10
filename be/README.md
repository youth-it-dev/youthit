# 🚀 Yourdentity Backend

청소년의 정체성 형성을 돕는 커뮤니티 플랫폼 - Firebase Functions 기반 REST API 서버

## 🛠️ 개발 환경 설정

### 필수 요구사항
- Node.js 20+ (LTS 버전 권장)
- pnpm (권장 패키지 매니저)
- Firebase CLI
- Firebase 프로젝트 설정

### 설치 및 실행

```bash
# 프로젝트 클론
git clone https://github.com/youth-it-dev/youthit.git

# 백엔드 디렉토리로 이동 및 의존성 설치
cd be/functions
pnpm install

# 환경 변수 설정
# ⚠️ .env 파일은 보안상 Git에 포함되지 않으며, 프로젝트 관리자에게 요청

# Firebase 프로젝트 설정
firebase use  # 현재 프로젝트 확인

# Firebase 에뮬레이터 실행
firebase emulators:start --only functions,auth,firestore

# Firebase 프로덕션 환경에서 실행 (functions 테스트용, 카카오 로그인 가능)
# ⚠️ 프로덕션 데이터를 사용하므로 신중한 테스트 필요 (데이터 변경/삭제 주의)
firebase emulators:start --only functions

```

**접속 URL**
- Emulator UI: `http://127.0.0.1:4000`

**주의사항**
- 에뮬레이터 환경에서는 카카오 로그인 불가능 (프로덕션 환경에서만 테스트 가능)
- 에뮬레이터 종료 시 데이터 초기화

### 프로덕션 배포

```bash
firebase deploy --only functions
```

## 🚀 테크 스택

### 핵심 프레임워크 & 라이브러리
- **런타임**: Node.js 20
- **프레임워크**: Express.js ^4.21.2
- **언어**: JavaScript (CommonJS)
- **플랫폼**: Firebase Functions v2 (^4.9.0, onRequest)
- **데이터베이스**: Cloud Firestore (Firebase)
- **인증**: Firebase Admin SDK ^12.6.0, Firebase Authentication (JWT Bearer Token)
- **API 문서화**: Swagger (swagger-jsdoc ^6.2.8, swagger-ui-express ^5.0.1)

### 외부 서비스 연동
- **Notion API**: 프로그램, 상점, FAQ 등 콘텐츠 관리
  - @notionhq/client ^5.1.0
  - notion-client 7.7.1
- **카카오 API**: 소셜 로그인 및 프로필 동기화
- **Firebase Cloud Messaging (FCM)**: 푸시 알림
- **ImgBB API**: 이미지 호스팅

### 파일 처리 & 보안
- **파일 업로드**: busboy ^1.6.0
- **파일 타입 검증**: file-type ^21.0.0
- **HTML 정제**: sanitize-html ^2.17.0
- **CORS**: cors ^2.8.5
- **환경 변수**: dotenv ^17.2.3

### 스케줄러 & 배포
- **스케줄러**: Firebase Cloud Scheduler
  - Storage Cleanup (일일/주간)
  - Mission Reset (일일)
- **패키지 매니저**: pnpm
- **배포**: Firebase Functions (asia-northeast3 리전)

## 🏗️ 아키텍처 특징

- **계층형 구조**: Controller → Service → FirestoreService
- **RESTful API**: 표준 HTTP 메서드 및 상태 코드 사용
- **미들웨어 기반**: 인증, 에러 처리, 응답 포맷팅
- **Swagger 자동 문서화**: API 스펙 자동 생성 및 관리
- **Firebase Triggers**: Auth, Scheduler 이벤트 자동 처리
- **Notion 연동**: 콘텐츠 관리 시스템으로 활용

## 📁 폴더 아키텍처

```
📦 be/functions/
├── 📂 src/
│   ├── 📂 config/                    # 설정 파일
│   │   ├── database.js               # Firebase Admin 초기화
│   │   └── swagger.js                # Swagger 설정
│   │
│   ├── 📂 constants/                 # 상수 정의
│   │   ├── userConstants.js          # 사용자 관련 상수
│   │   ├── missionConstants.js       # 미션 관련 상수
│   │   ├── kakaoConstants.js         # 카카오 API 상수
│   │   └── ...
│   │
│   ├── 📂 controllers/               # 컨트롤러 (요청/응답 처리)
│   │   ├── authController.js         # 인증
│   │   ├── userController.js         # 사용자
│   │   ├── missionController.js      # 미션
│   │   ├── communityController.js    # 커뮤니티
│   │   ├── programController.js      # 프로그램
│   │   └── ...
│   │
│   ├── 📂 services/                  # 서비스 (비즈니스 로직)
│   │   ├── authService.js            # 인증 서비스
│   │   ├── userService.js            # 사용자 서비스
│   │   ├── missionService.js          # 미션 서비스
│   │   ├── rewardService.js           # 리워드 서비스
│   │   ├── communityService.js        # 커뮤니티 서비스
│   │   ├── notionUserService.js       # Notion 사용자 동기화
│   │   └── ...
│   │
│   ├── 📂 routes/                     # 라우트 정의
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── missions.js
│   │   └── ...
│   │
│   ├── 📂 middleware/                 # 미들웨어
│   │   ├── authGuard.js               # 인증 가드
│   │   ├── errorHandler.js            # 에러 핸들러
│   │   ├── responseHandler.js         # 응답 포맷터
│   │   ├── rewardHandler.js           # 리워드 부여
│   │   └── optionalAuth.js            # 선택적 인증
│   │
│   ├── 📂 triggers/                   # Firebase Triggers
│   │   ├── authTrigger.js             # Auth 이벤트 (onCreate/onDelete)
│   │   ├── missionResetScheduler.js   # 미션 일일 리셋 스케줄러
│   │   └── storageCleanupScheduler.js # 스토리지 정리 스케줄러
│   │
│   ├── 📂 utils/                      # 유틸리티 함수
│   │   ├── kakaoApiHelper.js          # 카카오 API 헬퍼
│   │   ├── notionHelper.js            # Notion API 헬퍼
│   │   ├── fcmHelper.js               # FCM 푸시 알림 헬퍼
│   │   ├── paginationHelper.js        # 페이지네이션 헬퍼
│   │   ├── sanitizeHelper.js          # HTML 정제 헬퍼
│   │   └── ...
│   │
│   ├── 📂 scripts/                    # 유틸리티 스크립트
│   │   ├── getIdToken.js              # ID 토큰 발급
│   │   ├── createFirestoreCollections.js
│   │   └── ...
│   │
│   └── 📂 tests/                      # 테스트 스크립트
│       ├── test-all-policies.sh
│       ├── test-reward-system.sh
│       └── ...
│
├── 📄 index.js                        # 진입점 (Express 앱 설정)
├── 📄 package.json
├── 📄 firestore.rules                 # Firestore 보안 규칙
└── 📄 firestore.indexes.json          # Firestore 인덱스
```

## 🔧 주요 기능 모듈

### 인증 (Auth)
- Firebase ID Token 기반 인증
- 카카오 소셜 로그인 연동
- 로그아웃 (Firebase Refresh Token 무효화)
- 회원 탈퇴 (개인정보 가명처리)

### 사용자 (Users)
- 프로필 관리
- 카카오 프로필 동기화
- 닉네임 중복 체크
- 온보딩 프로세스

### 미션 (Missions)
- 미션 목록 조회
- 미션 신청/완료
- 일일 미션 리셋 (스케줄러)
- 미션 인증 게시글 작성

### 커뮤니티 (Communities)
- 프로그램 관리 (한끗루틴, 월간소모임, TMI)
- 게시글 작성/조회
- 댓글 시스템
- 좋아요 기능

### 리워드 (Rewards)
- 포인트 부여 시스템
- 일일 제한 체크
- 중복 방지 로직
- 리워드 히스토리

### 프로그램 (Programs)
- Notion 기반 프로그램 관리
- 프로그램 신청/참여
- 인증/후기 게시글

### 상점 (Store)
- Notion 기반 상품 관리
- 상품 목록/상세 조회
- 리워드 포인트로 구매

### 알림 (Notifications)
- FCM 푸시 알림
- 알림 토큰 관리
- 알림 히스토리

## 🔐 보안

### 인증 가드 (authGuard)
- 모든 보호된 API는 `authGuard` 미들웨어로 검증
- Firebase ID Token 검증
- Revoked Token 체크 (로그아웃된 토큰 거부)
- 자격정지 상태 확인

### Firestore 보안 규칙
- 사용자별 데이터 접근 제어
- 본인 데이터만 읽기/쓰기 가능
- 닉네임 중복 방지

### 데이터 검증
- 입력 데이터 검증 및 정제
- HTML 콘텐츠 sanitize
- 파일 타입 검증

## 📊 Swagger API 문서

**에뮬레이터**: `http://127.0.0.1:5001/{project-id}/asia-northeast3/api/api-docs`  
**프로덕션**: `https://asia-northeast3-{project-id}.cloudfunctions.net/api/api-docs`  
**JSON**: `/api-docs.json` 엔드포인트로 Swagger 스펙 다운로드 가능

## 🔄 Firebase Triggers

### Auth Triggers
- `createUserDocument`: 사용자 생성 시 Firestore 문서 자동 생성
- `deleteUserDocument`: 사용자 삭제 시 개인정보 가명처리

### Schedulers
- `missionDailyResetScheduler`: 매일 자정 미션 리셋
- `storageCleanupScheduler`: 스토리지 정리 작업

## 📋 Git 전략
- 브랜치: `feature` → `main`
- 커밋 전: 코드 품질 검사 (ESLint)

## 🔗 관련 문서
- [인증 아키텍처 플로우](./docs/auth-architecture.md)
- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
- [Firestore 보안 규칙](functions/firestore.rules)

