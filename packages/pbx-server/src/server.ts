import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { SIPExtension, GuestRequest, CallRecord, SIPMessage } from "@hotel-voip/shared/types";
import { isGuestExtensionStale, parseExtensionLastSeenMs } from "@hotel-voip/shared";
import {
  createParticipantToken,
  deleteCallRoom,
  ensureCallRoom,
  getServerLanIp,
  isLiveKitConfigured,
  resolveLiveKitWsUrl,
} from "./livekit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const extensions: Record<string, SIPExtension> = {};
const calls: CallRecord[] = [];
const requests: GuestRequest[] = [];
const sipLogs: SIPMessage[] = [];

const DEFAULT_STAFF_EXTENSIONS: Record<string, { name: string; clientType: 'staff' | 'front_desk' }> = {
  "000": { name: "Front Desk Reception", clientType: "front_desk" },
  "101": { name: "Housekeeping", clientType: "staff" },
  "102": { name: "Room Service (Food & Dining)", clientType: "staff" },
  "103": { name: "Laundry Service", clientType: "staff" },
  "104": { name: "Maintenance & Repair", clientType: "staff" },
  "911": { name: "Emergency Response", clientType: "staff" }
};

Object.entries(DEFAULT_STAFF_EXTENSIONS).forEach(([ext, meta]) => {
  extensions[ext] = {
    extension: ext,
    name: meta.name,
    status: "online",
    clientType: meta.clientType,
    lastSeen: new Date(),
    ip: "127.0.0.1",
    dnd: false,
  };
});

let sseClients: express.Response[] = [];

function broadcast(event: string, data: unknown) {
  sseClients.forEach((res) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client dropped
    }
  });
}

function logSIPPacket(
  type: SIPMessage['type'],
  fromExt: string,
  fromName: string,
  toExt: string,
  toName: string,
  callId: string,
  statusCode?: number,
  statusText?: string,
  additionalContent?: string
) {
  const timestamp = new Date().toISOString();
  const id = `sip-${Math.random().toString(36).substr(2, 9)}`;
  const boundaryIP = "192.168.1.100";
  const clientIP = fromExt === "000" ? "192.168.1.5" : `192.168.1.1${fromExt}`;

  let raw = "";
  if (type === "REGISTER") {
    raw = `REGISTER sip:${boundaryIP}:5060 SIP/2.0\n` +
          `Via: SIP/2.0/UDP ${clientIP}:5062;branch=z9hG4bK-reg-${fromExt}\n` +
          `Max-Forwards: 70\n` +
          `From: "${fromName}" <sip:${fromExt}@${boundaryIP}:5060>;tag=tag-${fromExt}\n` +
          `To: "${fromName}" <sip:${fromExt}@${boundaryIP}:5060>\n` +
          `Call-ID: ${callId}\n` +
          `CSeq: 1 REGISTER\n` +
          `Contact: <sip:${fromExt}@${clientIP}:5062;transport=udp>\n` +
          `Expires: 3600\n` +
          `User-Agent: PBX-Guest-Tablet-v1.0\n` +
          `Content-Length: 0\n`;
  } else if (type === "INVITE") {
    raw = `INVITE sip:${toExt}@${boundaryIP}:5060 SIP/2.0\n` +
          `Via: SIP/2.0/UDP ${clientIP}:5062;branch=z9hG4bK-inv-${callId}\n` +
          `Max-Forwards: 70\n` +
          `From: "${fromName}" <sip:${fromExt}@${boundaryIP}>;tag=tag-${fromExt}\n` +
          `To: "${toName}" <sip:${toExt}@${boundaryIP}>\n` +
          `Call-ID: ${callId}\n` +
          `CSeq: 1 INVITE\n` +
          `Contact: <sip:${fromExt}@${clientIP}:5062>\n` +
          `Content-Type: application/sdp\n` +
          `Content-Length: ${30 + (additionalContent || "").length}\n\n` +
          `v=0\n` +
          `o=${fromExt} 2026061800 2026061800 IN IP4 ${clientIP}\n` +
          `s=VoIP Intercom\n` +
          `c=IN IP4 ${clientIP}\n` +
          `t=0 0\n` +
          `m=audio 5004 RTP/AVP 0\n` +
          `a=rtpmap:0 PCMU/8000\n` +
          (additionalContent || "");
  } else if (type === "OK") {
    raw = `SIP/2.0 200 OK\n` +
          `Via: SIP/2.0/UDP ${fromExt === "000" ? `192.168.1.1${toExt}` : "192.168.1.5"}:5062;branch=z9hG4bK-inv-${callId}\n` +
          `From: "${fromName}" <sip:${fromExt}@${boundaryIP}>;tag=tag-${fromExt}\n` +
          `To: "${toName}" <sip:${toExt}@${boundaryIP}>;tag=tag-${toExt}\n` +
          `Call-ID: ${callId}\n` +
          `CSeq: 1 INVITE\n` +
          `Contact: <sip:${toExt}@${toExt === "000" ? "192.168.1.5" : `192.168.1.1${toExt}`}:5062>\n` +
          `Content-Type: application/sdp\n` +
          `Content-Length: 30\n\n` +
          `v=0\n` +
          `o=${toExt} 2026061801 2026061801 IN IP4 ${toExt === "000" ? "192.168.1.5" : `192.168.1.1${toExt}`}\n` +
          `s=VoIP Intercom\n` +
          `c=IN IP4 ${toExt === "000" ? "192.168.1.5" : `192.168.1.1${toExt}`}\n` +
          `t=0 0\n` +
          `m=audio 5004 RTP/AVP 0`;
  } else {
    const codeLine = statusCode ? `SIP/2.0 ${statusCode} ${statusText || "Status"}\n` : `${type} sip:${toExt}@${boundaryIP}:5060 SIP/2.0\n`;
    raw = `${codeLine}` +
          `Via: SIP/2.0/UDP ${clientIP}:5062;branch=z9hG4bK-${type.toLowerCase()}-${callId}\n` +
          `From: "${fromName}" <sip:${fromExt}@${boundaryIP}>;tag=tag-${fromExt}\n` +
          `To: "${toName}" <sip:${toExt}@${boundaryIP}>\n` +
          `Call-ID: ${callId}\n` +
          `CSeq: ${type === "ACK" || type === "BYE" ? "2" : "1"} ${type}\n` +
          `User-Agent: IP-PBX-Core-Engine\n` +
          `Content-Length: 0\n`;
  }

  const logEntry: SIPMessage = {
    id,
    timestamp,
    direction: "sent",
    raw,
    type
  };

  sipLogs.push(logEntry);
  if (sipLogs.length > 200) {
    sipLogs.shift();
  }

  broadcast("sip-packet", logEntry);
  return logEntry;
}

interface ActiveSession {
  callId: string;
  fromExt: string;
  toExt: string;
  status: 'routing' | 'ringing' | 'connected';
  startedAt?: number;
  ringStartedAt: number;
}
const activeSessions = new Map<string, ActiveSession>();
const ringTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const RING_TIMEOUT_MS = 45_000;
const GUEST_HEARTBEAT_STALE_MS = 75_000;
const GUEST_STALE_SWEEP_MS = 30_000;

function broadcastExtensionChange() {
  broadcast("extension-change", { extensions: Object.values(extensions) });
}

function offlineGuestExtension(ext: string): boolean {
  const extObj = extensions[ext];
  if (!extObj || extObj.clientType !== "guest") return false;
  if (extObj.status === "offline") return false;
  extObj.status = "offline";
  return true;
}

function touchGuestExtension(ext: string, ip: string) {
  const extObj = extensions[ext];
  if (!extObj || extObj.clientType !== "guest") return false;
  extObj.lastSeen = new Date();
  extObj.ip = ip;
  if (extObj.status === "offline") {
    extObj.status = "online";
  }
  return true;
}

function parseLastSeenMs(lastSeen: Date | string): number {
  return parseExtensionLastSeenMs(lastSeen);
}

function guestIsReachable(extObj: SIPExtension | undefined): boolean {
  if (!extObj || extObj.clientType !== "guest") return true;
  return !isGuestExtensionStale(extObj);
}

function setExtensionAfterCall(extObj: SIPExtension | undefined) {
  if (!extObj) return;
  if (extObj.clientType === "guest") {
    extObj.status = guestIsReachable(extObj) ? "online" : "offline";
    return;
  }
  extObj.status = "online";
}

function sweepStaleGuestExtensions() {
  const now = Date.now();
  let changed = false;

  for (const extObj of Object.values(extensions)) {
    if (extObj.clientType !== "guest" || extObj.status === "offline") continue;
    if (now - parseLastSeenMs(extObj.lastSeen) <= GUEST_HEARTBEAT_STALE_MS) continue;
    extObj.status = "offline";
    changed = true;
  }

  if (changed) {
    broadcastExtensionChange();
  }
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  const raw = req.socket.remoteAddress || req.ip || "127.0.0.1";
  return raw.replace(/^::ffff:/, "");
}

function findSessionByExtension(ext: string): ActiveSession | undefined {
  for (const session of activeSessions.values()) {
    if (session.fromExt === ext || session.toExt === ext) {
      return session;
    }
  }
  return undefined;
}

/** Reset extensions stuck in ringing/busy when no active session exists. */
function reconcileExtensionStatus(ext: string) {
  const extObj = extensions[ext];
  if (!extObj || extObj.status === "offline" || extObj.status === "online") return;

  if (!findSessionByExtension(ext)) {
    if (extObj.clientType === "guest" && !guestIsReachable(extObj)) {
      extObj.status = "offline";
    } else {
      extObj.status = "online";
    }
  }
}

function clearRingTimeout(callId: string) {
  const timeout = ringTimeouts.get(callId);
  if (timeout) {
    clearTimeout(timeout);
    ringTimeouts.delete(callId);
  }
}

function clearAllRingTimeouts() {
  ringTimeouts.forEach((timeout) => clearTimeout(timeout));
  ringTimeouts.clear();
}

function releaseCallExtensions(session: ActiveSession) {
  setExtensionAfterCall(extensions[session.fromExt]);
  setExtensionAfterCall(extensions[session.toExt]);
}

function scheduleRingTimeout(callId: string) {
  clearRingTimeout(callId);
  const timeout = setTimeout(() => {
    const session = activeSessions.get(callId);
    if (!session || session.status === "connected") return;

    const from = extensions[session.fromExt];
    const to = extensions[session.toExt];
    logSIPPacket(
      "BYE",
      session.toExt,
      to?.name || session.toExt,
      session.fromExt,
      from?.name || session.fromExt,
      callId,
      408,
      "Request Timeout"
    );

    const callRecord: CallRecord = {
      id: Math.random().toString(36).substr(2, 9),
      fromExt: session.fromExt,
      fromName: from?.name || session.fromExt,
      toExt: session.toExt,
      toName: to?.name || session.toExt,
      status: "missed",
      duration: 0,
      timestamp: new Date().toISOString(),
    };
    calls.push(callRecord);

    releaseCallExtensions(session);
    activeSessions.delete(callId);
    clearRingTimeout(callId);
    void deleteCallRoom(callId);

    broadcast("call:ended", { callId, status: "missed" });
    broadcast("extension-change", { extensions: Object.values(extensions), calls });
  }, RING_TIMEOUT_MS);
  ringTimeouts.set(callId, timeout);
}

function corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin;
  // Capacitor Android uses https://localhost; browsers use localhost ports.
  // Allow any origin for this LAN-only PBX so tablets can reach the API.
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(corsMiddleware);
  app.use(express.json());

  app.post("/api/pbx/reset", (_req, res) => {
    Object.keys(extensions).forEach(ext => {
      if (!DEFAULT_STAFF_EXTENSIONS[ext]) {
        delete extensions[ext];
      } else {
        extensions[ext].status = "online";
      }
    });
    calls.length = 0;
    requests.length = 0;
    sipLogs.length = 0;
    activeSessions.clear();
    clearAllRingTimeouts();

    logSIPPacket("REGISTER", "000", "Front Desk Reception", "000", "Front Desk Reception", "system-reset");

    broadcast("pbx-reset", { message: "State cleared" });
    res.json({ success: true, message: "PBX logs and states resetted successfully." });
  });

  app.get("/api/pbx/state", (_req, res) => {
    sweepStaleGuestExtensions();
    res.json({
      extensions: Object.values(extensions),
      calls,
      requests,
      sipLogs
    });
  });

  app.get("/api/events", (req, res) => {
    sweepStaleGuestExtensions();
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`event: sync\ndata: ${JSON.stringify({
      extensions: Object.values(extensions),
      calls,
      requests,
      sipLogs
    })}\n\n`);

    sseClients.push(res);

    req.on("close", () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
  });

  app.post("/api/sip/register", (req, res) => {
    const { extension, name, previousExtension } = req.body;
    if (!extension || !name) {
      return res.status(400).json({ error: "Missing extension or name parameters." });
    }

    const ip = getClientIp(req);

    if (
      previousExtension &&
      previousExtension !== extension &&
      extensions[previousExtension]?.clientType === "guest"
    ) {
      offlineGuestExtension(previousExtension);
    }

    // One physical tablet per IP — offline other guest rooms registered from this device.
    for (const [ext, extObj] of Object.entries(extensions)) {
      if (extObj.clientType === "guest" && extObj.ip === ip && ext !== extension) {
        offlineGuestExtension(ext);
      }
    }

    extensions[extension] = {
      extension,
      name,
      status: "online",
      clientType: "guest",
      lastSeen: new Date(),
      ip,
      dnd: false,
    };

    const callId = `reg-cid-${Math.random().toString(36).substr(2, 9)}`;
    const log = logSIPPacket("REGISTER", extension, name, extension, name, callId);

    broadcast("extension-update", { extension: extensions[extension], logs: [log] });
    broadcastExtensionChange();
    res.json({ success: true, extension: extensions[extension] });
  });

  app.post("/api/sip/heartbeat", (req, res) => {
    const { extension } = req.body;
    if (!extension || !extensions[extension]) {
      return res.status(404).json({ error: "Extension not registered." });
    }

    const extObj = extensions[extension];
    if (extObj.clientType !== "guest") {
      return res.status(400).json({ error: "Heartbeat is only valid for guest extensions." });
    }

    const ip = getClientIp(req);
    if (!touchGuestExtension(extension, ip)) {
      return res.status(404).json({ error: "Extension not registered." });
    }

    res.json({ success: true, extension: extensions[extension] });
  });

  app.post("/api/sip/unregister", (req, res) => {
    const { extension } = req.body;
    if (extension && extensions[extension]) {
      extensions[extension].status = "offline";
      const entity = extensions[extension];
      broadcast("extension-update", { extension: entity });
      broadcastExtensionChange();
    }
    res.json({ success: true });
  });

  app.post("/api/sip/presence", (req, res) => {
    const { extension, dnd, available } = req.body as {
      extension?: string;
      dnd?: boolean;
      available?: boolean;
    };

    if (!extension || !extensions[extension]) {
      return res.status(404).json({ error: "Extension not registered." });
    }

    const extObj = extensions[extension];
    if (extObj.clientType === "guest") {
      return res.status(400).json({ error: "Presence is not available for guest extensions." });
    }

    if (typeof dnd === "boolean") {
      extObj.dnd = dnd;
    }

    if (available === true) {
      extObj.status = "online";
      extObj.dnd = false;
    } else if (available === false) {
      extObj.status = "offline";
    }

    broadcast("extension-update", { extension: extObj });
    broadcastExtensionChange();
    res.json({ success: true, extension: extObj });
  });

  app.post("/api/sip/invite", (req, res) => {
    const { fromExt, toExt } = req.body;
    reconcileExtensionStatus(fromExt);
    reconcileExtensionStatus(toExt);

    const from = extensions[fromExt];
    const to = extensions[toExt];

    if (!from || !to) {
      return res.status(404).json({ error: "Sender or receiver extension not registered or online." });
    }

    if (from.status === "offline") {
      return res.status(404).json({ error: `Extension ${fromExt} is not online.` });
    }

    if (to.status === "offline") {
      return res.status(404).json({
        error: to.clientType === "front_desk"
          ? "Front desk is offline."
          : `Extension ${toExt} is not online.`,
        code: "OFFLINE",
      });
    }

    if (from.dnd) {
      const callId = `err-cid-${Math.random().toString(36).substr(2, 9)}`;
      logSIPPacket("INVITE", fromExt, from.name, toExt, to.name, callId);
      logSIPPacket("BYE", fromExt, from.name, toExt, to.name, callId, 486, "Do Not Disturb");
      return res.status(486).json({
        error: "Cannot place calls while Do Not Disturb is enabled.",
        code: "DND",
      });
    }

    if (to.dnd) {
      const callId = `err-cid-${Math.random().toString(36).substr(2, 9)}`;
      logSIPPacket("INVITE", fromExt, from.name, toExt, to.name, callId);
      logSIPPacket("BYE", toExt, to.name, fromExt, from.name, callId, 486, "Do Not Disturb");
      const callRecord: CallRecord = {
        id: Math.random().toString(36).substr(2, 9),
        fromExt,
        fromName: from.name,
        toExt,
        toName: to.name,
        status: "busy",
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      calls.push(callRecord);
      broadcast("extension-change", { extensions: Object.values(extensions), calls });
      return res.status(486).json({
        error: to.clientType === "front_desk"
          ? "Front desk is unavailable (Do Not Disturb)."
          : `${to.name} is unavailable (Do Not Disturb).`,
        code: "DND",
      });
    }

    if (from.status === "busy" || from.status === "ringing") {
      return res.status(486).json({
        error: `Extension ${fromExt} is already on a call.`,
        code: "BUSY",
      });
    }

    if (to.status === "busy" || to.status === "ringing") {
      const callId = `err-cid-${Math.random().toString(36).substr(2, 9)}`;
      logSIPPacket("INVITE", fromExt, from.name, toExt, to.name, callId);
      logSIPPacket("BYE", toExt, to.name, fromExt, from.name, callId, 486, "Busy Here");
      return res.status(486).json({
        error: `Extension ${toExt} is currently busy.`,
        code: "BUSY",
      });
    }

    const callId = `call-cid-${Math.random().toString(36).substr(2, 9)}`;

    from.status = "ringing";
    to.status = "ringing";

    activeSessions.set(callId, {
      callId,
      fromExt,
      toExt,
      status: "routing",
      ringStartedAt: Date.now(),
    });

    logSIPPacket("INVITE", fromExt, from.name, toExt, to.name, callId);
    logSIPPacket("TRYING", "000", "PBX Server", fromExt, from.name, callId, 100, "Trying");
    logSIPPacket("RINGING", toExt, to.name, fromExt, from.name, callId, 180, "Ringing");

    broadcast("call:incoming", {
      callId,
      fromExt,
      fromName: from.name,
      toExt,
      toName: to.name,
      status: "ringing",
      sipServerIP: "192.168.1.100"
    });

    broadcast("extension-change", { extensions: Object.values(extensions) });

    scheduleRingTimeout(callId);

    res.json({ success: true, callId });
  });

  app.post("/api/sip/answer", async (req, res) => {
    const { callId } = req.body;
    const session = activeSessions.get(callId);

    if (!session) {
      return res.status(404).json({ error: "Active call session not found." });
    }

    clearRingTimeout(callId);
    session.status = "connected";
    session.startedAt = Date.now();

    const from = extensions[session.fromExt];
    const to = extensions[session.toExt];

    if (from && to) {
      from.status = "busy";
      to.status = "busy";
    }

    logSIPPacket("OK", session.toExt, to?.name || session.toExt, session.fromExt, from?.name || session.fromExt, callId, 200, "OK");
    logSIPPacket("ACK", session.fromExt, from?.name || session.fromExt, session.toExt, to?.name || session.toExt, callId);

    if (isLiveKitConfigured()) {
      try {
        const roomName = await ensureCallRoom(callId);
        const lanIp = getServerLanIp();
        const livekitUrl = lanIp ? `ws://${lanIp}:7880` : resolveLiveKitWsUrl(req);
        broadcast("livekit:ready", {
          callId,
          roomName,
          livekitUrl,
        });
      } catch (err) {
        console.error("LiveKit room setup failed:", err);
      }
    }

    broadcast("call:answered", { callId });
    broadcast("extension-change", { extensions: Object.values(extensions) });

    res.json({ success: true });
  });

  app.post("/api/sip/decline", (req, res) => {
    const { callId, reason } = req.body;
    const session = activeSessions.get(callId);

    if (!session) {
      return res.status(404).json({ error: "Active call session not found." });
    }

    clearRingTimeout(callId);

    const from = extensions[session.fromExt];
    const to = extensions[session.toExt];

    releaseCallExtensions(session);

    logSIPPacket("BYE", session.toExt, to?.name || session.toExt, session.fromExt, from?.name || session.fromExt, callId, 603, reason || "Decline / Rejected");

    const callRecord: CallRecord = {
      id: Math.random().toString(36).substr(2, 9),
      fromExt: session.fromExt,
      fromName: from?.name || session.fromExt,
      toExt: session.toExt,
      toName: to?.name || session.toExt,
      status: "rejected",
      duration: 0,
      timestamp: new Date().toISOString()
    };
    calls.push(callRecord);

    activeSessions.delete(callId);
    void deleteCallRoom(callId);
    broadcast("call:ended", { callId, status: "rejected" });
    broadcast("extension-change", { extensions: Object.values(extensions), calls });

    res.json({ success: true });
  });

  app.post("/api/sip/hangup", (req, res) => {
    const { callId } = req.body;
    const session = activeSessions.get(callId);

    if (!session) {
      return res.status(404).json({ error: "Session already disconnected or not found." });
    }

    clearRingTimeout(callId);

    const duration = session.startedAt ? Math.floor((Date.now() - session.startedAt) / 1000) : 0;
    const from = extensions[session.fromExt];
    const to = extensions[session.toExt];

    releaseCallExtensions(session);

    logSIPPacket("BYE", session.fromExt, from?.name || "Sender", session.toExt, to?.name || "Receiver", callId);
    logSIPPacket("OK", session.toExt, to?.name || "Receiver", session.fromExt, from?.name || "Sender", callId, 200, "OK");

    const record: CallRecord = {
      id: Math.random().toString(36).substr(2, 9),
      fromExt: session.fromExt,
      fromName: from?.name || session.fromExt,
      toExt: session.toExt,
      toName: to?.name || session.toExt,
      status: duration > 0 ? "completed" : "missed",
      duration,
      timestamp: new Date().toISOString()
    };
    calls.push(record);

    activeSessions.delete(callId);
    void deleteCallRoom(callId);
    broadcast("call:ended", { callId, status: "ended", duration });
    broadcast("extension-change", { extensions: Object.values(extensions), calls });

    res.json({ success: true, duration });
  });

  app.post("/api/sip/say", (req, res) => {
    const { fromExt, toExt, text, callId } = req.body;
    if (!fromExt || !toExt || !text) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    const from = extensions[fromExt];
    const to = extensions[toExt];

    logSIPPacket(
      "MESSAGE",
      fromExt,
      from?.name || `Ext ${fromExt}`,
      toExt,
      to?.name || `Ext ${toExt}`,
      callId || `say-cid-${Math.random().toString(36).substr(2, 9)}`,
      undefined,
      undefined,
      `INFO sip:${toExt}@192.168.1.100 SIP/2.0\nContent-Type: application/text-to-speech\n\nPayload: "${text}"`
    );

    broadcast("sip:say", { fromExt, toExt, text, callId });
    res.json({ success: true });
  });

  app.post("/api/livekit/token", async (req, res) => {
    const { callId, extension, livekitUrl } = req.body;

    if (!callId || !extension) {
      return res.status(400).json({ error: "Missing callId or extension." });
    }

    const session = activeSessions.get(callId);
    if (!session || session.status !== "connected") {
      return res.status(404).json({ error: "No active connected call for this session." });
    }

    if (extension !== session.fromExt && extension !== session.toExt) {
      return res.status(403).json({ error: "Extension is not a participant in this call." });
    }

    if (!isLiveKitConfigured()) {
      return res.status(503).json({ error: "LiveKit is not configured on the server." });
    }

    try {
      await ensureCallRoom(callId);
      const extMeta = extensions[extension];
      const token = await createParticipantToken(callId, extension, extMeta?.name || extension);
      res.json({
        success: true,
        token,
        url: resolveLiveKitWsUrl(req, livekitUrl),
        roomName: `call-${callId}`,
      });
    } catch (err) {
      console.error("LiveKit token error:", err);
      res.status(500).json({ error: "Failed to create LiveKit token." });
    }
  });

  app.post("/api/webrtc/signal", (req, res) => {
    const { fromExt, toExt, signal } = req.body;
    broadcast("webrtc:signal", { fromExt, toExt, signal });
    res.json({ success: true });
  });

  app.post("/api/guest/request", (req, res) => {
    const { roomNumber, requestType, customText } = req.body;

    if (!roomNumber || !requestType) {
      return res.status(400).json({ error: "Missing roomNumber or requestType parameters." });
    }

    const newRequest: GuestRequest = {
      id: `req-${Math.random().toString(36).substr(2, 9)}`,
      roomNumber,
      requestType,
      customText,
      status: "pending",
      timestamp: new Date().toISOString()
    };

    requests.push(newRequest);

    const callId = `msg-cid-${Math.random().toString(36).substr(2, 9)}`;
    const formattedText = `GUEST REQUEST from Ext ${roomNumber}:\nRequest Type: ${requestType.toUpperCase()}\nNotes: ${customText || "None"}`;
    logSIPPacket("MESSAGE", roomNumber, `Room ${roomNumber}`, "000", "Front Desk Reception", callId, undefined, undefined, formattedText);

    broadcast("request-new", { request: newRequest });
    res.json({ success: true, request: newRequest });
  });

  app.post("/api/staff/request/status", (req, res) => {
    const { id, status } = req.body;
    const request = requests.find(r => r.id === id);

    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    request.status = status;

    const callId = `msg-cid-${Math.random().toString(36).substr(2, 9)}`;
    logSIPPacket("MESSAGE", "000", "Front Desk Reception", request.roomNumber, `Room ${request.roomNumber}`, callId, undefined, undefined, `REQUEST STATUS UPDATE:\nRequest ID: ${id}\nNew Status: ${status.toUpperCase()}`);

    broadcast("request-update", { request });
    res.json({ success: true, request });
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/", (_req, res) => {
      res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Hotel VoIP PBX</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem">
  <h1>PBX API (dev mode)</h1>
  <p>Port 3000 serves the API only during development. Open the apps here:</p>
  <ul>
    <li><a href="http://localhost:5174/">Front desk</a> — <code>http://localhost:5174/</code></li>
    <li><a href="http://localhost:5173/guest/">Guest tablet</a> — <code>http://localhost:5173/guest/</code></li>
  </ul>
  <p>API: <a href="/api/pbx/state">/api/pbx/state</a> · SSE: <code>/api/events</code></p>
</body>
</html>`);
    });
  }

  if (process.env.NODE_ENV === "production") {
    const guestDist = path.resolve(__dirname, "../../guest-tablet/dist");
    const deskDist = path.resolve(__dirname, "../../front-desk/dist");

    app.use("/guest", express.static(guestDist));
    app.get("/guest/*", (_req, res) => {
      res.sendFile(path.join(guestDist, "index.html"));
    });

    app.use(express.static(deskDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(deskDist, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    setInterval(sweepStaleGuestExtensions, GUEST_STALE_SWEEP_MS);
    console.log(`IP-PBX local intercom server running on http://0.0.0.0:${PORT}`);
    console.log(`  LiveKit media: ${process.env.LIVEKIT_HOST || "http://127.0.0.1:7880"} (run: npm run livekit)`);
    if (process.env.NODE_ENV !== "production") {
      const lanIp = getServerLanIp();
      console.log(`  API + SSE only in dev mode`);
      console.log(`  Guest tablet dev: http://localhost:5173/guest/`);
      console.log(`  Front desk dev:   http://localhost:5174/`);
      if (lanIp) {
        console.log(`  Front desk LAN:   http://${lanIp}:5174/  (other PCs on same Wi‑Fi)`);
        console.log(`  PBX API LAN:      http://${lanIp}:${PORT}/api/`);
        console.log(`  LiveKit WS LAN:   ws://${lanIp}:7880`);
      }
    } else {
      console.log(`  Front desk: http://0.0.0.0:${PORT}/`);
      console.log(`  Guest tablet: http://0.0.0.0:${PORT}/guest/`);
    }
  });
}

startServer();
