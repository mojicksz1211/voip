import { createPortal } from 'react-dom';
import { PhoneOff, User } from 'lucide-react';
import type { CallMetadata, SIPExtension } from '@hotel-voip/shared';

interface OutgoingCallModalProps {
  currentCall: CallMetadata;
  deskExt?: string;
  extensions?: SIPExtension[];
  onCancel: () => void;
}

/** Up-to-two-letter initials from a display name, e.g. "Room 304" -> "R3". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function OutgoingCallModal({
  currentCall,
  onCancel,
}: OutgoingCallModalProps) {
  if (typeof document === 'undefined') return null;

  const peerName = currentCall.toName;
  const peerExt = currentCall.toExt;
  const initials = initialsOf(peerName);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col landscape:flex-row landscape:items-center landscape:justify-around landscape:gap-4 landscape:px-8 short:overflow-y-auto items-center justify-between select-none animate-fadeIn bg-gradient-to-b from-[#0a1f44] via-[#0b1e3f] to-[#08152e] text-white px-6 safe-call-inset"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outgoing-call-title"
    >
      <div className="mt-6 landscape:mt-0 flex flex-col items-center landscape:items-start text-center landscape:text-left shrink-0">
        <p className="text-xs font-semibold tracking-[0.28em] text-blue-200/60 uppercase mb-6 landscape:mb-2 short:mb-1">
          Calling
        </p>
        <h1
          id="outgoing-call-title"
          className="call-title-size font-bold px-2 landscape:px-0 short:text-2xl"
        >
          {peerName}
        </h1>
        <p className="text-base landscape:text-lg text-blue-200/70 mt-2 landscape:mt-1">Ext {peerExt}</p>
        <p className="text-sm text-blue-300/70 font-medium mt-3 landscape:mt-2 animate-pulse">Ringing…</p>
      </div>

      <div className="relative flex items-center justify-center pointer-events-none shrink-0">
        <span
          className="absolute call-ripple-size rounded-full bg-white/5 animate-ripple short-landscape:hidden"
          aria-hidden
        />
        <span
          className="absolute call-ripple-size-lg rounded-full bg-white/5 animate-ripple short-landscape:hidden"
          style={{ animationDelay: '0.5s' }}
          aria-hidden
        />
        <div className="relative call-avatar-size rounded-full bg-gradient-to-br from-blue-500/40 to-indigo-500/20 border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
          {initials ? (
            <span className="text-3xl landscape:text-4xl font-bold text-white">{initials}</span>
          ) : (
            <User className="w-12 h-12 landscape:w-16 landscape:h-16 text-white/80" />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 landscape:gap-1.5 mb-2 landscape:mb-0 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel call"
          style={{ touchAction: 'manipulation' }}
          className="call-btn-size rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center shadow-xl transition-all active:scale-95"
        >
          <PhoneOff className="w-6 h-6 landscape:w-7 landscape:h-7" />
        </button>
        <span className="text-sm font-medium text-blue-100 short-landscape:hidden">End</span>
      </div>
    </div>,
    document.body,
  );
}
