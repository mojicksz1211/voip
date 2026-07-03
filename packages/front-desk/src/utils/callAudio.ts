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
  enableSpeaker(): Promise<void>;
  routeCallAudio(options: { phase: CallAudioPhase; withMic?: boolean }): Promise<void>;
  applyCallState(options: {
    phase: CallAudioNativePhase;
    ringType?: NativeRingtoneType;
    withMic?: boolean;
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

/** Ring on built-in speaker; switch to headset on connected when jack is plugged. */
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

/** Single native call — avoids async stop/start races between plugin methods. */
export function applyCallAudioState(
  phase: CallAudioNativePhase,
  options?: { ringType?: NativeRingtoneType; withMic?: boolean },
): void {
  if (!isAndroidNative) return;
  void CallAudio.applyCallState({
    phase,
    ringType: options?.ringType,
    withMic: options?.withMic ?? false,
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
