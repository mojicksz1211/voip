import { useEffect, useRef, useCallback } from "react";
import { CallMetadata, useCallTelephonySounds } from "@hotel-voip/shared";
import { isAndroidNative, playHangupSound } from "../utils/callAudio";

const DESK_EXT = "000";

interface UseDeskNotificationsOptions {
  currentCall: CallMetadata | null;
}

export function useDeskNotifications({ currentCall }: UseDeskNotificationsOptions) {
  const systemNotificationRef = useRef<Notification | null>(null);

  const closeSystemNotification = useCallback(() => {
    systemNotificationRef.current?.close();
    systemNotificationRef.current = null;
  }, []);

  useCallTelephonySounds(currentCall, DESK_EXT, {
    delegateRingToNative: isAndroidNative,
    playHangup: playHangupSound,
  });

  // System notification when tab/window is minimized (center modal handles in-app UI)
  useEffect(() => {
    const isIncomingRinging =
      currentCall?.toExt === DESK_EXT && currentCall?.status === "ringing";

    if (!isIncomingRinging || !currentCall) {
      closeSystemNotification();
      return;
    }

    const notificationTag = `call-${currentCall.callId}`;
    const message = `${currentCall.fromName} (Ext ${currentCall.fromExt})`;

    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      closeSystemNotification();
      const notification = new Notification("Incoming Call — Front Desk", {
        body: message,
        tag: notificationTag,
        requireInteraction: true,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      systemNotificationRef.current = notification;
    }
  }, [currentCall, closeSystemNotification]);
}
