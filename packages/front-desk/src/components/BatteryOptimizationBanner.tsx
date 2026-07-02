import { useEffect, useState } from 'react';
import { Battery, Bell, Check, Power } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  isBatteryExemptionGranted,
  requestBatteryExemption,
  openAutoStartSettings,
  getDeviceInfo,
  canUseFullScreenIntent,
  openFullScreenIntentSettings,
  canDrawOverlays,
  openOverlaySettings,
} from '../utils/callAudio';

const DISMISS_KEY = 'hotel-voip-desk-battery-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // localStorage unavailable
  }
}

/** OEM-specific hint for where to find the auto-start / background toggle. */
function brandHint(manufacturer: string): string | null {
  const m = manufacturer.toLowerCase();
  if (m.includes('lenovo') || m.includes('motorola')) {
    return 'Lenovo: Settings → Apps → Front Desk → Battery → Unrestricted; then lock the app in Recents.';
  }
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) {
    return 'MIUI: Security → Permissions → Autostart, then enable Front Desk.';
  }
  if (m.includes('oppo') || m.includes('realme')) {
    return 'ColorOS: Settings → Battery → allow background activity for Front Desk.';
  }
  if (m.includes('vivo') || m.includes('iqoo')) {
    return 'Funtouch: Settings → Battery → Background power, then allow Front Desk.';
  }
  if (m.includes('huawei') || m.includes('honor')) {
    return 'EMUI: Settings → Apps → Launch → manage manually, enable all for Front Desk.';
  }
  if (m.includes('samsung')) {
    return 'One UI: Settings → Battery → set Front Desk to Unrestricted.';
  }
  if (m.includes('oneplus')) {
    return "OxygenOS: Settings → Battery → Battery optimization → Don't optimize.";
  }
  return null;
}

export default function BatteryOptimizationBanner() {
  const isNative = Capacitor.isNativePlatform();
  const [visible, setVisible] = useState(false);
  const [batteryGranted, setBatteryGranted] = useState(true);
  const [fsiGranted, setFsiGranted] = useState(true);
  const [overlayGranted, setOverlayGranted] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative) {
      setVisible(false);
      return;
    }

    const dismissed = wasDismissed();
    void Promise.all([
      isBatteryExemptionGranted(),
      canUseFullScreenIntent(),
      canDrawOverlays(),
    ]).then(([battery, fsi, overlay]) => {
      setBatteryGranted(battery);
      setFsiGranted(fsi);
      setOverlayGranted(overlay);
      // Always surface if a call-alert permission is still missing, even if the
      // reliability banner was dismissed before — it is critical for alerts.
      setVisible(!dismissed || !fsi || !overlay);
    });

    void getDeviceInfo().then((info) => {
      if (info) setHint(brandHint(info.manufacturer));
    });
  }, [isNative]);

  if (!visible) return null;

  const handleAllowBattery = () => {
    requestBatteryExemption();
    void isBatteryExemptionGranted().then(setBatteryGranted);
  };

  const handleAutoStart = () => {
    void openAutoStartSettings();
  };

  const handleFullScreen = () => {
    void openFullScreenIntentSettings().then(() => {
      void canUseFullScreenIntent().then(setFsiGranted);
    });
  };

  const handleOverlay = () => {
    void openOverlaySettings().then(() => {
      void canDrawOverlays().then(setOverlayGranted);
    });
  };

  const handleDone = () => {
    setDismissed();
    setVisible(false);
  };

  return (
    <div className="shrink-0 px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-950">
      <div className="flex items-start gap-2">
        <Battery className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">Keep the front desk always reachable</p>
          <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
            Do both steps so the console keeps ringing even when the screen is off.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {batteryGranted ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-lg">
                <Check className="w-3 h-3" /> Battery: unrestricted
              </span>
            ) : (
              <button
                type="button"
                onClick={handleAllowBattery}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              >
                <Battery className="w-3 h-3" /> 1. Allow unrestricted battery
              </button>
            )}

            <button
              type="button"
              onClick={handleAutoStart}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              <Power className="w-3 h-3" /> 2. Enable auto-start
            </button>

            {fsiGranted ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-lg">
                <Check className="w-3 h-3" /> Full-screen calls: on
              </span>
            ) : (
              <button
                type="button"
                onClick={handleFullScreen}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                <Bell className="w-3 h-3" /> 3. Allow full-screen calls
              </button>
            )}

            {overlayGranted ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-lg">
                <Check className="w-3 h-3" /> Display over apps: on
              </span>
            ) : (
              <button
                type="button"
                onClick={handleOverlay}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                <Bell className="w-3 h-3" /> 4. Allow display over apps
              </button>
            )}
          </div>

          {hint && (
            <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
              <strong>Tip:</strong> {hint}
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleDone}
              className="px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
