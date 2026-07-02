const ROOM_KEY = 'hotel-voip-guest-room';
const PIN_KEY = 'hotel-voip-admin-pin';
const BATTERY_PROMPT_KEY = 'hotel-voip-battery-prompt-dismissed';
const KIOSK_KEY = 'hotel-voip-kiosk-pinned';
const DEFAULT_ADMIN_PIN = '1234';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}

export function getStoredRoom(): string | null {
  const room = read(ROOM_KEY);
  return room && /^\d+$/.test(room) ? room : null;
}

export function setStoredRoom(room: string) {
  write(ROOM_KEY, room);
}

export function clearStoredRoom() {
  remove(ROOM_KEY);
}

function getAdminPin(): string {
  return read(PIN_KEY) ?? DEFAULT_ADMIN_PIN;
}

export function verifyAdminPin(pin: string): boolean {
  return pin === getAdminPin();
}

export function wasBatteryPromptDismissed(): boolean {
  return read(BATTERY_PROMPT_KEY) === '1';
}

export function setBatteryPromptDismissed() {
  write(BATTERY_PROMPT_KEY, '1');
}

export function isKioskPinned(): boolean {
  return read(KIOSK_KEY) === '1';
}

export function setKioskPinned(enabled: boolean) {
  if (enabled) {
    write(KIOSK_KEY, '1');
  } else {
    remove(KIOSK_KEY);
  }
}
