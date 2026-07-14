import { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  SIPExtension,
  GuestRequest,
  CallMetadata,
  apiFetch,
  getApiBase,
  getEventsUrl,
  useWebRtcVoice,
  acquireMicrophone,
  releaseMicrophoneStream,
  createVoicePlaybackContext,
  resolveMicProfile,
  resolveLiveKitMicCapture,
  getRetroHandsetMode,
  RETRO_HANDSET_REMOTE_PLAYBACK_CAP,
  subscribeRetroHandsetMode,
  useHandsetHook,
  formatInviteError,
  type InviteErrorBody,
} from "@hotel-voip/shared";
import {
  applyCallAudioState,
  reassertConnectedCallAudio,
  resyncConnectedCallAudio,
  routeCallAudio,
  resetCallAudioRoute,
  startNativeRingtone,
  stopNativeRingtone,
  playHangupSound,
  scheduleAndroidHangupPlayback,
  wakeScreenForCall,
  subscribeHandsetHook,
  enableSpeakerForCall,
  hasProximitySensor,
} from "../utils/callAudio";
import {
  startCallForeground,
  stopCallForeground,
  startPresenceService,
  stopPresenceService,
  presentIncomingCall,
  cancelIncomingCall,
} from "../utils/nativeTablet";
import {
  getStoredRoom,
  setStoredRoom,
  clearStoredRoom,
} from "../utils/guestStorage";

const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const GUEST_HEARTBEAT_MS = 20_000;

function getInitialRoom(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("room");
  if (fromUrl) return fromUrl;
  if (isAndroidNative) {
    const stored = getStoredRoom();
    if (stored) return stored;
  }
  return "304";
}

export type GuestConnectionStatus = "connected" | "connecting" | "disconnected";

export function useGuestPbx() {
  const [extensions, setExtensions] = useState<SIPExtension[]>([]);
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [currentCall, setCurrentCall] = useState<CallMetadata | null>(null);
  const [roomNum, setRoomNum] = useState<string>(getInitialRoom);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAutoRegistering, setIsAutoRegistering] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<GuestConnectionStatus>("connecting");
  const [appAlert, setAppAlert] = useState<string | null>(null);
  const [retroHandset, setRetroHandset] = useState(() => getRetroHandsetMode());
  /** False on phones (proximity → earpiece); true on tablets without proximity (loudspeaker). */
  const [roomIntercomDevice, setRoomIntercomDevice] = useState(false);
  const roomIntercomDeviceRef = useRef(false);

  const showAppAlert = useCallback((message: string) => {
    setAppAlert(message);
  }, []);

  const dismissAppAlert = useCallback(() => {
    setAppAlert(null);
  }, []);

  const micStreamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const currentCallRef = useRef(currentCall);
  const audioRoutePhaseRef = useRef<"idle" | "ringing" | "connected">("idle");
  const nativeRingCallIdRef = useRef<string | null>(null);
  const postVoiceAudioRoutedRef = useRef(false);
  /** Android: true when user enabled loudspeaker (inverse of isSpeakerMuted). */
  const speakerOnRef = useRef(false);
  /** Ignore stale "offline" extension snapshots right after register. */
  const registeredAtRef = useRef(0);

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  useEffect(() => {
    if (!isAndroidNative) return;
    void hasProximitySensor().then((supported) => {
      const isTablet = !supported;
      roomIntercomDeviceRef.current = isTablet;
      setRoomIntercomDevice(isTablet);
    });
  }, []);

  const clearMicStream = useCallback(() => {
    releaseMicrophoneStream(micStreamRef.current);
    micStreamRef.current = null;
    if (playbackContextRef.current) {
      void playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
  }, []);

  const openMicForCall = useCallback(async (): Promise<boolean> => {
    if (!isAndroidNative) return true;
    const existing = micStreamRef.current?.getAudioTracks()[0];
    if (existing?.readyState === "live") {
      const connected = currentCallRef.current?.status === "connected";
      existing.enabled = connected;
      if (connected) {
        applyCallAudioState("connected", {
          withMic: true,
          forceSpeaker: speakerOnRef.current,
        });
      }
      return true;
    }
    try {
      clearMicStream();
      micStreamRef.current = await acquireMicrophone({ profile: resolveMicProfile('guest') });
      if (!isAndroidNative) {
        playbackContextRef.current = createVoicePlaybackContext();
        await playbackContextRef.current.resume();
      }
      const call = currentCallRef.current;
      if (call?.status === "connected") {
        applyCallAudioState("connected", {
          withMic: true,
          forceSpeaker: speakerOnRef.current,
        });
      } else {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      return true;
    } catch (err) {
      clearMicStream();
      const msg = err instanceof Error ? err.message : "Hindi ma-open ang microphone.";
      showAppAlert(msg);
      return false;
    }
  }, [clearMicStream, showAppAlert]);

  const {
    voiceError,
    isVoiceConnected,
    setLiveKitUrl,
    isMicMuted,
    isSpeakerMuted,
    toggleMic,
    toggleSpeaker,
  } = useWebRtcVoice(
    roomNum,
    currentCall,
    {
      autoStart: true,
      intercomSpeakerDefault: !getRetroHandsetMode() && roomIntercomDevice,
      getLocalStream: () => micStreamRef.current,
      getAudioContext: () => playbackContextRef.current,
      remotePlaybackVolume: getRetroHandsetMode() ? RETRO_HANDSET_REMOTE_PLAYBACK_CAP : 1,
      liveKitMicCapture: () => resolveLiveKitMicCapture('guest'),
      preferWiredCaptureDevice: getRetroHandsetMode(),
      onRemoteAudioStart: () => {
        if (!isAndroidNative) return;
        const withMic = Boolean(micStreamRef.current);
        const forceSpeaker = speakerOnRef.current;
        const isTablet = roomIntercomDeviceRef.current;
        reassertConnectedCallAudio(withMic, forceSpeaker, !isTablet);
      },
    },
  );

  const handleToggleSpeaker = useCallback(() => {
    if (isAndroidNative) {
      if (isSpeakerMuted) {
        speakerOnRef.current = true;
        enableSpeakerForCall();
      } else {
        speakerOnRef.current = false;
        applyCallAudioState("connected", {
          withMic: Boolean(micStreamRef.current),
          forceSpeaker: false,
        });
      }
    }
    toggleSpeaker();
  }, [isSpeakerMuted, toggleSpeaker]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const roomNumRef = useRef(roomNum);
  const lastRegisteredExtRef = useRef<string | null>(null);
  const autoRegisterAttemptedRef = useRef(false);
  const registerDeviceRef = useRef<(room: string) => Promise<void>>(async () => {});

  useEffect(() => {
    roomNumRef.current = roomNum;
  }, [roomNum]);

  useEffect(() => {
    const hangupIfRinging = () => {
      const call = currentCallRef.current;
      if (call?.status === "ringing") {
        apiFetch("/api/sip/hangup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: call.callId }),
          keepalive: true,
        }).catch(() => {});
      }
      clearMicStream();
    };
    window.addEventListener("beforeunload", hangupIfRinging);
    return () => {
      window.removeEventListener("beforeunload", hangupIfRinging);
      hangupIfRinging();
    };
  }, [clearMicStream]);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await apiFetch("/api/pbx/state");
        const data = await res.json();
        setExtensions(data.extensions || []);
        setRequests(data.requests || []);
      } catch (err) {
        console.error("Failed fetching initial PBX server state:", err);
        setConnectionStatus("disconnected");
      }
    };
    fetchState();

    const setupSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setConnectionStatus("connecting");
      const es = new EventSource(getEventsUrl());
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus("connected");
      };

      es.addEventListener("sync", (e: MessageEvent) => {
        const payload = JSON.parse(e.data);
        setExtensions(payload.extensions || []);
        setRequests(payload.requests || []);
      });

      es.addEventListener("extension-update", (e: MessageEvent) => {
        const { extension } = JSON.parse(e.data);
        setExtensions((prev) => {
          const filtered = prev.filter((ex) => ex.extension !== extension.extension);
          return [...filtered, extension];
        });
      });

      es.addEventListener("extension-change", (e: MessageEvent) => {
        const payload = JSON.parse(e.data);
        setExtensions(payload.extensions || []);
      });

      es.addEventListener("call:incoming", (e: MessageEvent) => {
        const callMetadata = JSON.parse(e.data) as CallMetadata;
        if (String(callMetadata.toExt) !== String(roomNumRef.current)) return;
        setCurrentCall(callMetadata);
      });

      es.addEventListener("call:answered", (e: MessageEvent) => {
        const payload = JSON.parse(e.data) as { callId?: string };
        setCurrentCall((prev) => {
          if (!prev || (payload.callId && prev.callId !== payload.callId)) return prev;
          return { ...prev, status: "connected" };
        });
      });

      es.addEventListener("call:ended", (e: MessageEvent) => {
        const payload = JSON.parse(e.data) as { callId?: string };
        setCurrentCall((prev) => {
          if (prev && payload.callId && prev.callId !== payload.callId) return prev;
          return null;
        });
        clearMicStream();
      });

      es.addEventListener("livekit:ready", (e: MessageEvent) => {
        const payload = JSON.parse(e.data) as { livekitUrl?: string };
        if (payload.livekitUrl) {
          setLiveKitUrl(payload.livekitUrl);
        }
      });

      es.addEventListener("request-new", (e: MessageEvent) => {
        const { request } = JSON.parse(e.data);
        setRequests((prev) => [...prev, request]);
      });

      es.addEventListener("request-update", (e: MessageEvent) => {
        const { request } = JSON.parse(e.data);
        setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
      });

      es.addEventListener("pbx-reset", () => {
        setExtensions([]);
        setRequests([]);
        setCurrentCall(null);
        setIsRegistered(false);
        clearMicStream();
        fetchState();
      });

      es.onerror = () => {
        setConnectionStatus("disconnected");
        console.warn("SSE stream interrupted. Retrying in 4 seconds...");
        es.close();
        setTimeout(setupSSE, 4000);
      };
    };

    setupSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [clearMicStream]);

  useEffect(() => {
    if (!isRegistered || !roomNum) return;

    const sendHeartbeat = () => {
      void apiFetch("/api/sip/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension: roomNumRef.current }),
        keepalive: true,
      }).catch(() => {});
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, GUEST_HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [isRegistered, roomNum]);

  useEffect(() => {
    if (isRegistered && roomNum) {
      const match = extensions.find((ex) => ex.extension === roomNum);
      if (!match || match.status === "offline") {
        if (Date.now() - registeredAtRef.current < 15_000) return;
        setIsRegistered(false);
      }
    }
  }, [extensions, isRegistered, roomNum]);

  useEffect(() => {
    if (
      isAndroidNative &&
      currentCall?.toExt === roomNum &&
      currentCall?.status === "ringing"
    ) {
      wakeScreenForCall();
    }
  }, [currentCall, roomNum]);

  // Keep a persistent foreground service alive while registered so the SSE
  // stream survives screen-off / Doze and incoming calls always ring.
  useEffect(() => {
    if (!isAndroidNative) return;
    const timer = window.setTimeout(() => {
      if (isRegistered && roomNum) {
        startPresenceService(roomNum, getApiBase());
      } else {
        stopPresenceService();
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isRegistered, roomNum]);

  // Full-screen incoming-call alert that pops over other apps / the lock screen
  // when the app is backgrounded or the screen is off.
  useEffect(() => {
    if (!isAndroidNative) return;
    const incoming =
      currentCall?.toExt === roomNum && currentCall?.status === "ringing";
    if (incoming && document.hidden) {
      presentIncomingCall("Incoming call", currentCall!.fromName);
    } else {
      cancelIncomingCall();
    }
  }, [
    currentCall?.callId,
    currentCall?.status,
    currentCall?.toExt,
    currentCall?.fromName,
    roomNum,
  ]);

  useEffect(() => {
    if (!isAndroidNative) return;

    if (
      !currentCall ||
      (currentCall.status !== "ringing" && currentCall.status !== "connected")
    ) {
      const endingActiveCall =
        audioRoutePhaseRef.current === "ringing" ||
        audioRoutePhaseRef.current === "connected";
      nativeRingCallIdRef.current = null;
      speakerOnRef.current = false;
      postVoiceAudioRoutedRef.current = false;
      if (endingActiveCall) {
        return scheduleAndroidHangupPlayback(playHangupSound, () => {
          stopNativeRingtone();
          resetCallAudioRoute();
          audioRoutePhaseRef.current = "idle";
        });
      }
      const resetTimer = window.setTimeout(() => {
        stopNativeRingtone();
        resetCallAudioRoute();
        audioRoutePhaseRef.current = "idle";
      }, 300);
      return () => clearTimeout(resetTimer);
    }

    const withMic = Boolean(micStreamRef.current);
    const room = String(roomNum);

    if (currentCall.status === "ringing") {
      if (nativeRingCallIdRef.current === currentCall.callId) {
        return;
      }
      nativeRingCallIdRef.current = currentCall.callId;
      audioRoutePhaseRef.current = "ringing";
      if (String(currentCall.toExt) === room) {
        startNativeRingtone("incoming");
      } else if (String(currentCall.fromExt) === room) {
        startNativeRingtone("ringback");
      } else {
        stopNativeRingtone();
        routeCallAudio("ringing", withMic);
      }
      return;
    }

    stopNativeRingtone();
    nativeRingCallIdRef.current = null;
    if (audioRoutePhaseRef.current !== "connected") {
      speakerOnRef.current = false;
      postVoiceAudioRoutedRef.current = false;
      audioRoutePhaseRef.current = "connected";
      const isTablet = roomIntercomDeviceRef.current;
      if (isTablet) {
        routeCallAudio("connected", withMic, false);
        return reassertConnectedCallAudio(withMic, false, false);
      }
      // Phone: defer native routing until LiveKit is connected (avoids killing WebRTC publish).
      return;
    }
  }, [currentCall?.callId, currentCall?.status, roomNum, roomIntercomDevice]);

  useEffect(() => {
    if (!isAndroidNative) return;
    const incoming =
      currentCall?.toExt === roomNum && currentCall?.status === "ringing";
    if (incoming && !micStreamRef.current) {
      void openMicForCall();
    }
  }, [currentCall?.callId, currentCall?.status, currentCall?.toExt, roomNum, openMicForCall]);

  useEffect(() => {
    if (!isAndroidNative || currentCall?.status !== "connected") return;
    if (isVoiceConnected) {
      const withMic = Boolean(micStreamRef.current);
      const forceSpeaker = speakerOnRef.current;
      if (roomIntercomDeviceRef.current) {
        return resyncConnectedCallAudio(withMic, forceSpeaker);
      }
      if (!postVoiceAudioRoutedRef.current) {
        postVoiceAudioRoutedRef.current = true;
        routeCallAudio("connected", withMic, false);
      }
      return reassertConnectedCallAudio(withMic, forceSpeaker, true);
    }
  }, [currentCall?.callId, currentCall?.status, isVoiceConnected]);

  useEffect(() => {
    if (!isAndroidNative) return;

    if (!currentCall) {
      stopCallForeground();
      return;
    }

    const active =
      currentCall.callId &&
      (currentCall.status === "ringing" || currentCall.status === "connected");

    if (!active) {
      stopCallForeground();
      return;
    }

    // Mic foreground service during incoming ring can block ring audio on some tablets.
    const isIncomingRing =
      currentCall.status === "ringing" && currentCall.toExt === roomNum;
    if (isIncomingRing) {
      stopCallForeground();
      return;
    }

    const peerName =
      currentCall.fromExt === roomNum ? currentCall.toName : currentCall.fromName;
    const statusLabel = currentCall.status === "ringing" ? "Ringing" : "In call";
    startCallForeground(`${peerName} — ${statusLabel}`);
  }, [
    currentCall?.callId,
    currentCall?.status,
    currentCall?.fromExt,
    currentCall?.fromName,
    currentCall?.toExt,
    currentCall?.toName,
    roomNum,
  ]);

  const handleInitiateCall = useCallback(
    async (toExt: string) => {
      if (!(await openMicForCall())) return;

      try {
        const res = await apiFetch("/api/sip/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromExt: roomNumRef.current, toExt }),
        });
        const data = (await res.json()) as InviteErrorBody & { callId?: string };
        if (!res.ok) {
          clearMicStream();
          showAppAlert(formatInviteError(data, toExt));
          return;
        }
        if (!data.callId) {
          clearMicStream();
          showAppAlert("The PBX server did not return a call ID. Please try again.");
          return;
        }

        const toExtMeta = extensions.find((ex) => ex.extension === toExt);
        setCurrentCall({
          callId: data.callId,
          fromExt: roomNumRef.current,
          fromName: `Room ${roomNumRef.current}`,
          toExt,
          toName: toExtMeta?.name || toExt,
          status: "ringing",
        });
      } catch (e) {
        clearMicStream();
        console.error("Invite API failed:", e);
      }
    },
    [openMicForCall, clearMicStream, extensions, showAppAlert],
  );

  const handleHangupCall = useCallback(
    async (callId: string) => {
      setCurrentCall((prev) => (prev?.callId === callId ? null : prev));
      try {
        await apiFetch("/api/sip/hangup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId }),
        });
      } catch (e) {
        console.error("Hangup API failed:", e);
      } finally {
        clearMicStream();
      }
    },
    [clearMicStream],
  );

  const handleAnswerCall = useCallback(
    async (callId: string) => {
      try {
        const [micOk] = await Promise.all([
          openMicForCall(),
          apiFetch("/api/sip/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callId }),
          }).then(async (res) => {
            if (!res.ok) throw new Error("Answer failed");
            return res;
          }),
        ]);
        if (!micOk) {
          clearMicStream();
        }
      } catch (e) {
        clearMicStream();
        console.error("Answer API failed:", e);
      }
    },
    [openMicForCall, clearMicStream],
  );

  const handleDeclineCall = useCallback(async (callId: string) => {
    try {
      await apiFetch("/api/sip/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, reason: "Decline / Busy Here" }),
      });
    } catch (e) {
      console.error("Decline API failed:", e);
    } finally {
      clearMicStream();
    }
  }, [clearMicStream]);

  useEffect(() => subscribeRetroHandsetMode(setRetroHandset), []);

  useHandsetHook(
    isAndroidNative && retroHandset,
    subscribeHandsetHook,
    String(roomNum),
    currentCall,
    {
      onAnswer: (callId) => void handleAnswerCall(callId),
      onHangup: (callId) => void handleHangupCall(callId),
    },
  );

  const handleRegisterDevice = useCallback(async (room: string) => {
    if (!room) return;
    const previousExtension =
      lastRegisteredExtRef.current && lastRegisteredExtRef.current !== room
        ? lastRegisteredExtRef.current
        : roomNumRef.current !== room
          ? roomNumRef.current
          : undefined;

    try {
      if (previousExtension) {
        await apiFetch("/api/sip/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extension: previousExtension }),
        });
      }

      const res = await apiFetch("/api/sip/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: room,
          name: `Room ${room}`,
          previousExtension,
        }),
      });
      if (res.ok) {
        setRoomNum(room);
        registeredAtRef.current = Date.now();
        setIsRegistered(true);
        lastRegisteredExtRef.current = room;
        if (isAndroidNative) {
          setStoredRoom(room);
        }
      }
    } catch (e) {
      console.error("Register device failed:", e);
    }
  }, []);

  const handleUnregisterDevice = useCallback(async () => {
    try {
      await apiFetch("/api/sip/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension: roomNumRef.current }),
      });
      setIsRegistered(false);
      lastRegisteredExtRef.current = null;
      if (isAndroidNative) {
        clearStoredRoom();
      }
    } catch (e) {
      console.error("Unregister device failed:", e);
    }
  }, []);

  const handleSendRoomRequest = useCallback(async (type: GuestRequest["requestType"], note?: string) => {
    try {
      await apiFetch("/api/guest/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomNumber: roomNumRef.current, requestType: type, customText: note }),
      });
    } catch (e) {
      console.error("Submit request failed:", e);
    }
  }, []);

  registerDeviceRef.current = handleRegisterDevice;

  // Auto-register saved room on Android launch
  useEffect(() => {
    if (!isAndroidNative || autoRegisterAttemptedRef.current) return;
    const stored = getStoredRoom();
    if (!stored) return;

    autoRegisterAttemptedRef.current = true;
    setRoomNum(stored);
    setIsAutoRegistering(true);
    void registerDeviceRef.current(stored).finally(() => setIsAutoRegistering(false));
  }, []);

  return {
    extensions,
    requests,
    currentCall,
    roomNum,
    setRoomNum,
    isRegistered,
    isAutoRegistering,
    connectionStatus,
    appAlert,
    dismissAppAlert,
    handleInitiateCall,
    handleHangupCall,
    handleAnswerCall,
    handleDeclineCall,
    handleRegisterDevice,
    handleUnregisterDevice,
    handleSendRoomRequest,
    voiceError,
    isVoiceConnected,
    isMicMuted,
    isSpeakerMuted,
    toggleMic,
    handleToggleSpeaker,
  };
}
