import { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Phone,
  Grid3X3,
  Pause,
  Play,
} from 'lucide-react';
import type { CallMetadata } from '@hotel-voip/shared';
import { getInitials, formatCallDuration } from '../../utils/deskHelpers';
import CallControlButton from './CallControlButton';
import { useDeskConfirm } from '../../hooks/useDeskConfirm';

interface ActiveCallOverlayProps {
  currentCall: CallMetadata;
  deskExt?: string;
  isMicMuted: boolean;
  isSpeakerMuted: boolean;
  isOnHold: boolean;
  isVoiceConnected: boolean;
  voiceError?: string | null;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onToggleHold: () => void;
  onHangup: () => void;
  onAnswer?: () => void;
  onDecline?: () => void;
  onShowKeypad?: () => void;
}

export default function ActiveCallOverlay({
  currentCall,
  deskExt = '000',
  isMicMuted,
  isSpeakerMuted,
  isOnHold,
  isVoiceConnected,
  voiceError,
  onToggleMic,
  onToggleSpeaker,
  onToggleHold,
  onHangup,
  onAnswer,
  onDecline,
  onShowKeypad,
}: ActiveCallOverlayProps) {
  const { confirm, dialog } = useDeskConfirm();
  const isIncoming = currentCall.toExt === deskExt && currentCall.status === 'ringing';
  const isConnected = currentCall.status === 'connected';
  const peerName =
    currentCall.fromExt === deskExt ? currentCall.toName : currentCall.fromName;
  const peerExt =
    currentCall.fromExt === deskExt ? currentCall.toExt : currentCall.fromExt;

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isConnected, currentCall.callId]);

  const handleDecline = async () => {
    const ok = await confirm({
      title: 'Decline call?',
      message: `Reject the incoming call from ${peerName} (Ext ${peerExt})?`,
      confirmLabel: 'Yes, Decline',
      cancelLabel: 'No',
      variant: 'danger',
    });
    if (ok) onDecline?.();
  };

  const handleHangup = async () => {
    const ok = await confirm({
      title: 'End call?',
      message: `Hang up the call with ${peerName} (Ext ${peerExt})?`,
      confirmLabel: 'Yes, Hang Up',
      cancelLabel: 'No',
      variant: 'danger',
    });
    if (ok) onHangup();
  };

  return (
    <div className="fixed inset-0 z-50 desk-gradient-call flex flex-col text-white animate-fadeIn">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        {isOnHold && (
          <span className="mb-4 px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
            On Hold
          </span>
        )}

        <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-4 animate-call-pulse">
          {getInitials(peerName)}
        </div>

        <h2 className="text-2xl font-bold mb-1">{peerName}</h2>
        <p className="text-white/70 text-sm mb-1">Ext {peerExt}</p>

        {isIncoming ? (
          <p className="text-white/80 text-sm animate-pulse mt-2">Incoming call…</p>
        ) : isConnected ? (
          <p className="text-white/90 text-lg font-mono mt-2 tabular-nums">
            {formatCallDuration(elapsed)}
          </p>
        ) : (
          <p className="text-white/70 text-sm mt-2">Connecting…</p>
        )}

        {isConnected && !isVoiceConnected && !voiceError && (
          <p className="text-white/60 text-xs mt-2">Establishing audio…</p>
        )}
        {voiceError && (
          <p className="text-rose-200 text-xs mt-2 text-center max-w-xs">{voiceError}</p>
        )}
      </div>

      <div className="px-8 pb-10 pt-4">
        {isIncoming ? (
          <div className="flex items-center justify-center gap-12">
            <CallControlButton
              icon={PhoneOff}
              label="Decline"
              onClick={() => void handleDecline()}
              variant="hangup"
            />
            <CallControlButton
              icon={Phone}
              label="Answer"
              onClick={() => onAnswer?.()}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-6 max-w-xs mx-auto mb-8">
              <CallControlButton
                icon={isMicMuted ? MicOff : Mic}
                label={isMicMuted ? 'Unmute' : 'Mute'}
                onClick={onToggleMic}
                active={isMicMuted}
              />
              <CallControlButton
                icon={Grid3X3}
                label="Keypad"
                onClick={() => onShowKeypad?.()}
              />
              <CallControlButton
                icon={isSpeakerMuted ? VolumeX : Volume2}
                label={isSpeakerMuted ? 'Speaker Off' : 'Speaker'}
                onClick={onToggleSpeaker}
                active={isSpeakerMuted}
              />
              <CallControlButton
                icon={isOnHold ? Play : Pause}
                label={isOnHold ? 'Resume' : 'Hold'}
                onClick={onToggleHold}
                active={isOnHold}
              />
            </div>
            <div className="flex justify-center">
              <CallControlButton
                icon={PhoneOff}
                label="Hang Up"
                onClick={() => void handleHangup()}
                variant="hangup"
              />
            </div>
          </>
        )}
      </div>
      {dialog}
    </div>
  );
}
