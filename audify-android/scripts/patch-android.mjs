import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
await mkdir(pkgDir, { recursive: true });

const mainActivity = String.raw`package com.nova.audify;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    public static final String ACTION_NATIVE_CONTROL = "com.nova.audify.NATIVE_CONTROL";
    public static final String EXTRA_COMMAND = "command";
    private BroadcastReceiver mediaReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.addJavascriptInterface(new AudifyJsBridge(), "AudifyNative");

        mediaReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String command = intent.getStringExtra(EXTRA_COMMAND);
                if (command == null) return;
                runOnUiThread(() -> runJsCommand(command));
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_NATIVE_CONTROL);
        ContextCompat.registerReceiver(this, mediaReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);

        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 6201);
        }
    }

    private void runJsCommand(String command) {
        String method;
        switch (command) {
            case "play": method = "play"; break;
            case "pause": method = "pause"; break;
            case "next": method = "next"; break;
            case "previous": method = "previous"; break;
            default: return;
        }
        String js = "window.AudifyNativeControl&&window.AudifyNativeControl." + method + "&&window.AudifyNativeControl." + method + "();";
        getBridge().getWebView().evaluateJavascript(js, null);
    }

    private final class AudifyJsBridge {
        @JavascriptInterface
        public void updateState(String json) {
            runOnUiThread(() -> {
                try {
                    JSONObject o = new JSONObject(json);
                    boolean playing = o.optBoolean("playing", false);
                    Intent i = new Intent(MainActivity.this, AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_STATE)
                        .putExtra(AudifyPlaybackService.EXTRA_TITLE, o.optString("title", "Audify"))
                        .putExtra(AudifyPlaybackService.EXTRA_ARTIST, o.optString("artist", ""))
                        .putExtra(AudifyPlaybackService.EXTRA_PLAYING, playing)
                        .putExtra(AudifyPlaybackService.EXTRA_POSITION, o.optDouble("currentTime", 0))
                        .putExtra(AudifyPlaybackService.EXTRA_DURATION, o.optDouble("duration", 0));
                    if (playing) {
                        ContextCompat.startForegroundService(MainActivity.this, i);
                    } else {
                        try { startService(i); } catch (Exception ignored) {}
                    }
                } catch (Exception ignored) {}
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (mediaReceiver != null) {
            try { unregisterReceiver(mediaReceiver); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
`;

const playbackService = String.raw`package com.nova.audify;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;
import androidx.media.session.MediaSessionCompat;
import androidx.media.session.PlaybackStateCompat;

public class AudifyPlaybackService extends Service {
    public static final String CHANNEL_ID = "audify_playback";
    public static final int NOTIFICATION_ID = 6201;
    public static final String ACTION_STATE = "com.nova.audify.STATE";
    public static final String ACTION_PLAY = "com.nova.audify.PLAY";
    public static final String ACTION_PAUSE = "com.nova.audify.PAUSE";
    public static final String ACTION_NEXT = "com.nova.audify.NEXT";
    public static final String ACTION_PREVIOUS = "com.nova.audify.PREVIOUS";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_DURATION = "duration";

    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;
    private String title = "Audify";
    private String artist = "";
    private boolean playing = false;
    private long positionMs = 0;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        mediaSession = new MediaSessionCompat(this, "AudifySession");
        mediaSession.setActive(true);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { command("play"); setPlaying(true); }
            @Override public void onPause() { command("pause"); setPlaying(false); }
            @Override public void onSkipToNext() { command("next"); }
            @Override public void onSkipToPrevious() { command("previous"); }
        });
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Audify:BackgroundPlayback");
        wakeLock.setReferenceCounted(false);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STATE.equals(action)) {
                title = intent.getStringExtra(EXTRA_TITLE);
                artist = intent.getStringExtra(EXTRA_ARTIST);
                positionMs = (long) (intent.getDoubleExtra(EXTRA_POSITION, 0) * 1000.0);
                setPlaying(intent.getBooleanExtra(EXTRA_PLAYING, false));
            } else if (ACTION_PLAY.equals(action)) {
                command("play"); setPlaying(true);
            } else if (ACTION_PAUSE.equals(action)) {
                command("pause"); setPlaying(false);
            } else if (ACTION_NEXT.equals(action)) {
                command("next");
            } else if (ACTION_PREVIOUS.equals(action)) {
                command("previous");
            } else {
                MediaButtonReceiver.handleIntent(mediaSession, intent);
            }
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    private void setPlaying(boolean value) {
        playing = value;
        if (playing) {
            if (!wakeLock.isHeld()) wakeLock.acquire();
        } else if (wakeLock.isHeld()) {
            wakeLock.release();
        }
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE |
            PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
        int state = playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, playing ? 1f : 0f)
            .build());
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private void command(String command) {
        Intent out = new Intent(MainActivity.ACTION_NATIVE_CONTROL)
            .setPackage(getPackageName())
            .putExtra(MainActivity.EXTRA_COMMAND, command);
        sendBroadcast(out);
    }

    private PendingIntent actionIntent(String action, int requestCode) {
        Intent i = new Intent(this, AudifyPlaybackService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int playIcon = playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playAction = playing ? ACTION_PAUSE : ACTION_PLAY;
        String playLabel = playing ? "Pause" : "Lecture";
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title == null || title.isEmpty() ? "Audify" : title)
            .setContentText(artist == null ? "" : artist)
            .setContentIntent(content)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Précédent", actionIntent(ACTION_PREVIOUS, 1))
            .addAction(playIcon, playLabel, actionIntent(playAction, 2))
            .addAction(android.R.drawable.ic_media_next, "Suivant", actionIntent(ACTION_NEXT, 3))
            .setStyle(new MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0,1,2))
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Lecture Audify", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Lecture audio Audify en arrière-plan");
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(channel);
        }
    }

    @Override public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); }
        super.onDestroy();
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
`;

await writeFile(path.join(pkgDir, 'MainActivity.java'), mainActivity, 'utf8');
await writeFile(path.join(pkgDir, 'AudifyPlaybackService.java'), playbackService, 'utf8');

const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
const permissions = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK'
];
for (const perm of permissions) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace(/<manifest([^>]*)>/, (m) => `${m}\n    <uses-permission android:name="${perm}" />`);
  }
}
if (!manifest.includes('AudifyPlaybackService')) {
  manifest = manifest.replace('</application>', `        <service\n            android:name=".AudifyPlaybackService"\n            android:exported="false"\n            android:foregroundServiceType="mediaPlayback" />\n    </application>`);
}
await writeFile(manifestPath, manifest, 'utf8');

const gradlePath = path.join(android, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
if (!gradle.includes('androidx.media:media')) {
  gradle = gradle.replace(/dependencies\s*\{/, 'dependencies {\n    implementation "androidx.media:media:1.7.0"');
}
await writeFile(gradlePath, gradle, 'utf8');

console.log('Patch Android Audify background WebView appliqué.');
