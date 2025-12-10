## FCM 푸시 알림 아키텍처 

### 개요
- FCM 토큰 발급 및 저장, 서버 전송, 관리자(노션 등) 발송, 단건/대량 푸시 흐름을 정리.
- 백엔드: Cloud Functions(`fcmService`, `fcmHelper`, `notificationService`) + Firestore(`users/{uid}/fcmTokens/{deviceId}`).
- 프론트(PWA/Web): Firebase Client SDK로 토큰 발급/등록, 포그라운드·백그라운드 수신 처리.

---

## 1. 구성 요소
- **Routes**: `/fcm/token (POST)` 토큰 저장/업데이트 (컨트롤러 `fcmController`, 서비스 `fcmService.saveToken`).
- **Controllers**: `fcmController` (save/get/delete 토큰).
- **Services**:
  - `fcmService`: 토큰 저장/조회/삭제/갱신, 단건(`sendToUser`), 다건(`sendToUsers`), 실제 전송(`sendToTokens`).
  - `notificationService`: 노션 등 대량 알림에서 `fcmHelper`를 호출, 알림 내역 저장/Notion 필드 업데이트.
- **Utils**: `fcmHelper`
  - `sendNotification(userId, ..., options)` → `sendToUser`
  - `sendNotificationToUsers(userIds, ..., options)` → `sendToUsers`
- **Firebase Admin SDK**: `messaging().sendEachForMulticast(message)` 사용.
- **Firestore(토큰 저장)**: `users/{userId}/fcmTokens/{deviceId}`
  - `token, deviceType, deviceInfo, lastUsed, createdAt`
- **FCM Server (Google)**: 멀티캐스트 응답 반환.
- **Frontend (PWA/Web)**:
  - 토큰 발급: `firebase.messaging().getToken(vapidKey)`
  - 토큰 전송: `POST /fcm/token`
  - 포그라운드 수신: `onMessage` → toast/Notification API
  - 백그라운드 수신: `firebase-messaging-sw.js` → `showNotification`
- **관리자 발송(노션)**:
  - 노션 알림 페이지 → `notificationService.sendNotification` → `fcmHelper.sendNotificationToUsers`
  - marketing / pushTerms 동의에 따라 필터링, 알림 내역 저장, 실패/필터링 결과를 응답에 포함.

---

## 2. 전송 플로우
```
관리자(노션) 발송
  notificationService.sendNotification  
    → fcmHelper.sendNotificationToUsers
      → fcmService.sendToUsers
        → sendToTokens → fcmAdmin.messaging().sendEachForMulticast(message)

서비스 로직 발송
  단건: fcmHelper.sendNotification 
       → fcmService.sendToUser 
         → sendToTokens 
           → fcmAdmin.messaging().sendEachForMulticast(message)
  다건: fcmHelper.sendNotificationToUsers 
       → fcmService.sendToUsers 
         → sendToTokens 
           → fcmAdmin.messaging().sendEachForMulticast(message)

FCM Server → 디바이스(PWA/Web)
프론트:
  onMessage(포그라운드) → toast/Notification API
  service worker(백그라운드) → showNotification
```

---

## 3. 토큰 관리
- `saveToken(userId, token, deviceInfo, deviceType)`
  - 동일 토큰이면 `lastUsed`만 갱신.
  - 사용자당 최대 5개 유지(5개 초과 시 `lastUsed` 필드 기반 가장 오래 안 쓴 토큰부터 제거).
  - 경로: `users/{uid}/fcmTokens/{deviceId}`
  - PWA/Web: `userAgent` 해시로 `deviceId` 생성, Mobile: 전달받은 `deviceId`.
- `getUserTokens(userId)`: 사용자 토큰 목록 조회.
- `deleteToken(userId, deviceId)`: 특정 디바이스 토큰 삭제.
- `updateTokenLastUsed(userId, deviceId)`: `lastUsed` 갱신.

---

## 4. 전송 정책 (푸시 동의/알림 저장)
- **일반 알림**: `pushTermsAgreed === true` 사용자에게만 전송(옵션 `skipPushTermsFilter`로 무시 가능).
- **마케팅/이벤트 알림**: 노션 관리자 발송 시 `notificationService`에서 `marketingTermsAgreed === true` 사용자에게만 전송(일반 알림은 pushTerms만 체크).
- **알림 내역 저장**: 단건/다건 모두 전송 성공 여부와 무관하게 `notificationService.saveNotification` 호출.
- **동의 미완료 사용자**: 전송은 스킵하지만 알림 내역은 남김.

---

## 5. 메시지 포맷
- data-only 메시지 사용 (중복 알림 방지, 커스텀 핸들링).
- payload 필드: `title`, `body`, `type`, `postId`, `commentId`, `communityId`, `link`.

---

## 6. 단건 vs 다건
- **단건**: `fcmHelper.sendNotification` → `sendToUser`
  - 댓글/좋아요/프로그램 승인·거절 등 개별 알림에 사용.
- **다건**: `fcmHelper.sendNotificationToUsers` → `sendToUsers`
  - 노션 기반 관리자 대량 발송, 이벤트 공지 등에 사용.

---

## 7. 관리자(노션) 발송
- 노션 알림 페이지에서 발송 → `notificationService.sendNotification`
- 마케팅/이벤트 여부에 따라 `marketingTermsAgreed` 또는 `pushTermsAgreed` 필터 적용
- 전송 실패된 알림도 내역 저장
- 응답에 성공/실패/필터링 결과 포함

---

