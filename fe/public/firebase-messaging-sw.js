importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts(
  "https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js"
);

// Replace these with your own Firebase config keys...
const firebaseConfig = {
  apiKey: "AIzaSyDrUoph1tb6UeIPiEcUjyaolThcxWKbHy0",
  authDomain: "youthvoice-2025.firebaseapp.com",
  projectId: "youthvoice-2025",
  storageBucket: "youthvoice-2025.firebasestorage.app",
  messagingSenderId: "700631058497",
  appId: "1:700631058497:web:2160361e1c25bec8bf1ec0",
  measurementId: "G-HXQ41FTC7V",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  const title = payload.data?.title || "알림";
  const body = payload.data?.body || "";
  const link = payload.data?.link;
  const type = payload.data?.type;
  const relatedId = payload.data?.relatedId;

  const notificationOptions = {
    body: body,
    icon: "./logo.png",
    data: {
      url: link,
      type: type,
      relatedId: relatedId,
    },
  };

  self.registration.showNotification(title, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        const { url, type, relatedId } = event.notification?.data ?? {};

        console.log("Notification data:", { url, type, relatedId });

        if (!url) {
          return;
        }

        const fullUrl = url.startsWith("http")
          ? url
          : `${self.location.origin}${url}`;

        /**
         * URL 정규화 함수
         * - 트레일링 슬래시 제거
         * - 쿼리 파라미터 정렬
         * - Service Worker 전용 구현
         */
        const normalizeUrl = (url) => {
          try {
            const urlObj = new URL(url);

            // 쿼리 파라미터 정렬
            let sortedSearch = "";
            if (urlObj.search) {
              const params = new URLSearchParams(urlObj.search);
              // URLSearchParams의 entries를 배열로 변환하여 정렬
              const sortedEntries = Array.from(params.entries()).sort(
                ([a], [b]) => a.localeCompare(b)
              );
              const sortedParams = new URLSearchParams();
              sortedEntries.forEach(([key, value]) => {
                sortedParams.append(key, value);
              });
              sortedSearch = sortedParams.toString();
            }

            // 트레일링 슬래시 제거 (pathname이 '/'가 아닌 경우)
            const normalizedPathname =
              urlObj.pathname === "/"
                ? urlObj.pathname
                : urlObj.pathname.replace(/\/$/, "");

            return `${urlObj.origin}${normalizedPathname}${sortedSearch ? `?${sortedSearch}` : ""}${urlObj.hash}`;
          } catch (error) {
            console.warn("URL 정규화 실패:", url, error);
            return url;
          }
        };

        const normalizedFullUrl = normalizeUrl(fullUrl);

        for (const client of clientList) {
          const normalizedClientUrl = normalizeUrl(client.url);
          if (normalizedClientUrl === normalizedFullUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});
