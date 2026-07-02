import {
  REMOTE_PLAYBACK_VOLUME_ANDROID_DESK,
} from '@hotel-voip/shared';

const DESK_SPEAKER_VOLUME_RATIO = 0.68;
const DESK_MUSIC_VOLUME_RATIO = 0.58;

const STORAGE_KEY = 'hotel-voip-desk-audio-v1';

export interface DeskAudioSettings {
  /** LiveKit / HTML audio gain (0–1). Higher = louder guest voice, more echo risk. */
  remotePlayback: number;
  /** Android STREAM_VOICE_CALL level (0–1). */
  speakerVoice: number;
  /** Android STREAM_MUSIC level (0–1). Main echo control on tablet speaker. */
  speakerMusic: number;
}

export const DEFAULT_DESK_AUDIO: DeskAudioSettings = {
  remotePlayback: REMOTE_PLAYBACK_VOLUME_ANDROID_DESK,
  speakerVoice: DESK_SPEAKER_VOLUME_RATIO,
  speakerMusic: DESK_MUSIC_VOLUME_RATIO,
};

const listeners = new Set<(settings: DeskAudioSettings) => void>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(raw: Partial<DeskAudioSettings>): DeskAudioSettings {
  return {
    remotePlayback: clamp(
      typeof raw.remotePlayback === 'number' ? raw.remotePlayback : DEFAULT_DESK_AUDIO.remotePlayback,
      0.35,
      1,
    ),
    speakerVoice: clamp(
      typeof raw.speakerVoice === 'number' ? raw.speakerVoice : DEFAULT_DESK_AUDIO.speakerVoice,
      0.25,
      1,
    ),
    speakerMusic: clamp(
      typeof raw.speakerMusic === 'number' ? raw.speakerMusic : DEFAULT_DESK_AUDIO.speakerMusic,
      0.25,
      1,
    ),
  };
}

function notify(settings: DeskAudioSettings) {
  for (const listener of listeners) {
    listener(settings);
  }
}

export function getDeskAudioSettings(): DeskAudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DESK_AUDIO };
    return normalize(JSON.parse(raw) as Partial<DeskAudioSettings>);
  } catch {
    return { ...DEFAULT_DESK_AUDIO };
  }
}

export function setDeskAudioSettings(partial: Partial<DeskAudioSettings>): DeskAudioSettings {
  const next = normalize({ ...getDeskAudioSettings(), ...partial });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify(next);
  return next;
}

export function resetDeskAudioSettings(): DeskAudioSettings {
  const next = { ...DEFAULT_DESK_AUDIO };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify(next);
  return next;
}

export function subscribeDeskAudioSettings(
  listener: (settings: DeskAudioSettings) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Rough acoustic output estimate — higher usually means more echo on speaker. */
export function getEchoRiskLevel(settings: DeskAudioSettings): 'low' | 'medium' | 'high' {
  const product = settings.speakerMusic * settings.remotePlayback;
  if (product >= 0.55) return 'high';
  if (product >= 0.45) return 'medium';
  return 'low';
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
