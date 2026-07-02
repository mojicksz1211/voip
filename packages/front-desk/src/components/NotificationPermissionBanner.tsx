import { Bell, BellOff, Settings } from "lucide-react";
import type { NotificationPermissionState } from "../hooks/useNotificationPermission";

interface NotificationPermissionBannerProps {
  permission: NotificationPermissionState;
  onRequest: () => void;
  onDismissDeniedHint?: () => void;
  showDeniedHint?: boolean;
}

export default function NotificationPermissionBanner({
  permission,
  onRequest,
  onDismissDeniedHint,
  showDeniedHint = true,
}: NotificationPermissionBannerProps) {
  if (permission === "unsupported") return null;
  if (permission === "granted") return null;

  if (permission === "denied" && showDeniedHint) {
    return (
      <div className="mx-6 lg:mx-10 mt-3 mb-0 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-start gap-3 text-xs text-rose-900">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
        <div className="flex-1 space-y-1">
          <p className="font-bold">Call notifications are blocked in the browser</p>
          <p className="text-rose-800/90 leading-relaxed">
            To receive alerts when the window is minimized, reset the permission in Chrome:
          </p>
          <ol className="list-decimal list-inside text-rose-800/90 space-y-0.5 pl-0.5">
            <li>Click the <strong>icon to the left of the URL</strong> (tune / lock icon)</li>
            <li>Open <strong>Site settings</strong> or <strong>Page info</strong></li>
            <li>Find <strong>Notifications</strong> → change to <strong>Allow</strong></li>
            <li>Refresh this page</li>
          </ol>
          <p className="text-[10px] text-rose-700/80 pt-1">
            While blocked: the incoming call popup and sounds still work when the tab is open.
          </p>
        </div>
        {onDismissDeniedHint && (
          <button
            onClick={onDismissDeniedHint}
            className="shrink-0 text-[10px] font-bold text-rose-600 hover:text-rose-800 uppercase"
          >
            Hide
          </button>
        )}
      </div>
    );
  }

  if (permission === "default") {
    return (
      <div className="mx-6 lg:mx-10 mt-3 mb-0 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2 text-xs text-amber-900">
          <Bell className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Enable call alerts</p>
            <p className="text-amber-800/90 mt-0.5">
              Show incoming calls even when the browser window is minimized.
            </p>
          </div>
        </div>
        <button
          onClick={onRequest}
          className="shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
        >
          <Settings className="w-3.5 h-3.5" />
          Allow notifications
        </button>
      </div>
    );
  }

  return null;
}
