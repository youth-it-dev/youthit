/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onMessage, Unsubscribe } from "firebase/messaging";
import { toast } from "sonner";
import { onAuthStateChange } from "@/lib/auth";
import { fetchToken, getClientMessaging } from "@/lib/firebase";
import { debug } from "@/utils/shared/debugger";

/**
 * @description 알림 권한이 이미 granted인 경우에만 FCM 토큰을 가져옵니다.
 *
 * 주의: 이 함수는 권한을 요청하지 않습니다.
 * 권한 요청은 AppNotificationsInitializer에서 사용자 제스처 기반으로 처리됩니다.
 * 사용자 제스처 없이 Notification.requestPermission()을 호출하면 브라우저가 팝업을 무시할 수 있습니다.
 */
async function getNotificationPermissionAndToken() {
  // Step 1: Check if Notifications are supported in the browser.
  if (!("Notification" in window)) {
    debug.warn(
      "[useFcmToken] This browser does not support desktop notification"
    );
    return null;
  }

  // Step 2: Check if permission is already granted.
  // 권한이 granted인 경우에만 토큰을 가져옵니다.
  // 권한 요청은 AppNotificationsInitializer에서 사용자 제스처 기반으로 처리됩니다.
  if (Notification.permission === "granted") {
    debug.log(
      "[useFcmToken] 알림 권한이 이미 granted 상태입니다. 토큰을 가져옵니다."
    );
    return await fetchToken();
  }

  // 권한이 default 또는 denied인 경우 토큰을 가져오지 않습니다.
  debug.log(
    `[useFcmToken] 알림 권한이 ${Notification.permission} 상태입니다. 권한 요청은 AppNotificationsInitializer에서 처리됩니다.`
  );
  return null;
}

const useFcmToken = () => {
  const router = useRouter(); // Initialize the router for navigation.
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<NotificationPermission | null>(null); // State to store the notification permission status.
  const [token, setToken] = useState<string | null>(null); // State to store the FCM token.
  const retryLoadToken = useRef(0); // Ref to keep track of retry attempts.
  const isLoading = useRef(false); // Ref to keep track if a token fetch is currently in progress.

  const loadToken = useCallback(async () => {
    // Step 4: Prevent multiple fetches if already fetched or in progress.
    if (isLoading.current) {
      debug.log("FCM token loading already in progress, skipping...");
      return;
    }

    debug.log("Starting FCM token loading process...");
    isLoading.current = true; // Mark loading as in progress.
    const token = await getNotificationPermissionAndToken(); // Fetch the token.

    // Step 5: Handle the case where permission is denied.
    if (Notification.permission === "denied") {
      setNotificationPermissionStatus("denied");
      debug.warn(
        "%cPush Notifications issue - permission denied",
        "color: green; background: #c7c7c7; padding: 8px; font-size: 20px"
      );
      isLoading.current = false;
      return;
    }

    // Step 6: Retry fetching the token if necessary. (up to 3 times)
    // This step is typical initially as the service worker may not be ready/installed yet.
    if (!token) {
      if (retryLoadToken.current >= 3) {
        alert("Unable to load token, refresh the browser");
        debug.warn(
          "%cPush Notifications issue - unable to load token after 3 retries",
          "color: green; background: #c7c7c7; padding: 8px; font-size: 20px"
        );
        isLoading.current = false;
        return;
      }

      retryLoadToken.current += 1;
      debug.error("An error occurred while retrieving token. Retrying...");
      isLoading.current = false;
      await loadToken();
      return;
    }

    // Step 7: Set the fetched token and mark as fetched.
    setNotificationPermissionStatus(Notification.permission);
    setToken(token);
    isLoading.current = false;

    // FCM 토큰 등록은 로그인 페이지에서 담당하므로 여기서는 토큰만 설정
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user: any) => {
      if (user && "Notification" in window) {
        loadToken();
      } else if (!user) {
        setToken(null);
        setNotificationPermissionStatus(null);
      }
    });

    return () => unsubscribe();
  }, [loadToken]);

  useEffect(() => {
    const setupListener = async () => {
      if (!token) return; // Exit if no token is available.

      debug.log(`onMessage registered with token ${token}`);
      const m = await getClientMessaging();
      if (!m) return;

      // Step 9: Register a listener for incoming FCM messages.
      const unsubscribe = onMessage(m, (payload) => {
        if (Notification.permission !== "granted") return;

        debug.log("Foreground push notification received:", payload);

        const title =
          payload.data?.title || payload.notification?.title || "알림";
        const body = payload.data?.body || payload.notification?.body || "";
        const link = payload.fcmOptions?.link || payload.data?.link;

        if (link) {
          toast.info(`${title}: ${body}`, {
            action: {
              label: "Visit",
              onClick: () => {
                const link = payload.fcmOptions?.link || payload.data?.link;
                if (link) {
                  router.push(link);
                }
              },
            },
          });
        } else {
          toast.info(`${title}: ${body}`);
        }

        // --------------------------------------------
        // Disable this if you only want toast notifications.
        const n = new Notification(title, {
          body: body,
          data: link ? { url: link } : undefined,
        });

        // Step 10: Handle notification click event to navigate to a link if present.
        n.onclick = (event) => {
          event.preventDefault();
          const link = (event.target as any)?.data?.url;
          if (link) {
            router.push(link);
          } else {
            debug.log("No link found in the notification payload");
          }
        };
        // --------------------------------------------
      });

      return unsubscribe;
    };

    let unsubscribe: Unsubscribe | null = null;

    setupListener().then((unsub) => {
      if (unsub) {
        unsubscribe = unsub;
      }
    });

    // Step 11: Cleanup the listener when the component unmounts.
    return () => unsubscribe?.();
  }, [token, router]);

  return { token, notificationPermissionStatus }; // Return the token and permission status.
};

export default useFcmToken;
