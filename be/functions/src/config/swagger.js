const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Yourdentity API",
      version: "1.0.0",
      description: "Yourdentity 백엔드 API 문서",
      contact: {
        name: "Yourdentity Team",
        email: "support@yourdentity.com",
      },
    },
    tags: [
      {
        name: "Users",
        description: "사용자 관련 API",
      },
      {
        name: "Missions",
        description: "미션 관련 API",
      },
      {
        name: "Images",
        description: "이미지 업로드 관련 API",
      },
      {
        name: "Communities",
        description:
          "커뮤니티 통합 관리 API (전체 포스트 조회, 루틴 인증글, 소모임 후기글, TMI 소개글)",
      },
      {
        name: "Announcements",
        description: "공지사항 관련 API",
      },
      {
        name: "FAQs",
        description: "FAQ 관련 API",
      },
      {
        name: "FCM",
        description: "FCM 푸시 알림 토큰 관리 API",
      },
      {
        name: "Programs",
        description: "프로그램 관련 API",
      },
      {
        name: "Files",
        description: "파일 관리 API",
      },
    ],
    servers: [
      {
        url: process.env.FUNCTIONS_EMULATOR === "true" ?
          `http://127.0.0.1:5001/${process.env.DEV_PROJECT_ID || "youthvoice-2025"}/asia-northeast3/api` :
          `https://asia-northeast3-${process.env.PROD_PROJECT_ID || "youthvoice-2025"}.cloudfunctions.net/api`,
        description: process.env.FUNCTIONS_EMULATOR === "true" ?
          "개발 서버 (Firebase Emulator)" :
          "프로덕션 서버",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Firebase ID Token을 Bearer 토큰으로 전달",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "사용자 고유 ID",
              example: "abc123def456",
            },
            name: {
              type: "string",
              description: "사용자 이름",
              example: "홍길동",
            },
            email: {
              type: "string",
              format: "email",
              description: "이메일 주소",
              example: "user@example.com",
            },
            profileImageUrl: {
              type: "string",
              description: "프로필 이미지 URL",
              example: "https://example.com/profile.jpg",
            },
            authType: {
              type: "string",
              enum: ["email", "sns"],
              description: "인증 유형",
              example: "sns",
            },
            snsProvider: {
              type: "string",
              enum: ["kakao", "google"],
              description: "소셜 로그인 제공자",
              example: "kakao",
            },
            role: {
              type: "string",
              enum: ["user", "admin"],
              description: "사용자 권한",
              example: "user",
            },
            phoneNumber: {
              type: "string",
              description: "휴대전화 번호",
              example: "010-1234-5678",
            },
            phoneVerified: {
              type: "boolean",
              description: "휴대전화 인증 완료 여부",
              example: false,
            },
            birthYear: {
              type: "number",
              description: "출생년도",
              example: 1990,
            },
            rewards: {
              type: "number",
              description: "리워드 총합",
              example: 0,
            },
            level: {
              type: "number",
              description: "사용자 레벨",
              example: 5,
            },
            badges: {
              type: "array",
              items: {
                type: "string",
              },
              description: "획득한 배지 목록",
              example: ["first_mission", "early_bird"],
            },
            mainProfileId: {
              type: "string",
              description: "메인 프로필 ID",
              example: "profile_abc123",
              nullable: true,
            },
            uploadQuotaBytes: {
              type: "number",
              description: "업로드 쿼터 (바이트)",
              example: 1073741824,
            },
            usedStorageBytes: {
              type: "number",
              description: "사용 중인 스토리지 (바이트)",
              example: 52428800,
            },
            activityParticipationCount: {
              type: "number",
              description: "활동 참여 횟수",
              example: 0,
            },
            certificationPosts: {
              type: "number",
              description: "누적 인증 게시글 수",
              example: 0,
            },
            reportCount: {
              type: "number",
              description: "누적 신고 횟수",
              example: 0,
            },
            suspensionReason: {
              type: "string",
              description: "정지 사유",
              example: "",
              nullable: true,
            },
            suspensionStartAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "자격정지 시작 일시",
            },
            suspensionEndAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "자격정지 종료 일시",
            },
            serviceTermsVersion: {
              type: "string",
              nullable: true,
              description: "서비스 약관 버전",
            },
            privacyTermsVersion: {
              type: "string",
              nullable: true,
              description: "개인정보처리방침 버전",
            },
            age14TermsAgreed: {
              type: "boolean",
              description: "만 14세 이상 동의",
              example: true,
            },
            pushTermsAgreed: {
              type: "boolean",
              description: "푸시 알림 동의",
              example: false,
            },
            termsAgreedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "약관 동의 시각",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "계정 생성 시간",
            },
            lastLoginAt: {
              type: "string",
              format: "date-time",
              description: "마지막 로그인 시간",
            },
            lastUpdatedAt: {
              type: "string",
              format: "date-time",
              description: "사용자 정보가 변경된 시간 (노션 동기화 기준)",
            },
          },
        },
        Mission: {
          type: "object",
          description: "노션에서 관리되는 미션 데이터",
          properties: {
            id: {
              type: "string",
              description: "Notion 페이지 ID",
              example: "2a645f52-4cd0-80ea-9d7f-fe3ca69df522",
            },
            title: {
              type: "string",
              description: "미션 제목",
              example: "내가 좋아하는 책 읽고 책 추천사 써보기",
            },
            missionIntroduction: {
              type: "string",
              nullable: true,
              description: "미션 소개",
              example: "내가 좋아하는 책을 한권 선정해서 읽고 그 책을 쓴 작가를 위한 책 추천사 써보기",
            },
            coverImage: {
              type: "string",
              nullable: true,
              description: "노션 페이지 커버 이미지 URL (unsplash 등)",
              example: "https://images.unsplash.com/photo-1234567890",
            },
            isRecruiting: {
              type: "boolean",
              description: "현재 모집 여부",
              example: true,
            },
            isUnlimited: {
              type: "boolean",
              description: "무제한(상시) 미션 여부",
              example: false,
            },
            applicationDeadline: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "신청 마감일시(무제한이 아닐 경우)",
            },
            certificationDeadline: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "인증 마감일시",
            },
            categories: {
              type: "array",
              items: {type: "string"},
              description: "카테고리(다중 선택)",
              example: ["자기 탐색", "자기 만족"],
            },
            detailTags: {
              type: "string",
              nullable: true,
              description: "상세 태그(텍스트)",
              example: "혼자, 글쓰기",
            },
            targetAudience: {
              type: "string",
              nullable: true,
              description: "참여 대상",
            },
            notes: {
              type: "string",
              nullable: true,
              description: "참고 사항",
            },
            certificationMethod: {
              type: "array",
              nullable: true,
              description: "인증 방법 (Multi-select)",
              items: {
                type: "string",
              },
              example: ["사진과 함께 인증글 작성", "3줄 이상 글 작성"],
            },
            likesCount: {
              type: "integer",
              description: "앱에서 집계한 찜 수",
              example: 12,
            },
            isLiked: {
              type: "boolean",
              description: "현재 사용자가 찜했는지 여부 (비로그인 시 false)",
              example: true,
            },
            faqRelation: {
              type: "object",
              description: "FAQ 관계 정보",
              properties: {
                relations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "FAQ ID",
                        example: "2a645f52-4cd0-80b8-a954-c912f7c57f27",
                      },
                    },
                  },
                },
                has_more: {
                  type: "boolean",
                  description: "추가 FAQ 존재 여부",
                  example: false,
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Notion 페이지 생성 시간",
              example: "2025-11-09T13:12:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Notion 페이지 최근 수정 시간",
              example: "2025-11-09T23:00:00.000+09:00",
            },
          },
        },
        ImageUpload: {
          type: "object",
          required: ["image"],
          properties: {
            image: {
              type: "string",
              format: "binary",
              description: "업로드할 이미지 파일",
            },
          },
        },
        FileUpload: {
          type: "object",
          required: ["file"],
          properties: {
            file: {
              type: "string",
              format: "binary",
              description: "업로드할 파일 (multipart/form-data)",
            },
          },
        },
        FileUploadResponse: {
          type: "object",
          required: ["status", "data"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 201,
            },
            data: {
              type: "object",
              required: ["uploaded", "failed", "files", "errors"],
              properties: {
                uploaded: {
                  type: "number",
                  description: "성공적으로 업로드된 파일 수",
                  example: 1,
                },
                failed: {
                  type: "number",
                  description: "업로드 실패한 파일 수",
                  example: 0,
                },
                files: {
                  type: "array",
                  description: "업로드된 파일 정보 목록",
                  items: {
                    type: "object",
                    required: ["success"],
                    properties: {
                      success: {
                        type: "boolean",
                        description: "업로드 성공 여부",
                        example: true,
                      },
                      data: {
                        type: "object",
                        description: "업로드 성공 시 파일 정보",
                        properties: {
                          fileUrl: {
                            type: "string",
                            description: "파일 접근 URL",
                            example: "https://storage.googleapis.com/youthvoice-2025.firebasestorage.app/files/yzNfPCrnmwbqMV7ryNaAhQITjcC2/qr_ZFC_nDZJL_Fv.png",
                          },
                          fileName: {
                            type: "string",
                            description: "Cloud Storage 내 파일 경로",
                            example: "files/yzNfPCrnmwbqMV7ryNaAhQITjcC2/qr_ZFC_nDZJL_Fv.png",
                          },
                          originalFileName: {
                            type: "string",
                            description: "원본 파일명",
                            example: "qr.png",
                          },
                          mimeType: {
                            type: "string",
                            description: "MIME 타입",
                            example: "image/png",
                          },
                          size: {
                            type: "number",
                            description: "파일 크기 (바이트)",
                            example: 938831,
                          },
                          bucket: {
                            type: "string",
                            description: "Cloud Storage 버킷명",
                            example: "youthvoice-2025.firebasestorage.app",
                          },
                          path: {
                            type: "string",
                            description: "파일 경로",
                            example: "files/yzNfPCrnmwbqMV7ryNaAhQITjcC2/qr_ZFC_nDZJL_Fv.png",
                          },
                        },
                      },
                    },
                  },
                },
                errors: {
                  type: "array",
                  description: "업로드 실패 시 에러 메시지 목록",
                  items: {
                    type: "string",
                  },
                  example: [],
                },
              },
            },
          },
        },
        Image: {
          type: "object",
          required: ["url", "order"],
          properties: {
            url: {
              type: "string",
              description: "이미지 URL",
              example:
                "https://youthvoice.vake.io/files/G0IZUDWCL/FKGRWXUG8/file",
            },
            order: {
              type: "number",
              description: "이미지 순서",
              example: 1,
            },
          },
        },
        ContentItem: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["text", "image", "video", "embed", "file"],
              description: "콘텐츠 타입",
              example: "text",
            },
            order: {
              type: "number",
              description: "순서",
              example: 1,
            },
            content: {
              type: "string",
              description: "텍스트 내용 (text 타입일 때)",
              example: "오늘도 화이팅!",
            },
            url: {
              type: "string",
              description: "미디어 URL",
              example: "https://example.com/image.jpg",
            },
            width: {
              type: "number",
              description: "너비",
              example: 1080,
            },
            height: {
              type: "number",
              description: "높이",
              example: 1080,
            },
            blurHash: {
              type: "string",
              description: "블러 해시",
              example: "L6PZfSi_.AyE_3t7t7R**0o#DgR4",
            },
            thumbUrl: {
              type: "string",
              description: "썸네일 URL (video 전용)",
              example: "https://example.com/thumb.jpg",
            },
            videoSource: {
              type: "string",
              enum: ["uploaded", "youtube", "vimeo"],
              description: "비디오 소스",
              example: "uploaded",
            },
            provider: {
              type: "string",
              enum: ["youtube", "vimeo", "self"],
              description: "제공자",
              example: "self",
            },
            providerVideoId: {
              type: "string",
              description: "제공자 비디오 ID",
              example: "abc123",
            },
            duration: {
              type: "number",
              description: "비디오 길이 (초)",
              example: 120,
            },
            sizeBytes: {
              type: "number",
              description: "파일 크기",
              example: 1048576,
            },
            mimeType: {
              type: "string",
              description: "MIME 타입",
              example: "image/jpeg",
            },
            processingStatus: {
              type: "string",
              enum: ["uploaded", "processing", "ready", "failed"],
              description: "처리 상태",
              example: "ready",
            },
            transcodedVariants: {
              type: "array",
              description: "비디오 변환 결과",
              items: {
                type: "object",
                properties: {
                  resolution: {
                    type: "string",
                    description: "해상도",
                    example: "1080p",
                  },
                  bitrate: {
                    type: "number",
                    description: "비트레이트",
                    example: 2000,
                  },
                  url: {
                    type: "string",
                    description: "변환된 비디오 URL",
                    example: "https://example.com/video_1080p.mp4",
                  },
                },
              },
            },
            fileName: {
              type: "string",
              description: "파일명 (file 전용)",
              example: "document.pdf",
            },
          },
        },
        MediaItem: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["image", "video", "embed", "file"],
              description: "미디어 타입",
              example: "image",
            },
            url: {
              type: "string",
              description: "미디어 URL",
              example: "https://example.com/image.jpg",
            },
            order: {
              type: "number",
              description: "순서",
              example: 1,
            },
            width: {
              type: "number",
              description: "너비",
              example: 1080,
            },
            height: {
              type: "number",
              description: "높이",
              example: 1080,
            },
            blurHash: {
              type: "string",
              description: "블러 해시",
              example: "L6PZfSi_.AyE_3t7t7R**0o#DgR4",
            },
            thumbUrl: {
              type: "string",
              description: "썸네일 URL",
              example: "https://example.com/thumb.jpg",
            },
            videoSource: {
              type: "string",
              enum: ["uploaded", "youtube", "vimeo"],
              description: "비디오 소스",
              example: "uploaded",
            },
            provider: {
              type: "string",
              enum: ["youtube", "vimeo", "self"],
              description: "제공자",
              example: "self",
            },
            providerVideoId: {
              type: "string",
              description: "제공자 비디오 ID",
              example: "abc123",
            },
            duration: {
              type: "number",
              description: "비디오 길이 (초)",
              example: 120,
            },
            sizeBytes: {
              type: "number",
              description: "파일 크기",
              example: 1048576,
            },
            mimeType: {
              type: "string",
              description: "MIME 타입",
              example: "image/jpeg",
            },
            processingStatus: {
              type: "string",
              enum: ["uploaded", "processing", "ready", "failed"],
              description: "처리 상태",
              example: "ready",
            },
            transcodedVariants: {
              type: "array",
              description: "비디오 변환 결과",
              items: {
                type: "object",
                properties: {
                  resolution: {
                    type: "string",
                    description: "해상도",
                    example: "1080p",
                  },
                  bitrate: {
                    type: "number",
                    description: "비트레이트",
                    example: 2000,
                  },
                  url: {
                    type: "string",
                    description: "변환된 비디오 URL",
                    example: "https://example.com/video_1080p.mp4",
                  },
                },
              },
            },
            fileName: {
              type: "string",
              description: "파일명 (file 전용)",
              example: "document.pdf",
            },
          },
        },
        StandardResponse: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              description: "응답 데이터 (성공 시에만 포함)",
              nullable: true,
              oneOf: [
                {type: "object", additionalProperties: true},
                {type: "array", items: {type: "object"}},
                {type: "string"},
                {type: "number"},
                {type: "boolean"},
              ],
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["status", "message"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 400,
            },
            message: {
              type: "string",
              description: "에러 메시지",
              example: "잘못된 요청입니다",
            },
          },
        },
        UnauthorizedResponse: {
          type: "object",
          required: ["status", "message"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 401,
            },
            message: {
              type: "string",
              description: "인증 실패 사유",
              example: "토큰이 만료되었습니다",
            },
          },
        },
        AccountSuspendedResponse: {
          type: "object",
          required: ["status", "message"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 423,
            },
            message: {
              type: "string",
              description: "자격정지 사유",
              example: "계정이 자격정지 상태입니다",
            },
            data: {
              type: "object",
              properties: {
                suspensionEndAt: {
                  type: "string",
                  format: "date-time",
                  description: "자격정지 종료 일시",
                  example: "2024-12-31T23:59:59.000Z",
                },
              },
            },
          },
        },
        PaginatedResponse: {
          type: "object",
          required: ["status", "data", "pagination"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              type: "array",
              description: "응답 데이터 배열",
              items: {
                type: "object",
              },
            },
            pagination: {
              type: "object",
              description: "페이지네이션 정보",
              properties: {
                page: {
                  type: "number",
                  description: "현재 페이지",
                  example: 0,
                },
                size: {
                  type: "number",
                  description: "페이지당 항목 수",
                  example: 20,
                },
                totalElements: {
                  type: "number",
                  description: "전체 항목 수",
                  example: 100,
                },
                totalPages: {
                  type: "number",
                  description: "전체 페이지 수",
                  example: 5,
                },
                hasNext: {
                  type: "boolean",
                  description: "다음 페이지 존재 여부",
                  example: true,
                },
                hasPrevious: {
                  type: "boolean",
                  description: "이전 페이지 존재 여부",
                  example: false,
                },
              },
            },
          },
        },
        CreatedResponse: {
          type: "object",
          required: ["status", "data"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 201,
            },
            data: {
              type: "object",
              description: "생성된 리소스 데이터",
            },
          },
        },
        RoutineListItem: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "루틴 고유 ID",
              example: "routine_123",
            },
            name: {
              type: "string",
              description: "루틴 이름",
              example: "매일 운동하기",
            },
            description: {
              type: "string",
              description: "루틴 설명",
              example: "하루 30분씩 운동하는 루틴입니다",
            },
            status: {
              type: "string",
              enum: ["RECRUITING", "IN_PROGRESS", "COMPLETED"],
              description: "루틴 상태",
              example: "RECRUITING",
            },
            price: {
              type: "number",
              description: "가격",
              example: 10000,
            },
            currency: {
              type: "string",
              description: "통화",
              example: "KRW",
            },
            stockCount: {
              type: "integer",
              description: "재고 수량",
              example: 50,
            },
            soldCount: {
              type: "integer",
              description: "판매 수량",
              example: 10,
            },
            viewCount: {
              type: "integer",
              description: "조회수",
              example: 150,
            },
            buyable: {
              type: "boolean",
              description: "구매 가능 여부",
              example: true,
            },
            sellerId: {
              type: "string",
              description: "판매자 ID",
              example: "seller_123",
            },
            sellerName: {
              type: "string",
              description: "판매자 이름",
              example: "유스보이스",
            },
            deadline: {
              type: "string",
              format: "date-time",
              description: "마감일",
              example: "2024-12-31T23:59:59.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일",
              example: "2024-01-01T00:00:00.000Z",
            },
          },
        },
        RoutineDetail: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "루틴 고유 ID",
              example: "routine_123",
            },
            name: {
              type: "string",
              description: "루틴 이름",
              example: "매일 운동하기",
            },
            description: {
              type: "string",
              description: "루틴 설명",
              example: "하루 30분씩 운동하는 루틴입니다",
            },
            status: {
              type: "string",
              enum: ["RECRUITING", "IN_PROGRESS", "COMPLETED"],
              description: "루틴 상태",
              example: "RECRUITING",
            },
            price: {
              type: "number",
              description: "가격",
              example: 10000,
            },
            currency: {
              type: "string",
              description: "통화",
              example: "KRW",
            },
            stockCount: {
              type: "integer",
              description: "재고 수량",
              example: 50,
            },
            soldCount: {
              type: "integer",
              description: "판매 수량",
              example: 10,
            },
            viewCount: {
              type: "integer",
              description: "조회수",
              example: 151,
            },
            buyable: {
              type: "boolean",
              description: "구매 가능 여부",
              example: true,
            },
            sellerId: {
              type: "string",
              description: "판매자 ID",
              example: "seller_123",
            },
            sellerName: {
              type: "string",
              description: "판매자 이름",
              example: "유스보이스",
            },
            content: {
              type: "array",
              description: "루틴 상세 내용",
              items: {
                type: "object",
              },
            },
            media: {
              type: "array",
              description: "미디어 파일",
              items: {
                type: "object",
              },
            },
            options: {
              type: "array",
              description: "옵션 목록",
              items: {
                type: "object",
              },
            },
            primaryDetails: {
              type: "array",
              description: "주요 상세 정보",
              items: {
                type: "object",
              },
            },
            variants: {
              type: "array",
              description: "변형 옵션",
              items: {
                type: "object",
              },
            },
            customFields: {
              type: "array",
              description: "커스텀 필드",
              items: {
                type: "object",
              },
            },
            deadline: {
              type: "string",
              format: "date-time",
              description: "마감일",
              example: "2024-12-31T23:59:59.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일",
              example: "2024-01-01T00:00:00.000Z",
            },
            qna: {
              type: "array",
              description: "Q&A 목록",
              items: {
                $ref: "#/components/schemas/QnAItem",
              },
            },
            communityPosts: {
              type: "array",
              description: "커뮤니티 게시글 목록",
              items: {
                $ref: "#/components/schemas/CommunityPost",
              },
            },
          },
        },
        ApplicationResponse: {
          type: "object",
          properties: {
            applicationId: {
              type: "string",
              description: "신청 ID",
              example: "app_123",
            },
            type: {
              type: "string",
              description: "신청 타입",
              example: "ROUTINE",
            },
            targetId: {
              type: "string",
              description: "대상 ID",
              example: "routine_123",
            },
            userId: {
              type: "string",
              description: "사용자 ID",
              example: "user_123",
            },
            status: {
              type: "string",
              description: "신청 상태",
              example: "PENDING",
            },
            selectedVariant: {
              type: "string",
              nullable: true,
              description: "선택된 옵션",
            },
            quantity: {
              type: "integer",
              description: "수량",
              example: 1,
            },
            customFieldsRequest: {
              type: "object",
              description: "커스텀 필드 요청",
            },
            activityNickname: {
              type: "string",
              description: "활동용 닉네임",
              example: "기진맥진",
            },
            activityPhoneNumber: {
              type: "string",
              description: "활동용 전화번호",
              example: "010-1234-5678",
            },
            region: {
              type: "object",
              description: "지역 정보",
              properties: {
                city: {
                  type: "string",
                  description: "시/도",
                  example: "서울시",
                },
                district: {
                  type: "string",
                  description: "군/구",
                  example: "성동구",
                },
              },
            },
            currentSituation: {
              type: "string",
              description: "현재 상황 (자유 텍스트)",
              example: "현재 학교를 다니고 있지 않아요",
            },
            applicationSource: {
              type: "string",
              description: "신청 경로 (자유 텍스트)",
              example: "SNS(인스타그램, 블로그 등)",
            },
            applicationMotivation: {
              type: "string",
              description: "참여 동기 (자유 텍스트)",
              example: "일상을 좀 더 규칙적으로 관리하고 싶어서",
            },
            canAttendEvents: {
              type: "boolean",
              description: "필참 일정 참여 여부",
              example: true,
            },
            appliedAt: {
              type: "string",
              format: "date-time",
              description: "신청일",
              example: "2024-01-01T00:00:00.000Z",
            },
            targetName: {
              type: "string",
              description: "대상 이름",
              example: "매일 운동하기",
            },
            targetPrice: {
              type: "number",
              description: "대상 가격",
              example: 10000,
            },
          },
        },
        Review: {
          type: "object",
          properties: {
            reviewId: {
              type: "string",
              description: "리뷰 고유 ID",
            },
            type: {
              type: "string",
              enum: ["ROUTINE", "GATHERING"],
              description: "리뷰 타입",
            },
            targetId: {
              type: "string",
              description: "루틴 ID 또는 소모임 ID",
            },
            userId: {
              type: "string",
              description: "사용자 ID",
            },
            content: {
              type: "string",
              description: "리뷰 내용",
            },
            images: {
              type: "array",
              items: {
                type: "string",
                description: "이미지 URL",
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        QnAItem: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Q&A ID",
              example: "qna_123",
            },
            content: {
              type: "array",
              description: "질문 내용",
              items: {
                type: "object",
              },
            },
            media: {
              type: "array",
              description: "미디어 파일",
              items: {
                type: "object",
              },
            },
            answerContent: {
              type: "array",
              nullable: true,
              description: "답변 내용",
              items: {
                type: "object",
              },
            },
            answerMedia: {
              type: "array",
              description: "답변 미디어",
              items: {
                type: "object",
              },
            },
            answerUserId: {
              type: "string",
              nullable: true,
              description: "답변자 ID",
              example: "user_456",
            },
            askedBy: {
              type: "string",
              description: "질문자 ID",
              example: "user_123",
            },
            answeredBy: {
              type: "string",
              nullable: true,
              description: "답변자 ID",
              example: "user_456",
            },
            askedAt: {
              type: "string",
              format: "date-time",
              description: "질문일",
              example: "2024-01-01T00:00:00.000Z",
            },
            answeredAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "답변일",
              example: "2024-01-02T00:00:00.000Z",
            },
            likesCount: {
              type: "integer",
              description: "좋아요 수",
              example: 5,
            },
          },
        },
        CommunityPostListItem: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "게시글 ID",
              example: "AMrsQRg9tBY0ZGJMbKG2",
            },
            type: {
              type: "string",
              description: "게시글 타입",
              example: "TMI",
            },
            author: {
              type: "string",
              description: "작성자",
              example: "사용자닉네임",
            },
            profileImageUrl: {
              type: "string",
              nullable: true,
              description: "작성자 프로필 이미지 URL",
              example: "https://example.com/profile.jpg",
            },
            title: {
              type: "string",
              description: "제목",
              example: "오늘의 루틴 인증!",
            },
            preview: {
              type: "object",
              description: "미리보기 정보",
              properties: {
                description: {
                  type: "string",
                  description: "미리보기 설명",
                  example: "오늘도 화이팅!",
                },
                thumbnail: {
                  type: "object",
                  nullable: true,
                  description: "썸네일 정보 (null 가능)",
                  properties: {
                    url: {
                      type: "string",
                      description: "썸네일 URL",
                      example: "https://example.com/image.jpg",
                    },
                    blurHash: {
                      type: "string",
                      description: "블러 해시",
                      example: "L6PZfSi_.AyE_3t7t7R**0o#DgR4",
                    },
                    width: {
                      type: "integer",
                      description: "너비",
                      example: 1080,
                    },
                    height: {
                      type: "integer",
                      description: "높이",
                      example: 1080,
                    },
                  },
                },
              },
            },
            mediaCount: {
              type: "integer",
              description: "미디어 개수",
              example: 0,
            },
            channel: {
              type: "string",
              description: "채널명",
              example: "TMI 자아탐색",
            },
            category: {
              type: "string",
              nullable: true,
              description: "카테고리",
              example: "string",
            },
            tags: {
              type: "array",
              description: "태그 목록",
              items: {
                type: "string",
              },
              example: ["string"],
            },
            scheduledDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "예약 발행 날짜",
              example: "2025-10-03T17:15:04.882Z",
            },
            isLocked: {
              type: "boolean",
              description: "잠금 여부",
              example: false,
            },
            isPublic: {
              type: "boolean",
              description: "공개 여부",
              example: true,
            },
            likesCount: {
              type: "integer",
              description: "좋아요 수",
              example: 0,
            },
            isLiked: {
              type: "boolean",
              nullable: true,
              description: "사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)",
            },
            commentsCount: {
              type: "integer",
              description: "댓글 수",
              example: 0,
            },
            reportsCount: {
              type: "integer",
              description: "신고 횟수",
              example: 0,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일",
              example: "2025-10-03T17:15:07.862Z",
            },
            timeAgo: {
              type: "string",
              description: "상대적 시간",
              example: "2분 전",
            },
          },
        },
        CommunityPost: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "게시글 ID",
              example: "post_123",
            },
            type: {
              type: "string",
              description: "게시글 타입",
              example: "ROUTINE_CERT",
            },
            programType: {
              type: "string",
              enum: ["ROUTINE", "GATHERING", "TMI"],
              description: "프로그램 유형",
              example: "TMI",
            },
            author: {
              type: "string",
              description: "작성자",
              example: "사용자닉네임",
            },
            authorId: {
              type: "string",
              nullable: true,
              description: "작성자 UID",
              example: "user_123",
            },
            title: {
              type: "string",
              description: "제목",
              example: "오늘의 루틴 인증!",
            },
            content: {
              type: "string",
              description: "게시글 HTML 내용",
              example: "<p>게시글 내용입니다!</p>",
            },
            media: {
              type: "array",
              items: {
                type: "string",
              },
              description: "미디어 파일 경로 목록",
              example: ["files/eVyK7rI0-_PM/qr_x4WtsPDPmozu.png"],
            },
            channel: {
              type: "string",
              description: "채널명",
              example: "플래너 인증 루틴",
            },
            isLocked: {
              type: "boolean",
              description: "잠금 여부",
              example: false,
            },
            isPublic: {
              type: "boolean",
              description: "공개 여부",
              example: true,
            },
            likesCount: {
              type: "integer",
              description: "좋아요 수",
              example: 10,
            },
            isLiked: {
              type: "boolean",
              nullable: true,
              description: "사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)",
            },
            isAuthor: {
              type: "boolean",
              description: "작성자 여부 (본인 게시글인지, 인증된 요청일 때만 포함)",
              example: false,
            },
            commentsCount: {
              type: "integer",
              description: "댓글 수",
              example: 3,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일",
              example: "2024-01-01T00:00:00.000Z",
            },
            profileImageUrl: {
              type: "string",
              nullable: true,
              description: "작성자 프로필 이미지 URL",
              example: "https://example.com/profile.jpg",
            },
          },
        },
        Comment: {
          type: "object",
          properties: {
            commentId: {
              type: "string",
              description: "댓글 고유 ID",
            },
            type: {
              type: "string",
              enum: [
                "tmi",
                "review",
                "routine_cert",
                "gathering",
                "community_post",
              ],
              description: "댓글 타입",
            },
            targetId: {
              type: "string",
              description: "대상 ID",
            },
            userId: {
              type: "string",
              description: "사용자 ID",
            },
            content: {
              type: "string",
              description: "댓글 내용",
            },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "이미지 URL",
                  },
                  order: {
                    type: "number",
                    description: "이미지 순서",
                  },
                },
              },
            },
            parentId: {
              type: "string",
              nullable: true,
              description: "부모 댓글 ID",
            },
            depth: {
              type: "number",
              description: "댓글 깊이",
            },
            isReply: {
              type: "boolean",
              description: "답글 여부",
            },
            isLocked: {
              type: "boolean",
              description: "댓글 잠금 여부",
            },
            reportsCount: {
              type: "number",
              description: "신고 횟수",
            },
            deleted: {
              type: "boolean",
              description: "삭제 여부",
            },
            deletedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "삭제일시",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        GatheringListItem: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "소모임 고유 ID",
              example: "gathering_123",
            },
            name: {
              type: "string",
              description: "소모임 이름",
              example: "월간 독서 모임",
            },
            description: {
              type: "string",
              description: "소모임 설명",
              example: "매월 한 권씩 책을 읽고 토론하는 모임입니다",
            },
            status: {
              type: "string",
              enum: ["RECRUITING", "IN_PROGRESS", "COMPLETED"],
              description: "소모임 상태",
              example: "RECRUITING",
            },
            price: {
              type: "number",
              description: "가격",
              example: 5000,
            },
            currency: {
              type: "string",
              description: "통화",
              example: "KRW",
            },
            stockCount: {
              type: "integer",
              description: "재고 수량",
              example: 20,
            },
            soldCount: {
              type: "integer",
              description: "판매 수량",
              example: 5,
            },
            viewCount: {
              type: "integer",
              description: "조회수",
              example: 80,
            },
            buyable: {
              type: "boolean",
              description: "구매 가능 여부",
              example: true,
            },
            sellerId: {
              type: "string",
              description: "판매자 ID",
              example: "seller_123",
            },
            sellerName: {
              type: "string",
              description: "판매자 이름",
              example: "독서 코치",
            },
            deadline: {
              type: "string",
              format: "date-time",
              description: "마감일",
              example: "2024-12-31T23:59:59.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일",
              example: "2024-01-01T00:00:00.000Z",
            },
          },
        },
        GatheringDetail: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "소모임 고유 ID",
              example: "gathering_123",
            },
            name: {
              type: "string",
              description: "소모임 이름",
              example: "월간 독서 모임",
            },
            description: {
              type: "string",
              description: "소모임 설명",
              example: "매월 한 권씩 책을 읽고 토론하는 모임입니다",
            },
            status: {
              type: "string",
              enum: ["RECRUITING", "IN_PROGRESS", "COMPLETED"],
              description: "소모임 상태",
              example: "RECRUITING",
            },
            price: {
              type: "number",
              description: "가격",
              example: 5000,
            },
            currency: {
              type: "string",
              description: "통화",
              example: "KRW",
            },
            stockCount: {
              type: "integer",
              description: "재고 수량",
              example: 20,
            },
            soldCount: {
              type: "integer",
              description: "판매 수량",
              example: 5,
            },
            viewCount: {
              type: "integer",
              description: "조회수",
              example: 81,
            },
            buyable: {
              type: "boolean",
              description: "구매 가능 여부",
              example: true,
            },
            sellerId: {
              type: "string",
              description: "판매자 ID",
              example: "seller_123",
            },
            sellerName: {
              type: "string",
              description: "판매자 이름",
              example: "독서 코치",
            },
            content: {
              type: "array",
              description: "소모임 상세 내용",
              items: {
                type: "object",
              },
            },
            media: {
              type: "array",
              description: "미디어 파일",
              items: {
                type: "object",
              },
            },
            options: {
              type: "array",
              description: "옵션 목록",
              items: {
                type: "object",
              },
            },
            primaryDetails: {
              type: "array",
              description: "주요 상세 정보",
              items: {
                type: "object",
              },
            },
            variants: {
              type: "array",
              description: "변형 옵션",
              items: {
                type: "object",
              },
            },
            customFields: {
              type: "array",
              description: "커스텀 필드",
              items: {
                type: "object",
              },
            },
            deadline: {
              type: "string",
              format: "date-time",
              description: "마감일",
              example: "2024-12-31T23:59:59.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일",
              example: "2024-01-01T00:00:00.000Z",
            },
            qna: {
              type: "array",
              description: "Q&A 목록",
              items: {
                $ref: "#/components/schemas/QnAItem",
              },
            },
            communityPosts: {
              type: "array",
              description: "커뮤니티 게시글 목록",
              items: {
                $ref: "#/components/schemas/CommunityPost",
              },
            },
          },
        },
        Community: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "커뮤니티 고유 ID",
            },
            name: {
              type: "string",
              description: "커뮤니티 이름",
            },
            interestTag: {
              type: "string",
              description: "관심사 태그",
            },
            type: {
              type: "string",
              enum: ["interest", "anonymous"],
              description: "커뮤니티 타입",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            createdBy: {
              type: "string",
              description: "생성자 ID",
            },
            linkedChat: {
              type: "string",
              description: "연결된 채팅방 ID",
            },
          },
        },
        CommunityMember: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "멤버 ID",
              example: "member_123",
            },
            userId: {
              type: "string",
              description: "사용자 ID",
              example: "user_123",
            },
            nickname: {
              type: "string",
              nullable: true,
              description: "사용자 닉네임",
              example: "사용자닉네임",
            },
            avatar: {
              type: "string",
              nullable: true,
              description: "프로필 이미지 URL",
              example: "https://example.com/avatar.jpg",
            },
            role: {
              type: "string",
              enum: ["member", "admin", "moderator"],
              description: "멤버 역할",
              example: "member",
            },
            status: {
              type: "string",
              nullable: true,
              enum: ["pending", "approved", "suspended"],
              description: "멤버 상태 (승인대기/승인/정지)",
              example: "approved",
            },
            joinedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "가입일시",
              example: "2025-10-03T17:15:07.862Z",
            },
            lastActiveAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "마지막 활동일시",
              example: "2025-10-03T18:30:15.123Z",
            },
          },
        },
        Post: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "게시글 고유 ID",
              example: "CERT_1758883064394",
            },
            type: {
              type: "string",
              enum: ["ROUTINE_CERT", "TMI", "GATHERING_REVIEW"],
              description: "게시글 타입",
              example: "ROUTINE_CERT",
            },
            author: {
              type: "string",
              description: "작성자 닉네임",
              example: "사용자닉네임",
            },
            communityPath: {
              type: "string",
              description: "커뮤니티 경로",
              example: "communities/routine-cert",
            },
            title: {
              type: "string",
              description: "게시글 제목",
              example: "오늘의 루틴 인증!",
            },
            content: {
              type: "array",
              description: "게시글 본문 내용",
              items: {
                $ref: "#/components/schemas/ContentItem",
              },
            },
            channel: {
              type: "string",
              description: "채널명",
              example: "플래너 인증 루틴",
            },
            isLocked: {
              type: "boolean",
              description: "잠금 여부",
              example: false,
            },
            isPublic: {
              type: "boolean",
              description: "공개 여부",
              example: true,
            },
            rewardGiven: {
              type: "boolean",
              description: "리워드 지급 여부",
              example: false,
            },
            reactionsCount: {
              type: "number",
              description: "반응 수",
              example: 0,
            },
            likesCount: {
              type: "number",
              description: "좋아요 수",
              example: 0,
            },
            isLiked: {
              type: "boolean",
              nullable: true,
              description: "사용자가 좋아요를 눌렀다면 true (인증된 요청일 때만 포함)",
            },
            commentsCount: {
              type: "number",
              description: "댓글 수",
              example: 0,
            },
            reportsCount: {
              type: "number",
              description: "신고 수",
              example: 0,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
              example: "2025-09-28T14:39:41.690Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
              example: "2025-09-28T14:39:41.690Z",
            },
          },
        },
        ActivityResponse: {
          type: "object",
          properties: {
            activityId: {
              type: "string",
              description: "활동 고유 ID",
            },
            type: {
              type: "string",
              enum: ["GATHERING_REVIEW", "ROUTINE_CERT", "TMI_REVIEW"],
              description: "활동 구분",
            },
            userId: {
              type: "string",
              description: "작성자 ID",
            },
            title: {
              type: "string",
              description: "제목",
            },
            content: {
              type: "string",
              description: "내용",
            },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "이미지 URL",
                  },
                  order: {
                    type: "number",
                    description: "이미지 순서",
                  },
                },
              },
            },
            likesCount: {
              type: "number",
              description: "좋아요 수",
            },
            commentsCount: {
              type: "number",
              description: "댓글 수",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        LikeToggleResponse: {
          type: "object",
          properties: {
            routineId: {
              type: "string",
              description: "루틴 ID",
              example: "routine_123",
            },
            userId: {
              type: "string",
              description: "사용자 ID",
              example: "user_123",
            },
            isLiked: {
              type: "boolean",
              description: "좋아요 여부",
              example: true,
            },
            likesCount: {
              type: "integer",
              description: "좋아요 수",
              example: 5,
            },
          },
        },
        QnALikeToggleResponse: {
          type: "object",
          properties: {
            qnaId: {
              type: "string",
              description: "Q&A ID",
              example: "qna_123",
            },
            userId: {
              type: "string",
              description: "사용자 ID",
              example: "user_123",
            },
            isLiked: {
              type: "boolean",
              description: "좋아요 여부",
              example: true,
            },
            likesCount: {
              type: "integer",
              description: "좋아요 수",
              example: 3,
            },
          },
        },
        Announcement: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "공지사항 ID (Notion 페이지 ID)",
              example: "abc123def456",
            },
            title: {
              type: "string",
              description: "공지사항 제목",
              example: "새로운 기능 업데이트 안내",
            },
            author: {
              type: "string",
              nullable: true,
              description: "작성자 ID",
              example: "user_123",
            },
            contentRich: {
              type: "array",
              description: "노션 블록 형태의 상세 내용",
              items: {
                type: "object",
                description: "노션 블록 객체",
              },
            },
            pinned: {
              type: "boolean",
              nullable: true,
              description: "고정 여부",
              example: false,
            },
            startDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "공지 시작일",
              example: "2024-01-01T00:00:00.000Z",
            },
            endDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "공지 종료일",
              example: "2024-12-31T23:59:59.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
              example: "2024-01-01T00:00:00.000Z",
            },
            isDeleted: {
              type: "boolean",
              description: "삭제 여부",
              example: false,
            },
          },
        },
        AnnouncementListResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              type: "array",
              description: "공지사항 목록",
              items: {
                $ref: "#/components/schemas/Announcement",
              },
            },
          },
        },
        AnnouncementDetailResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              $ref: "#/components/schemas/Announcement",
            },
          },
        },
        AnnouncementSyncResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              $ref: "#/components/schemas/Announcement",
            },
          },
        },
        AnnouncementDeleteResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "공지사항 ID",
                  example: "abc123def456",
                },
                isDeleted: {
                  type: "boolean",
                  description: "삭제 여부",
                  example: true,
                },
                updatedAt: {
                  type: "string",
                  format: "date-time",
                  description: "수정일시",
                  example: "2024-01-01T00:00:00.000Z",
                },
              },
            },
          },
        },
        FCMToken: {
          type: "object",
          required: ["token"],
          properties: {
            token: {
              type: "string",
              description: "FCM 토큰",
              example: "fcm_token_example_123456789",
            },
            deviceInfo: {
              type: "string",
              description: "디바이스 정보 (브라우저 userAgent, 모바일 deviceId 등)",
              example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            deviceType: {
              type: "string",
              enum: ["pwa", "mobile", "web"],
              description: "디바이스 타입",
              default: "pwa",
              example: "pwa",
            },
          },
        },
        FCMTokenResponse: {
          type: "object",
          properties: {
            deviceId: {
              type: "string",
              description: "디바이스 ID",
              example: "device_abc123def456",
            },
            message: {
              type: "string",
              description: "응답 메시지",
              example: "토큰 저장 완료",
            },
          },
        },
        FCMTokenListResponse: {
          type: "object",
          properties: {
            tokens: {
              type: "array",
              description: "FCM 토큰 목록",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "디바이스 ID (문서 ID)",
                    example: "63279522febcf5538b72",
                  },
                  token: {
                    type: "string",
                    description: "FCM 토큰",
                    example: "fcm_token_example_123456789",
                  },
                  deviceType: {
                    type: "string",
                    description: "디바이스 타입",
                    example: "pwa",
                  },
                  deviceInfo: {
                    type: "string",
                    description: "디바이스 정보",
                    example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  },
                  lastUsed: {
                    type: "string",
                    format: "date-time",
                    description: "마지막 사용 시간",
                    example: "2024-01-01T00:00:00.000Z",
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    description: "생성 시간",
                    example: "2024-01-01T00:00:00.000Z",
                  },
                },
              },
            },
          },
        },
        FCMDeleteResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "삭제 결과 메시지",
              example: "토큰이 삭제되었습니다.",
            },
          },
        },
        Program: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "프로그램 ID",
              example: "program_123",
            },
            title: {
              type: "string",
              description: "프로그램 제목",
              example: "청년 리더십 프로그램",
            },
            programName: {
              type: "string",
              description: "프로그램명",
              example: "2024 청년 리더십 아카데미",
            },
            description: {
              type: "string",
              description: "프로그램 소개글",
              example: "청년들의 리더십 역량을 기르는 프로그램입니다.",
            },
            programType: {
              type: "string",
              enum: ["ROUTINE", "TMI", "GATHERING"],
              description: "프로그램 종류",
              example: "ROUTINE",
            },
            recruitmentStatus: {
              type: "string",
              enum: ["모집 전", "모집 중", "모집 완료"],
              description: "모집상태 (날짜 기반 자동 계산)",
              example: "모집 중",
            },
            programStatus: {
              type: "string",
              enum: ["진행 전", "진행 중", "종료됨"],
              description: "프로그램 진행여부 (날짜 기반 자동 계산)",
              example: "진행 전",
            },
            recruitmentStartDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "모집 시작 날짜",
              example: "2024-01-01",
            },
            recruitmentEndDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "모집 종료 날짜",
              example: "2024-02-29",
            },
            startDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "활동 시작 날짜",
              example: "2024-03-01",
            },
            endDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "활동 종료 날짜",
              example: "2024-06-30",
            },
            displayStartDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "표시 시작 날짜",
              example: "2024-02-15",
            },
            orientationDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "오티 날짜",
              example: "2024-03-05",
            },
            shareMeetingDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "공유회 날짜",
              example: "2024-06-25",
            },
            targetAudience: {
              type: "string",
              description: "참여 대상",
              example: "20-30세 청년",
            },
            thumbnail: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "파일명",
                  },
                  url: {
                    type: "string",
                    description: "이미지 URL",
                  },
                  type: {
                    type: "string",
                    description: "파일 타입",
                  },
                },
              },
              description: "썸네일",
            },
            coverImage: {
              type: "string",
              nullable: true,
              description: "커버 이미지 URL (Notion 페이지 커버 이미지)",
              example: "https://example.com/cover-image.jpg",
            },
            linkUrl: {
              type: "string",
              description: "바로 보러 가기 URL",
              example: "https://example.com/program",
            },
            isReviewRegistered: {
              type: "boolean",
              description: "프로그램 후기 등록 여부",
              example: false,
            },
            isBannerRegistered: {
              type: "boolean",
              description: "하단 배너 등록 여부",
              example: true,
            },
            participants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "참여자 이름",
                    example: "김철수",
                  },
                  id: {
                    type: "string",
                    nullable: true,
                    description: "참여자 ID",
                    example: "user_123",
                  },
                },
              },
              description: "참여자 정보",
              example: [
                { name: "김철수", id: "user_123" },
                { name: "이영희", id: "user_456" }
              ],
            },
            notes: {
              type: "string",
              description: "참고 사항",
              example: "온라인 진행",
            },
            faqRelation: {
              type: "object",
              properties: {
                relations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "FAQ ID",
                      },
                    },
                  },
                  description: "FAQ 관계 목록",
                },
                has_more: {
                  type: "boolean",
                  description: "추가 FAQ 관계 존재 여부",
                  example: false,
                },
              },
              description: "FAQ 관계 정보",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "[Deprecated] 최근 수정 날짜. 'updatedAt' 사용 권장",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "최근 수정 날짜",
              example: "2024-01-01T00:00:00.000Z",
            },
            notionPageTitle: {
              type: "string",
              description: "상세페이지(노션) 제목",
              example: "청년 리더십 프로그램 상세 안내",
            },
            leaderNickname: {
              type: "string",
              nullable: true,
              description: "리더 사용자 별명",
              example: "홍길동",
            },
            leaderRealName: {
              type: "string",
              nullable: true,
              description: "리더 사용자 실명",
              example: "홍길동",
            },
          },
        },
        ProgramDetail: {
          allOf: [
            {
              $ref: "#/components/schemas/Program",
            },
            {
              type: "object",
              properties: {
                pageContent: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        description: "블록 타입",
                      },
                      id: {
                        type: "string",
                        description: "블록 ID",
                      },
                      text: {
                        type: "string",
                        description: "텍스트 내용",
                      },
                      richText: {
                        type: "array",
                        items: {
                          type: "object",
                        },
                        description: "Rich Text 형태의 내용",
                      },
                      hasChildren: {
                        type: "boolean",
                        description: "하위 블록 존재 여부",
                      },
                      checked: {
                        type: "boolean",
                        description: "체크박스 상태 (to_do 타입)",
                      },
                      icon: {
                        type: "object",
                        description: "아이콘 정보 (callout 타입)",
                      },
                      url: {
                        type: "string",
                        description: "미디어 URL (image, video, file 타입)",
                      },
                      caption: {
                        type: "string",
                        description: "캡션 (미디어 타입)",
                      },
                    },
                  },
                  description: "프로그램 페이지 상세 내용",
                },
                faqList: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "FAQ ID",
                      },
                      title: {
                        type: "string",
                        description: "FAQ 제목",
                      },
                      category: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                        description: "FAQ 카테고리",
                      },
                      content: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: {
                              type: "string",
                            },
                            id: {
                              type: "string",
                            },
                            text: {
                              type: "string",
                            },
                          },
                        },
                        description: "FAQ 내용 (블록 형태)",
                      },
                      createdAt: {
                        type: "string",
                        format: "date-time",
                        description: "생성일시",
                      },
                      updatedAt: {
                        type: "string",
                        format: "date-time",
                        description: "수정일시",
                      },
                    },
                  },
                  description: "관련 FAQ 목록",
                },
              },
            },
          ],
        },
        ProgramListResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "응답 메시지",
                  example: "프로그램 목록을 성공적으로 조회했습니다.",
                },
                programs: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Program",
                  },
                  description: "프로그램 목록",
                },
                pagination: {
                  type: "object",
                  properties: {
                    hasMore: {
                      type: "boolean",
                      description: "다음 페이지 존재 여부",
                      example: true,
                    },
                    nextCursor: {
                      type: "string",
                      description: "다음 페이지 커서",
                      example: "cursor_123",
                    },
                    totalCount: {
                      type: "number",
                      description: "전체 개수",
                      example: 50,
                    },
                  },
                },
              },
            },
          },
        },
        ProgramDetailResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "응답 메시지",
                  example: "프로그램 상세 정보를 성공적으로 조회했습니다.",
                },
                program: {
                  $ref: "#/components/schemas/ProgramDetail",
                },
              },
            },
          },
        },
        ProgramSearchResponse: {
          type: "object",
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "응답 메시지",
                  example: "'청년'에 대한 검색 결과를 성공적으로 조회했습니다.",
                },
                programs: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Program",
                  },
                  description: "검색된 프로그램 목록",
                },
                pagination: {
                  type: "object",
                  properties: {
                    hasMore: {
                      type: "boolean",
                      description: "다음 페이지 존재 여부",
                      example: false,
                    },
                    nextCursor: {
                      type: "string",
                      description: "다음 페이지 커서",
                      example: null,
                    },
                    totalCount: {
                      type: "number",
                      description: "검색 결과 총 개수",
                      example: 5,
                    },
                  },
                },
                searchTerm: {
                  type: "string",
                  description: "검색어",
                  example: "청년",
                },
              },
            },
          },
        },
        Success: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 200,
            },
            data: {
              description: "응답 데이터 (성공 시에만 포함)",
              nullable: true,
              oneOf: [
                {type: "object", additionalProperties: true},
                {type: "array", items: {type: "object"}},
                {type: "string"},
                {type: "number"},
                {type: "boolean"},
              ],
            },
          },
        },
        Error: {
          type: "object",
          required: ["status", "message"],
          properties: {
            status: {
              type: "number",
              description: "HTTP 상태 코드",
              example: 400,
            },
            message: {
              type: "string",
              description: "에러 메시지",
              example: "잘못된 요청입니다",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js", "./src/docs/*.js"],
};

// 기본 Swagger 스펙 생성
const specs = swaggerJSDoc(options);

// 자동 생성된 Swagger와 병합
async function getMergedSwaggerSpecs() {
  try {
    // require 캐시 삭제로 파일 변경사항 반영
    const swaggerConfigPath = require.resolve("./swagger.js");
    delete require.cache[swaggerConfigPath];

    // 매번 새로운 스펙을 생성해서 변경사항이 반영되도록 함
    return swaggerJSDoc(options);
  } catch (error) {
    console.warn("⚠️  자동 Swagger 병합 실패, 기본 스펙 사용:", error.message);
    return swaggerJSDoc(options);
  }
}

module.exports = {
  // 기본 스펙 (기존 호환성)
  default: specs,

  // 병합된 스펙 (자동 생성 포함)
  getMerged: getMergedSwaggerSpecs,
};
