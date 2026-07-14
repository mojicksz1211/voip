package com.hotelvoip.frontdesk;

import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.SystemClock;

final class CallAudioRouting {

    private CallAudioRouting() {}

    private static long lastFullRouteMs = 0;
    private static long lastConnectedReassertMs = 0;

    static void resetRingRoutingThrottle() {
        lastFullRouteMs = 0;
    }

    static void resetConnectedReassertThrottle() {
        lastConnectedReassertMs = 0;
    }

    /** Re-apply full routing at most every 2s to avoid UI jank during ring cycles. */
    static void maintainSpeakerForRing(AudioManager audioManager) {
        long now = SystemClock.elapsedRealtime();
        if (lastFullRouteMs != 0 && now - lastFullRouteMs < 2000L) {
            audioManager.setSpeakerphoneOn(true);
            return;
        }
        lastFullRouteMs = now;
        forceSpeakerForRing(audioManager);
    }

    static void forceSpeakerForRing(AudioManager audioManager) {
        forceSpeakerForRing(audioManager, true);
    }

    static void forceSpeakerForRing(AudioManager audioManager, boolean muteMic) {
        clearCommunicationDevice(audioManager);
        audioManager.setBluetoothScoOn(false);
        audioManager.setMicrophoneMute(muteMic);

        if (isWiredHeadsetConnected(audioManager)) {
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioManager.setSpeakerphoneOn(true);
            forceAllStreamsToSpeaker(audioManager);
            if (lastFullRouteMs == 0) {
                attemptForceSpeakerWithWiredJack(audioManager);
            }
        } else {
            audioManager.setMode(AudioManager.MODE_RINGTONE);
            audioManager.setSpeakerphoneOn(true);
            forceAllStreamsToSpeaker(audioManager);
            routeOutputToBuiltInSpeaker(audioManager);
        }

        boostRingVolumes(audioManager);
    }

    static void prepareConnectedAudio(AudioManager audioManager, boolean preferWiredHeadset) {
        prepareConnectedAudio(audioManager, preferWiredHeadset, false);
    }

    /** @param forceSpeaker when true, route to loudspeaker (user toggled speaker on). */
    static void prepareConnectedAudio(
            AudioManager audioManager,
            boolean preferWiredHeadset,
            boolean forceSpeaker
    ) {
        audioManager.setMicrophoneMute(false);
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);

        if (forceSpeaker) {
            stopBluetoothScoIfActive(audioManager);
            clearCommunicationDevice(audioManager);
            audioManager.setSpeakerphoneOn(true);
            forceAllStreamsToSpeaker(audioManager);
            routeOutputToBuiltInSpeaker(audioManager);
            return;
        }

        if (preferWiredHeadset && routeToWiredHeadsetIfAvailable(audioManager)) {
            stopBluetoothScoIfActive(audioManager);
            clearForcedSpeakerRouting(audioManager);
            audioManager.setSpeakerphoneOn(false);
            return;
        }

        if (routeToBluetoothIfAvailable(audioManager)) {
            clearForcedSpeakerRouting(audioManager);
            audioManager.setSpeakerphoneOn(false);
            return;
        }

        stopBluetoothScoIfActive(audioManager);
        clearCommunicationDevice(audioManager);

        // Ring phase forces speaker via AudioSystem.setForceUse — must clear before earpiece.
        clearForcedSpeakerRouting(audioManager);

        // Phones: earpiece. Tablets (no earpiece device): fall back to loudspeaker.
        routeConnectedDefaultOutput(audioManager);
    }

    static boolean hasBuiltInEarpiece(AudioManager audioManager) {
        return findBuiltInEarpiece(audioManager) != null;
    }

    static void routeSpeakerOutput(AudioManager audioManager) {
        audioManager.setSpeakerphoneOn(true);
        forceAllStreamsToSpeaker(audioManager);
        routeOutputToBuiltInSpeaker(audioManager);
    }

    /** Earpiece when available; otherwise loudspeaker (desk tablets have no earpiece). */
    static void routeConnectedDefaultOutput(AudioManager audioManager) {
        if (!routeToBuiltInEarpieceIfAvailable(audioManager)) {
            routeSpeakerOutput(audioManager);
        }
    }

    /**
     * Connected-call routing for phones, tablets, wired retro handsets, and Bluetooth HFP.
     *
     * @return true when audio should use the built-in loudspeaker.
     */
    static boolean computeEffectiveSpeaker(AudioManager audioManager, boolean forceSpeaker) {
        if (forceSpeaker) {
            return true;
        }
        if (isExternalAudioConnected(audioManager)) {
            return false;
        }
        // Phones: earpiece. Tablets (no earpiece device): loudspeaker.
        return !hasBuiltInEarpiece(audioManager);
    }

    static boolean isExternalAudioConnected(AudioManager audioManager) {
        return isWiredHeadsetConnected(audioManager) || isBluetoothHfpConnected(audioManager);
    }

    static void prepareDeskConnectedAudio(
            AudioManager audioManager,
            boolean preferWiredHeadset,
            boolean forceSpeaker
    ) {
        if (isExternalAudioConnected(audioManager)) {
            prepareConnectedAudio(audioManager, preferWiredHeadset, forceSpeaker);
            return;
        }
        if (forceSpeaker || !hasBuiltInEarpiece(audioManager)) {
            prepareConnectedAudio(audioManager, preferWiredHeadset, true);
            return;
        }
        prepareConnectedAudio(audioManager, preferWiredHeadset, false);
    }

    /**
     * Light reassert after WebRTC overrides routing — throttled, no clearCommunicationDevice churn.
     */
    static void reassertConnectedAudio(AudioManager audioManager, boolean forceSpeaker) {
        long now = SystemClock.elapsedRealtime();
        if (lastConnectedReassertMs != 0 && now - lastConnectedReassertMs < 2000L) {
            return;
        }
        lastConnectedReassertMs = now;

        if (forceSpeaker) {
            if (!audioManager.isSpeakerphoneOn()) {
                audioManager.setSpeakerphoneOn(true);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo current = audioManager.getCommunicationDevice();
                if (current == null || current.getType() != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                    routeOutputToBuiltInSpeaker(audioManager);
                }
            }
            return;
        }

        audioManager.setMicrophoneMute(false);

        if (isWiredHeadsetConnected(audioManager)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo current = audioManager.getCommunicationDevice();
                AudioDeviceInfo wired = findWiredCommunicationDevice(audioManager);
                if (wired != null
                        && (current == null || current.getId() != wired.getId())) {
                    audioManager.setCommunicationDevice(wired);
                    disableHandsetSidetone(audioManager);
                }
            } else if (audioManager.isSpeakerphoneOn()) {
                audioManager.setSpeakerphoneOn(false);
                disableHandsetSidetone(audioManager);
            }
            return;
        }

        if (isBluetoothHfpConnected(audioManager)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo current = audioManager.getCommunicationDevice();
                AudioDeviceInfo bluetooth = findBluetoothCommunicationDevice(audioManager);
                if (bluetooth != null
                        && (current == null || current.getId() != bluetooth.getId())) {
                    audioManager.setCommunicationDevice(bluetooth);
                }
            } else if (!audioManager.isBluetoothScoOn()) {
                routeToBluetoothIfAvailable(audioManager);
            } else if (audioManager.isSpeakerphoneOn()) {
                audioManager.setSpeakerphoneOn(false);
            }
            return;
        }

        if (!hasBuiltInEarpiece(audioManager)) {
            if (!audioManager.isSpeakerphoneOn()) {
                audioManager.setSpeakerphoneOn(true);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo current = audioManager.getCommunicationDevice();
                if (current == null || current.getType() != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                    routeOutputToBuiltInSpeaker(audioManager);
                }
            }
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AudioDeviceInfo current = audioManager.getCommunicationDevice();
            if (current != null && current.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                routeToBuiltInEarpieceIfAvailable(audioManager);
            }
            return;
        }
        if (audioManager.isSpeakerphoneOn()) {
            audioManager.setSpeakerphoneOn(false);
        }
    }

    /**
     * Hang-up tone routing — do not call setCommunicationDevice(); LiveKit teardown
     * clears the communication route and kills a freshly started AudioTrack.
     */
    static void prepareHangupAudio(AudioManager audioManager, boolean wired) {
        audioManager.setMicrophoneMute(false);
        stopBluetoothScoIfActive(audioManager);
        if (wired) {
            audioManager.setMode(AudioManager.MODE_NORMAL);
            audioManager.setSpeakerphoneOn(false);
            disableHandsetSidetone(audioManager);
        } else {
            forceSpeakerForRing(audioManager, false);
        }
        boostRingVolumes(audioManager);
    }

    static void disableHandsetSidetone(AudioManager audioManager) {
        final String[] keys = {
                "sidetone_enable=0",
                "sidetone_enabled=0",
                "handset_sidetone_enable=0",
        };
        for (String params : keys) {
            try {
                audioManager.setParameters(params);
            } catch (Exception ignored) {
                // OEM-specific; best effort only.
            }
        }
    }

    static AudioDeviceInfo findBuiltInSpeaker(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return null;
        }
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                return device;
            }
        }
        return null;
    }

    static AudioDeviceInfo findBuiltInEarpiece(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return null;
        }
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                return device;
            }
        }
        return null;
    }

    /** Routes voice call audio to the built-in earpiece when available. */
    static boolean routeToBuiltInEarpieceIfAvailable(AudioManager audioManager) {
        clearForcedSpeakerRouting(audioManager);
        audioManager.setSpeakerphoneOn(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AudioDeviceInfo earpiece = findBuiltInEarpiece(audioManager);
                if (earpiece != null) {
                    return audioManager.setCommunicationDevice(earpiece);
                }
            } catch (SecurityException ignored) {
                // Some builds reject communication device changes without policy access.
            }
            // No earpiece device (e.g. unfolded foldable) — speakerphone off, system default route.
            return false;
        }
        // Pre-API 31: MODE_IN_COMMUNICATION + speaker off typically uses earpiece on phones.
        return true;
    }

    static void boostRingVolumes(AudioManager audioManager) {
        int alarmMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
        safeSetStreamVolume(audioManager, AudioManager.STREAM_ALARM, alarmMax);

        int ringMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
        safeSetStreamVolume(audioManager, AudioManager.STREAM_RING, ringMax);

        int voiceMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
        safeSetStreamVolume(audioManager, AudioManager.STREAM_VOICE_CALL, voiceMax);
    }

    static void safeSetStreamVolume(AudioManager audioManager, int stream, int volume) {
        try {
            audioManager.setStreamVolume(stream, volume, 0);
        } catch (SecurityException ignored) {
            // DND / OEM policy may block programmatic volume changes.
        }
    }

    @SuppressWarnings("deprecation")
    static boolean isWiredHeadsetConnected(AudioManager audioManager) {
        return findWiredCommunicationDevice(audioManager) != null;
    }

    /** Bluetooth HFP/SCO headset connected (voice-call profile only). */
    static boolean isBluetoothHfpConnected(AudioManager audioManager) {
        return findBluetoothCommunicationDevice(audioManager) != null;
    }

    static AudioDeviceInfo findBluetoothCommunicationDevice(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return null;
        }
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (device.getType() != AudioDeviceInfo.TYPE_BLUETOOTH_SCO) {
                continue;
            }
            String product = safeProductName(device);
            if (product != null && matchesLocalBuildIdentity(product)) {
                continue;
            }
            return device;
        }
        return null;
    }

    static boolean routeToBluetoothIfAvailable(AudioManager audioManager) {
        if (!isBluetoothHfpConnected(audioManager)) {
            return false;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AudioDeviceInfo bluetooth = findBluetoothCommunicationDevice(audioManager);
                if (bluetooth != null && audioManager.setCommunicationDevice(bluetooth)) {
                    audioManager.setSpeakerphoneOn(false);
                    return true;
                }
            } catch (SecurityException ignored) {
                // BLUETOOTH_CONNECT may be denied on some builds.
            }
            return false;
        }

        audioManager.setSpeakerphoneOn(false);
        if (!audioManager.isBluetoothScoOn()) {
            audioManager.startBluetoothSco();
            audioManager.setBluetoothScoOn(true);
        }
        return true;
    }

    static void stopBluetoothScoIfActive(AudioManager audioManager) {
        if (!audioManager.isBluetoothScoOn()) {
            return;
        }
        audioManager.setBluetoothScoOn(false);
        try {
            audioManager.stopBluetoothSco();
        } catch (Exception ignored) {
            // Best effort only.
        }
    }

    private static boolean routeToWiredHeadsetIfAvailable(AudioManager audioManager) {
        if (!isWiredHeadsetConnected(audioManager)) {
            return false;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AudioDeviceInfo device = findWiredCommunicationDevice(audioManager);
            if (device != null && audioManager.setCommunicationDevice(device)) {
                disableHandsetSidetone(audioManager);
                return true;
            }
            return false;
        }

        audioManager.setSpeakerphoneOn(false);
        disableHandsetSidetone(audioManager);
        return true;
    }

    static AudioDeviceInfo findWiredOutputDevice(AudioManager audioManager) {
        return findWiredCommunicationDevice(audioManager);
    }

    private static AudioDeviceInfo findWiredCommunicationDevice(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return null;
        }
        AudioDeviceInfo external = findPreferredWiredDevice(audioManager, false);
        if (external != null) {
            return external;
        }
        // Some tablets (e.g. Lenovo TB336FU) expose the 3.5mm jack only as an OEM-internal
        // USB headset node named after the device — filtered above to avoid phantom routing.
        if (audioManager.isWiredHeadsetOn()) {
            return findPreferredWiredDevice(audioManager, true);
        }
        return null;
    }

    private static AudioDeviceInfo findPreferredWiredDevice(
            AudioManager audioManager,
            boolean includeOemJackNodes
    ) {
        int[] preferredTypes = {
                AudioDeviceInfo.TYPE_WIRED_HEADSET,
                AudioDeviceInfo.TYPE_USB_HEADSET,
                AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        };
        for (int type : preferredTypes) {
            for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                if (device.getType() != type) {
                    continue;
                }
                if (includeOemJackNodes) {
                    if (isLikelyOemWiredJackNode(device)) {
                        return device;
                    }
                    continue;
                }
                if (isExternalWiredOutputDevice(device)) {
                    return device;
                }
            }
        }
        return null;
    }

    private static boolean isLikelyOemWiredJackNode(AudioDeviceInfo device) {
        if (device == null) {
            return false;
        }
        int type = device.getType();
        if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                || type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES) {
            return true;
        }
        if (type == AudioDeviceInfo.TYPE_USB_HEADSET) {
            String product = safeProductName(device);
            return product != null && matchesLocalBuildIdentity(product);
        }
        return false;
    }

    private static boolean isExternalWiredOutputDevice(AudioDeviceInfo device) {
        if (device == null) {
            return false;
        }
        String product = safeProductName(device);
        if (product != null && matchesLocalBuildIdentity(product)) {
            return false;
        }
        if (device.getType() == AudioDeviceInfo.TYPE_USB_HEADSET) {
            return product != null && !product.isEmpty();
        }
        return true;
    }

    private static String safeProductName(AudioDeviceInfo device) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return null;
        }
        try {
            CharSequence name = device.getProductName();
            return name != null ? name.toString().trim() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean matchesLocalBuildIdentity(String product) {
        String p = product.trim();
        if (p.isEmpty()) {
            return false;
        }
        return equalsIgnoreCase(p, Build.MODEL)
                || equalsIgnoreCase(p, Build.DEVICE)
                || equalsIgnoreCase(p, Build.PRODUCT)
                || equalsIgnoreCase(p, Build.MANUFACTURER);
    }

    private static boolean equalsIgnoreCase(String a, String b) {
        return a != null && b != null && a.equalsIgnoreCase(b);
    }

    private static void routeOutputToBuiltInSpeaker(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AudioDeviceInfo speaker = findBuiltInSpeaker(audioManager);
                if (speaker != null) {
                    audioManager.setCommunicationDevice(speaker);
                }
            } catch (SecurityException ignored) {
                // Some builds reject communication device changes without policy access.
            }
        }
    }

    static void clearCommunicationDevice(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audioManager.clearCommunicationDevice();
        }
    }

    @SuppressWarnings("deprecation")
    private static void forceAllStreamsToSpeaker(AudioManager audioManager) {
        audioManager.setSpeakerphoneOn(true);
        try {
            Class<?> audioSystem = Class.forName("android.media.AudioSystem");
            java.lang.reflect.Method setForceUse = audioSystem.getMethod(
                    "setForceUse",
                    int.class,
                    int.class
            );
            setForceUse.invoke(null, 0, 1);
            setForceUse.invoke(null, 1, 1);
            setForceUse.invoke(null, 2, 1);
        } catch (Exception ignored) {
            // Not available on all builds
        }
    }

    /** Undo ring-phase AudioSystem / OEM force-speaker so connected calls can use earpiece. */
    static void clearForcedSpeakerRouting(AudioManager audioManager) {
        try {
            Class<?> audioSystem = Class.forName("android.media.AudioSystem");
            java.lang.reflect.Method setForceUse = audioSystem.getMethod(
                    "setForceUse",
                    int.class,
                    int.class
            );
            setForceUse.invoke(null, 0, 0);
            setForceUse.invoke(null, 1, 0);
            setForceUse.invoke(null, 2, 0);
        } catch (Exception ignored) {
            // Not available on all builds
        }
        final String[] params = {
                "force_speaker=false",
                "routing=default",
                "audio_output_device=auto",
        };
        for (String param : params) {
            try {
                audioManager.setParameters(param);
            } catch (Exception ignored) {
                // OEM-specific; best effort only.
            }
        }
    }

    private static void attemptForceSpeakerWithWiredJack(AudioManager audioManager) {
        final String[] params = {
                "force_speaker=true",
                "SET_FORCE_USE=AUDIO_FORCE_SPEAKER",
                "routing=force_speaker",
                "audio_output_device=speaker",
        };
        for (String param : params) {
            try {
                audioManager.setParameters(param);
            } catch (Exception ignored) {
                // OEM-specific; best effort only.
            }
        }
    }
}
