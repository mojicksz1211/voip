import type { CallRecord, GuestRequest, SIPExtension } from '@hotel-voip/shared';
import { getGreeting } from '@hotel-voip/shared';

export { getGreeting };

export interface ExtensionCounts {
  online: number;
  offline: number;
  busy: number;
  ringing: number;
  total: number;
}

export interface DashboardStats {
  guests: ExtensionCounts;
  staff: ExtensionCounts;
  requests: { pending: number; processing: number; done: number; total: number };
  callsToday: {
    total: number;
    completed: number;
    missed: number;
    avgDurationSec: number;
  };
}

function countByStatus(items: SIPExtension[]): ExtensionCounts {
  const counts: ExtensionCounts = { online: 0, offline: 0, busy: 0, ringing: 0, total: items.length };
  for (const ext of items) {
    counts[ext.status]++;
  }
  return counts;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function computeDashboardStats(
  extensions: SIPExtension[],
  calls: CallRecord[],
  requests: GuestRequest[],
  deskExt = '000',
): DashboardStats {
  const others = extensions.filter((e) => e.extension !== deskExt);
  const guests = others.filter((e) => e.clientType === 'guest');
  const staff = others.filter((e) => e.clientType !== 'guest');

  const todayCalls = calls.filter((c) => isToday(c.timestamp));
  const completed = todayCalls.filter((c) => c.status === 'completed');
  const missed = todayCalls.filter((c) => c.status === 'missed' || c.status === 'rejected');
  const totalDuration = completed.reduce((sum, c) => sum + c.duration, 0);

  return {
    guests: countByStatus(guests),
    staff: countByStatus(staff),
    requests: {
      pending: requests.filter((r) => r.status === 'pending').length,
      processing: requests.filter((r) => r.status === 'processing').length,
      done: requests.filter((r) => r.status === 'done').length,
      total: requests.length,
    },
    callsToday: {
      total: todayCalls.length,
      completed: completed.length,
      missed: missed.length,
      avgDurationSec: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    },
  };
}

export function formatLastSeen(lastSeen: Date | string): string {
  const d = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
