import { useState } from 'react';
import { Phone, PhoneMissed, Star, PhoneOutgoing, PhoneIncoming, User } from 'lucide-react';
import type { CallRecord, SIPExtension } from '@hotel-voip/shared';
import {
  type RecentsTab,
  filterCalls,
  getFavoriteExtensions,
  toggleFavoriteExtension,
} from '../../utils/deskHelpers';
import { getExtensionIcon } from '../../utils/deskRoomIcons';
import DeskIconCircle from './DeskIconCircle';

interface DeskRecentsPanelProps {
  calls: CallRecord[];
  extensions: SIPExtension[];
  deskExt?: string;
  onDial: (ext: string) => void;
  onFavoritesChange?: (favorites: string[]) => void;
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

function TabCountBadge({
  count,
  tabId,
  active,
}: {
  count: number;
  tabId: RecentsTab;
  active: boolean;
}) {
  const tones: Record<RecentsTab, { on: string; off: string }> = {
    recent: {
      on: 'bg-desk-primary text-white',
      off: 'bg-blue-100 text-desk-primary border border-blue-200',
    },
    missed: {
      on: 'bg-rose-500 text-white',
      off: 'bg-rose-100 text-rose-700 border border-rose-200',
    },
    favorites: {
      on: 'bg-amber-500 text-white',
      off: 'bg-amber-50 text-amber-700 border border-amber-200',
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

export default function DeskRecentsPanel({
  calls,
  extensions,
  deskExt = '000',
  onDial,
  onFavoritesChange,
}: DeskRecentsPanelProps) {
  const [tab, setTab] = useState<RecentsTab>('recent');
  const [favorites, setFavorites] = useState<string[]>(() => getFavoriteExtensions());

  const missedCount = filterCalls(calls, 'missed').length;
  const recentCount = calls.length;

  const getExt = (ext: string) => extensions.find((e) => e.extension === ext);
  const getExtName = (ext: string) => getExt(ext)?.name ?? `Ext ${ext}`;

  const getPeerIcon = (peerExt: string, isMissed: boolean) => {
    const ext = getExt(peerExt);
    if (ext) return getExtensionIcon(ext);
    return isMissed ? PhoneMissed : User;
  };

  const handleToggleFavorite = (ext: string) => {
    const next = toggleFavoriteExtension(ext);
    setFavorites(next);
    onFavoritesChange?.(next);
  };

  const renderCallRow = (call: CallRecord) => {
    const isOutbound = call.fromExt === deskExt;
    const peerExt = isOutbound ? call.toExt : call.fromExt;
    const peerName = isOutbound ? call.toName : call.fromName;
    const isMissed = call.status === 'missed' || call.status === 'rejected';
    const isFav = favorites.includes(peerExt);
    const DirectionIcon = isOutbound ? PhoneOutgoing : PhoneIncoming;
    const PeerIcon = getPeerIcon(peerExt, isMissed);

    return (
      <div
        key={call.id}
        role="button"
        tabIndex={0}
        onClick={() => onDial(peerExt)}
        onKeyDown={(e) => e.key === 'Enter' && onDial(peerExt)}
        className="group grid grid-cols-[48px_1fr_auto] gap-x-3 items-center px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
      >
        <DeskIconCircle
          icon={PeerIcon}
          muted={isMissed}
          className={isMissed ? '!bg-rose-50 !text-rose-600' : undefined}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[15px] sm:text-base font-semibold text-slate-800 truncate leading-tight">
              {peerName}
            </p>
            <span className="text-xs sm:text-sm text-slate-400 shrink-0">· {peerExt}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <DirectionIcon
              className={`w-4 h-4 shrink-0 ${
                isMissed ? 'text-rose-500' : isOutbound ? 'text-emerald-500' : 'text-blue-500'
              }`}
            />
            {isMissed ? (
              <span className="text-xs font-medium text-rose-500">Missed</span>
            ) : call.duration > 0 ? (
              <span className="text-xs text-slate-400">{formatDuration(call.duration)}</span>
            ) : (
              <span className="text-xs text-slate-400 capitalize">{call.status}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs sm:text-sm text-slate-400 tabular-nums">{formatTime(call.timestamp)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(peerExt);
            }}
            className={`p-1.5 rounded-lg transition-opacity ${
              isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Star
              className={`w-5 h-5 ${
                isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'
              }`}
            />
          </button>
        </div>
      </div>
    );
  };

  const renderFavoriteRow = (ext: string) => {
    const extObj = getExt(ext);
    const name = getExtName(ext);
    const Icon = extObj ? getExtensionIcon(extObj) : User;

    return (
      <div
        key={ext}
        role="button"
        tabIndex={0}
        onClick={() => onDial(ext)}
        onKeyDown={(e) => e.key === 'Enter' && onDial(ext)}
        className="group grid grid-cols-[48px_1fr_auto] gap-x-3 items-center px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
      >
        <DeskIconCircle icon={Icon} className="!bg-amber-50 !text-amber-700" />
        <div className="min-w-0">
          <p className="text-[15px] sm:text-base font-semibold text-slate-800 truncate leading-tight">{name}</p>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Ext {ext}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Phone className="w-5 h-5 text-desk-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(ext);
            }}
            className="p-1.5"
          >
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </button>
        </div>
      </div>
    );
  };

  const filtered = tab === 'favorites' ? [] : filterCalls(calls, tab);
  const favoriteExts = favorites.filter((ext) => ext !== deskExt);

  const tabs: { id: RecentsTab; label: string; count: number }[] = [
    { id: 'recent', label: 'Recent', count: recentCount },
    { id: 'missed', label: 'Missed', count: missedCount },
    { id: 'favorites', label: 'Favorites', count: favoriteExts.length },
  ];

  return (
    <div className="flex flex-col h-full max-w-4xl bg-white rounded-2xl desk-shadow-card overflow-hidden border border-slate-100">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Call History</h2>
          {missedCount > 0 && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              {missedCount} missed
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
                <TabCountBadge count={t.count} tabId={t.id} active={isActive} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'favorites' ? (
          favoriteExts.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">Star a room from Recent to pin it here.</p>
            </div>
          ) : (
            favoriteExts.map(renderFavoriteRow)
          )
        ) : filtered.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <PhoneMissed className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No {tab} calls yet.</p>
          </div>
        ) : (
          filtered.map(renderCallRow)
        )}
      </div>
    </div>
  );
}
