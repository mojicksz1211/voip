import { useEffect, useRef } from 'react';
import type { CallMetadata } from './types';
import { telephonyAudio } from './AudioEngine';

function wasActiveCall(call: CallMetadata | null): boolean {
  return Boolean(call && (call.status === 'ringing' || call.status === 'connected'));
}

export type NativeRingtoneType = 'incoming' | 'ringback';

export interface NativeCallRinging {
  startIncoming(): void;
  startRingback(): void;
  stop(): void;
}

export interface UseCallTelephonySoundsOptions {
  /** Android: native speaker ring (bypasses wired headset for ring/ringback). */
  nativeRinging?: NativeCallRinging;
  /** Android: PBX hook owns native ring/ringback — avoids cleanup races with Capacitor plugins. */
  delegateRingToNative?: boolean;
  /** Android backup: also play Web Audio ring when native is delegated to PBX hook. */
  webRingBackupOnAndroid?: boolean;
  /** Play hang-up tone (native on Android tablet, Web Audio on desktop). */
  playHangup?: () => void;
}

/** Plays ringer, ringback, connect, and hangup tones based on call state. */
export function useCallTelephonySounds(
  currentCall: CallMetadata | null,
  localExt: string,
  options?: UseCallTelephonySoundsOptions,
) {
  const prevCallRef = useRef<CallMetadata | null>(null);
  const nativeRingingRef = useRef(options?.nativeRinging);
  const delegateRingRef = useRef(options?.delegateRingToNative);
  const webRingBackupRef = useRef(options?.webRingBackupOnAndroid);
  const playHangupRef = useRef(options?.playHangup);
  nativeRingingRef.current = options?.nativeRinging;
  delegateRingRef.current = options?.delegateRingToNative;
  webRingBackupRef.current = options?.webRingBackupOnAndroid;
  playHangupRef.current = options?.playHangup;

  useEffect(() => {
    const prevCall = prevCallRef.current;
    const callEnded = !currentCall && wasActiveCall(prevCall);
    const nativeRinging = nativeRingingRef.current;
    const delegateRing = delegateRingRef.current;
    const webRingBackup = webRingBackupRef.current;

    const stopNativeIfOwned = () => {
      if (!delegateRing) {
        nativeRinging?.stop();
      }
    };

    if (currentCall?.toExt === localExt && currentCall.status === 'ringing') {
      if (!delegateRing) {
        telephonyAudio.stopAll();
        if (nativeRinging) {
          nativeRinging.startIncoming();
        } else {
          telephonyAudio.startIncomingRinger();
        }
      } else if (webRingBackup) {
        telephonyAudio.stopAll();
        telephonyAudio.startIncomingRinger();
      }
    } else if (currentCall?.fromExt === localExt && currentCall.status === 'ringing') {
      if (!delegateRing) {
        telephonyAudio.stopAll();
        if (nativeRinging) {
          nativeRinging.startRingback();
        } else {
          telephonyAudio.startRingbackTone();
        }
      } else if (webRingBackup) {
        telephonyAudio.stopAll();
        telephonyAudio.startRingbackTone();
      }
    } else if (currentCall?.status === 'connected') {
      stopNativeIfOwned();
      telephonyAudio.playCallConnect();
    } else if (callEnded) {
      stopNativeIfOwned();
      if (!delegateRing) {
        const playHangup = playHangupRef.current;
        if (playHangup) {
          playHangup();
        } else {
          telephonyAudio.playHangupTone();
        }
      }
    } else {
      stopNativeIfOwned();
      telephonyAudio.stopAll();
    }

    prevCallRef.current = currentCall;

    return () => {
      if (!delegateRingRef.current) {
        telephonyAudio.stopAll();
      }
    };
  }, [currentCall, localExt]);
}
