import { getApiBase, getStoredApiBase, isTailscaleHost, setStoredApiBase } from './api';

const ENDPOINTS_CACHE_KEY = 'hotel-voip-pbx-endpoints';
const CONNECT_TIMEOUT_MS = 10_000;

export interface PbxEndpoints {
  lan: string | null;
  tailscale: string | null;
  livekit?: {
    lan: string | null;
    tailscale: string | null;
  };
}

export type PbxConnectionMode = 'lan' | 'tailscale' | 'custom' | 'unknown';

function isPrivateLanHost(hostname: string): boolean {
  if (isTailscaleHost(hostname)) return false;
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

export function getCachedPbxEndpoints(): PbxEndpoints | null {
  try {
    const raw = localStorage.getItem(ENDPOINTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PbxEndpoints;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      lan: typeof parsed.lan === 'string' ? parsed.lan.replace(/\/$/, '') : null,
      tailscale:
        typeof parsed.tailscale === 'string' ? parsed.tailscale.replace(/\/$/, '') : null,
      livekit: parsed.livekit,
    };
  } catch {
    return null;
  }
}

export function cachePbxEndpoints(endpoints: PbxEndpoints): void {
  try {
    localStorage.setItem(
      ENDPOINTS_CACHE_KEY,
      JSON.stringify({
        lan: endpoints.lan?.replace(/\/$/, '') ?? null,
        tailscale: endpoints.tailscale?.replace(/\/$/, '') ?? null,
        livekit: endpoints.livekit,
      }),
    );
  } catch {
    // localStorage unavailable
  }
}

export async function testPbxConnection(baseUrl: string): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/pbx/state`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchPbxEndpoints(baseUrl?: string): Promise<PbxEndpoints | null> {
  const base = (baseUrl ?? getApiBase()).replace(/\/$/, '');
  if (!base) return getCachedPbxEndpoints();

  try {
    const res = await fetch(`${base}/api/pbx/endpoints`);
    if (!res.ok) return getCachedPbxEndpoints();
    const data = (await res.json()) as PbxEndpoints;
    cachePbxEndpoints(data);
    return data;
  } catch {
    return getCachedPbxEndpoints();
  }
}

export function getPbxConnectionMode(): PbxConnectionMode {
  const base = getApiBase();
  if (!base) return 'unknown';

  try {
    const hostname = new URL(base).hostname;
    const cached = getCachedPbxEndpoints();

    if (cached?.lan) {
      try {
        if (new URL(cached.lan).hostname === hostname) return 'lan';
      } catch {
        // ignore invalid cached URL
      }
    }

    if (cached?.tailscale) {
      try {
        if (new URL(cached.tailscale).hostname === hostname) return 'tailscale';
      } catch {
        // ignore invalid cached URL
      }
    }

    if (isTailscaleHost(hostname)) return 'tailscale';
    if (isPrivateLanHost(hostname)) return 'lan';
    return 'custom';
  } catch {
    return 'unknown';
  }
}

export function getPbxEndpointForMode(
  mode: 'lan' | 'tailscale',
  endpoints?: PbxEndpoints | null,
): string | null {
  const resolved = endpoints ?? getCachedPbxEndpoints();
  if (!resolved) return null;
  return mode === 'lan' ? resolved.lan : resolved.tailscale;
}

export async function switchPbxConnection(
  mode: 'lan' | 'tailscale',
): Promise<{ ok: true } | { ok: false; error: string }> {
  let endpoints = getCachedPbxEndpoints();
  if (!endpoints?.lan || !endpoints?.tailscale) {
    const current = getStoredApiBase() ?? getApiBase();
    if (current) {
      endpoints = (await fetchPbxEndpoints(current)) ?? endpoints;
    }
  }

  const target = getPbxEndpointForMode(mode, endpoints);
  if (!target) {
    return {
      ok: false,
      error:
        mode === 'lan'
          ? 'LAN address is not saved yet. Connect on hotel Wi-Fi once, or use Change Server.'
          : 'Tailscale address is not saved yet. Connect on hotel Wi-Fi once, or use Change Server.',
    };
  }

  if (getApiBase() === target) {
    return { ok: true };
  }

  try {
    await testPbxConnection(target);
    setStoredApiBase(target);
    return { ok: true };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      error: timedOut
        ? `Timeout reaching ${target}. Check network${mode === 'tailscale' ? ' and Tailscale' : ''}.`
        : `Could not connect to ${target}. Check network${mode === 'tailscale' ? ' and Tailscale' : ''}.`,
    };
  }
}
