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



import androidx.core.app.NotificationCompat;



public class VoipCallService extends Service {

    public static final String CHANNEL_ID = "front_desk_voip_calls";

    public static final int NOTIFICATION_ID = 1001;

    public static final String EXTRA_LABEL = "label";



    private static volatile boolean foregroundStarted = false;

    private static volatile boolean stopWhenReady = false;



    public static void beginStart() {

        stopWhenReady = false;

    }



    /** Stop only after startForeground() ran — avoids ForegroundServiceDidNotStartInTimeException. */

    public static void requestStop(Context context) {

        if (!foregroundStarted) {

            stopWhenReady = true;

            return;

        }

        context.stopService(new Intent(context, VoipCallService.class));

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

        String label = intent != null

                ? intent.getStringExtra(EXTRA_LABEL)

                : null;

        if (label == null || label.isEmpty()) {

            label = "VoIP call in progress";

        }



        try {

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {

                startForeground(

                        NOTIFICATION_ID,

                        buildNotification(label),

                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE

                );

            } else {

                startForeground(NOTIFICATION_ID, buildNotification(label));

            }

            foregroundStarted = true;

        } catch (RuntimeException e) {

            foregroundStarted = false;

            stopWhenReady = false;

            stopSelf();

            return START_NOT_STICKY;

        }



        if (stopWhenReady) {

            stopWhenReady = false;

            foregroundStarted = false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {

                stopForeground(STOP_FOREGROUND_REMOVE);

            } else {

                stopForeground(true);

            }

            stopSelf();

            return START_NOT_STICKY;

        }



        return START_STICKY;

    }



    @Override

    public void onDestroy() {

        foregroundStarted = false;

        stopWhenReady = false;

        super.onDestroy();

    }



    private Notification buildNotification(String label) {

        Intent launchIntent = new Intent(this, MainActivity.class);

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(

                this,

                0,

                launchIntent,

                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE

        );



        return new NotificationCompat.Builder(this, CHANNEL_ID)

                .setContentTitle("Front Desk")

                .setContentText(label)

                .setSmallIcon(R.mipmap.ic_launcher)

                .setOngoing(true)

                .setCategory(NotificationCompat.CATEGORY_CALL)

                .setPriority(NotificationCompat.PRIORITY_HIGH)

                .setContentIntent(pendingIntent)

                .build();

    }



    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {

            return;

        }



        NotificationChannel channel = new NotificationChannel(

                CHANNEL_ID,

                "Front Desk Calls",

                NotificationManager.IMPORTANCE_HIGH

        );

        channel.setDescription("Keeps the front desk intercom active during calls");

        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);



        NotificationManager manager = getSystemService(NotificationManager.class);

        if (manager != null) {

            manager.createNotificationChannel(channel);

        }

    }

}


