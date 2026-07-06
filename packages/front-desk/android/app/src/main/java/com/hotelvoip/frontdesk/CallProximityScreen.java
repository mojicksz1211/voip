package com.hotelvoip.frontdesk;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;

/**
 * GSM-style proximity blackout during earpiece calls.
 * Uses a sensor listener + full-screen overlay instead of PROXIMITY_SCREEN_OFF_WAKE_LOCK
 * so the WebView / WebRTC stack keeps running (wake lock pauses Chromium on many devices).
 */
final class CallProximityScreen {

    private static final String TAG = "HotelVoIPCallAudio";

    private static SensorManager sensorManager;
    private static SensorEventListener proximityListener;
    private static View blackoutOverlay;
    private static boolean monitoring;
    private static boolean isNear;
    private static boolean keepScreenOnWasSet;

    private CallProximityScreen() {}

    static boolean isSupported(Context context) {
        if (context == null) {
            return false;
        }
        PackageManager pm = context.getPackageManager();
        if (pm == null || !pm.hasSystemFeature(PackageManager.FEATURE_SENSOR_PROXIMITY)) {
            return false;
        }
        SensorManager sm = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_PROXIMITY) != null;
    }

    static boolean isHeld() {
        return monitoring;
    }

    static void maintainDuringCall(Activity activity) {
        // Overlay tracks near/far via the sensor; nothing to do on audio reassert.
    }

    static void acquire(Activity activity) {
        if (activity == null || !isSupported(activity) || monitoring) {
            return;
        }

        Window window = activity.getWindow();
        if (window != null) {
            int flags = window.getAttributes().flags;
            keepScreenOnWasSet = (flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0;
        }

        sensorManager = (SensorManager) activity.getSystemService(Context.SENSOR_SERVICE);
        Sensor proximity = sensorManager != null
                ? sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY)
                : null;
        if (proximity == null) {
            return;
        }

        monitoring = true;
        proximityListener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (event.sensor.getType() != Sensor.TYPE_PROXIMITY) {
                    return;
                }
                boolean near = event.values[0] < event.sensor.getMaximumRange();
                activity.runOnUiThread(() -> updateNearState(activity, near));
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {
                // no-op
            }
        };
        sensorManager.registerListener(
                proximityListener,
                proximity,
                SensorManager.SENSOR_DELAY_NORMAL
        );
        Log.i(TAG, "proximity overlay monitoring started");
    }

    static void release(Activity activity) {
        if (sensorManager != null && proximityListener != null) {
            sensorManager.unregisterListener(proximityListener);
        }
        sensorManager = null;
        proximityListener = null;
        monitoring = false;

        if (activity != null) {
            activity.runOnUiThread(() -> {
                updateNearState(activity, false);
                restoreKeepScreenOn(activity);
            });
        } else {
            isNear = false;
            keepScreenOnWasSet = false;
        }
        Log.i(TAG, "proximity overlay monitoring stopped");
    }

    private static void updateNearState(Activity activity, boolean near) {
        if (near == isNear) {
            return;
        }
        isNear = near;
        if (near) {
            showBlackout(activity);
            Window window = activity.getWindow();
            if (window != null) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        } else {
            hideBlackout(activity);
            restoreKeepScreenOn(activity);
        }
    }

    private static void restoreKeepScreenOn(Activity activity) {
        if (!keepScreenOnWasSet || activity == null) {
            return;
        }
        Window window = activity.getWindow();
        if (window != null) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private static void showBlackout(Activity activity) {
        if (blackoutOverlay != null && blackoutOverlay.getParent() != null) {
            return;
        }
        FrameLayout decor = activity.findViewById(android.R.id.content);
        if (decor == null) {
            decor = (FrameLayout) activity.getWindow().getDecorView();
        }
        blackoutOverlay = new View(activity);
        blackoutOverlay.setBackgroundColor(Color.BLACK);
        blackoutOverlay.setClickable(true);
        blackoutOverlay.setFocusable(true);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        decor.addView(blackoutOverlay, params);
        blackoutOverlay.bringToFront();
        blackoutOverlay.setElevation(10000f);
        Log.d(TAG, "proximity overlay shown");
    }

    private static void hideBlackout(Activity activity) {
        if (blackoutOverlay == null) {
            return;
        }
        if (blackoutOverlay.getParent() instanceof FrameLayout) {
            ((FrameLayout) blackoutOverlay.getParent()).removeView(blackoutOverlay);
        }
        blackoutOverlay = null;
        Log.d(TAG, "proximity overlay hidden");
    }
}
