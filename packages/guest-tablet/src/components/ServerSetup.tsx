import { useState } from "react";
import { Server, Save } from "lucide-react";
import { getStoredApiBase, setStoredApiBase } from "@hotel-voip/shared";

interface ServerSetupProps {
  onSaved: () => void;
  onCancel?: () => void;
}

const CONNECT_TIMEOUT_MS = 10_000;

async function testPbxConnection(baseUrl: string): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/pbx/state`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function ServerSetup({ onSaved, onCancel }: ServerSetupProps) {
  const [url, setUrl] = useState(getStoredApiBase() ?? "http://192.168.110.50:3000");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = url.trim().replace(/\/$/, "");
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError("Enter the full URL, e.g. http://192.168.110.50:3000");
      return;
    }

    if (/localhost|127\.0\.0\.1/i.test(trimmed)) {
      setError("Do not use localhost — enter the PC's IP on WiFi/LAN (e.g. http://192.168.110.50:3000).");
      return;
    }

    setTesting(true);
    try {
      await testPbxConnection(trimmed);
      setStoredApiBase(trimmed);
      onSaved();
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? "Timeout — could not reach the server. Make sure: (1) npm run dev is running on the PC, (2) the tablet and PC are on the same WiFi, (3) the IP is correct (run ipconfig on the PC)."
          : "Could not connect to the PBX server. Make sure WiFi is the same and the server is running on the PC."
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="h-full bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">PBX Server Setup</h1>
            <p className="text-xs text-slate-500">Link the tablet to the hotel network</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              PBX Server Address
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.110.50:3000"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              On the PC, open Command Prompt and run <strong>ipconfig</strong> — find the IPv4 Address
              (e.g. 192.168.110.50), then enter: <strong>http://[IP]:3000</strong>
            </p>
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={testing}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {testing ? "Testing connection..." : "Save and continue"}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
