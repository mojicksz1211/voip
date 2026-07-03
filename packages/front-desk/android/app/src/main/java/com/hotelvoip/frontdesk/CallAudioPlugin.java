package com.hotelvoip.frontdesk;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.util.Log;

@CapacitorPlugin(name = "CallAudio")
public class CallAudioPlugin extends Plugin {

    private static final String TAG = "HotelVoIPCallAudio";
    private static CallAudioPlugin instance;

    /** Known OEM auto-start / background-launch management screens, tried in order. */
    private static final String[][] AUTOSTART_COMPONENTS = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
            {"com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"},
            {"com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.MainActivity"},
            {"com.htc.pitroad", "com.htc.pitroad.landingpage.activity.LandingPageActivity"},
    };

    private AudioFocusRequest audioFocusRequest;
    private AudioFocusRequest ringFocusRequest;
    private final NativeCallRinger nativeCallRinger = new NativeCallRinger();
    private final Object audioLock = new Object();
    private final Object callServiceLock = new Object();

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    public static boolean dispatchHandsetHookKey(int keyCode, int action, int repeatCount) {
        if (action != android.view.KeyEvent.ACTION_DOWN || repeatCount != 0) {
            return false;
        }
        if (keyCode != android.view.KeyEvent.KEYCODE_HEADSETHOOK
                && keyCode != android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                && keyCode != android.view.KeyEvent.KEYCODE_CALL) {
            return false;
        }
        notifyHandsetHook();
        return true;
    }

    private static void notifyHandsetHook() {
        if (instance == null) {
            return;
        }
        JSObject data = new JSObject();
        data.put("action", "press");
        instance.notifyListeners("handsetHook", data);
        Log.i(TAG, "handsetHook press");
    }

    private void runAudioOnUiThread(PluginCall call, Runnable task) {
        Runnable wrapped = () -> {
            synchronized (audioLock) {
                task.run();
            }
            call.resolve();
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(wrapped);
            return;
        }

        new Handler(Looper.getMainLooper()).post(wrapped);
    }

    @PluginMethod
    public void startCallService(PluginCall call) {
        if (!hasMicPermission()) {
            call.reject("Microphone permission is required before starting a call.");
            return;
        }

        String label = call.getString("label", "Station call");
        Intent intent = new Intent(getContext(), VoipCallService.class);
        intent.putExtra(VoipCallService.EXTRA_LABEL, label);

        Runnable work = () -> {
            synchronized (callServiceLock) {
                try {
                    VoipCallService.beginStart();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        getContext().startForegroundService(intent);
                    } else {
                        getContext().startService(intent);
                    }
                    call.resolve();
                } catch (RuntimeException e) {
                    call.reject("Could not start call service: " + e.getMessage());
                }
            }
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void stopCallService(PluginCall call) {
        Runnable work = () -> {
            synchronized (callServiceLock) {
                VoipCallService.requestStop(getContext());
                call.resolve();
            }
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void startPresenceService(PluginCall call) {
        Runnable work = () -> {
            synchronized (callServiceLock) {
                try {
                    PresenceService.start(getContext());
                    call.resolve();
                } catch (RuntimeException e) {
                    call.reject("Could not start presence service: " + e.getMessage());
                }
            }
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void stopPresenceService(PluginCall call) {
        Runnable work = () -> {
            synchronized (callServiceLock) {
                PresenceService.stop(getContext());
                call.resolve();
            }
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void isBatteryExemptionGranted(PluginCall call) {
        JSObject result = new JSObject();
        boolean granted = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            granted = powerManager != null
                    && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }

        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve();
            return;
        }

        PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        String packageName = getContext().getPackageName();

        if (powerManager != null && powerManager.isIgnoringBatteryOptimizations(packageName)) {
            call.resolve();
            return;
        }

        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + packageName));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void presentIncomingCall(PluginCall call) {
        String title = call.getString("title", "Incoming call");
        String body = call.getString("body", "");
        IncomingCallNotifier.present(getContext(), title, body);
        call.resolve();
    }

    @PluginMethod
    public void cancelIncomingCall(PluginCall call) {
        IncomingCallNotifier.cancel(getContext());
        call.resolve();
    }

    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        JSObject result = new JSObject();
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm =
                    (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            granted = nm != null && nm.canUseFullScreenIntent();
        }
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        Runnable work = () -> {
            boolean opened = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    opened = true;
                } catch (Exception ignored) {
                    // Fall through to app details below.
                }
            }
            if (!opened) {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    opened = true;
                } catch (Exception ignored) {
                    // No settings screen available.
                }
            }
            JSObject result = new JSObject();
            result.put("opened", opened);
            call.resolve(result);
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void canDrawOverlays(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Runnable work = () -> {
            boolean opened = false;
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                opened = true;
            } catch (Exception ignored) {
                // No overlay settings screen available.
            }
            JSObject result = new JSObject();
            result.put("opened", opened);
            call.resolve(result);
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        result.put("brand", Build.BRAND == null ? "" : Build.BRAND);
        result.put("model", Build.MODEL == null ? "" : Build.MODEL);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void openAutoStartSettings(PluginCall call) {
        JSObject result = new JSObject();
        result.put("opened", tryOpenAutoStartSettings());
        call.resolve(result);
    }

    private boolean tryOpenAutoStartSettings() {
        for (String[] component : AUTOSTART_COMPONENTS) {
            Intent intent = new Intent();
            intent.setClassName(component[0], component[1]);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
                return true;
            } catch (Exception ignored) {
                // Component not present on this OEM — try the next candidate.
            }
        }

        // Fallback: open this app's details page so the user can find the
        // autostart / background toggle manually.
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    @PluginMethod
    public void applyCallState(PluginCall call) {
        String phase = call.getString("phase", "idle");
        String ringType = call.getString("ringType", null);
        boolean withMic = call.getBoolean("withMic", false);

        runAudioOnUiThread(call, () -> {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) {
                return;
            }

            switch (phase) {
                case "ringing":
                    applyRingingState(audioManager, ringType, withMic);
                    break;
                case "connected":
                    applyConnectedState(audioManager);
                    break;
                case "idle":
                default:
                    applyIdleState(audioManager);
                    break;
            }
        });
    }

    @PluginMethod
    public void enableSpeaker(PluginCall call) {
        runAudioOnUiThread(call, () -> {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                nativeCallRinger.stop();
                requestVoiceFocus(audioManager);
                CallAudioRouting.prepareConnectedAudio(audioManager, false);
                applyMaxCallVolumes(audioManager);
            }
        });
    }

    @PluginMethod
    public void routeCallAudio(PluginCall call) {
        String phase = call.getString("phase", "connected");
        boolean withMic = call.getBoolean("withMic", false);

        runAudioOnUiThread(call, () -> {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) {
                return;
            }

            if ("ringing".equals(phase)) {
                routeRingingCallAudio(audioManager, withMic);
            } else {
                nativeCallRinger.stop();
                requestVoiceFocus(audioManager);
                CallAudioRouting.prepareConnectedAudio(audioManager, true);
                applyMaxCallVolumes(audioManager);
            }
        });
    }

    @PluginMethod
    public void startRingtone(PluginCall call) {
        String type = call.getString("type", "incoming");
        runAudioOnUiThread(call, () -> {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                requestRingFocus(audioManager);
                nativeCallRinger.start(getContext(), audioManager, type);
            }
        });
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        runAudioOnUiThread(call, () -> {
            nativeCallRinger.stop();
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            abandonRingFocus(audioManager);
        });
    }

    @PluginMethod
    public void playHangupSound(PluginCall call) {
        runAudioOnUiThread(call, () -> {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                Log.i(TAG, "playHangupSound");
                nativeCallRinger.playHangupTone(audioManager);
            }
        });
    }

    @PluginMethod
    public void resetCallAudio(PluginCall call) {
        runAudioOnUiThread(call, () -> {
            applyIdleState((AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE));
        });
    }

    @PluginMethod
    public void wakeScreen(PluginCall call) {
        if (getActivity() == null) {
            call.resolve();
            return;
        }

        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                getActivity().setTurnScreenOn(true);
                getActivity().setShowWhenLocked(true);
            }

            getActivity().getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                            PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                                    | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                            "FrontDesk:IncomingCall"
                    );
                    wakeLock.acquire(3000L);
                    wakeLock.release();
                }
            }

            call.resolve();
        });
    }

    static void applyMaxCallVolumes(AudioManager audioManager) {
        int voiceMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
        CallAudioRouting.safeSetStreamVolume(audioManager, AudioManager.STREAM_VOICE_CALL, voiceMax);

        int musicMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        CallAudioRouting.safeSetStreamVolume(audioManager, AudioManager.STREAM_MUSIC, musicMax);
    }

    private void applyIdleState(AudioManager audioManager) {
        nativeCallRinger.stop();
        abandonRingFocus(audioManager);
        if (audioManager == null) {
            return;
        }
        CallAudioRouting.clearCommunicationDevice(audioManager);
        audioManager.setSpeakerphoneOn(false);
        audioManager.setBluetoothScoOn(false);
        audioManager.setMode(AudioManager.MODE_NORMAL);
        abandonVoiceFocus(audioManager);
    }

    private void applyRingingState(AudioManager audioManager, String ringType, boolean withMic) {
        if (withMic) {
            requestVoiceFocus(audioManager);
            CallAudioRouting.forceSpeakerForRing(audioManager, false);
        } else {
            CallAudioRouting.forceSpeakerForRing(audioManager);
        }

        if (ringType != null && !ringType.isEmpty()) {
            nativeCallRinger.start(getContext(), audioManager, ringType);
        } else {
            nativeCallRinger.stop();
        }
    }

    private void applyConnectedState(AudioManager audioManager) {
        nativeCallRinger.stop();
        requestVoiceFocus(audioManager);
        CallAudioRouting.prepareConnectedAudio(audioManager, true);
        applyMaxCallVolumes(audioManager);
    }

    private void routeRingingCallAudio(AudioManager audioManager, boolean withMic) {
        if (withMic) {
            requestVoiceFocus(audioManager);
            CallAudioRouting.forceSpeakerForRing(audioManager, false);
        } else {
            CallAudioRouting.forceSpeakerForRing(audioManager);
        }
    }

    private boolean hasMicPermission() {
        return ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestVoiceFocus(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(focusChange -> { /* no-op */ })
                    .build();
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
            );
        }
    }

    private void abandonVoiceFocus(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
            audioFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(null);
        }
    }

    private void requestRingFocus(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            ringFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(focusChange -> { /* keep ringing */ })
                    .build();
            audioManager.requestAudioFocus(ringFocusRequest);
        } else {
            audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_RING,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            );
        }
    }

    private void abandonRingFocus(AudioManager audioManager) {
        if (audioManager == null) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && ringFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(ringFocusRequest);
            ringFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(null);
        }
    }
}
