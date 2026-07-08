import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallMetadata } from './types';
import { getLiveKitWsUrl, isUsableLiveKitWsUrl } from './api';
import { isAndroidUserAgent } from './audioConfig';
import { LiveKitCallManager, type LiveKitCallManagerOptions } from './LiveKitCallManager';

export interface UseWebRtcVoiceOptions extends LiveKitCallManagerOptions {
  autoStart?: boolean;
  /** Android room intercom: start on loudspeaker (not earpiece). Retro handset overrides. */
  intercomSpeakerDefault?: boolean;
}

export function useWebRtcVoice(
  localExt: string,
  currentCall: CallMetadata | null,
  options?: UseWebRtcVoiceOptions,
) {
  const managerRef = useRef<LiveKitCallManager | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const managerOptionsRef = useRef(options);
  const callRef = useRef<CallMetadata | null>(null);
  const startingRef = useRef(false);
  const livekitUrlRef = useRef<string | undefined>(undefined);
  const autoStart = options?.autoStart !== false;

  useEffect(() => {
    managerOptionsRef.current = options;
  }, [options]);

  useEffect(() => {
    managerRef.current = new LiveKitCallManager(
      localExt,
      setVoiceError,
      setIsVoiceConnected,
      managerOptionsRef.current,
    );
    return () => {
      managerRef.current?.stop();
      managerRef.current = null;
    };
  }, [localExt]);

  const runStartVoice = useCallback(async (call: CallMetadata) => {
    const manager = managerRef.current;
    if (!manager || startingRef.current) {
      return;
    }

    // Connect during ring (deferPublish) so token/WS/ICE are ready before answer — mic not required yet.
    const mayStart = call.status === 'connected' || call.status === 'ringing';
    if (!mayStart) {
      return;
    }

    if (manager.isActive) {
      if (manager.isPublished || call.status !== 'connected') {
        return;
      }
      startingRef.current = true;
      setVoiceError(null);
      try {
        await manager.ensurePublished();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start live voice.';
        setVoiceError(msg);
        setIsVoiceConnected(false);
        manager.stop();
        console.error('LiveKit publish failed:', err);
      } finally {
        startingRef.current = false;
      }
      return;
    }

    startingRef.current = true;

    setVoiceError(null);
    setIsMicMuted(false);
    const intercomSpeaker =
      isAndroidUserAgent() && managerOptionsRef.current?.intercomSpeakerDefault === true;
    // Android: earpiece by default (GSM-style), or loudspeaker for room intercom.
    setIsSpeakerMuted(isAndroidUserAgent() && !intercomSpeaker);
    setIsOnHold(false);

    try {
      const deferPublish = call.status === 'ringing';
      await manager.connect(
        call.callId,
        livekitUrlRef.current ?? getLiveKitWsUrl(),
        deferPublish ? { deferPublish: true } : undefined,
      );
      if (deferPublish && callRef.current?.status === 'connected') {
        await manager.ensurePublished();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start live voice.';
      const hint = /signal connection|failed to fetch/i.test(msg)
        ? `${msg} — check LiveKit (port 7880) and Windows Firewall on the PBX PC.`
        : msg;
      setVoiceError(hint);
      setIsVoiceConnected(false);
      manager.stop();
      console.error('LiveKit start failed:', err);
    } finally {
      startingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    if (!currentCall) {
      manager.stop();
      setIsVoiceConnected(false);
      setIsMicMuted(false);
      setIsSpeakerMuted(false);
      setIsOnHold(false);
      callRef.current = null;
      startingRef.current = false;
      livekitUrlRef.current = undefined;
      return;
    }

    callRef.current = currentCall;

    return () => {
      manager.stop();
      setIsVoiceConnected(false);
      setIsMicMuted(false);
      setIsSpeakerMuted(false);
      setIsOnHold(false);
      startingRef.current = false;
    };
  }, [currentCall?.callId]);

  useEffect(() => {
    if (!currentCall || !autoStart || currentCall.status !== 'ringing') return;
    void runStartVoice(currentCall);
  }, [currentCall?.callId, currentCall?.status, autoStart, runStartVoice]);

  useEffect(() => {
    if (!currentCall || !autoStart || currentCall.status !== 'connected') return;
    void runStartVoice(currentCall);
  }, [currentCall?.callId, currentCall?.status, autoStart, runStartVoice]);

  const setLiveKitUrl = useCallback((url: string) => {
    if (isUsableLiveKitWsUrl(url)) {
      livekitUrlRef.current = url;
    }
  }, []);

  const toggleMic = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;
    const next = !isMicMuted;
    try {
      await manager.setMicMuted(next);
      setIsMicMuted(next);
      if (isOnHold && !next) {
        setIsOnHold(false);
      }
    } catch (err) {
      console.error('Mute toggle failed:', err);
      setVoiceError(err instanceof Error ? err.message : 'Failed to toggle microphone.');
    }
  }, [isMicMuted, isOnHold]);

  const toggleSpeaker = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    const next = !isSpeakerMuted;
    manager.setSpeakerMuted(next);
    setIsSpeakerMuted(next);
  }, [isSpeakerMuted]);

  const toggleHold = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;
    const next = !isOnHold;
    try {
      setIsOnHold(next);
      await manager.setMicMuted(next);
      setIsMicMuted(next);
    } catch (err) {
      console.error('Hold toggle failed:', err);
      setVoiceError(err instanceof Error ? err.message : 'Failed to toggle hold.');
    }
  }, [isOnHold]);

  const setRemotePlaybackVolume = useCallback((volume: number) => {
    managerRef.current?.setRemotePlaybackVolume(volume);
  }, []);

  return {
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
  };
}
