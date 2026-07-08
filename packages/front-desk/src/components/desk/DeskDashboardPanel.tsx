import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { CallMetadata, CallRecord, GuestRequest, SIPExtension } from '@hotel-voip/shared';
import { getApiBase } from '@hotel-voip/shared';
import type { DeskNav } from '../../utils/deskHelpers';
import { REQUEST_LABELS } from '../../utils/deskHelpers';
import {
  computeDashboardStats,
  formatLastSeen,
  getGreeting,
} from '../../utils/deskDashboard';
import { getExtensionIcon } from '../../utils/deskRoomIcons';
import DeskIconCircle from './DeskIconCircle';

interface DeskDashboardPanelProps {
  extensions: SIPExtension[];
  calls: CallRecord[];
  requests: GuestRequest[];
  currentCall: CallMetadata | null;
  deskExt?: string;
  isVoiceConnected?: boolean;
  voiceError?: string | null;
  onDial: (ext: string) => void;
  onNavChange: (nav: DeskNav) => void;
  dnd?: boolean;
}

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  icon: typeof Activity;
}) {
  const tones = {
    default: 'bg-white border-slate-100 text-slate-800',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    warning: 'bg-amber-50 border-amber-100 text-amber-900',
    danger: 'bg-rose-50 border-rose-100 text-rose-900',
    info: 'bg-blue-50 border-blue-100 text-blue-900',
  };
  const iconTones = {
    default: 'bg-slate-100 text-slate-500',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-rose-100 text-rose-600',
    info: 'bg-blue-100 text-desk-primary',
  };

  return (
    <div className={`rounded-2xl border desk-shadow-card p-4 sm:p-5 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 tabular-nums leading-none">{value}</p>
          {sub && <p className="text-xs sm:text-sm mt-2 opacity-80">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconTones[tone]}`}>
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="text-base sm:text-lg font-bold text-slate-800">{title}</h3>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-1 text-sm font-semibold text-desk-primary hover:text-desk-primary-dark transition-colors"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function statusLabel(status: SIPExtension['status']): string {
  const labels: Record<SIPExtension['status'], string> = {
    online: 'Online',
    offline: 'Offline',
    ringing: 'Ringing',
    busy: 'Busy',
  };
  return labels[status];
}

function StatusDot({ status }: { status: SIPExtension['status'] }) {
  const colors: Record<SIPExtension['status'], string> = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-300',
    ringing: 'bg-amber-500 animate-pulse',
    busy: 'bg-rose-500',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

export default function DeskDashboardPanel({
  extensions,
  calls,
  requests,
  currentCall,
  deskExt = '000',
  isVoiceConnected = false,
  voiceError = null,
  onDial,
  onNavChange,
  dnd = false,
}: DeskDashboardPanelProps) {
  const stats = computeDashboardStats(extensions, calls, requests, deskExt);
  const serverUrl = getApiBase();
  const now = new Date();
  const dateLabel = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const guestRooms = extensions
    .filter((e) => e.clientType === 'guest' && e.extension !== deskExt)
    .sort((a, b) => {
      const order = { online: 0, ringing: 1, busy: 2, offline: 3 };
      return order[a.status] - order[b.status] || a.extension.localeCompare(b.extension);
    });

  const recentCalls = [...calls].reverse().slice(0, 5);
  const recentRequests = [...requests]
    .filter((r) => r.status === 'pending' || r.status === 'processing')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const activeStaff = stats.staff.online + stats.staff.ringing + stats.staff.busy;
  const hasActiveCall = Boolean(currentCall);
  const canDial = !hasActiveCall && !dnd;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-4 sm:gap-5 pb-4 pr-1 max-w-5xl w-full">
      {/* Header */}
      <div className="bg-white rounded-2xl desk-shadow-card border border-slate-100 px-5 py-5 sm:py-6 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-400">{dateLabel}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              {getGreeting()}, Front Desk
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Live overview of rooms, calls, and guest requests.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${
                serverUrl
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {serverUrl ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {serverUrl ? 'PBX Connected' : 'PBX Not Set'}
            </span>
            {hasActiveCall && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                <Phone className="w-4 h-4" />
                {currentCall!.status === 'connected' ? 'Call Active' : 'Call Ringing'}
              </span>
            )}
            {isVoiceConnected && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-desk-primary border border-blue-200">
                <Activity className="w-4 h-4" />
                Voice Live
              </span>
            )}
            {voiceError && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Audio Error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        <StatCard
          label="Guest Rooms Online"
          value={stats.guests.online}
          sub={`${stats.guests.total} registered · ${stats.guests.offline} offline`}
          tone="success"
          icon={Building2}
        />
        <StatCard
          label="Pending Requests"
          value={stats.requests.pending}
          sub={
            stats.requests.processing > 0
              ? `${stats.requests.processing} in progress`
              : 'No requests in progress'
          }
          tone={stats.requests.pending > 0 ? 'danger' : 'default'}
          icon={Bell}
        />
        <StatCard
          label="Calls Today"
          value={stats.callsToday.total}
          sub={
            stats.callsToday.avgDurationSec > 0
              ? `Avg ${formatDuration(stats.callsToday.avgDurationSec)}`
              : 'No completed calls yet'
          }
          tone="info"
          icon={Phone}
        />
        <StatCard
          label="Missed Today"
          value={stats.callsToday.missed}
          sub={`${stats.callsToday.completed} answered`}
          tone={stats.callsToday.missed > 0 ? 'warning' : 'default'}
          icon={PhoneMissed}
        />
      </div>

      {/* Room status + activity */}
      <div className="flex flex-col xl:grid xl:grid-cols-2 gap-4 shrink-0">
        {/* Room status */}
        <div className="bg-white rounded-2xl desk-shadow-card border border-slate-100 flex flex-col shrink-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 shrink-0">
            <SectionHeader
              title="Room Status"
              actionLabel="All Rooms"
              onAction={() => onNavChange('rooms')}
            />
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {stats.guests.online} online
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {stats.guests.ringing} ringing
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {stats.guests.busy} busy
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                {stats.guests.offline} offline
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 max-h-[min(280px,40dvh)] overflow-y-auto py-2">
            {guestRooms.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">No guest rooms registered yet.</p>
              </div>
            ) : (
              guestRooms.slice(0, 8).map((ext) => {
                const Icon = getExtensionIcon(ext);
                const isOnline = ext.status === 'online';
                const statusColors: Record<SIPExtension['status'], string> = {
                  online: 'text-emerald-600 bg-emerald-50',
                  offline: 'text-slate-400 bg-slate-100',
                  ringing: 'text-amber-600 bg-amber-50',
                  busy: 'text-rose-600 bg-rose-50',
                };

                return (
                  <div
                    key={ext.extension}
                    className="grid grid-cols-[40px_1fr_auto] gap-x-3 items-center px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <DeskIconCircle icon={Icon} muted={!isOnline} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={ext.status} />
                        <p className="text-sm font-semibold text-slate-800 truncate">{ext.name}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 pl-4">
                        Ext {ext.extension} · {formatLastSeen(ext.lastSeen)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${statusColors[ext.status]}`}
                      >
                        {statusLabel(ext.status)}
                      </span>
                      {canDial && isOnline && (
                        <button
                          type="button"
                          onClick={() => onDial(ext.extension)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-desk-primary hover:bg-desk-primary-dark text-white transition-all active:scale-95 shadow-sm"
                          title={`Call ${ext.extension}`}
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {guestRooms.length > 8 && (
              <button
                type="button"
                onClick={() => onNavChange('rooms')}
                className="w-full py-3 text-sm font-semibold text-desk-primary hover:bg-blue-50 transition-colors"
              >
                View all {guestRooms.length} rooms
              </button>
            )}
          </div>
        </div>

        {/* Recent activity column */}
        <div className="flex flex-col gap-4 shrink-0">
          {/* Recent calls */}
          <div className="bg-white rounded-2xl desk-shadow-card border border-slate-100 flex flex-col shrink-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 shrink-0">
              <SectionHeader
                title="Recent Calls"
                actionLabel="History"
                onAction={() => onNavChange('recents')}
              />
            </div>
            <div className="flex-1 min-h-0 max-h-[min(220px,32dvh)] overflow-y-auto">
              {recentCalls.length === 0 ? (
                <div className="py-8 px-6 text-center">
                  <Phone className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-400">No calls yet today.</p>
                </div>
              ) : (
                recentCalls.map((call) => {
                  const isOutbound = call.fromExt === deskExt;
                  const peerExt = isOutbound ? call.toExt : call.fromExt;
                  const peerName = isOutbound ? call.toName : call.fromName;
                  const isMissed = call.status === 'missed' || call.status === 'rejected';
                  const DirectionIcon = isOutbound ? PhoneOutgoing : PhoneIncoming;

                  return (
                    <button
                      key={call.id}
                      type="button"
                      onClick={() => onDial(peerExt)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                    >
                      <DirectionIcon
                        className={`w-4 h-4 shrink-0 ${
                          isMissed ? 'text-rose-500' : isOutbound ? 'text-emerald-500' : 'text-blue-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{peerName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {isMissed ? 'Missed' : call.duration > 0 ? formatDuration(call.duration) : call.status}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums shrink-0">
                        {formatTime(call.timestamp)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending requests */}
          <div className="bg-white rounded-2xl desk-shadow-card border border-slate-100 flex flex-col shrink-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 shrink-0">
              <SectionHeader
                title="Open Requests"
                actionLabel="All Requests"
                onAction={() => onNavChange('requests')}
              />
            </div>
            <div className="flex-1 min-h-0 max-h-[min(220px,32dvh)] overflow-y-auto">
              {recentRequests.length === 0 ? (
                <div className="py-8 px-6 text-center">
                  <Bell className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-400">No open guest requests.</p>
                </div>
              ) : (
                recentRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => onNavChange('requests')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        req.status === 'pending' ? 'bg-amber-500' : 'bg-desk-primary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        Room {req.roomNumber}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {REQUEST_LABELS[req.requestType] ?? req.requestType}
                        {req.customText ? ` — ${req.customText}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">
                      {formatTime(req.timestamp)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Staff summary — inside activity column on mobile to avoid overlap */}
          {stats.staff.total > 0 && (
            <div className="bg-white rounded-2xl desk-shadow-card border border-slate-100 px-5 py-4 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-desk-primary flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">Staff & Services</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeStaff > 0
                        ? `${stats.staff.online} of ${stats.staff.total} departments available`
                        : `${stats.staff.total} departments configured`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavChange('rooms')}
                  className="text-xs font-semibold text-desk-primary hover:text-desk-primary-dark transition-colors shrink-0"
                >
                  View staff
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
