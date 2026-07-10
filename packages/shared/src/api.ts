const STORAGE_KEY = 'hotel-voip-pbx-url';

export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function isTailscaleHost(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

export function getStoredApiBase(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    // localStorage unavailable
  }
  return null;
}

export function setStoredApiBase(url: string) {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''));
}

export function getApiBase(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) {
    return (import.meta.env.VITE_API_BASE as string).replace(/\/$/, '');
  }
  const stored = getStoredApiBase();
  if (stored) return stored;
  return '';
}

export function getEventsUrl(): string {
  const base = getApiBase();
  return base ? `${base}/api/events` : '/api/events';
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const base = getApiBase();
  const url = base ? `${base}${path}` : path;
  return fetch(url, options);
}

/** Derive LiveKit WebSocket URL from the configured PBX server address. */
export function getLiveKitWsUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LIVEKIT_WS_URL) {
    return (import.meta.env.VITE_LIVEKIT_WS_URL as string).replace(/\/$/, '');
  }

  const base = getApiBase();
  if (base) {
    try {
      const parsed = new URL(base);
      if (!isLoopbackHost(parsed.hostname)) {
        return `ws://${parsed.hostname}:7880`;
      }
    } catch {
      // fall through
    }
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname && !isLoopbackHost(hostname)) {
      return `ws://${hostname}:7880`;
    }
  }

  return 'ws://127.0.0.1:7880';
}

/**
 * Hotel LAN: skip public STUN/TURN so ICE completes on host candidates only.
 * Avoids multi-second STUN binding timeouts when the PBX and devices share a subnet.
 */
export function getLanRtcConfig(): RTCConfiguration {
  return { iceServers: [] };
}

/** Ignore loopback LiveKit URLs pushed from another client (e.g. front desk on localhost). */
export function isUsableLiveKitWsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') && !isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}
