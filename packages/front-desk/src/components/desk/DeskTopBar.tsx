import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OperatorStatus } from '../../utils/deskHelpers';
import { useDeskConfirm } from '../../hooks/useDeskConfirm';

interface DeskTopBarProps {
  autoAnswer: boolean;
  dnd: boolean;
  onToggleAutoAnswer: () => void;
  onToggleDnd: () => void;
  operatorStatus: OperatorStatus;
  onStatusChange: (status: OperatorStatus) => void;
  isRegistered?: boolean;
}

export default function DeskTopBar({
  autoAnswer,
  dnd,
  onToggleAutoAnswer,
  onToggleDnd,
  operatorStatus,
  onStatusChange,
  isRegistered = true,
}: DeskTopBarProps) {
  const { confirm, dialog } = useDeskConfirm();
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [statusOpen]);

  const confirmEnableDnd = () =>
    confirm({
      title: 'Enable Do Not Disturb?',
      message:
        'Outbound calls will be blocked. Incoming calls will still ring unless you decline them.',
      confirmLabel: 'Yes, Enable DND',
      cancelLabel: 'No',
      variant: 'danger',
    });

  const handleAutoAnswerChange = async () => {
    if (autoAnswer) {
      onToggleAutoAnswer();
      return;
    }
    const ok = await confirm({
      title: 'Enable Auto Answer?',
      message: 'Incoming calls will be answered automatically after 2 seconds.',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    if (ok) onToggleAutoAnswer();
  };

  const handleDndClick = async () => {
    if (dnd) {
      onToggleDnd();
      return;
    }
    if (await confirmEnableDnd()) onToggleDnd();
  };

  const handleStatusChange = async (status: OperatorStatus) => {
    if (status === operatorStatus) return;
    if (status === 'dnd' && !dnd) {
      if (!(await confirmEnableDnd())) return;
    }
    onStatusChange(status);
  };

  return (
    <header className="min-h-14 py-2 px-4 sm:px-5 flex items-center justify-between bg-white border-b border-slate-200 shrink-0 z-20 safe-area-pt">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="/desk-icon.svg"
          alt=""
          className="w-10 h-10 rounded-xl shadow-sm shrink-0"
          width={40}
          height={40}
        />
        <div className="min-w-0 leading-tight">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
            Hotel VoIP
            <span className="font-medium text-slate-400 hidden sm:inline"> · Front Desk</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">Front Desk Console</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoAnswer}
            onChange={() => void handleAutoAnswerChange()}
            className="w-4 h-4 rounded border-slate-300 text-desk-primary focus:ring-desk-primary"
          />
          <span className="text-sm font-medium text-slate-600 hidden sm:inline">Auto Answer</span>
        </label>

        <button
          type="button"
          onClick={() => void handleDndClick()}
          className={`px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors ${
            dnd
              ? 'bg-rose-100 text-rose-700 border border-rose-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          DND{dnd ? ' ON' : ''}
        </button>

        <div className="relative" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen((open) => !open)}
            className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            aria-expanded={statusOpen}
            aria-haspopup="listbox"
          >
            <span
              className={`w-3 h-3 rounded-full ${
                operatorStatus === 'online'
                  ? 'bg-emerald-500'
                  : operatorStatus === 'dnd'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
              }`}
            />
            <span className="text-sm font-semibold text-slate-700 hidden sm:inline">Front Desk</span>
            <span className="text-xs text-slate-400 hidden md:inline">
              • {isRegistered ? 'REGISTERED' : 'OFFLINE'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <div
            className={`absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-30 ${
              statusOpen ? 'block' : 'hidden'
            }`}
          >
            {(['online', 'dnd', 'offline'] as OperatorStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  void handleStatusChange(s);
                  setStatusOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 capitalize ${
                  operatorStatus === s ? 'text-desk-primary font-semibold' : 'text-slate-600'
                }`}
              >
                {s === 'dnd' ? 'Do Not Disturb' : s}
              </button>
            ))}
          </div>
        </div>
      </div>
      {dialog}
    </header>
  );
}
