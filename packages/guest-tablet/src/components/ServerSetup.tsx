import { useEffect, useState } from "react";
import { Server, Save } from "lucide-react";
import {
  cachePbxEndpoints,
  fetchPbxEndpoints,
  getStoredApiBase,
  setStoredApiBase,
  testPbxConnection,
  type PbxEndpoints,
} from "@hotel-voip/shared";

interface ServerSetupProps {
  onSaved: () => void;
  onCancel?: () => void;
}

export default function ServerSetup({ onSaved, onCancel }: ServerSetupProps) {
  const [url, setUrl] = useState(getStoredApiBase() ?? "http://192.168.110.50:3000");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [endpoints, setEndpoints] = useState<PbxEndpoints | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      const base = getStoredApiBase();
      if (base) {
        const data = await fetchPbxEndpoints(base);
        if (data) setEndpoints(data);
        return;
      }

      try {
        const res = await fetch("/api/pbx/endpoints", { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as PbxEndpoints;
        cachePbxEndpoints(data);
        setEndpoints(data);
      } catch {
        // ignore
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = url.trim().replace(/\/$/, "");
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError("Enter the full URL, e.g. http://192.168.110.50:3000 or http://100.x.x.x:3000");
      return;
    }

    if (/localhost|127\.0\.0\.1/i.test(trimmed)) {
      setError("Do not use localhost — enter the PC's LAN IP or Tailscale IP (e.g. http://192.168.110.50:3000 or http://100.x.x.x:3000).");
      return;
    }

    setTesting(true);
    try {
      await testPbxConnection(trimmed);
      setStoredApiBase(trimmed);
      const discovered = await fetchPbxEndpoints(trimmed);
      if (discovered) cachePbxEndpoints(discovered);
      onSaved();
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? "Timeout — could not reach the server. Make sure npm run dev is running, the IP is correct, and Tailscale is connected when using a 100.x.x.x address."
          : "Could not connect to the PBX server. Use the LAN IP on the hotel Wi‑Fi or the Tailscale IP from another network."
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
            {(endpoints?.lan || endpoints?.tailscale) && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {endpoints.lan && (
                  <button
                    type="button"
                    onClick={() => setUrl(endpoints.lan ?? "")}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Use LAN
                    <span className="block font-mono text-[10px] font-normal text-slate-500">
                      {endpoints.lan}
                    </span>
                  </button>
                )}
                {endpoints.tailscale && (
                  <button
                    type="button"
                    onClick={() => setUrl(endpoints.tailscale ?? "")}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Use Tailscale
                    <span className="block font-mono text-[10px] font-normal text-slate-500">
                      {endpoints.tailscale}
                    </span>
                  </button>
                )}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              Same hotel Wi‑Fi: use the LAN IP from <strong>ipconfig</strong> (e.g. 192.168.110.50).
              Other Wi‑Fi or mobile data: use the PC's Tailscale IP from <strong>tailscale ip -4</strong>.
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
