import { PhoneCall, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SIPExtension } from '@hotel-voip/shared';
import { getExtensionIcon, GUEST_SECTION_ICON, STAFF_SECTION_ICON } from '../../utils/deskRoomIcons';
import DeskIconCircle from './DeskIconCircle';

interface DeskRoomsPanelProps {
  extensions: SIPExtension[];
  deskExt?: string;
  currentCall: boolean;
  onDial: (ext: string) => void;
  dnd?: boolean;
}

function StatusDot({ status }: { status: SIPExtension['status'] }) {
  const colors: Record<SIPExtension['status'], string> = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-300',
    ringing: 'bg-amber-500 animate-pulse',
    busy: 'bg-rose-500',
  };
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[status]}`} />;
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

function RoomRow({
  ext,
  canDial,
  onDial,
}: {
  ext: SIPExtension;
  canDial: boolean;
  onDial: (ext: string) => void;
}) {
  const isOnline = ext.status === 'online';
  const Icon = getExtensionIcon(ext);

  return (
    <div className="grid grid-cols-[44px_1fr_auto] sm:grid-cols-[48px_1fr_auto] gap-x-3 items-center px-3 sm:px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors group">
      <DeskIconCircle icon={Icon} muted={!isOnline} size="md" />

      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={ext.status} />
          <p className="text-[15px] sm:text-base font-semibold text-slate-800 truncate leading-tight">
            {ext.name}
          </p>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-400 mt-1 truncate">
          Ext {ext.extension}
          <span className="hidden sm:inline"> · {ext.ip}</span>
        </p>
      </div>

      {canDial && isOnline ? (
        <button
          type="button"
          onClick={() => onDial(ext.extension)}
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-desk-primary hover:bg-desk-primary-dark text-white transition-all active:scale-95 shrink-0 shadow-sm"
          title={`Dial ${ext.extension}`}
        >
          <PhoneCall className="w-5 h-5" />
        </button>
      ) : (
        <span className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
          <span
            className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-1 rounded-md ${
              ext.status === 'offline'
                ? 'text-slate-400 bg-slate-100'
                : ext.status === 'busy'
                  ? 'text-rose-500 bg-rose-50'
                  : ext.status === 'ringing'
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-slate-400'
            }`}
          >
            {statusLabel(ext.status)}
          </span>
        </span>
      )}
    </div>
  );
}

function RoomCard({
  title,
  icon,
  items,
  canDial,
  onDial,
}: {
  title: string;
  icon: LucideIcon;
  items: SIPExtension[];
  canDial: boolean;
  onDial: (ext: string) => void;
}) {
  const onlineCount = items.filter((r) => r.status === 'online').length;

  return (
    <div className="bg-white rounded-2xl desk-shadow-card overflow-hidden border border-slate-100 shrink-0">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <DeskIconCircle icon={icon} size="lg" />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {onlineCount} online
            </span>
            <span>·</span>
            <span>{items.length} total</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-h-[min(480px,55dvh)] overflow-y-auto py-2">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-2 gap-y-0.5">
          {items.map((ext) => (
            <RoomRow key={ext.extension} ext={ext} canDial={canDial} onDial={onDial} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DeskRoomsPanel({
  extensions,
  deskExt = '000',
  currentCall,
  onDial,
  dnd = false,
}: DeskRoomsPanelProps) {
  const rooms = extensions
    .filter((ext) => ext.extension !== deskExt)
    .sort((a, b) => {
      const order = { online: 0, ringing: 1, busy: 2, offline: 3 };
      const diff = order[a.status] - order[b.status];
      return diff !== 0 ? diff : a.extension.localeCompare(b.extension);
    });

  const guestRooms = rooms.filter((r) => r.clientType === 'guest');
  const staffRooms = rooms.filter((r) => r.clientType !== 'guest');
  const canDial = !currentCall && !dnd;

  if (rooms.length === 0) {
    return (
      <div className="max-w-4xl bg-white rounded-2xl desk-shadow-card border border-slate-100 py-12 px-6 text-center">
        <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">No extensions registered yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl w-full gap-5 overflow-y-auto min-h-0 pr-1">
      {guestRooms.length > 0 && (
        <RoomCard
          title="Guest Rooms"
          icon={GUEST_SECTION_ICON}
          items={guestRooms}
          canDial={canDial}
          onDial={onDial}
        />
      )}
      {staffRooms.length > 0 && (
        <RoomCard
          title="Staff & Services"
          icon={STAFF_SECTION_ICON}
          items={staffRooms}
          canDial={canDial}
          onDial={onDial}
        />
      )}
    </div>
  );
}
