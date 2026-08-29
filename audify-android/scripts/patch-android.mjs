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
import android.content.Intent;
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
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.addJavascriptInterface(new AudifyJsBridge(), "AudifyNative");

        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 6301);
        }
    }

    private void send(String action) {
        try { startService(new Intent(this, AudifyPlaybackService.class).setAction(action)); } catch (Exception ignored) {}
    }

    private final class AudifyJsBridge {
        @JavascriptInterface
        public void loadTrack(String json) {
            try {
                JSONObject o = new JSONObject(json);
                Intent i = new Intent(MainActivity.this, AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_LOAD)
                    .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID, o.optString("videoId", ""))
                    .putExtra(AudifyPlaybackService.EXTRA_TITLE, o.optString("title", "Audify"))
                    .putExtra(AudifyPlaybackService.EXTRA_ARTIST, o.optString("artist", ""))
                    .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL, o.optString("thumbnail", ""));
                startService(i);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface public void pause() { send(AudifyPlaybackService.ACTION_PAUSE); }
        @JavascriptInterface public void resume() { send(AudifyPlaybackService.ACTION_PLAY); }

        @JavascriptInterface
        public void seekTo(double seconds) {
            try {
                Intent i = new Intent(MainActivity.this, AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_SEEK)
                    .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS, seconds);
                startService(i);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String getState() {
            return AudifyPlaybackService.getStateJson();
        }
    }
}
`;

const downloader = String.raw`package com.nova.audify;

import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;

public final class AudifyDownloader extends Downloader {
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build();

    @Override
    public Response execute(Request request) throws IOException, ReCaptchaException {
        byte[] data = request.dataToSend();
        RequestBody body = data == null ? null : RequestBody.create((MediaType) null, data);
        okhttp3.Request.Builder builder = new okhttp3.Request.Builder()
            .url(request.url())
            .method(request.httpMethod(), body);

        for (Map.Entry<String, List<String>> entry : request.headers().entrySet()) {
            builder.removeHeader(entry.getKey());
            for (String value : entry.getValue()) builder.addHeader(entry.getKey(), value);
        }

        try (okhttp3.Response response = client.newCall(builder.build()).execute()) {
            if (response.code() == 429) {
                throw new ReCaptchaException("YouTube rate limit / reCAPTCHA", request.url());
            }
            String responseBody = response.body() == null ? "" : response.body().string();
            return new Response(
                response.code(),
                response.message(),
                response.headers().toMultimap(),
                responseBody,
                response.request().url().toString()
            );
        }
    }
}
`;

const playbackService = String.raw`package com.nova.audify;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import org.json.JSONObject;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamExtractor;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class AudifyPlaybackService extends MediaSessionService {
    public static final String ACTION_LOAD = "com.nova.audify.LOAD";
    public static final String ACTION_PLAY = "com.nova.audify.PLAY";
    public static final String ACTION_PAUSE = "com.nova.audify.PAUSE";
    public static final String ACTION_SEEK = "com.nova.audify.SEEK";
    public static final String EXTRA_VIDEO_ID = "videoId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_THUMBNAIL = "thumbnail";
    public static final String EXTRA_SEEK_SECONDS = "seekSeconds";

    private static volatile AudifyPlaybackService instance;
    private static volatile boolean loading = false;
    private static volatile String error = "";
    private static volatile String currentVideoId = "";

    private ExoPlayer player;
    private MediaSession mediaSession;
    private ExecutorService resolver;
    private Handler mainHandler;
    private final AtomicInteger generation = new AtomicInteger();

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        mainHandler = new Handler(Looper.getMainLooper());
        resolver = Executors.newSingleThreadExecutor();
        NewPipe.init(new AudifyDownloader());

        player = new ExoPlayer.Builder(this).build();
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) loading = false;
            }
            @Override public void onPlayerError(PlaybackException ex) {
                loading = false;
                error = ex.getMessage() == null ? "Playback error" : ex.getMessage();
            }
        });
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_LOAD.equals(action)) {
                String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String thumbnail = intent.getStringExtra(EXTRA_THUMBNAIL);
                if (videoId != null && !videoId.isEmpty()) resolveAndPlay(videoId, title, artist, thumbnail);
            } else if (ACTION_PLAY.equals(action)) {
                if (player != null) player.play();
            } else if (ACTION_PAUSE.equals(action)) {
                if (player != null) player.pause();
            } else if (ACTION_SEEK.equals(action)) {
                double seconds = intent.getDoubleExtra(EXTRA_SEEK_SECONDS, 0);
                if (player != null) player.seekTo(Math.max(0L, (long) (seconds * 1000.0)));
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private void resolveAndPlay(String videoId, String title, String artist, String thumbnail) {
        final int ticket = generation.incrementAndGet();
        currentVideoId = videoId;
        loading = true;
        error = "";
        if (player != null) player.pause();

        resolver.execute(() -> {
            try {
                String pageUrl = "https://www.youtube.com/watch?v=" + videoId;
                StreamExtractor extractor = ServiceList.YouTube.getStreamExtractor(pageUrl);
                extractor.fetchPage();
                List<AudioStream> streams = extractor.getAudioStreams();
                AudioStream best = null;
                for (AudioStream stream : streams) {
                    String content = stream.getContent();
                    if (content == null || content.isEmpty()) continue;
                    if (best == null || stream.getAverageBitrate() > best.getAverageBitrate()) best = stream;
                }
                if (best == null) throw new IllegalStateException("Aucun flux audio YouTube trouvé");
                String streamUrl = best.getContent();
                if (ticket != generation.get()) return;

                mainHandler.post(() -> {
                    if (ticket != generation.get() || player == null) return;
                    try {
                        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                            .setTitle(title == null || title.isEmpty() ? "Audify" : title)
                            .setArtist(artist == null ? "" : artist);
                        if (thumbnail != null && !thumbnail.isEmpty()) metadata.setArtworkUri(Uri.parse(thumbnail));
                        MediaItem item = new MediaItem.Builder()
                            .setMediaId(videoId)
                            .setUri(streamUrl)
                            .setMediaMetadata(metadata.build())
                            .build();
                        player.setMediaItem(item);
                        player.prepare();
                        player.play();
                    } catch (Exception ex) {
                        loading = false;
                        error = ex.getMessage() == null ? "Erreur lecteur natif" : ex.getMessage();
                    }
                });
            } catch (Throwable ex) {
                if (ticket != generation.get()) return;
                loading = false;
                error = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            }
        });
    }

    public static String getStateJson() {
        JSONObject o = new JSONObject();
        AudifyPlaybackService s = instance;
        try {
            o.put("videoId", currentVideoId);
            o.put("loading", loading);
            o.put("error", error);
            if (s != null && s.player != null) {
                o.put("playing", s.player.isPlaying());
                o.put("position", s.player.getCurrentPosition() / 1000.0);
                long duration = s.player.getDuration();
                o.put("duration", duration > 0 ? duration / 1000.0 : 0);
            } else {
                o.put("playing", false);
                o.put("position", 0);
                o.put("duration", 0);
            }
        } catch (Exception ignored) {}
        return o.toString();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onDestroy() {
        generation.incrementAndGet();
        instance = null;
        if (resolver != null) resolver.shutdownNow();
        if (mediaSession != null) mediaSession.release();
        if (player != null) player.release();
        mediaSession = null;
        player = null;
        super.onDestroy();
    }
}
`;

await writeFile(path.join(pkgDir, 'MainActivity.java'), mainActivity, 'utf8');
await writeFile(path.join(pkgDir, 'AudifyDownloader.java'), downloader, 'utf8');
await writeFile(path.join(pkgDir, 'AudifyPlaybackService.java'), playbackService, 'utf8');

const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
for (const perm of [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK'
]) {
  if (!manifest.includes(perm)) manifest = manifest.replace(/<manifest([^>]*)>/, m => `${m}\n    <uses-permission android:name="${perm}" />`);
}
if (!manifest.includes('AudifyPlaybackService')) {
  manifest = manifest.replace('</application>', `        <service\n            android:name=".AudifyPlaybackService"\n            android:foregroundServiceType="mediaPlayback"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="androidx.media3.session.MediaSessionService" />\n                <action android:name="android.media.browse.MediaBrowserService" />\n            </intent-filter>\n        </service>\n    </application>`);
}
await writeFile(manifestPath, manifest, 'utf8');

const rootGradlePath = path.join(android, 'build.gradle');
let rootGradle = await readFile(rootGradlePath, 'utf8');
if (!rootGradle.includes('https://jitpack.io')) {
  rootGradle = rootGradle.replace(/mavenCentral\(\)/g, "mavenCentral()\n        maven { url 'https://jitpack.io' }");
}
await writeFile(rootGradlePath, rootGradle, 'utf8');

const gradlePath = path.join(android, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
if (!gradle.includes('coreLibraryDesugaringEnabled true')) {
  gradle = gradle.replace(/android\s*\{/, `android {\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }`);
}
if (!gradle.includes('NewPipeExtractor')) {
  gradle = gradle.replace(/dependencies\s*\{/, `dependencies {\n    implementation "androidx.media3:media3-exoplayer:1.6.1"\n    implementation "androidx.media3:media3-session:1.6.1"\n    implementation "com.github.TeamNewPipe:NewPipeExtractor:v0.26.4"\n    implementation "com.squareup.okhttp3:okhttp:4.12.0"\n    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs_nio:2.1.5"`);
}
await writeFile(gradlePath, gradle, 'utf8');

console.log('Audify Android V63: NewPipeExtractor + Media3/ExoPlayer patch appliqué.');
