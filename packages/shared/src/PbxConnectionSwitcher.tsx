import { usePbxConnection } from './usePbxConnection';

type SwitcherVariant = 'guest' | 'desk';

interface PbxConnectionSwitcherProps {
  variant?: SwitcherVariant;
  className?: string;
}

function accentClass(variant: SwitcherVariant, active: boolean): string {
  if (!active) return 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  return variant === 'guest'
    ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
    : 'border-desk-primary/30 bg-blue-50 text-desk-primary-dark';
}

export default function PbxConnectionSwitcher({
  variant = 'guest',
  className = '',
}: PbxConnectionSwitcherProps) {
  const {
    mode,
    switching,
    error,
    currentUrl,
    canUseLan,
    canUseTailscale,
    switchTo,
  } = usePbxConnection();

  if (!canUseLan && !canUseTailscale) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ${className}`}>
        <p className="text-xs font-semibold text-slate-700">PBX connection</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Save the server once on hotel Wi-Fi to enable quick LAN / Tailscale switching.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            PBX Connection
          </p>
          <p className="text-[11px] text-slate-500 mt-1 truncate font-mono">
            {currentUrl || 'Not configured'}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${
            mode === 'tailscale'
              ? 'border-violet-200 bg-violet-50 text-violet-700'
              : mode === 'lan'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          {mode === 'tailscale' ? 'Remote' : mode === 'lan' ? 'Hotel Wi-Fi' : 'Custom'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canUseLan || switching !== null}
          onClick={() => void switchTo('lan')}
          className={`rounded-xl border px-3 py-3 text-left transition-colors min-h-[52px] disabled:opacity-50 ${accentClass(
            variant,
            mode === 'lan',
          )}`}
          style={{ touchAction: 'manipulation' }}
        >
          <p className="text-sm font-semibold">
            {switching === 'lan' ? 'Switching…' : 'Hotel Wi-Fi'}
          </p>
          <p className="text-[10px] opacity-80 truncate">LAN · faster onsite</p>
        </button>

        <button
          type="button"
          disabled={!canUseTailscale || switching !== null}
          onClick={() => void switchTo('tailscale')}
          className={`rounded-xl border px-3 py-3 text-left transition-colors min-h-[52px] disabled:opacity-50 ${accentClass(
            variant,
            mode === 'tailscale',
          )}`}
          style={{ touchAction: 'manipulation' }}
        >
          <p className="text-sm font-semibold">
            {switching === 'tailscale' ? 'Switching…' : 'Remote'}
          </p>
          <p className="text-[10px] opacity-80 truncate">Tailscale · mobile data</p>
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
