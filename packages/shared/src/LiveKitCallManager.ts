import { Room, RoomEvent, Track, AudioPresets } from 'livekit-client';
import type { RemoteAudioTrack } from 'livekit-client';
import { apiFetch, getLanRtcConfig, getLiveKitWsUrl } from './api';
import {
  DESKTOP_VOICE_CAPTURE,
  ANDROID_RAW_MIC_CAPTURE,
  isAndroidUserAgent,
} from './audioConfig';
import { releaseMicrophoneStream, resolvePreferredWiredMicDeviceId, mergeMicCaptureWithDevice } from './micAccess';
import { getRetroHandsetMode } from './retroHandsetSettings';

export interface LiveKitCallManagerOptions {
  beforeAcquireMic?: () => Promise<void>;
  getLocalStream?: () => MediaStream | null;
  getAudioContext?: () => AudioContext | null;
  onRemoteAudioStart?: () => void;
  /** 0–1 remote speaker level (front-desk tablet echo control). Default 1. */
  remotePlaybackVolume?: number;
  /** When set, Android uses LiveKit-owned mic with these constraints (smoother encode). */
  liveKitMicCapture?: Record<string, boolean> | (() => Record<string, boolean>);
  /**
   * Android: bind capture to wired headset mic. Guest: true. Front desk: only when retro handset.
   * Desk tablets often use the jack for listen-only; forcing headset mic breaks WebRTC TX on Lenovo.
   */
  preferWiredCaptureDevice?: boolean;
}

const VOICE_AUDIO_PUBLISH = {
  audioPreset: AudioPresets.speech,
  forceStereo: false,
  dtx: true,
  red: true,
} as const;

/** Android wired headsets: DTX comfort noise sounds like continuous static/hiss. */
const ANDROID_VOICE_PUBLISH = {
  ...AudioPresets.speech,
  forceStereo: false,
  dtx: false,
  red: true,
} as const;

/** Retro handset: continuous speech encode, no RED/DTX artifacts on cheap receivers. */
const RETRO_HANDSET_AUDIO_PUBLISH = {
  ...AudioPresets.speech,
  forceStereo: false,
  dtx: false,
  red: false,
} as const;

const ANDROID_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  voiceIsolation: false,
} as const;

function captureDefaultsForOptions(options?: LiveKitCallManagerOptions) {
  if (isAndroidUserAgent()) {
    return androidLiveKitMicCapture(options);
  }
  return DESKTOP_VOICE_CAPTURE;
}

function androidLiveKitMicCapture(options?: LiveKitCallManagerOptions) {
  const capture = options?.liveKitMicCapture;
  if (typeof capture === 'function') {
    const resolved = capture();
    if (resolved) return resolved;
  } else if (capture) {
    return capture;
  }
  return isAndroidUserAgent() ? ANDROID_CAPTURE : ANDROID_RAW_MIC_CAPTURE;
}


function publishOptionsForCapture(_capture: Record<string, boolean>) {
  if (isAndroidUserAgent()) {
    if (getRetroHandsetMode()) {
      return RETRO_HANDSET_AUDIO_PUBLISH;
    }
    return ANDROID_VOICE_PUBLISH;
  }
  return VOICE_AUDIO_PUBLISH;
}

export class LiveKitCallManager {
  private room: Room | null = null;
  private remoteAudioElements: HTMLMediaElement[] = [];
  private remoteAudioTracks: RemoteAudioTrack[] = [];
  private started = false;
  private publishCompleted = false;
  private roomConnected = false;
  private micMuted = false;
  private speakerMuted = false;
  private micEchoRefreshDone = false;
  private pendingMicPublish = false;
  private remotePlaybackVolume = 1;

  constructor(
    private readonly localExt: string,
    private readonly onError?: (message: string) => void,
    private readonly onConnectionStateChange?: (connected: boolean) => void,
    private readonly options?: LiveKitCallManagerOptions,
  ) {
    this.remotePlaybackVolume = options?.remotePlaybackVolume ?? 1;
  }

  private clearRemoteAudio() {
    for (const element of this.remoteAudioElements) {
      element.pause();
      element.srcObject = null;
      element.remove();
    }
    this.remoteAudioElements = [];
    this.remoteAudioTracks = [];
  }

  private resolveWebAudioMix(): boolean | { audioContext: AudioContext } {
    // Android WebView: route remote audio through <audio> directly. Re-capturing
    // via Web Audio (interactive buffer) causes millisecond dropouts / stutter.
    if (isAndroidUserAgent()) {
      return false;
    }
    const external = this.options?.getAudioContext?.();
    if (external && external.state !== 'closed') {
      return { audioContext: external };
    }
    return false;
  }

  private shouldDeferMicForAec() {
    // Android uses AudioManager MODE_IN_COMMUNICATION AEC — publish mic immediately on connect.
    return false;
  }

  private async tryPublishDeferredMic() {
    if (!this.pendingMicPublish || this.publishCompleted || !this.room) return;

    this.pendingMicPublish = false;
    try {
      await this.publishLocalAudio();
      await this.room.startAudio();
      this.publishCompleted = true;
      this.onConnectionStateChange?.(true);
    } catch (err) {
      this.pendingMicPublish = true;
      const msg = err instanceof Error ? err.message : 'Failed to open microphone for call.';
      this.onError?.(msg);
      console.error('Deferred mic publish failed:', err);
    }
  }

  private attachRemoteAudio(track: Track) {
    if (track.kind !== Track.Kind.Audio) return;

    const audioTrack = track as RemoteAudioTrack;
    const playbackVolume = this.remotePlaybackVolume;
    const element = audioTrack.attach();
    element.autoplay = true;
    element.setAttribute('playsinline', 'true');
    element.setAttribute('preload', 'auto');
    if (isAndroidUserAgent()) {
      element.muted = false;
    }
    element.volume = playbackVolume;
    audioTrack.setVolume(playbackVolume);
    document.body.appendChild(element);
    this.remoteAudioElements.push(element);
    this.remoteAudioTracks.push(audioTrack);

    void element.play().catch(() => {
      void element.play().catch(() => {});
    });

    this.options?.onRemoteAudioStart?.();

    // Show "In call" as soon as remote audio is playing; local mic may still be publishing (AEC defer).
    if (this.roomConnected) {
      this.onConnectionStateChange?.(true);
    }

    void this.tryPublishDeferredMic();

    if (!isAndroidUserAgent()) {
      void this.refreshLocalMicForEchoCancellation();
    }
  }

  /**
   * Re-open the mic after remote audio is playing so browser AEC has a playback
   * reference (fixes BT headset feedback when speech starts on desktop).
   */
  private async refreshLocalMicForEchoCancellation() {
    if (this.micEchoRefreshDone || !this.room || isAndroidUserAgent()) return;
    this.micEchoRefreshDone = true;

    const external = this.options?.getLocalStream?.();
    releaseMicrophoneStream(external ?? null);

    for (const publication of this.room.localParticipant.audioTrackPublications.values()) {
      const track = publication.track;
      if (track) {
        try {
          await this.room.localParticipant.unpublishTrack(track);
        } catch {
          // already unpublished
        }
      }
    }

    try {
      await this.room.localParticipant.setMicrophoneEnabled(true, DESKTOP_VOICE_CAPTURE, VOICE_AUDIO_PUBLISH);
    } catch (err) {
      console.warn('Mic echo-cancellation refresh failed:', err);
    }
  }

  private watchRoomConnection() {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      if (this.publishCompleted) {
        this.onConnectionStateChange?.(true);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.onConnectionStateChange?.(false);
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      this.onConnectionStateChange?.(false);
    });

    this.room.on(RoomEvent.Reconnected, () => {
      this.onConnectionStateChange?.(true);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (participant.identity === this.localExt) return;
      if (track.kind === Track.Kind.Audio) {
        this.attachRemoteAudio(track);
      }
    });

    this.room.on(RoomEvent.MediaDevicesError, (err) => {
      const msg = err instanceof Error ? err.message : 'Microphone error.';
      this.onError?.(msg);
    });
  }

  private async androidMicCaptureWithDevice(options?: LiveKitCallManagerOptions) {
    const base = androidLiveKitMicCapture(options);
    if (!isAndroidUserAgent()) return base;
    const preferWired = options?.preferWiredCaptureDevice ?? true;
    if (!preferWired) return base;
    const deviceId = await resolvePreferredWiredMicDeviceId();
    return mergeMicCaptureWithDevice(base, deviceId);
  }

  private async publishLocalAudio() {
    if (!this.room) return;

    const externalStream = this.options?.getLocalStream?.();
    const externalTrack = externalStream?.getAudioTracks()[0];
    const primedButMuted =
      externalTrack?.readyState === 'live' && externalTrack.enabled === false;
    const deskCapture = await this.androidMicCaptureWithDevice(this.options);
    const publishOptions = publishOptionsForCapture(deskCapture);

    if (externalTrack?.readyState === 'live') {
      if (isAndroidUserAgent()) {
        await this.options?.beforeAcquireMic?.();
        // Front desk primes mic during ring with track.enabled=false; publishing that
        // track sends silence to the guest. Release and open a fresh LiveKit-owned mic.
        if (primedButMuted) {
          releaseMicrophoneStream(externalStream);
        } else {
          await this.room.localParticipant.setMicrophoneEnabled(
            true,
            deskCapture,
            publishOptions,
          );
          releaseMicrophoneStream(externalStream);
          return;
        }
      } else {
        // Desktop: pre-connect mic lacks remote playback reference for AEC — use LiveKit mic.
        releaseMicrophoneStream(externalStream);
        await this.options?.beforeAcquireMic?.();
        await this.room.localParticipant.setMicrophoneEnabled(
          true,
          DESKTOP_VOICE_CAPTURE,
          VOICE_AUDIO_PUBLISH,
        );
        return;
      }
    }

    await this.options?.beforeAcquireMic?.();
    await this.room.localParticipant.setMicrophoneEnabled(
      true,
      isAndroidUserAgent() ? deskCapture : DESKTOP_VOICE_CAPTURE,
      isAndroidUserAgent() ? publishOptions : VOICE_AUDIO_PUBLISH,
    );
  }

  private attachExistingRemoteAudio() {
    if (!this.room) return;
    for (const participant of this.room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        if (publication.track) {
          this.attachRemoteAudio(publication.track);
        }
      }
    }
  }

  async connect(callId: string, livekitUrl?: string, connectOptions?: { deferPublish?: boolean }) {
    if (this.started) return;
    this.started = true;

    const wsUrl = livekitUrl || getLiveKitWsUrl();
    const res = await apiFetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId,
        extension: this.localExt,
        livekitUrl: wsUrl,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Failed to get LiveKit token.');
    }

    const data = (await res.json()) as { token: string; url?: string };
    const connectUrl = data.url || wsUrl;

    const deskCapture = androidLiveKitMicCapture(this.options);
    const publishDefaults = isAndroidUserAgent()
      ? publishOptionsForCapture(deskCapture)
      : VOICE_AUDIO_PUBLISH;

    this.room = new Room({
      adaptiveStream: false,
      dynacast: false,
      webAudioMix: this.resolveWebAudioMix(),
      publishDefaults,
      audioCaptureDefaults: captureDefaultsForOptions(this.options),
    });

    this.watchRoomConnection();

    try {
      await this.room.connect(connectUrl, data.token, {
        rtcConfig: getLanRtcConfig(),
      });
      this.roomConnected = true;

      if (connectOptions?.deferPublish) {
        await this.room.startAudio();
        this.attachExistingRemoteAudio();
        return;
      }

      if (this.shouldDeferMicForAec()) {
        this.pendingMicPublish = true;
        await this.room.startAudio();
        this.attachExistingRemoteAudio();
        await this.tryPublishDeferredMic();
        return;
      }

      await this.publishLocalAudio();
      await this.room.startAudio();
      this.publishCompleted = true;
      this.onConnectionStateChange?.(true);
      this.attachExistingRemoteAudio();
    } catch (err) {
      this.started = false;
      this.room?.disconnect();
      this.room = null;
      const msg = err instanceof Error ? err.message : 'LiveKit connection failed.';
      throw new Error(msg);
    }
  }

  async ensurePublished() {
    if (!this.room || !this.roomConnected || this.publishCompleted) return;

    if (this.shouldDeferMicForAec()) {
      if (!this.publishCompleted) {
        this.pendingMicPublish = true;
        this.attachExistingRemoteAudio();
        await this.tryPublishDeferredMic();
      }
      return;
    }

    await this.publishLocalAudio();
    await this.room.startAudio();
    this.publishCompleted = true;
    this.onConnectionStateChange?.(true);
    this.attachExistingRemoteAudio();
  }

  stop() {
    this.clearRemoteAudio();
    this.room?.disconnect();
    this.room = null;
    this.started = false;
    this.publishCompleted = false;
    this.roomConnected = false;
    this.micMuted = false;
    this.speakerMuted = false;
    this.micEchoRefreshDone = false;
    this.pendingMicPublish = false;
    this.onConnectionStateChange?.(false);
  }

  get isActive() {
    return this.started;
  }

  get isPublished() {
    return this.publishCompleted;
  }

  get isMicMuted() {
    return this.micMuted;
  }

  get isSpeakerMuted() {
    return this.speakerMuted;
  }

  async setMicMuted(muted: boolean) {
    this.micMuted = muted;

    const external = this.options?.getLocalStream?.();
    external?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });

    if (!this.room) return;

    // Mute/unmute published tracks without unpublishing — setMicrophoneEnabled(false)
    // tears down the mic and republish on unmute often fails ("engine not connected").
    for (const publication of this.room.localParticipant.audioTrackPublications.values()) {
      const track = publication.track;
      if (!track || track.kind !== Track.Kind.Audio) continue;

      const mediaTrack = track.mediaStreamTrack;
      if (mediaTrack) {
        mediaTrack.enabled = !muted;
      }

      try {
        if (muted) {
          await track.mute();
        } else {
          await track.unmute();
        }
      } catch {
        // Fallback: mediaStreamTrack.enabled already updated above
      }
    }
  }

  setSpeakerMuted(muted: boolean) {
    this.speakerMuted = muted;
    // Android: routing is native (earpiece vs loudspeaker); never mute WebRTC playback.
    if (isAndroidUserAgent()) return;

    const playbackVolume = this.remotePlaybackVolume;
    for (const track of this.remoteAudioTracks) {
      track.setVolume(muted ? 0 : playbackVolume);
    }
    for (const element of this.remoteAudioElements) {
      element.muted = muted;
      element.volume = muted ? 0 : playbackVolume;
    }
  }

  setRemotePlaybackVolume(volume: number) {
    this.remotePlaybackVolume = Math.max(0, Math.min(1, volume));
    if (this.speakerMuted && !isAndroidUserAgent()) return;
    for (const track of this.remoteAudioTracks) {
      track.setVolume(this.remotePlaybackVolume);
    }
    for (const element of this.remoteAudioElements) {
      element.volume = this.remotePlaybackVolume;
    }
  }
}
