import { useState, useEffect, useCallback } from "react";

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function useNotificationPermission() {
  const readPermission = (): NotificationPermissionState =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported";

  const [permission, setPermission] = useState<NotificationPermissionState>(readPermission);

  const refresh = useCallback(() => {
    setPermission(readPermission());
  }, []);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return readPermission();
    }
  }, []);

  return {
    permission,
    isGranted: permission === "granted",
    isDenied: permission === "denied",
    isDefault: permission === "default",
    isUnsupported: permission === "unsupported",
    requestPermission,
    refresh,
  };
}
