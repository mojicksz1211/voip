interface GuestAlertDialogProps {
  open: boolean;
  title?: string;
  message: string;
  onDismiss: () => void;
}

export default function GuestAlertDialog({
  open,
  title = 'Notice',
  message,
  onDismiss,
}: GuestAlertDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onDismiss}
        aria-label="Close dialog"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="guest-alert-title"
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-fadeIn"
      >
        <h3 id="guest-alert-title" className="text-base font-bold text-slate-900">
          {title}
        </h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
