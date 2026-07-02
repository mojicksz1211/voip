package com.hotelvoip.frontdesk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Persistent foreground service that keeps the front-desk console process — and
 * therefore its SSE connection to the PBX — alive so incoming calls always ring
 * even when the screen is off or the app is backgrounded.
 *
 * Separate from {@link VoipCallService}: that one is a short-lived MICROPHONE
 * service used only during an active call, while this is a long-lived DATA_SYNC
 * service that runs the whole time the console is up. A partial wake lock keeps
 * the CPU running so the WebView's network stream is not frozen during Doze.
 */
public class PresenceService extends Service {

    public static final String CHANNEL_ID = "front_desk_presence";
    public static final int NOTIFICATION_ID = 1002;

    private static final String WAKE_LOCK_TAG = "frontdesk:presence";

    /** True while the service is alive in this process (statics reset on process death). */
    private static volatile boolean running = false;

    private PowerManager.WakeLock wakeLock;

    public static void start(Context context) {
        Intent intent = new Intent(context, PresenceService.class);
        try {
            if (running || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                // Already foreground (or pre-O): a plain startService avoids arming
                // another strict startForegroundService watchdog.
                context.startService(intent);
            } else {
                context.startForegroundService(intent);
            }
        } catch (RuntimeException e) {
            // Background start not allowed on Android 12+ (or similar) — retried when
            // the app is in the foreground again; never crash the process.
        }
    }

    public static void stop(Context context) {
        try {
            context.stopService(new Intent(context, PresenceService.class));
        } catch (RuntimeException ignored) {
            // Service already gone.
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // CRITICAL: satisfy the startForegroundService() contract immediately. Android
        // kills the whole app with ForegroundServiceDidNotStartInTime if startForeground()
        // is not called within a few seconds of startForegroundService().
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                        NOTIFICATION_ID,
                        buildNotification(),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                );
            } else {
                startForeground(NOTIFICATION_ID, buildNotification());
            }
        } catch (RuntimeException e) {
            running = false;
            stopSelf();
            return START_NOT_STICKY;
        }
        running = true;

        acquireWakeLock();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        releaseWakeLock();
        super.onDestroy();
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            return;
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.presence_channel),
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.presence_channel_desc));
        channel.setShowBadge(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.presence_title))
                .setContentText(getString(R.string.presence_text_idle))
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .build();
    }
}
