import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeRingtoneType } from '@hotel-voip/shared';
import { telephonyAudio } from '@hotel-voip/shared';

export type CallAudioPhase = 'ringing' | 'connected';

export type CallAudioNativePhase = 'idle' | 'ringing' | 'connected';

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

/** Ring on built-in speaker; switch to headset on connected when jack is plugged. */
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
