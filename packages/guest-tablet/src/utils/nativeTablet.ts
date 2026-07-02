import { Capacitor, registerPlugin } from '@capacitor/core';

export interface KioskStatus {
  lockTaskActive: boolean;
  backBlocked: boolean;
  screenPinningEnabled?: boolean;
  deviceOwner?: boolean;
}

export interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  sdkInt: number;
}

interface TabletPlugin {
  enableKiosk(): Promise<KioskStatus>;
  disableKiosk(): Promise<void>;
  getKioskStatus(): Promise<KioskStatus>;
  openSecuritySettings(): Promise<void>;
  startCallService(options: { label: string }): Promise<void>;
  stopCallService(): Promise<void>;
  startPresenceService(options: { room: string }): Promise<void>;
  stopPresenceService(): Promise<void>;
  isBatteryExemptionGranted(): Promise<{ granted: boolean }>;
  requestBatteryExemption(): Promise<void>;
  openAutoStartSettings(): Promise<{ opened: boolean }>;
  getDeviceInfo(): Promise<DeviceInfo>;
  presentIncomingCall(options: { title: string; body: string }): Promise<void>;
  cancelIncomingCall(): Promise<void>;
  canUseFullScreenIntent(): Promise<{ granted: boolean }>;
  openFullScreenIntentSettings(): Promise<{ opened: boolean }>;
  canDrawOverlays(): Promise<{ granted: boolean }>;
  openOverlaySettings(): Promise<{ opened: boolean }>;
}

export const Tablet = registerPlugin<TabletPlugin>('Tablet');

const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function enableKioskMode(): Promise<KioskStatus> {
  if (!isAndroidNative) {
    return { lockTaskActive: false, backBlocked: false };
  }
  try {
    return await Tablet.enableKiosk();
  } catch {
    return { lockTaskActive: false, backBlocked: false };
  }
}

export function disableKioskMode(): void {
  if (!isAndroidNative) return;
  void Tablet.disableKiosk().catch(() => {});
}

export async function getKioskStatus(): Promise<KioskStatus> {
  if (!isAndroidNative) {
    return { lockTaskActive: false, backBlocked: false };
  }
  try {
    return await Tablet.getKioskStatus();
  } catch {
    return { lockTaskActive: false, backBlocked: false };
  }
}

export function openSecuritySettings(): void {
  if (!isAndroidNative) return;
  void Tablet.openSecuritySettings().catch(() => {});
}

export function startCallForeground(label: string): void {
  if (!isAndroidNative) return;
  void Tablet.startCallService({ label }).catch(() => {});
}

export function stopCallForeground(): void {
  if (!isAndroidNative) return;
  void Tablet.stopCallService().catch(() => {});
}

/** Keep the tablet reachable for incoming calls while a room is registered. */
export function startPresenceService(room: string): void {
  if (!isAndroidNative) return;
  void Tablet.startPresenceService({ room }).catch(() => {});
}

export function stopPresenceService(): void {
  if (!isAndroidNative) return;
  void Tablet.stopPresenceService().catch(() => {});
}

/** Open the OEM auto-start / background-launch manager (best effort). */
export async function openAutoStartSettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await Tablet.openAutoStartSettings();
    return result.opened;
  } catch {
    return false;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  if (!isAndroidNative) return null;
  try {
    return await Tablet.getDeviceInfo();
  } catch {
    return null;
  }
}

/** Full-screen incoming-call alert that appears over other apps / lock screen. */
export function presentIncomingCall(title: string, body: string): void {
  if (!isAndroidNative) return;
  void Tablet.presentIncomingCall({ title, body }).catch(() => {});
}

export function cancelIncomingCall(): void {
  if (!isAndroidNative) return;
  void Tablet.cancelIncomingCall().catch(() => {});
}

/** Android 14+: full-screen intents need an explicit per-app grant. */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (!isAndroidNative) return true;
  try {
    const result = await Tablet.canUseFullScreenIntent();
    return result.granted;
  } catch {
    return true;
  }
}

export async function openFullScreenIntentSettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await Tablet.openFullScreenIntentSettings();
    return result.opened;
  } catch {
    return false;
  }
}

/** "Display over other apps" — lets the tablet jump straight to the call UI. */
export async function canDrawOverlays(): Promise<boolean> {
  if (!isAndroidNative) return true;
  try {
    const result = await Tablet.canDrawOverlays();
    return result.granted;
  } catch {
    return true;
  }
}

export async function openOverlaySettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await Tablet.openOverlaySettings();
    return result.opened;
  } catch {
    return false;
  }
}

export async function isBatteryExemptionGranted(): Promise<boolean> {
  if (!isAndroidNative) return true;
  try {
    const result = await Tablet.isBatteryExemptionGranted();
    return result.granted;
  } catch {
    return true;
  }
}

export function requestBatteryExemption(): void {
  if (!isAndroidNative) return;
  void Tablet.requestBatteryExemption().catch(() => {});
}
