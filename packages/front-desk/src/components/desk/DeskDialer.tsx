import { useState, useEffect } from 'react';
import { Phone, Delete } from 'lucide-react';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

interface DeskDialerProps {
  onCall: (ext: string) => void;
  disabled?: boolean;
  initialValue?: string;
}

export default function DeskDialer({ onCall, disabled = false, initialValue = '' }: DeskDialerProps) {
  const [dialed, setDialed] = useState(initialValue);

  useEffect(() => {
    if (initialValue) setDialed(initialValue);
  }, [initialValue]);

  const appendDigit = (digit: string) => {
    if (dialed.length >= 6) return;
    setDialed((prev) => prev + digit);
  };

  const backspace = () => setDialed((prev) => prev.slice(0, -1));

  const handleCall = () => {
    const ext = dialed.trim();
    if (!ext || disabled) return;
    onCall(ext);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-6 pb-4 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          Caller ID
        </p>
        <p className="text-base font-semibold text-slate-700">Ext 000 • Front Desk</p>
      </div>

      <div className="px-6 mb-5">
        <div className="flex items-center gap-3 bg-desk-keypad rounded-2xl px-5 py-4 border border-slate-100">
          <input
            type="text"
            readOnly
            value={dialed}
            placeholder="Dial extension"
            className="flex-1 bg-transparent text-3xl font-light text-slate-800 text-center outline-none placeholder:text-slate-300"
          />
          {dialed.length > 0 && (
            <button
              type="button"
              onClick={backspace}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
            >
              <Delete className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 grid grid-cols-3 gap-3 content-start">
        {KEYPAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => appendDigit(key)}
            disabled={disabled}
            className="aspect-square max-h-[min(76px,12vmin)] rounded-2xl bg-desk-keypad hover:bg-slate-100 text-2xl landscape:text-xl font-medium text-slate-800 transition-colors active:scale-95 disabled:opacity-40 border border-slate-100"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="p-6 pt-4">
        <button
          type="button"
          onClick={handleCall}
          disabled={!dialed.trim() || disabled}
          className="w-full py-4 rounded-full desk-gradient-call-btn text-white text-base font-bold flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Phone className="w-6 h-6" />
          Call
        </button>
        {disabled && (
          <p className="text-center text-xs text-rose-500 mt-2.5 font-medium">DND is on — outbound disabled</p>
        )}
      </div>
    </div>
  );
}
