import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

interface AdminPinDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  error?: string | null;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

export default function AdminPinDialog({
  open,
  title = 'Admin PIN Required',
  message = 'Enter the staff PIN to continue.',
  error,
  onSubmit,
  onCancel,
}: AdminPinDialogProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim()) onSubmit(pin.trim());
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-label="Close dialog"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-pin-title"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h3 id="admin-pin-title" className="text-base font-bold text-slate-900">
            {title}
          </h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter PIN"
          className="mt-4 w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          autoComplete="off"
        />

        {error && (
          <p className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!pin}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
