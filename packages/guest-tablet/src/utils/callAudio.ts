import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NativeRingtoneType } from '@hotel-voip/shared';
import { telephonyAudio } from '@hotel-voip/shared';

export type CallAudioPhase = 'ringing' | 'connected';

export type CallAudioNativePhase = 'idle' | 'ringing' | 'connected';

interface CallAudioPlugin {
  hasProximitySensor(): Promise<{ supported: boolean }>;
  enableSpeaker(): Promise<void>;
  routeCallAudio(options: { phase: CallAudioPhase; withMic?: boolean }): Promise<void>;
  applyCallState(options: {
    phase: CallAudioNativePhase;
    ringType?: NativeRingtoneType;
    withMic?: boolean;
    forceSpeaker?: boolean;
    reassertOnly?: boolean;
    intercomSpeaker?: boolean;
  }): Promise<void>;
  startRingtone(options: { type: NativeRingtoneType }): Promise<void>;
  stopRingtone(): Promise<void>;
  playHangupSound(): Promise<void>;
  resetCallAudio(): Promise<void>;
  wakeScreen(): Promise<void>;
  addListener(
    eventName: 'handsetHook',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;
}

export const CallAudio = registerPlugin<CallAudioPlugin>('CallAudio');

export const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** True on phones (proximity sensor); false on tablets used as room intercom. */
export async function hasProximitySensor(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await CallAudio.hasProximitySensor();
    return result.supported;
  } catch {
    return false;
  }
}

/** Wait for LiveKit/WebRTC to release the communication device before hang-up PCM. */
export const ANDROID_HANGUP_PLAY_DELAY_MS = 500;
/** Leave room for the native tone plus up to a couple of self-healing retries. */
export const ANDROID_HANGUP_CLEANUP_DELAY_MS = 1900;

export function scheduleAndroidHangupPlayback(
  playHangup: () => void,
  cleanup: () => void,
): () => void {
  const hangupTimer = window.setTimeout(playHangup, ANDROID_HANGUP_PLAY_DELAY_MS);
  const cleanupTimer = window.setTimeout(cleanup, ANDROID_HANGUP_CLEANUP_DELAY_MS);
  return () => {
    window.clearTimeout(hangupTimer);
    window.clearTimeout(cleanupTimer);
  };
}

/** Ring on built-in speaker; connected call uses earpiece unless jack is plugged or speaker is toggled on. */
export function routeCallAudio(phase: CallAudioPhase, withMic = false): void {
  if (!isAndroidNative) return;
  void CallAudio.routeCallAudio({ phase, withMic }).catch(() => {
    // Native plugin unavailable in browser dev mode.
  });
}

export function resetCallAudioRoute(): void {
  if (!isAndroidNative) return;
  void CallAudio.resetCallAudio().catch(() => {});
}

export function startNativeRingtone(type: NativeRingtoneType): void {
  if (!isAndroidNative) return;
  void CallAudio.startRingtone({ type }).catch((err) => {
    console.warn('[CallAudio] startRingtone failed', err);
  });
}

export function stopNativeRingtone(): void {
  if (!isAndroidNative) return;
  void CallAudio.stopRingtone().catch((err) => {
    console.warn('[CallAudio] stopRingtone failed', err);
  });
}

export function playHangupSound(): void {
  if (isAndroidNative) {
    void CallAudio.playHangupSound().catch((err) => {
      console.warn('[CallAudio] playHangupSound failed', err);
    });
    return;
  }
  telephonyAudio.playHangupTone();
}

export function wakeScreenForCall(): void {
  if (!isAndroidNative) return;
  void CallAudio.wakeScreen().catch(() => {});
}

/** Route active call audio to the built-in loudspeaker (user enabled speaker in UI). */
export function enableSpeakerForCall(): void {
  if (!isAndroidNative) return;
  void CallAudio.enableSpeaker().catch(() => {});
}

/** Re-apply connected routing after LiveKit/WebRTC starts (can override AudioManager). */
const CONNECTED_AUDIO_REASSERT_MS = [0, 1000] as const;
const CONNECTED_AUDIO_FULL_RESYNC_MS = [800] as const;

let reassertGeneration = 0;
let resyncGeneration = 0;

export function reassertConnectedCallAudio(withMic = false, forceSpeaker = false): () => void {
  if (!isAndroidNative) return () => {};
  const generation = ++reassertGeneration;
  const timers = CONNECTED_AUDIO_REASSERT_MS.map((delay) =>
    window.setTimeout(() => {
      if (generation !== reassertGeneration) return;
      applyCallAudioState('connected', { withMic, forceSpeaker, reassertOnly: true });
    }, delay),
  );
  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

export function resyncConnectedCallAudio(withMic = false, forceSpeaker = false): () => void {
  if (!isAndroidNative) return () => {};
  const generation = ++resyncGeneration;
  const timers = CONNECTED_AUDIO_FULL_RESYNC_MS.map((delay) =>
    window.setTimeout(() => {
      if (generation !== resyncGeneration) return;
      applyCallAudioState('connected', { withMic, forceSpeaker, reassertOnly: false });
    }, delay),
  );
  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

/** Single native call — avoids async stop/start races between plugin methods. */
export function applyCallAudioState(
  phase: CallAudioNativePhase,
  options?: {
    ringType?: NativeRingtoneType;
    withMic?: boolean;
    forceSpeaker?: boolean;
    reassertOnly?: boolean;
    intercomSpeaker?: boolean;
  },
): void {
  if (!isAndroidNative) return;
  void CallAudio.applyCallState({
    phase,
    ringType: options?.ringType,
    withMic: options?.withMic ?? false,
    forceSpeaker: options?.forceSpeaker ?? false,
    reassertOnly: options?.reassertOnly ?? false,
    intercomSpeaker: options?.intercomSpeaker ?? false,
  }).catch(() => {});
}

/** Retro 3.5mm handset hook / media button (Android KEYCODE_HEADSETHOOK). */
export function subscribeHandsetHook(onPress: () => void): () => void {
  if (!isAndroidNative) return () => {};

  let handle: PluginListenerHandle | null = null;
  let cancelled = false;

  void CallAudio.addListener('handsetHook', () => {
    onPress();
  }).then((h) => {
    if (cancelled) {
      void h.remove();
      return;
    }
    handle = h;
  });

  return () => {
    cancelled = true;
    void handle?.remove();
  };
}
