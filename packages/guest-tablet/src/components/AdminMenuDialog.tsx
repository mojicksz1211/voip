import { Phone, Pin, PinOff, RefreshCw, Server, Unlink } from 'lucide-react';
import GuestModal from './GuestModal';

interface AdminMenuDialogProps {
  open: boolean;
  kioskPinned: boolean;
  kioskLockActive: boolean;
  retroHandset: boolean;
  onToggleRetroHandset: () => void;
  onServerSetup: () => void;
  onToggleKioskPin: () => void;
  onRetryKioskPin?: () => void;
  onUnlink: () => void;
  onCancel: () => void;
}

export default function AdminMenuDialog({
  open,
  kioskPinned,
  kioskLockActive,
  retroHandset,
  onToggleRetroHandset,
  onServerSetup,
  onToggleKioskPin,
  onRetryKioskPin,
  onUnlink,
  onCancel,
}: AdminMenuDialogProps) {
  return (
    <GuestModal open={open} onBackdropClick={onCancel} zIndexClass="z-[150]">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-fadeIn"
      >
        <h3 className="text-base font-bold text-slate-900 mb-1">Staff Admin</h3>
        <p className="text-sm text-slate-600 mb-4">Choose an action for this tablet.</p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          <button
            type="button"
            onClick={onToggleRetroHandset}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors min-h-[48px] ${
              retroHandset ? 'border-violet-200 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            <Phone className={`w-5 h-5 ${retroHandset ? 'text-violet-600' : 'text-slate-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${retroHandset ? 'text-violet-900' : 'text-slate-900'}`}>
                Retro phone handset {retroHandset ? 'ON' : 'OFF'}
              </p>
              <p className="text-[11px] text-slate-500">
                For 3.5mm retro receiver — better audio. Hook button answers or ends calls.
              </p>
            </div>
          </button>
          {kioskPinned && !kioskLockActive && onRetryKioskPin && (
            <button
              type="button"
              onClick={onRetryKioskPin}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-200 hover:bg-indigo-50 text-left transition-colors min-h-[48px]"
              style={{ touchAction: 'manipulation' }}
            >
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">Retry Full Pin</p>
                <p className="text-[11px] text-indigo-600">
                  Try locking Home / Recents again
                </p>
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleKioskPin}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors min-h-[48px] ${
              kioskPinned
                ? 'border-amber-200 hover:bg-amber-50'
                : 'border-indigo-200 hover:bg-indigo-50'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {kioskPinned ? (
              <PinOff className="w-5 h-5 text-amber-600" />
            ) : (
              <Pin className="w-5 h-5 text-indigo-600" />
            )}
            <div>
              <p className={`text-sm font-semibold ${kioskPinned ? 'text-amber-800' : 'text-slate-900'}`}>
                {kioskPinned ? 'Unpin App' : 'Pin App (Kiosk)'}
              </p>
              <p className={`text-[11px] ${kioskPinned ? 'text-amber-600' : 'text-slate-500'}`}>
                {kioskPinned
                  ? kioskLockActive
                    ? 'Fully pinned — tap to unpin and allow exit'
                    : 'Back blocked — partial pin only'
                  : 'Lock guests inside the app'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={onServerSetup}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors min-h-[48px]"
            style={{ touchAction: 'manipulation' }}
          >
            <Server className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Change Server</p>
              <p className="text-[11px] text-slate-500">Update PBX server address</p>
            </div>
          </button>
          <button
            type="button"
            onClick={onUnlink}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-left transition-colors min-h-[48px]"
            style={{ touchAction: 'manipulation' }}
          >
            <Unlink className="w-5 h-5 text-rose-600" />
            <div>
              <p className="text-sm font-semibold text-rose-700">Unlink Room</p>
              <p className="text-[11px] text-rose-500">Unregister this tablet</p>
            </div>
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full mt-4 min-h-[44px] py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
          style={{ touchAction: 'manipulation' }}
        >
          Cancel
        </button>
      </div>
    </GuestModal>
  );
}
