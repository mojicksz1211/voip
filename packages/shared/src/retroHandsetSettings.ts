import type { MicProfile } from './audioConfig';
import {
  isAndroidUserAgent,
  LIVEKIT_RETRO_HANDSET_MIC_CAPTURE,
  ANDROID_GUEST_VOICE_MIC_CAPTURE,
  ANDROID_DESK_TX_MIC_CAPTURE,
} from './audioConfig';

const STORAGE_KEY = 'hotel-voip-retro-handset-v1';

const listeners = new Set<(enabled: boolean) => void>();

function notify(enabled: boolean) {
  for (const listener of listeners) {
    listener(enabled);
  }
}

/** Retro 3.5mm phone handsets leak mic→earpiece acoustically — enable AEC/sidetone fixes. */
export function getRetroHandsetMode(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function setRetroHandsetMode(enabled: boolean): boolean {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  notify(enabled);
  return enabled;
}

export function subscribeRetroHandsetMode(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Same mic profile on desk and guest — guest path has NS enabled on Android. */
export function resolveMicProfile(_app: 'desk' | 'guest'): MicProfile {
  if (!isAndroidUserAgent() || !getRetroHandsetMode()) {
    return 'default';
  }
  return 'retro-handset';
}

/** Lower earpiece gain — retro handsets leak mic acoustically into the receiver. */
export const RETRO_HANDSET_REMOTE_PLAYBACK_CAP = 0.48;

/**
 * LiveKit transmit capture. Retro handset overrides both. Otherwise the front
 * desk uses an AGC-on profile so its far-field built-in mic is boosted for the
 * guest; the guest keeps AGC off (usually a close/headset mic).
 */
export function resolveLiveKitMicCapture(app: 'desk' | 'guest') {
  if (getRetroHandsetMode()) {
    return LIVEKIT_RETRO_HANDSET_MIC_CAPTURE;
  }
  if (app === 'desk') {
    return ANDROID_DESK_TX_MIC_CAPTURE;
  }
  return ANDROID_GUEST_VOICE_MIC_CAPTURE;
}
