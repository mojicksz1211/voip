import type { SIPExtension } from './types';

export const GUEST_PRESENCE_STALE_MS = 75_000;

export function parseExtensionLastSeenMs(lastSeen: Date | string): number {
  const d = lastSeen instanceof Date ? lastSeen : new Date(lastSeen);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function isGuestExtensionStale(
  ext: Pick<SIPExtension, 'clientType' | 'lastSeen'>,
  now = Date.now(),
): boolean {
  if (ext.clientType !== 'guest') return false;
  return now - parseExtensionLastSeenMs(ext.lastSeen) > GUEST_PRESENCE_STALE_MS;
}

export function resolveGuestExtensionStatus(
  ext: SIPExtension,
  now = Date.now(),
): SIPExtension['status'] {
  if (ext.clientType !== 'guest') return ext.status;
  if (ext.status === 'offline') return 'offline';
  if (isGuestExtensionStale(ext, now)) return 'offline';
  return ext.status;
}

export function normalizeExtensions(
  extensions: SIPExtension[],
  now = Date.now(),
): SIPExtension[] {
  return extensions.map((ext) => ({
    ...ext,
    status: resolveGuestExtensionStatus(ext, now),
  }));
}
