import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import VoiceSinewave from './VoiceSinewave';

interface InCallScreenProps {
  peerName: string;
  peerExt: string;
  isMicMuted: boolean;
  isSpeakerMuted: boolean;
  isVoiceConnected: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onHangup: () => void;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ControlBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 landscape:gap-1 group"
    >
      <span
        className={`call-control-btn-size rounded-full flex items-center justify-center transition-all active:scale-95 ${
          active
            ? 'bg-white text-slate-900'
            : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
        }`}
      >
        <Icon className="w-5 h-5 landscape:w-6 landscape:h-6" strokeWidth={2.25} />
      </span>
      <span className="text-xs font-medium text-blue-100/80 short-landscape:hidden">{label}</span>
    </button>
  );
}

export default function InCallScreen({
  peerName,
  peerExt,
  isMicMuted,
  isSpeakerMuted,
  isVoiceConnected,
  onToggleMic,
  onToggleSpeaker,
  onHangup,
}: InCallScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex flex-col landscape:flex-row landscape:items-center landscape:justify-around landscape:gap-4 landscape:px-8 short:overflow-y-auto items-center justify-between select-none animate-fadeIn bg-gradient-to-b from-[#0a1f44] via-[#0b1e3f] to-[#08152e] text-white px-6 safe-call-inset"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-incall-title"
    >
      <div className="mt-4 landscape:mt-0 flex flex-col items-center landscape:items-start text-center landscape:text-left shrink-0">
        <p className="text-xs font-semibold tracking-[0.28em] text-blue-200/60 uppercase mb-4 landscape:mb-2 short:mb-1">
          {isVoiceConnected ? 'In call' : 'Connecting…'}
        </p>
        <h1
          id="guest-incall-title"
          className="call-title-size font-bold px-2 landscape:px-0 short:text-2xl"
        >
          {peerName}
        </h1>
        <p className="text-base landscape:text-lg text-blue-200/70 mt-2 landscape:mt-1">Ext {peerExt}</p>
        <p className="mt-3 landscape:mt-2 text-2xl landscape:text-xl short:text-lg font-mono font-semibold tabular-nums tracking-tight text-blue-100">
          {formatDuration(elapsed)}
        </p>
      </div>

      <div className="w-full max-w-xl landscape:max-w-md landscape:flex-1 landscape:min-w-0">
        <VoiceSinewave active={isVoiceConnected} className="h-20 sm:h-28 landscape:h-16 short:h-12" />
      </div>

      <div className="w-full max-w-sm landscape:max-w-none landscape:w-auto flex flex-col items-center gap-6 landscape:gap-4 mb-2 landscape:mb-0 shrink-0">
        <div className="flex items-start justify-center gap-8 landscape:gap-4">
          <ControlBtn
            icon={isMicMuted ? MicOff : Mic}
            label={isMicMuted ? 'Unmute' : 'Mute'}
            active={isMicMuted}
            onClick={onToggleMic}
          />
          <ControlBtn
            icon={isSpeakerMuted ? VolumeX : Volume2}
            label={isSpeakerMuted ? 'Speaker off' : 'Speaker'}
            active={isSpeakerMuted}
            onClick={onToggleSpeaker}
          />
        </div>

        <div className="flex flex-col items-center gap-2 landscape:gap-1.5">
          <button
            type="button"
            onClick={onHangup}
            aria-label="Hang up"
            style={{ touchAction: 'manipulation' }}
            className="call-btn-size rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center shadow-xl transition-all active:scale-95"
          >
            <PhoneOff className="w-6 h-6 landscape:w-7 landscape:h-7" strokeWidth={2.25} />
          </button>
          <span className="text-sm font-medium text-blue-100 short-landscape:hidden">Hang up</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
