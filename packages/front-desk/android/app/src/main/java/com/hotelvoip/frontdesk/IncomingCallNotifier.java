package com.hotelvoip.frontdesk;

import android.content.Context;
import android.content.Intent;

/**
 * Brings the front-desk console's own incoming-call screen straight to the
 * foreground when a call arrives while the app is backgrounded or the screen is
 * off/locked.
 *
 * We intentionally do NOT post a system notification: the app's in-app
 * incoming-call UI is the intended experience. Launching {@link MainActivity}
 * directly is permitted because the app holds SYSTEM_ALERT_WINDOW ("display over
 * other apps"), and MainActivity is declared {@code showWhenLocked} /
 * {@code turnScreenOn}, so the call UI also appears over the lock screen.
 */
public final class IncomingCallNotifier {

    private IncomingCallNotifier() {
    }

    public static void present(Context context, String title, String body) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try {
            context.startActivity(launch);
        } catch (Exception ignored) {
            // Nothing more we can do here; the native ringtone still alerts staff.
        }
    }

    public static void cancel(Context context) {
        // No system notification is posted, so there is nothing to dismiss.
        // Kept for API compatibility with the JS bridge.
    }
}
