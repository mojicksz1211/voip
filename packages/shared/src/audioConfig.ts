/** Remote speaker playback gain on desktop (Web Audio API; >1.0 = louder). */
export const REMOTE_GAIN_DESKTOP = 1.55;

/** Soft constraints — won't fail if the device can't provide them. */
export const VOICE_MIC_IDEAL: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
};

/**
 * Desktop / Bluetooth headset: keep AEC on, disable AGC (prevents speech-start gain pump
 * that sounds like feedback on the remote side). Does not change playback volume.
 */
export const VOICE_MIC_DESKTOP: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
};

export const DESKTOP_VOICE_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  voiceIsolation: false,
} as const;

/** Front-desk transmit: AEC on, highpass only — full NS gates audio on Lenovo tablets. */
export const ANDROID_DESK_MIC_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  voiceIsolation: false,
} as const;

/** Chromium/WebView flags — AEC + highpass; no aggressive NS gating. */
export const ANDROID_VOICE_MIC_CAPTURE: Record<string, boolean> = {
  ...ANDROID_DESK_MIC_CAPTURE,
  googEchoCancellation: true,
  googNoiseSuppression: false,
  googAutoGainControl: false,
  googHighpassFilter: true,
  googTypingNoiseDetection: false,
};

/** Guest room mic: AEC + NS for wired headset; AGC off so breath is not pumped. */
export const ANDROID_GUEST_VOICE_MIC_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  voiceIsolation: false,
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googAutoGainControl: false,
  googHighpassFilter: true,
  googTypingNoiseDetection: false,
} as const;

/**
 * Front-desk transmit: same AEC + NS as the guest, but with Auto Gain Control ON.
 * The desk tablet's built-in mic is usually far-field (tablet on a stand), so its
 * raw level is quiet on the guest side. AGC lifts soft/distant speech; NS keeps
 * the boosted noise floor in check.
 */
export const ANDROID_DESK_TX_MIC_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: false,
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googAutoGainControl: true,
  googHighpassFilter: true,
  googTypingNoiseDetection: false,
} as const;

/** Chromium/WebView flags — disable hidden voice processing on Android (legacy raw path). */
export const ANDROID_RAW_MIC_CAPTURE: Record<string, boolean> = {
  ...ANDROID_DESK_MIC_CAPTURE,
  googEchoCancellation: false,
  googNoiseSuppression: false,
  googAutoGainControl: false,
  googHighpassFilter: false,
  googTypingNoiseDetection: false,
};

/** LiveKit setMicrophoneEnabled capture — front desk (highpass, no NS gating). */
export const LIVEKIT_DESK_MIC_CAPTURE = ANDROID_VOICE_MIC_CAPTURE;

/** Retro 3.5mm phone handset: AEC + light NS/highpass; AGC off (pumps bleed/static). */
export const ANDROID_RETRO_HANDSET_MIC_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  voiceIsolation: false,
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googAutoGainControl: false,
  googHighpassFilter: true,
  googTypingNoiseDetection: false,
} as const;

export const LIVEKIT_RETRO_HANDSET_MIC_CAPTURE = ANDROID_RETRO_HANDSET_MIC_CAPTURE;

/** Prefer 48 kHz mono for continuous voice on wired headset mics. */
export const DESK_MIC_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  ...ANDROID_DESK_MIC_CAPTURE,
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};

export const DESK_VOICE_MIC_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  ...ANDROID_VOICE_MIC_CAPTURE,
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};

export const RETRO_HANDSET_MIC_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  ...ANDROID_RETRO_HANDSET_MIC_CAPTURE,
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};

/** Remote playback on front-desk Android (WebView + wired handset). Lower = less echo. */
export const REMOTE_PLAYBACK_VOLUME_ANDROID_DESK = 0.68;

export type MicProfile = 'default' | 'desk' | 'retro-handset';

/** Playback context for remote audio (desktop). Use playback hint for smooth output. */
export function createVoicePlaybackContext(): AudioContext {
  return new AudioContext({ latencyHint: 'playback' });
}

export function isAndroidUserAgent(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function getMicConstraintSets(isAndroid: boolean, profile: MicProfile = 'default'): MediaStreamConstraints[] {
  const basic: MediaStreamConstraints = { audio: true, video: false };
  const ideal: MediaStreamConstraints = { audio: VOICE_MIC_IDEAL, video: false };

  if (isAndroid) {
    if (profile === 'desk') {
      return [
        { audio: DESK_VOICE_MIC_TRACK_CONSTRAINTS, video: false },
        { audio: ANDROID_VOICE_MIC_CAPTURE, video: false },
        { audio: DESK_MIC_TRACK_CONSTRAINTS, video: false },
        { audio: ANDROID_RAW_MIC_CAPTURE, video: false },
        basic,
      ];
    }
    if (profile === 'retro-handset') {
      return [
        { audio: RETRO_HANDSET_MIC_TRACK_CONSTRAINTS, video: false },
        { audio: ANDROID_RETRO_HANDSET_MIC_CAPTURE, video: false },
        { audio: ANDROID_GUEST_VOICE_MIC_CAPTURE, video: false },
        basic,
      ];
    }
    return [
      { audio: ANDROID_GUEST_VOICE_MIC_CAPTURE, video: false },
      ideal,
      basic,
    ];
  }

  return [
    { audio: VOICE_MIC_DESKTOP },
    ideal,
    basic,
  ];
}
