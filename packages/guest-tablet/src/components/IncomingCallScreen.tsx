import { createPortal } from 'react-dom';
import { Phone, PhoneOff, User } from 'lucide-react';

interface IncomingCallScreenProps {
  peerName: string;
  peerExt: string;
  onAnswer: () => void;
  onDecline: () => void;
}

/** Up-to-two-letter initials from a display name, e.g. "Front Desk" -> "FD". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function IncomingCallScreen({
  peerName,
  peerExt,
  onAnswer,
  onDecline,
}: IncomingCallScreenProps) {
  if (typeof document === 'undefined') return null;

  const initials = initialsOf(peerName);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between select-none animate-fadeIn bg-gradient-to-b from-[#0a1f44] via-[#0b1e3f] to-[#08152e] text-white px-6 safe-call-inset"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-incoming-call-title"
    >
      <div className="mt-6 flex flex-col items-center text-center">
        <p className="text-xs font-semibold tracking-[0.28em] text-blue-200/60 uppercase mb-8">
          Incoming call
        </p>
        <h1
          id="guest-incoming-call-title"
          className="text-4xl sm:text-5xl font-bold leading-tight px-2"
        >
          {peerName}
        </h1>
        <p className="text-lg text-blue-200/70 mt-3">Ext {peerExt}</p>
      </div>

      <div className="relative flex items-center justify-center pointer-events-none">
        <span className="absolute w-56 h-56 rounded-full bg-white/5 animate-ripple" aria-hidden />
        <span
          className="absolute w-64 h-64 rounded-full bg-white/5 animate-ripple"
          style={{ animationDelay: '0.5s' }}
          aria-hidden
        />
        <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-blue-500/40 to-indigo-500/20 border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
          {initials ? (
            <span className="text-5xl font-bold text-white">{initials}</span>
          ) : (
            <User className="w-16 h-16 text-white/80" />
          )}
        </div>
      </div>

      <div className="w-full max-w-xs flex items-end justify-between mb-2">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onDecline}
            aria-label="Decline call"
            className="w-[72px] h-[72px] rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center shadow-xl transition-all active:scale-95"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <span className="text-sm font-medium text-blue-100">Decline</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onAnswer}
            aria-label="Answer call"
            style={{ touchAction: 'manipulation' }}
            className="w-[72px] h-[72px] rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-xl transition-all active:scale-95 blink-emerald"
          >
            <Phone className="w-7 h-7" />
          </button>
          <span className="text-sm font-medium text-blue-100">Answer</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
