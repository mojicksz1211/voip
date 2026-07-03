import type { CallRecord } from '@hotel-voip/shared';

const FAVORITES_KEY = 'hotel-voip-desk-favorites';
const AUTO_ANSWER_KEY = 'hotel-voip-desk-auto-answer';
const DND_KEY = 'hotel-voip-desk-dnd';

export type RecentsTab = 'recent' | 'missed' | 'favorites';
export type DeskNav = 'dashboard' | 'keypad' | 'recents' | 'rooms' | 'requests' | 'settings';
export type OperatorStatus = 'online' | 'offline' | 'dnd';

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatCallDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function filterCalls(calls: CallRecord[], tab: RecentsTab): CallRecord[] {
  const sorted = [...calls].reverse();
  if (tab === 'missed') {
    return sorted.filter((c) => c.status === 'missed' || c.status === 'rejected');
  }
  return sorted;
}

export function getFavoriteExtensions(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setFavoriteExtensions(exts: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(exts));
}

export function toggleFavoriteExtension(ext: string): string[] {
  const current = getFavoriteExtensions();
  const next = current.includes(ext) ? current.filter((e) => e !== ext) : [...current, ext];
  setFavoriteExtensions(next);
  return next;
}

export function getAutoAnswer(): boolean {
  try {
    return localStorage.getItem(AUTO_ANSWER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoAnswer(enabled: boolean) {
  localStorage.setItem(AUTO_ANSWER_KEY, String(enabled));
}

export function getDnd(): boolean {
  try {
    return localStorage.getItem(DND_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDnd(enabled: boolean) {
  localStorage.setItem(DND_KEY, String(enabled));
}

export const REQUEST_LABELS: Record<string, string> = {
  towels: 'Extra Towels',
  water: 'Bottled Water',
  cleanup: 'Room Clean-up',
  laundry: 'Laundry Service',
  wakeup: 'Wake-up Call',
  other: 'Special Request',
};
