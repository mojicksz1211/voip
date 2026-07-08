import { useState } from 'react';
import { MessageSquare, Check, Clock } from 'lucide-react';
import type { GuestRequest } from '@hotel-voip/shared';
import { REQUEST_LABELS } from '../../utils/deskHelpers';
import { useDeskConfirm } from '../../hooks/useDeskConfirm';

type RequestTab = 'pending' | 'processing' | 'done' | 'all';

interface DeskRequestsPanelProps {
  requests: GuestRequest[];
  onUpdateStatus: (id: string, status: GuestRequest['status']) => Promise<void>;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TabCountBadge({
  count,
  tabId,
  active,
}: {
  count: number;
  tabId: RequestTab;
  active: boolean;
}) {
  const tones: Record<RequestTab, { on: string; off: string }> = {
    pending: {
      on: 'bg-rose-500 text-white',
      off: 'bg-rose-100 text-rose-700 border border-rose-200',
    },
    processing: {
      on: 'bg-desk-primary text-white',
      off: 'bg-blue-100 text-desk-primary border border-blue-200',
    },
    done: {
      on: 'bg-emerald-500 text-white',
      off: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    },
    all: {
      on: 'bg-slate-700 text-white',
      off: 'bg-slate-200 text-slate-700 border border-slate-300',
    },
  };

  return (
    <span
      className={`min-w-[24px] h-6 px-2 inline-flex items-center justify-center rounded-full text-xs font-bold leading-none ${
        active ? tones[tabId].on : tones[tabId].off
      }`}
    >
      {count}
    </span>
  );
}

function StatusBadge({ status }: { status: GuestRequest['status'] }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    processing: 'bg-blue-50 text-desk-primary border-blue-200',
    done: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const labels = { pending: 'Pending', processing: 'Processing', done: 'Done' };
  return (
    <span
      className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function DeskRequestsPanel({ requests, onUpdateStatus }: DeskRequestsPanelProps) {
  const [tab, setTab] = useState<RequestTab>('pending');
  const { confirm, dialog } = useDeskConfirm();

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const processingCount = requests.filter((r) => r.status === 'processing').length;
  const doneCount = requests.filter((r) => r.status === 'done').length;

  const filtered = [...requests]
    .filter((r) => tab === 'all' || r.status === tab)
    .reverse();

  const tabs: { id: RequestTab; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending', count: pendingCount },
    { id: 'processing', label: 'Active', count: processingCount },
    { id: 'done', label: 'Done', count: doneCount },
    { id: 'all', label: 'All', count: requests.length },
  ];

  const handleProcess = async (req: GuestRequest) => {
    const label = REQUEST_LABELS[req.requestType] ?? req.requestType;
    const ok = await confirm({
      title: 'Process this request?',
      message: `Start handling Room ${req.roomNumber} — ${label}?`,
      confirmLabel: 'Yes, Process',
      cancelLabel: 'No',
    });
    if (ok) await onUpdateStatus(req.id, 'processing');
  };

  const handleDone = async (req: GuestRequest) => {
    const label = REQUEST_LABELS[req.requestType] ?? req.requestType;
    const ok = await confirm({
      title: 'Mark as done?',
      message: `Mark Room ${req.roomNumber} — ${label} as completed?`,
      confirmLabel: 'Yes, Done',
      cancelLabel: 'No',
    });
    if (ok) await onUpdateStatus(req.id, 'done');
  };

  return (
    <div className="flex flex-col h-full max-w-4xl w-full bg-white rounded-2xl desk-shadow-card overflow-hidden border border-slate-100">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Guest Requests</h2>
          {pendingCount > 0 && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 text-sm font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white text-desk-primary shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <TabCountBadge count={t.count} tabId={t.id} active={isActive} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">
              {tab === 'pending' ? 'No pending requests.' : `No ${tab} requests.`}
            </p>
          </div>
        ) : (
          filtered.map((req) => (
            <div
              key={req.id}
              className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center px-4 sm:px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-[15px] sm:text-base font-semibold text-slate-800">
                    Room {req.roomNumber}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs sm:text-sm font-bold text-desk-primary uppercase truncate">
                    {REQUEST_LABELS[req.requestType] ?? req.requestType}
                  </span>
                  {tab === 'all' && <StatusBadge status={req.status} />}
                </div>
                {req.customText && (
                  <p className="text-xs sm:text-sm text-slate-500 italic truncate mt-1">
                    "{req.customText}"
                  </p>
                )}
                <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatTime(req.timestamp)}
                </p>
              </div>

              <div className="shrink-0">
                {req.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void handleProcess(req)}
                    className="px-4 py-2.5 text-sm bg-desk-primary hover:bg-desk-primary-dark text-white font-semibold rounded-xl transition-colors active:scale-95"
                  >
                    Process
                  </button>
                )}
                {req.status === 'processing' && (
                  <button
                    type="button"
                    onClick={() => void handleDone(req)}
                    className="px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center gap-1.5 transition-colors active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Done
                  </button>
                )}
                {req.status === 'done' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-slate-400 bg-slate-100 rounded-xl">
                    <Check className="w-4 h-4" />
                    Done
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {dialog}
    </div>
  );
}
