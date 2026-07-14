import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NativeRingtoneType } from '@hotel-voip/shared';
import { telephonyAudio } from '@hotel-voip/shared';

export type CallAudioPhase = 'ringing' | 'connected';

export type CallAudioNativePhase = 'idle' | 'ringing' | 'connected';

export interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  sdkInt: number;
}

interface CallAudioPlugin {
  hasProximitySensor(): Promise<{ supported: boolean }>;
  enableSpeaker(): Promise<void>;
  routeCallAudio(options: { phase: CallAudioPhase; withMic?: boolean; preferSpeaker?: boolean }): Promise<void>;
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
  startCallService(options: { label: string }): Promise<void>;
  stopCallService(): Promise<void>;
  startPresenceService(): Promise<void>;
  stopPresenceService(): Promise<void>;
  isBatteryExemptionGranted(): Promise<{ granted: boolean }>;
  requestBatteryExemption(): Promise<void>;
  openAutoStartSettings(): Promise<{ opened: boolean }>;
  getDeviceInfo(): Promise<DeviceInfo>;
  presentIncomingCall(options: { title: string; body: string }): Promise<void>;
  cancelIncomingCall(): Promise<void>;
  canUseFullScreenIntent(): Promise<{ granted: boolean }>;
  openFullScreenIntentSettings(): Promise<{ opened: boolean }>;
  canDrawOverlays(): Promise<{ granted: boolean }>;
  openOverlaySettings(): Promise<{ opened: boolean }>;
  addListener(
    eventName: 'handsetHook',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;
}

export const CallAudio = registerPlugin<CallAudioPlugin>('CallAudio');

export const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** True on phones (proximity sensor); false on tablets used as desk intercom. */
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

export function startCallForeground(label: string): void {
  if (!isAndroidNative) return;
  void CallAudio.startCallService({ label }).catch(() => {});
}

export function stopCallForeground(): void {
  if (!isAndroidNative) return;
  void CallAudio.stopCallService().catch(() => {});
}

/** Keep the console process alive so incoming calls always ring on standby. */
export function startPresenceService(): void {
  if (!isAndroidNative) return;
  void CallAudio.startPresenceService().catch(() => {});
}

export async function isBatteryExemptionGranted(): Promise<boolean> {
  if (!isAndroidNative) return true;
  try {
    const result = await CallAudio.isBatteryExemptionGranted();
    return result.granted;
  } catch {
    return true;
  }
}

export function requestBatteryExemption(): void {
  if (!isAndroidNative) return;
  void CallAudio.requestBatteryExemption().catch(() => {});
}

/** Open the OEM auto-start / background-launch manager (best effort). */
export async function openAutoStartSettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await CallAudio.openAutoStartSettings();
    return result.opened;
  } catch {
    return false;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  if (!isAndroidNative) return null;
  try {
    return await CallAudio.getDeviceInfo();
  } catch {
    return null;
  }
}

/** Full-screen incoming-call alert that appears over other apps / lock screen. */
export function presentIncomingCall(title: string, body: string): void {
  if (!isAndroidNative) return;
  void CallAudio.presentIncomingCall({ title, body }).catch(() => {});
}

export function cancelIncomingCall(): void {
  if (!isAndroidNative) return;
  void CallAudio.cancelIncomingCall().catch(() => {});
}

/** Android 14+: full-screen intents need an explicit per-app grant. */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (!isAndroidNative) return true;
  try {
    const result = await CallAudio.canUseFullScreenIntent();
    return result.granted;
  } catch {
    return true;
  }
}

export async function openFullScreenIntentSettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await CallAudio.openFullScreenIntentSettings();
    return result.opened;
  } catch {
    return false;
  }
}

/** "Display over other apps" — lets the console jump straight to the call UI. */
export async function canDrawOverlays(): Promise<boolean> {
  if (!isAndroidNative) return true;
  try {
    const result = await CallAudio.canDrawOverlays();
    return result.granted;
  } catch {
    return true;
  }
}

export async function openOverlaySettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await CallAudio.openOverlaySettings();
    return result.opened;
  } catch {
    return false;
  }
}

/** Ring on built-in speaker; connected call uses earpiece unless jack is plugged or speaker is toggled on. */
export function routeCallAudio(phase: CallAudioPhase, withMic = false): void {
  if (!isAndroidNative) return;
  void CallAudio.routeCallAudio({ phase, withMic }).catch(() => {});
}

export function resetCallAudioRoute(): void {
  if (!isAndroidNative) return;
  void CallAudio.resetCallAudio().catch(() => {});
}

export function startNativeRingtone(type: NativeRingtoneType): void {
  if (!isAndroidNative) return;
  void CallAudio.startRingtone({ type }).catch(() => {});
}

export function stopNativeRingtone(): void {
  if (!isAndroidNative) return;
  void CallAudio.stopRingtone().catch(() => {});
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
/** Phones: backup reassert only — immediate routing runs synchronously in reassertConnectedCallAudio. */
const PHONE_CONNECTED_AUDIO_REASSERT_MS = [400] as const;
/** Light reassert after voice connects — full prepare during WebRTC playback disconnects AAudio. */
const CONNECTED_AUDIO_FULL_RESYNC_MS = [400, 1500] as const;

let reassertGeneration = 0;
let resyncGeneration = 0;

export function reassertConnectedCallAudio(
  withMic = false,
  forceSpeaker = false,
  phoneEarpiece = false,
): () => void {
  if (!isAndroidNative) return () => {};
  if (phoneEarpiece && !forceSpeaker) {
    applyCallAudioState('connected', { withMic, forceSpeaker, reassertOnly: true });
  }
  const generation = ++reassertGeneration;
  const delays = phoneEarpiece ? PHONE_CONNECTED_AUDIO_REASSERT_MS : CONNECTED_AUDIO_REASSERT_MS;
  const timers = delays.map((delay) =>
    window.setTimeout(() => {
      if (generation !== reassertGeneration) return;
      applyCallAudioState('connected', { withMic, forceSpeaker, reassertOnly: true });
    }, delay),
  );
  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

/** Full prepareConnectedAudio passes — same fix as toggling speaker off/on. */
export function resyncConnectedCallAudio(withMic = false, forceSpeaker = false): () => void {
  if (!isAndroidNative) return () => {};
  const generation = ++resyncGeneration;
  const timers = CONNECTED_AUDIO_FULL_RESYNC_MS.map((delay) =>
    window.setTimeout(() => {
      if (generation !== resyncGeneration) return;
      applyCallAudioState('connected', { withMic, forceSpeaker, reassertOnly: true });
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
