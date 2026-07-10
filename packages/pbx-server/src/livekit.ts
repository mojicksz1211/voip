import type { Request } from "express";
import os from "os";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LIVEKIT_HOST = process.env.LIVEKIT_HOST || "http://127.0.0.1:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "hotel-local-voip-livekit-dev-secret-32";

let roomClient: RoomServiceClient | null = null;

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isTailscaleIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

function isTailscaleInterface(name: string): boolean {
  return /tailscale/i.test(name);
}

export function getServerLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (
        (net.family === "IPv4" || Number(net.family) === 4) &&
        !net.internal &&
        !isTailscaleInterface(name) &&
        !isTailscaleIpv4(net.address)
      ) {
        return net.address;
      }
    }
  }
  return null;
}

export function getTailscaleIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (
        (net.family === "IPv4" || Number(net.family) === 4) &&
        !net.internal &&
        (isTailscaleInterface(name) || isTailscaleIpv4(net.address))
      ) {
        return net.address;
      }
    }
  }
  return null;
}

function getRoomClient(): RoomServiceClient {
  if (!roomClient) {
    roomClient = new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return roomClient;
}

export function roomNameForCall(callId: string): string {
  return `call-${callId}`;
}

export async function ensureCallRoom(callId: string): Promise<string> {
  const name = roomNameForCall(callId);
  try {
    await getRoomClient().createRoom({
      name,
      emptyTimeout: 120,
      maxParticipants: 2,
    });
  } catch {
    // Room may already exist if both sides connect quickly.
  }
  return name;
}

export async function deleteCallRoom(callId: string): Promise<void> {
  try {
    await getRoomClient().deleteRoom(roomNameForCall(callId));
  } catch {
    // Room may already be gone.
  }
}

export async function createParticipantToken(
  callId: string,
  extension: string,
  displayName: string,
): Promise<string> {
  const room = roomNameForCall(callId);
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: extension,
    name: displayName,
    ttl: "1h",
  });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
  });
  return token.toJwt();
}

export function resolveLiveKitWsUrl(req: Request, clientUrl?: string): string {
  if (process.env.LIVEKIT_WS_URL) {
    return process.env.LIVEKIT_WS_URL;
  }

  if (clientUrl && /^wss?:\/\//i.test(clientUrl)) {
    try {
      const parsed = new URL(clientUrl);
      if (!isLoopbackHost(parsed.hostname)) {
        return clientUrl.replace(/\/$/, "");
      }
    } catch {
      // fall through
    }
  }

  const hostHeader = req.headers.host;
  if (hostHeader) {
    const hostname = hostHeader.split(":")[0];
    if (!isLoopbackHost(hostname)) {
      return `ws://${hostname}:7880`;
    }
  }

  const lanIp = getServerLanIp();
  if (lanIp) {
    return `ws://${lanIp}:7880`;
  }

  return "ws://127.0.0.1:7880";
}

export function isLiveKitConfigured(): boolean {
  return Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}
