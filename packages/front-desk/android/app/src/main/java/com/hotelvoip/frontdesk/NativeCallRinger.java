package com.hotelvoip.frontdesk;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * Plays call ring / ringback on the built-in speaker (PCM dual-tone).
 * Uses STREAM_ALARM for consistent volume, especially with a wired jack plugged in.
 */
final class NativeCallRinger {

    private static final String TAG = "HotelVoIPRinger";
    private static final int SAMPLE_RATE = 44100;
    private static final float INCOMING_AMPLITUDE = 0.48f;
    private static final float RINGBACK_AMPLITUDE = 0.38f;
    private static final int INCOMING_TONE_MS = 400;
    private static final long INCOMING_CYCLE_MS = 3500L;
    private static final int RINGBACK_TONE_MS = 2000;
    private static final long RINGBACK_CYCLE_MS = 6000L;

    private static final short[] INCOMING_BUFFER =
            buildDualToneBuffer(853f, 960f, INCOMING_TONE_MS, INCOMING_AMPLITUDE);
    private static final short[] INCOMING_BURST_BUFFER = buildIncomingBurstBuffer();
    private static final int INCOMING_BURST_MS = 850 + INCOMING_TONE_MS;
    private static final short[] RINGBACK_BUFFER =
            buildDualToneBuffer(440f, 480f, RINGBACK_TONE_MS, RINGBACK_AMPLITUDE);

    private static final int HANGUP_CHIRP_MS = 140;
    private static final int HANGUP_GAP_MS = 120;
    private static final float HANGUP_AMPLITUDE = 0.42f;
    private static final short[] HANGUP_BUFFER = buildHangupBuffer();
    private static final int HANGUP_TOTAL_MS = HANGUP_CHIRP_MS + HANGUP_GAP_MS + HANGUP_CHIRP_MS;

    /** Frames the hang-up tone should reach; used to detect a killed/truncated track. */
    private static final int HANGUP_EXPECTED_FRAMES = SAMPLE_RATE * HANGUP_TOTAL_MS / 1000;
    private static final int HANGUP_MIN_OK_FRAMES = HANGUP_EXPECTED_FRAMES * 3 / 5;
    private static final int HANGUP_MAX_ATTEMPTS = 3;

    private static final AudioAttributes RING_ATTRIBUTES = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

    private static final AudioFormat RING_FORMAT = new AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build();

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable cycleRunnable;
    private Runnable stopTrackRunnable;
    private AudioTrack activeTrack;
    private String activeType;
    private AudioManager audioManager;
    private int playGeneration = 0;
    private boolean preferWiredOutput;
    private boolean skipOutputBinding;
    private int hangupAttemptsLeft;
    private Runnable hangupVerifyRunnable;

    void start(Context context, AudioManager audioManager, String type) {
        stop();
        preferWiredOutput = false;
        this.audioManager = audioManager;
        activeType = type;
        CallAudioRouting.resetRingRoutingThrottle();
        CallAudioRouting.forceSpeakerForRing(audioManager);
        Log.i(TAG, "start type=" + type + " wired=" + CallAudioRouting.isWiredHeadsetConnected(audioManager));

        if ("ringback".equals(type)) {
            scheduleRingbackCycle();
        } else {
            scheduleIncomingCycle();
        }
    }

    void stop() {
        activeType = null;
        audioManager = null;
        playGeneration++;
        CallAudioRouting.resetRingRoutingThrottle();
        cancelPendingStop();
        hangupAttemptsLeft = 0;
        cancelHangupVerify();
        if (cycleRunnable != null) {
            handler.removeCallbacks(cycleRunnable);
            cycleRunnable = null;
        }
        stopActiveTrack();
    }

    /**
     * Classic landline hang-up: two quick descending beeps. LiveKit tears the call
     * audio session down asynchronously and can kill a freshly started AudioTrack,
     * which is why the tone was sometimes cut to one beep or silent. We now verify
     * the track actually played to (near) completion and retry if it was truncated.
     */
    void playHangupTone(AudioManager audioManager) {
        stop();
        this.audioManager = audioManager;
        preferWiredOutput = CallAudioRouting.isWiredHeadsetConnected(audioManager);
        hangupAttemptsLeft = HANGUP_MAX_ATTEMPTS;
        Log.i(TAG, "playHangupTone wired=" + preferWiredOutput);
        playHangupAttempt();
    }

    private void playHangupAttempt() {
        if (audioManager == null || hangupAttemptsLeft <= 0) {
            return;
        }
        hangupAttemptsLeft--;
        // Re-assert hang-up routing each attempt: a late teardown may have cleared it.
        CallAudioRouting.prepareHangupAudio(audioManager, preferWiredOutput);
        skipOutputBinding = preferWiredOutput;
        playCachedTone(HANGUP_BUFFER, HANGUP_TOTAL_MS);
        skipOutputBinding = false;

        final AudioTrack started = activeTrack;
        cancelHangupVerify();
        hangupVerifyRunnable = () -> verifyHangupPlayback(started);
        handler.postDelayed(hangupVerifyRunnable, HANGUP_TOTAL_MS + 20L);
    }

    private void verifyHangupPlayback(AudioTrack started) {
        hangupVerifyRunnable = null;
        if (audioManager == null || started == null || activeTrack != started) {
            return;
        }
        int head = 0;
        try {
            head = started.getPlaybackHeadPosition();
        } catch (Exception ignored) {
            // treat as failure below
        }
        if (head >= HANGUP_MIN_OK_FRAMES || hangupAttemptsLeft <= 0) {
            return;
        }
        Log.w(TAG, "hangup tone truncated head=" + head + " — retrying");
        playHangupAttempt();
    }

    // Only removes the pending verify callback; the attempt counter is reset in stop().
    private void cancelHangupVerify() {
        if (hangupVerifyRunnable != null) {
            handler.removeCallbacks(hangupVerifyRunnable);
            hangupVerifyRunnable = null;
        }
    }

    private void scheduleIncomingCycle() {
        cycleRunnable = new Runnable() {
            @Override
            public void run() {
                if (activeType == null || audioManager == null) return;
                CallAudioRouting.maintainSpeakerForRing(audioManager);
                playIncomingBurst();
                handler.postDelayed(this, INCOMING_CYCLE_MS);
            }
        };
        cycleRunnable.run();
    }

    private void scheduleRingbackCycle() {
        cycleRunnable = new Runnable() {
            @Override
            public void run() {
                if (activeType == null || audioManager == null) return;
                CallAudioRouting.maintainSpeakerForRing(audioManager);
                playCachedTone(RINGBACK_BUFFER, RINGBACK_TONE_MS);
                handler.postDelayed(this, RINGBACK_CYCLE_MS);
            }
        };
        cycleRunnable.run();
    }

    private void playIncomingBurst() {
        playCachedTone(INCOMING_BURST_BUFFER, INCOMING_BURST_MS);
    }

    private void cancelPendingStop() {
        if (stopTrackRunnable != null) {
            handler.removeCallbacks(stopTrackRunnable);
            stopTrackRunnable = null;
        }
    }

    private void scheduleStopAfter(long delayMs, int generation) {
        cancelPendingStop();
        stopTrackRunnable = () -> {
            if (generation != playGeneration) {
                return;
            }
            stopActiveTrack();
        };
        handler.postDelayed(stopTrackRunnable, delayMs);
    }

    private void playCachedTone(short[] buffer, int durationMs) {
        if (audioManager == null) {
            return;
        }

        int generation = ++playGeneration;
        cancelPendingStop();
        stopActiveTrack();

        boolean wired = CallAudioRouting.isWiredHeadsetConnected(audioManager);
        if (wired || !tryPlayStatic(buffer, durationMs, generation)) {
            playCachedToneStream(buffer, durationMs, generation);
        }
    }

    private boolean tryPlayStatic(short[] buffer, int durationMs, int generation) {
        int bufferBytes = buffer.length * 2;
        AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(RING_ATTRIBUTES)
                .setAudioFormat(RING_FORMAT)
                .setBufferSizeInBytes(bufferBytes)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build();

        if (track.getState() != AudioTrack.STATE_INITIALIZED) {
            Log.w(TAG, "static AudioTrack failed");
            track.release();
            return false;
        }

        bindToSpeaker(track);
        track.setVolume(1.0f);
        activeTrack = track;
        track.write(buffer, 0, buffer.length);
        track.play();
        scheduleStopAfter(durationMs + 80L, generation);
        return true;
    }

    private void playCachedToneStream(short[] buffer, int durationMs, int generation) {
        int minBuffer = AudioTrack.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
        );
        if (minBuffer <= 0) {
            Log.e(TAG, "stream minBuffer invalid");
            return;
        }
        int bufferBytes = Math.max(buffer.length * 2, minBuffer * 2);

        AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(RING_ATTRIBUTES)
                .setAudioFormat(RING_FORMAT)
                .setBufferSizeInBytes(bufferBytes)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();

        if (track.getState() != AudioTrack.STATE_INITIALIZED) {
            Log.e(TAG, "stream AudioTrack not initialized");
            track.release();
            return;
        }

        bindToSpeaker(track);
        track.setVolume(1.0f);
        activeTrack = track;
        track.play();
        writeStreamBlocking(track, buffer);
        scheduleStopAfter(durationMs + 80L, generation);
    }

    private static void writeStreamBlocking(AudioTrack track, short[] buffer) {
        int offset = 0;
        while (offset < buffer.length) {
            int written;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                written = track.write(buffer, offset, buffer.length - offset, AudioTrack.WRITE_BLOCKING);
            } else {
                written = track.write(buffer, offset, buffer.length - offset);
            }
            if (written <= 0) {
                break;
            }
            offset += written;
        }
    }

    private void bindToSpeaker(AudioTrack track) {
        if (skipOutputBinding || audioManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }
        AudioDeviceInfo speaker = CallAudioRouting.findBuiltInSpeaker(audioManager);
        if (speaker != null) {
            track.setPreferredDevice(speaker);
        }
    }

    private static short[] buildIncomingBurstBuffer() {
        int totalSamples = SAMPLE_RATE * INCOMING_BURST_MS / 1000;
        short[] burst = new short[totalSamples];
        copyToneAt(burst, 0, INCOMING_BUFFER);
        copyToneAt(burst, SAMPLE_RATE * 450 / 1000, INCOMING_BUFFER);
        copyToneAt(burst, SAMPLE_RATE * 850 / 1000, INCOMING_BUFFER);
        return burst;
    }

    private static void copyToneAt(short[] dest, int offset, short[] tone) {
        if (offset + tone.length > dest.length) {
            return;
        }
        System.arraycopy(tone, 0, dest, offset, tone.length);
    }

    private static short[] buildDualToneBuffer(float f1, float f2, int durationMs, float amplitude) {
        int numSamples = SAMPLE_RATE * durationMs / 1000;
        short[] buffer = new short[numSamples];
        for (int i = 0; i < numSamples; i++) {
            double t = (double) i / SAMPLE_RATE;
            double sample = Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t);
            double envelope = 1.0;
            if (i < numSamples / 10) {
                envelope = (double) i / (numSamples / 10.0);
            } else if (i > numSamples * 9 / 10) {
                envelope = (double) (numSamples - i) / (numSamples / 10.0);
            }
            buffer[i] = (short) (sample * amplitude * envelope * Short.MAX_VALUE / 2.0);
        }
        return buffer;
    }

    private static short[] buildHangupBuffer() {
        int chirpSamples = SAMPLE_RATE * HANGUP_CHIRP_MS / 1000;
        int gapSamples = SAMPLE_RATE * HANGUP_GAP_MS / 1000;
        short[] chirp1 = buildChirpBuffer(480f, 320f, HANGUP_CHIRP_MS, HANGUP_AMPLITUDE);
        short[] chirp2 = buildChirpBuffer(400f, 240f, HANGUP_CHIRP_MS, HANGUP_AMPLITUDE * 0.9f);
        short[] buffer = new short[chirpSamples + gapSamples + chirpSamples];
        copyToneAt(buffer, 0, chirp1);
        copyToneAt(buffer, chirpSamples + gapSamples, chirp2);
        return buffer;
    }

    private static short[] buildChirpBuffer(float startHz, float endHz, int durationMs, float amplitude) {
        int numSamples = SAMPLE_RATE * durationMs / 1000;
        short[] buffer = new short[numSamples];
        double phase = 0;
        for (int i = 0; i < numSamples; i++) {
            double freq = startHz + (endHz - startHz) * i / numSamples;
            phase += 2 * Math.PI * freq / SAMPLE_RATE;
            double sample = Math.sin(phase);
            double envelope = 1.0;
            if (i < numSamples / 10) {
                envelope = (double) i / (numSamples / 10.0);
            } else if (i > numSamples * 9 / 10) {
                envelope = (double) (numSamples - i) / (numSamples / 10.0);
            }
            buffer[i] = (short) (sample * amplitude * envelope * Short.MAX_VALUE / 2.0);
        }
        return buffer;
    }

    private void stopActiveTrack() {
        if (activeTrack == null) return;
        try {
            if (activeTrack.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                activeTrack.stop();
            }
            activeTrack.release();
        } catch (Exception ignored) {
            // already released
        }
        activeTrack = null;
    }
}
