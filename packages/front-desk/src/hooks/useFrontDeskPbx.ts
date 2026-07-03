import { useState, useEffect, useRef, useCallback } from "react";
import {
  SIPExtension,
  GuestRequest,
  CallRecord,
  CallMetadata,
  apiFetch,
  getEventsUrl,
  normalizeExtensions,
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
} from "@hotel-voip/shared";
import {
  applyCallAudioState,
  routeCallAudio,
  resetCallAudioRoute,
  wakeScreenForCall,
  startCallForeground,
  stopCallForeground,
  isAndroidNative,
  startNativeRingtone,
  stopNativeRingtone,
  playHangupSound,
  scheduleAndroidHangupPlayback,
  presentIncomingCall,
  cancelIncomingCall,
  subscribeHandsetHook,
} from "../utils/callAudio";
import {
  getDeskAudioSettings,
  type DeskAudioSettings,
} from "../utils/deskAudioSettings";

const DESK_EXT = "000";
const DESK_STATE_REFRESH_MS = 25_000;
const DESK_PRESENCE_TICK_MS = 15_000;

export function useFrontDeskPbx() {
  const [extensions, setExtensions] = useState<SIPExtension[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [currentCall, setCurrentCall] = useState<CallMetadata | null>(null);
  const [retroHandset, setRetroHandset] = useState(() => getRetroHandsetMode());

  const micStreamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const currentCallRef = useRef(currentCall);
  const audioRoutePhaseRef = useRef<"idle" | "ringing" | "connected">("idle");
  const nativeRingCallIdRef = useRef<string | null>(null);
  const setRemotePlaybackVolumeRef = useRef<(volume: number) => void>(() => {});

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  const applyDeskAudio = useCallback((settings: DeskAudioSettings = getDeskAudioSettings()) => {
    const playback = getRetroHandsetMode()
      ? Math.min(settings.remotePlayback, RETRO_HANDSET_REMOTE_PLAYBACK_CAP)
      : settings.remotePlayback;
    setRemotePlaybackVolumeRef.current?.(playback);
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
    try {
      clearMicStream();
      if (currentCallRef.current?.status === "connected") {
        applyCallAudioState("connected", { withMic: true });
      }
      micStreamRef.current = await acquireMicrophone({ profile: resolveMicProfile('guest') });
      if (!isAndroidNative) {
        playbackContextRef.current = createVoicePlaybackContext();
        await playbackContextRef.current.resume();
      }
      const call = currentCallRef.current;
      if (call?.status !== "connected" && micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      return true;
    } catch (err) {
      clearMicStream();
      const msg = err instanceof Error ? err.message : "Hindi ma-open ang microphone.";
      alert(msg);
      return false;
    }
  }, [clearMicStream]);

  const {
    voiceError,
    isVoiceConnected,
    setLiveKitUrl,
    isMicMuted,
    isSpeakerMuted,
    isOnHold,
    toggleMic,
    toggleSpeaker,
    toggleHold,
    setRemotePlaybackVolume,
  } = useWebRtcVoice(DESK_EXT, currentCall, {
    autoStart: true,
    getLocalStream: () => micStreamRef.current,
    getAudioContext: () => playbackContextRef.current,
    remotePlaybackVolume: getRetroHandsetMode() ? RETRO_HANDSET_REMOTE_PLAYBACK_CAP : 1,
    liveKitMicCapture: () => resolveLiveKitMicCapture('desk'),
    beforeAcquireMic: async () => {
      if (isAndroidNative) {
        applyCallAudioState("connected", { withMic: true });
      }
    },
    onRemoteAudioStart: () => {
      if (isAndroidNative) {
        applyCallAudioState("connected", { withMic: Boolean(micStreamRef.current) });
      }
      applyDeskAudio();
    },
  });

  setRemotePlaybackVolumeRef.current = setRemotePlaybackVolume;

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

    if (currentCall.status === "ringing") {
      if (nativeRingCallIdRef.current === currentCall.callId) {
        return;
      }
      nativeRingCallIdRef.current = currentCall.callId;
      audioRoutePhaseRef.current = "ringing";
      if (currentCall.toExt === DESK_EXT) {
        startNativeRingtone("incoming");
      } else if (currentCall.fromExt === DESK_EXT) {
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
      routeCallAudio("connected", withMic);
      audioRoutePhaseRef.current = "connected";
    }
  }, [currentCall?.callId, currentCall?.status]);

  const handleToggleSpeaker = useCallback(() => {
    if (isAndroidNative && isSpeakerMuted) {
      applyCallAudioState("connected", { withMic: Boolean(micStreamRef.current) });
    }
    toggleSpeaker();
  }, [isSpeakerMuted, toggleSpeaker]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const applyExtensions = useCallback((items: SIPExtension[]) => {
    setExtensions(normalizeExtensions(items));
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setExtensions((prev) => normalizeExtensions(prev));
    }, DESK_PRESENCE_TICK_MS);
    return () => clearInterval(tick);
  }, []);

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
    };
    window.addEventListener("beforeunload", hangupIfRinging);
    return () => {
      window.removeEventListener("beforeunload", hangupIfRinging);
      hangupIfRinging();
    };
  }, []);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await apiFetch("/api/pbx/state");
        const data = await res.json();
        applyExtensions(data.extensions || []);
        setCalls(data.calls || []);
        setRequests(data.requests || []);
      } catch (err) {
        console.error("Failed fetching initial PBX server state:", err);
      }
    };
    fetchState();
    const refreshTimer = window.setInterval(() => {
      void fetchState();
    }, DESK_STATE_REFRESH_MS);

    const setupSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(getEventsUrl());
      eventSourceRef.current = es;

      es.addEventListener("sync", (e: MessageEvent) => {
        const payload = JSON.parse(e.data);
        applyExtensions(payload.extensions || []);
        setCalls(payload.calls || []);
        setRequests(payload.requests || []);
      });

      es.addEventListener("extension-update", (e: MessageEvent) => {
        const { extension } = JSON.parse(e.data) as { extension: SIPExtension };
        setExtensions((prev) => {
          const filtered = prev.filter((ex) => ex.extension !== extension.extension);
          return normalizeExtensions([...filtered, extension]);
        });
      });

      es.addEventListener("extension-change", (e: MessageEvent) => {
        const payload = JSON.parse(e.data);
        applyExtensions(payload.extensions || []);
        if (payload.calls) {
          setCalls(payload.calls);
        }
      });

      es.addEventListener("call:incoming", (e: MessageEvent) => {
        const callMetadata = JSON.parse(e.data) as CallMetadata;
        if (callMetadata.toExt !== DESK_EXT && callMetadata.fromExt !== DESK_EXT) return;
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
        setCalls([]);
        setRequests([]);
        setCurrentCall(null);
        fetchState();
      });

      es.onerror = () => {
        console.warn("SSE stream interrupted. Retrying in 4 seconds...");
        es.close();
        setTimeout(setupSSE, 4000);
      };
    };

    setupSSE();

    return () => {
      clearInterval(refreshTimer);
      eventSourceRef.current?.close();
    };
  }, [applyExtensions, clearMicStream, setLiveKitUrl]);

  useEffect(() => {
    if (
      isAndroidNative &&
      currentCall?.toExt === DESK_EXT &&
      currentCall.status === "ringing"
    ) {
      wakeScreenForCall();
    }
  }, [currentCall]);

  // Full-screen incoming-call alert that pops over other apps / the lock screen
  // when the console is backgrounded or the screen is off.
  useEffect(() => {
    if (!isAndroidNative) return;
    const incoming =
      currentCall?.toExt === DESK_EXT && currentCall.status === "ringing";
    if (incoming && document.hidden) {
      presentIncomingCall("Incoming call", `${currentCall!.fromName} (Ext ${currentCall!.fromExt})`);
    } else {
      cancelIncomingCall();
    }
  }, [currentCall?.callId, currentCall?.status, currentCall?.toExt, currentCall?.fromExt, currentCall?.fromName]);

  useEffect(() => {
    if (!isAndroidNative) return;

    const active =
      currentCall?.callId &&
      (currentCall.status === "ringing" || currentCall.status === "connected");

    if (!active) {
      stopCallForeground();
      return;
    }

    // Mic foreground service during incoming ring can skew audio routing on some tablets.
    const isIncomingRing =
      currentCall.status === "ringing" && currentCall.toExt === DESK_EXT;
    if (isIncomingRing) {
      stopCallForeground();
      return;
    }

    const peerName =
      currentCall.fromExt === DESK_EXT ? currentCall.toName : currentCall.fromName;
    const statusLabel = currentCall.status === "ringing" ? "Ringing" : "In call";
    startCallForeground(`${peerName} — ${statusLabel}`);
  }, [
    currentCall?.callId,
    currentCall?.status,
    currentCall?.fromExt,
    currentCall?.fromName,
    currentCall?.toExt,
    currentCall?.toName,
  ]);

  const handleInitiateCall = useCallback(
    async (toExt: string) => {
      if (!(await openMicForCall())) return;

      try {
        const res = await apiFetch("/api/sip/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromExt: DESK_EXT, toExt }),
        });
        const data = await res.json();
        if (!res.ok) {
          clearMicStream();
          alert(`Failed placing VoIP Call: ${data.error || "Receiver busy / off"}`);
          return;
        }

        const toExtMeta = extensions.find((ex) => ex.extension === toExt);
        setCurrentCall({
          callId: data.callId,
          fromExt: DESK_EXT,
          fromName: "Front Desk Reception",
          toExt,
          toName: toExtMeta?.name || toExt,
          status: "ringing",
        });
      } catch (e) {
        clearMicStream();
        console.error("Invite API failed:", e);
      }
    },
    [extensions, clearMicStream, openMicForCall],
  );

  const handleHangupCall = useCallback(async (callId: string) => {
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
  }, [clearMicStream]);

  const handleAnswerCall = useCallback(
    async (callId: string) => {
      if (!(await openMicForCall())) return;

      try {
        await apiFetch("/api/sip/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId }),
        });
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
    DESK_EXT,
    currentCall,
    {
      onAnswer: (callId) => void handleAnswerCall(callId),
      onHangup: (callId) => void handleHangupCall(callId),
    },
  );

  const handleUpdateRequestStatus = useCallback(async (id: string, status: GuestRequest['status']) => {
    try {
      await apiFetch("/api/staff/request/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch (e) {
      console.error("Status update failed:", e);
    }
  }, []);

  return {
    extensions,
    calls,
    requests,
    currentCall,
    handleInitiateCall,
    handleHangupCall,
    handleAnswerCall,
    handleDeclineCall,
    handleUpdateRequestStatus,
    voiceError,
    isVoiceConnected,
    isMicMuted,
    isSpeakerMuted,
    isOnHold,
    toggleMic,
    handleToggleSpeaker,
    toggleHold,
    applyDeskAudio,
  };
}
