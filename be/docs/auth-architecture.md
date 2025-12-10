# 인증 아키텍처 플로우

이 문서는 Yourdentity 프로젝트의 인증 시스템 아키텍처와 주요 플로우를 설명합니다.

## 개요

- **인증 방식**: Firebase Authentication + Kakao OAuth (OpenID Connect)
- **토큰 관리**: Firebase ID Token (Bearer Token)
- **데이터베이스**: Cloud Firestore

## 주요 플로우

### 1. 카카오 로그인

#### 신규 사용자
1. 사용자가 카카오 로그인 버튼 클릭
2. 카카오 OAuth 인증 진행
3. Firebase Auth에 사용자 생성
4. Firestore에 기본 사용자 문서 자동 생성 (Auth Trigger)
5. 카카오 프로필 정보 동기화 (이름, 이메일, 전화번호, 생년월일, 성별, 약관 동의)
6. 온보딩 페이지로 이동하여 닉네임 설정

#### 기존 사용자
1. 사용자가 카카오 로그인 버튼 클릭
2. 카카오 OAuth 인증 진행
3. Firebase Auth 로그인
4. 닉네임이 없으면 온보딩 페이지로 이동
5. 닉네임이 있으면 메인 페이지로 이동

### 2. 온보딩 프로세스

1. 신규 사용자 또는 닉네임이 없는 사용자는 온보딩 페이지로 이동
2. 카카오 프로필 정보 동기화 시도
   - 성공: 카카오에서 받은 정보(이름, 이메일, 전화번호, 생년월일, 성별, 약관 동의)를 Firestore에 저장
   - 실패: 사용자에게 재시도 안내
3. 사용자가 닉네임 설정
4. 온보딩 완료 후 메인 페이지로 이동

### 3. 로그아웃

1. 프론트엔드에서 Firebase Auth 로그아웃
2. 백엔드 API 호출하여 모든 Refresh Token 무효화
3. 로그인 페이지로 이동

### 4. 회원 탈퇴

1. 사용자가 회원 탈퇴 요청
2. 카카오 재인증으로 새로운 액세스 토큰 발급
3. 백엔드 API 호출:
   - 카카오 연결 해제
   - Firestore 개인정보 가명처리 (생년월일만 마스킹하여 유지)
   - Firebase Auth 사용자 삭제
4. 로그인 페이지로 이동

## 보안

- 모든 API 요청은 Firebase ID Token을 Bearer Token으로 전달
- 백엔드에서 토큰 검증 및 사용자 인증 상태 확인
- 로그아웃 시 모든 Refresh Token 무효화로 기존 토큰 사용 불가
- 회원 탈퇴 시 개인정보 가명처리로 데이터 보호

## Firebase Triggers

- **onCreate**: 사용자 생성 시 Firestore에 기본 사용자 문서 자동 생성
- **onDelete**: 사용자 삭제 시 Firestore 데이터 가명처리
