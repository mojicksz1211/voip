import GuestModal from './GuestModal';

interface GuestConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GuestConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  variant = 'default',
  onConfirm,
  onCancel,
}: GuestConfirmDialogProps) {
  const confirmClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <GuestModal open={open} onBackdropClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-confirm-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-fadeIn"
      >
        <h3 id="guest-confirm-title" className="text-base font-bold text-slate-900">
          {title}
        </h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${confirmClass}`}
            style={{ touchAction: 'manipulation' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </GuestModal>
  );
}
