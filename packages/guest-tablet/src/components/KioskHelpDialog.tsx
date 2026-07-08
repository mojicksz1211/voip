import { useState } from 'react';
import GuestModal from './GuestModal';

interface KioskHelpDialogProps {
  open: boolean;
  lockTaskActive: boolean;
  deviceOwner?: boolean;
  screenPinningEnabled?: boolean;
  onOpenSettings: () => void;
  onRetryPin: () => Promise<void>;
  onDismiss: () => void;
}

export default function KioskHelpDialog({
  open,
  lockTaskActive,
  deviceOwner,
  screenPinningEnabled,
  onOpenSettings,
  onRetryPin,
  onDismiss,
}: KioskHelpDialogProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetryPin();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <GuestModal open={open} onBackdropClick={onDismiss}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-fadeIn"
      >
        <h3 className="text-base font-bold text-slate-900">
          {deviceOwner || lockTaskActive ? 'Kiosk locked' : 'Kiosk active'}
        </h3>
        {deviceOwner ? (
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Full device lock is enabled. Home and Recents are disabled. Use Settings to unpin
            when needed.
          </p>
        ) : lockTaskActive ? (
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Screen pin is active. If a guest uses Back+Overview to unpin, this app will return
            and re-pin automatically. Use Settings to fully unpin.
          </p>
        ) : (
          <div className="text-sm text-slate-600 mt-2 leading-relaxed space-y-2">
            <p>
              Kiosk guardian is running. If guests leave the app (Back+Overview), it will{' '}
              <strong>return automatically</strong> and re-pin. Use Settings to unpin.
            </p>
            <p className="text-[12px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <strong>Best lock (IT one-time):</strong> factory-reset tablet, no Google account,
              then USB:{' '}
              <code className="bg-white px-1 rounded text-[10px]">
                adb shell dpm set-device-owner com.hotelvoip.guesttablet/.KioskDeviceAdminReceiver
              </code>
            </p>
            {screenPinningEnabled === false && (
              <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Enable <strong>Screen pinning</strong> in settings for stronger lock, then tap
                Retry Pin.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 mt-5">
          {!deviceOwner && !lockTaskActive && (
            <>
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
                style={{ touchAction: 'manipulation' }}
              >
                {retrying ? 'Pinning…' : 'Retry Pin'}
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-full min-h-[44px] py-2.5 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-colors active:scale-[0.98]"
                style={{ touchAction: 'manipulation' }}
              >
                Open Security Settings
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors active:scale-[0.98]"
            style={{ touchAction: 'manipulation' }}
          >
            OK
          </button>
        </div>
      </div>
    </GuestModal>
  );
}
