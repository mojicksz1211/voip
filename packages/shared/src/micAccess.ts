/** Open the device microphone (must be called from a user tap on Android). */
import {
  getMicConstraintSets,
  ANDROID_GUEST_VOICE_MIC_CAPTURE,
  ANDROID_RETRO_HANDSET_MIC_CAPTURE,
  RETRO_HANDSET_MIC_TRACK_CONSTRAINTS,
  type MicProfile,
} from './audioConfig';

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

const BLOCKED_INPUT = /stereo mix|loopback|wave out|what u hear|virtual|cable output/i;
const BUILTIN_MIC = /built.?in|internal|bottom|back|tablet|default|microphone array|speakerphone/i;
const WIRED_MIC = /headset|wired|usb|earphone|hands-?free|3\.5|jack|headphone/i;

function formatMicError(err: unknown): Error {
  const name = err instanceof DOMException ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  const android = isAndroid();

  if (name === 'NotAllowedError' || /permission|denied|NotAllowed/i.test(msg)) {
    return new Error(
      android
        ? 'Could not open the microphone. Allow mic access in Android Settings for this app.'
        : 'Microphone blocked. Click the lock icon in the browser address bar and allow microphone access.',
    );
  }

  if (name === 'NotFoundError' || /not found|DevicesNotFound/i.test(msg)) {
    return new Error(
      android
        ? 'No microphone found on the tablet. Check device settings.'
        : 'No microphone found. Plug in a headset/mic or choose a default input in Windows Sound settings.',
    );
  }

  if (/audio source/i.test(msg)) {
    return new Error(
      android
        ? 'Could not open the microphone. Allow mic access in Android Settings for this app.'
        : 'Could not open microphone. Check that a mic is connected and selected as default.',
    );
  }

  return err instanceof Error ? err : new Error(msg || 'Could not open microphone.');
}

async function enumerateAudioInputs(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(
      (d) => d.kind === 'audioinput' && d.deviceId && !BLOCKED_INPUT.test(d.label),
    );
  } catch {
    return [];
  }
}

/** Prefer wired retro handset mic over built-in tablet mic (Lenovo/Android). */
export async function resolvePreferredWiredMicDeviceId(): Promise<string | undefined> {
  if (!isAndroid()) return undefined;

  const inputs = await enumerateAudioInputs();
  if (inputs.length === 0) return undefined;

  const wired = inputs.filter((d) => WIRED_MIC.test(d.label) && !BUILTIN_MIC.test(d.label));
  if (wired.length > 0) return wired[0].deviceId;

  const notBuiltin = inputs.filter((d) => d.label && !BUILTIN_MIC.test(d.label));
  if (notBuiltin.length === 1 && inputs.length >= 2) return notBuiltin[0].deviceId;

  // Android often lists built-in first, wired headset second — labels may be empty until permission.
  if (inputs.length >= 2) {
    const last = inputs[inputs.length - 1];
    const first = inputs[0];
    if (!last.label && !first.label) return last.deviceId;
    if (BUILTIN_MIC.test(first.label) && !BUILTIN_MIC.test(last.label)) return last.deviceId;
  }

  return undefined;
}

export function injectPreferredMicDevice(
  constraints: MediaStreamConstraints,
  deviceId?: string,
): MediaStreamConstraints {
  if (!deviceId || constraints.audio === false || constraints.audio === undefined) {
    return constraints;
  }

  const audio =
    typeof constraints.audio === 'object'
      ? { ...constraints.audio, deviceId: { ideal: deviceId } }
      : { deviceId: { ideal: deviceId } };

  return { ...constraints, audio };
}

export function mergeMicCaptureWithDevice<T extends Record<string, unknown>>(
  capture: T,
  deviceId?: string,
): T & { deviceId?: { ideal: string } } {
  if (!deviceId) return capture;
  return { ...capture, deviceId: { ideal: deviceId } };
}

async function tryFirstAudioInput(): Promise<MediaStream | null> {
  const inputs = await enumerateAudioInputs();

  for (const input of inputs) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: input.deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      });
    } catch {
      // try next device
    }
  }

  return null;
}

async function finalizeMicStream(stream: MediaStream, profile: MicProfile): Promise<MediaStream> {
  const track = stream.getAudioTracks()[0];
  if (!track) return stream;

  const attempts: MediaTrackConstraints[] =
    profile === 'retro-handset'
      ? [RETRO_HANDSET_MIC_TRACK_CONSTRAINTS, ANDROID_RETRO_HANDSET_MIC_CAPTURE, ANDROID_GUEST_VOICE_MIC_CAPTURE]
      : [ANDROID_GUEST_VOICE_MIC_CAPTURE];

  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints);
      break;
    } catch {
      // try next constraint set
    }
  }

  return stream;
}

/** Unmute desk primed tracks immediately before LiveKit takes over capture. */
export function enableDeskMicTracks(stream: MediaStream | null | undefined): void {
  stream?.getAudioTracks().forEach((track) => {
    track.enabled = true;
  });
}

export async function acquireMicrophone(options?: { profile?: MicProfile }): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone not supported on this device.');
  }

  let lastError: unknown;
  const profile = options?.profile ?? 'default';
  const preferWiredMic = isAndroid() && (profile === 'default' || profile === 'retro-handset');
  const preferredDeviceId = preferWiredMic ? await resolvePreferredWiredMicDeviceId() : undefined;

  try {
    await navigator.mediaDevices.enumerateDevices();
  } catch {
    // non-fatal
  }

  for (const constraints of getMicConstraintSets(isAndroid(), profile)) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        injectPreferredMicDevice(constraints, preferredDeviceId),
      );
      if (profile === 'retro-handset') {
        return await finalizeMicStream(stream, profile);
      }
      return stream;
    } catch (err) {
      lastError = err;
    }
  }

  if (profile === 'retro-handset') {
    throw formatMicError(lastError);
  }

  try {
    const stream = await tryFirstAudioInput();
    if (stream) return stream;
  } catch (err) {
    lastError = err;
  }

  throw formatMicError(lastError);
}

export function releaseMicrophoneStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
