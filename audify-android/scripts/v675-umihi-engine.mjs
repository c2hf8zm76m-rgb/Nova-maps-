import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');

const dataSource = String.raw`package com.nova.audify;

import android.content.Context;
import android.net.Uri;

import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;

import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamExtractor;

import java.io.IOException;
import java.util.List;

/**
 * Audify's native YouTube resolver.
 *
 * ExoPlayer receives stable audifyyt:// media URIs. Only when a media item is
 * actually needed does this DataSource resolve its YouTube id into a playable
 * audio stream. This keeps the entire queue inside Media3 instead of manually
 * replacing ExoPlayer's current item for every next/previous action.
 */
@UnstableApi
public final class AudifyYoutubeDataSourceFactory implements DataSource.Factory {
    private static final String SCHEME = "audifyyt";
    private final DataSource.Factory upstream;

    public AudifyYoutubeDataSourceFactory(Context context) {
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent("AudifyAndroid/67.5")
            .setAllowCrossProtocolRedirects(true);
        upstream = new DefaultDataSource.Factory(context.getApplicationContext(), http);
    }

    @Override
    public DataSource createDataSource() {
        return new ResolvingDataSource(upstream.createDataSource(), dataSpec -> {
            Uri uri = dataSpec.uri;
            if (!SCHEME.equals(uri.getScheme())) return dataSpec;

            String videoId = uri.getLastPathSegment();
            if (videoId == null || videoId.isEmpty()) {
                throw new IOException("Identifiant YouTube manquant");
            }

            try {
                String streamUrl = resolveAudio(videoId);
                return dataSpec.withUri(Uri.parse(streamUrl));
            } catch (IOException ex) {
                throw ex;
            } catch (Throwable ex) {
                String message = ex.getMessage();
                throw new IOException(message == null ? "Impossible de résoudre le flux YouTube" : message, ex);
            }
        });
    }

    private static String resolveAudio(String videoId) throws Exception {
        String pageUrl = "https://www.youtube.com/watch?v=" + videoId;
        StreamExtractor extractor = ServiceList.YouTube.getStreamExtractor(pageUrl);
        extractor.fetchPage();
        List<AudioStream> streams = extractor.getAudioStreams();

        AudioStream best = null;
        for (AudioStream stream : streams) {
            String content = stream.getContent();
            if (content == null || content.isEmpty()) continue;
            if (best == null || stream.getAverageBitrate() > best.getAverageBitrate()) {
                best = stream;
            }
        }

        if (best == null || best.getContent() == null || best.getContent().isEmpty()) {
            throw new IOException("Aucun flux audio YouTube disponible");
        }
        return best.getContent();
    }
}
`;

const service = String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import org.json.JSONArray;
import org.json.JSONObject;
import org.schabi.newpipe.extractor.NewPipe;

import java.util.ArrayList;
import java.util.List;

/**
 * Audify V67.5 native playback engine.
 *
 * The WebView is only the UI. Playback, queue position, media controls and
 * background/lock-screen lifetime belong to this Media3 service.
 */
@UnstableApi
public class AudifyPlaybackService extends MediaSessionService {
    public static final String ACTION_LOAD = "com.nova.audify.LOAD";
    public static final String ACTION_PLAY = "com.nova.audify.PLAY";
    public static final String ACTION_PAUSE = "com.nova.audify.PAUSE";
    public static final String ACTION_TOGGLE = "com.nova.audify.TOGGLE";
    public static final String ACTION_SEEK = "com.nova.audify.SEEK";
    public static final String ACTION_SET_QUEUE = "com.nova.audify.SET_QUEUE";
    public static final String ACTION_NEXT = "com.nova.audify.NEXT";
    public static final String ACTION_PREVIOUS = "com.nova.audify.PREVIOUS";
    public static final String ACTION_REPEAT = "com.nova.audify.REPEAT";
    public static final String ACTION_VOLUME = "com.nova.audify.VOLUME";

    public static final String EXTRA_VIDEO_ID = "videoId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_THUMBNAIL = "thumbnail";
    public static final String EXTRA_SEEK_SECONDS = "seekSeconds";
    public static final String EXTRA_QUEUE_JSON = "queueJson";
    public static final String EXTRA_REPEAT = "repeat";
    public static final String EXTRA_VOLUME = "volume";

    private static volatile AudifyPlaybackService instance;
    private static volatile boolean snapshotPlaying = false;
    private static volatile boolean snapshotLoading = false;
    private static volatile String snapshotError = "";
    private static volatile String snapshotVideoId = "";
    private static volatile double snapshotPosition = 0;
    private static volatile double snapshotDuration = 0;
    private static volatile double snapshotVolume = 1.0;
    private static volatile boolean snapshotRepeatOne = false;
    private static volatile int snapshotQueueIndex = -1;
    private static volatile int snapshotQueueSize = 0;

    private ExoPlayer player;
    private MediaSession mediaSession;
    private Handler mainHandler;
    private final ArrayList<Track> queueSpec = new ArrayList<>();
    private int queueIndexHint = -1;

    private static final class Track {
        final String id;
        final String title;
        final String artist;
        final String thumbnail;

        Track(String id, String title, String artist, String thumbnail) {
            this.id = id == null ? "" : id;
            this.title = title == null || title.isEmpty() ? "Sans titre" : title;
            this.artist = artist == null || artist.isEmpty() ? "YouTube" : artist;
            this.thumbnail = thumbnail == null ? "" : thumbnail;
        }
    }

    private final Runnable stateTicker = new Runnable() {
        @Override
        public void run() {
            updateSnapshot();
            if (mainHandler != null) mainHandler.postDelayed(this, 200);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        mainHandler = new Handler(Looper.getMainLooper());
        NewPipe.init(new AudifyDownloader());

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();

        AudifyYoutubeDataSourceFactory resolvingFactory = new AudifyYoutubeDataSourceFactory(this);
        player = new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(resolvingFactory))
            .setAudioAttributes(audioAttributes, true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setHandleAudioBecomingNoisy(true)
            .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                snapshotLoading = state == Player.STATE_BUFFERING;
                if (state == Player.STATE_READY || state == Player.STATE_ENDED) snapshotLoading = false;
                updateSnapshot();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                updateSnapshot();
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                snapshotVideoId = mediaItem == null ? "" : mediaItem.mediaId;
                snapshotError = "";
                updateSnapshot();
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                snapshotLoading = false;
                snapshotError = error.getMessage() == null ? "Erreur de lecture native" : error.getMessage();
                updateSnapshot();
            }
        });

        Intent openAudify = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent sessionActivity = PendingIntent.getActivity(
            this,
            6750,
            openAudify,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession = new MediaSession.Builder(this, player)
            .setSessionActivity(sessionActivity)
            .build();

        updateSnapshot();
        mainHandler.post(stateTicker);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_SET_QUEUE.equals(action)) {
                applyQueueJson(intent.getStringExtra(EXTRA_QUEUE_JSON));
            } else if (ACTION_LOAD.equals(action)) {
                playRequested(
                    intent.getStringExtra(EXTRA_VIDEO_ID),
                    intent.getStringExtra(EXTRA_TITLE),
                    intent.getStringExtra(EXTRA_ARTIST),
                    intent.getStringExtra(EXTRA_THUMBNAIL)
                );
            } else if (ACTION_TOGGLE.equals(action)) {
                if (player != null) {
                    if (player.isPlaying()) player.pause(); else player.play();
                }
            } else if (ACTION_PLAY.equals(action)) {
                if (player != null) player.play();
            } else if (ACTION_PAUSE.equals(action)) {
                if (player != null) player.pause();
            } else if (ACTION_NEXT.equals(action)) {
                goNext();
            } else if (ACTION_PREVIOUS.equals(action)) {
                goPrevious();
            } else if (ACTION_SEEK.equals(action)) {
                double seconds = intent.getDoubleExtra(EXTRA_SEEK_SECONDS, 0);
                if (player != null) player.seekTo(Math.max(0L, (long) (seconds * 1000.0)));
            } else if (ACTION_REPEAT.equals(action)) {
                snapshotRepeatOne = intent.getBooleanExtra(EXTRA_REPEAT, false);
                if (player != null) {
                    player.setRepeatMode(snapshotRepeatOne ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
                }
            } else if (ACTION_VOLUME.equals(action)) {
                double volume = intent.getDoubleExtra(EXTRA_VOLUME, 1.0);
                if (player != null) player.setVolume((float) Math.max(0.0, Math.min(1.0, volume)));
            }
            updateSnapshot();
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private void applyQueueJson(String json) {
        if (player == null || json == null || json.isEmpty()) return;
        try {
            JSONObject root = new JSONObject(json);
            JSONArray items = root.optJSONArray("items");
            int wantedIndex = root.optInt("index", -1);
            ArrayList<Track> next = new ArrayList<>();

            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) continue;
                    String id = item.optString("id", "");
                    if (id.isEmpty()) continue;
                    next.add(new Track(
                        id,
                        item.optString("title", "Sans titre"),
                        item.optString("artist", "YouTube"),
                        item.optString("thumbnail", "")
                    ));
                }
            }

            queueIndexHint = wantedIndex >= 0 && wantedIndex < next.size() ? wantedIndex : -1;

            if (sameQueueIds(next)) {
                queueSpec.clear();
                queueSpec.addAll(next);
                updateSnapshot();
                return;
            }

            boolean wasPlaying = player.isPlaying();
            long oldPosition = Math.max(0L, player.getCurrentPosition());
            String oldId = player.getCurrentMediaItem() == null ? "" : player.getCurrentMediaItem().mediaId;
            int oldIndex = player.getCurrentMediaItemIndex();

            queueSpec.clear();
            queueSpec.addAll(next);

            List<MediaItem> nativeItems = new ArrayList<>();
            for (Track track : queueSpec) nativeItems.add(toMediaItem(track));

            if (nativeItems.isEmpty()) {
                player.clearMediaItems();
                snapshotVideoId = "";
                updateSnapshot();
                return;
            }

            int startIndex = choosePreservedIndex(oldId, oldIndex, queueIndexHint);
            long startPosition = 0L;
            if (startIndex >= 0 && startIndex < queueSpec.size() && oldId.equals(queueSpec.get(startIndex).id)) {
                startPosition = oldPosition;
            }

            player.setMediaItems(nativeItems, startIndex, startPosition);
            player.setRepeatMode(snapshotRepeatOne ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
            if (wasPlaying) {
                snapshotLoading = true;
                player.prepare();
                player.play();
            }
            updateSnapshot();
        } catch (Exception ex) {
            snapshotError = ex.getMessage() == null ? "Queue native invalide" : ex.getMessage();
            updateSnapshot();
        }
    }

    private boolean sameQueueIds(List<Track> other) {
        if (queueSpec.size() != other.size()) return false;
        for (int i = 0; i < queueSpec.size(); i++) {
            if (!queueSpec.get(i).id.equals(other.get(i).id)) return false;
        }
        return true;
    }

    private int choosePreservedIndex(String oldId, int oldIndex, int wantedIndex) {
        if (wantedIndex >= 0 && wantedIndex < queueSpec.size()) return wantedIndex;
        if (oldIndex >= 0 && oldIndex < queueSpec.size() && queueSpec.get(oldIndex).id.equals(oldId)) return oldIndex;
        for (int i = 0; i < queueSpec.size(); i++) {
            if (queueSpec.get(i).id.equals(oldId)) return i;
        }
        return 0;
    }

    private void playRequested(String videoId, String title, String artist, String thumbnail) {
        if (player == null || videoId == null || videoId.isEmpty()) return;
        snapshotError = "";

        int index = -1;
        if (queueIndexHint >= 0 && queueIndexHint < player.getMediaItemCount()) {
            MediaItem hinted = player.getMediaItemAt(queueIndexHint);
            if (videoId.equals(hinted.mediaId)) index = queueIndexHint;
        }
        if (index < 0) {
            int currentIndex = player.getCurrentMediaItemIndex();
            if (currentIndex >= 0 && currentIndex < player.getMediaItemCount()
                && videoId.equals(player.getMediaItemAt(currentIndex).mediaId)) {
                index = currentIndex;
            }
        }
        if (index < 0) {
            for (int i = 0; i < player.getMediaItemCount(); i++) {
                if (videoId.equals(player.getMediaItemAt(i).mediaId)) {
                    index = i;
                    break;
                }
            }
        }

        if (index >= 0) {
            if (player.getCurrentMediaItemIndex() != index) player.seekTo(index, 0L);
        } else {
            Track single = new Track(videoId, title, artist, thumbnail);
            queueSpec.clear();
            queueSpec.add(single);
            player.setMediaItem(toMediaItem(single));
        }

        queueIndexHint = -1;
        snapshotVideoId = videoId;
        snapshotLoading = true;
        player.setRepeatMode(snapshotRepeatOne ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        player.prepare();
        player.play();
        updateSnapshot();
    }

    private MediaItem toMediaItem(Track track) {
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist);
        if (!track.thumbnail.isEmpty()) metadata.setArtworkUri(Uri.parse(track.thumbnail));

        Uri source = Uri.parse("audifyyt://youtube/" + track.id);
        return new MediaItem.Builder()
            .setMediaId(track.id)
            .setUri(source)
            .setMediaMetadata(metadata.build())
            .build();
    }

    private void goNext() {
        if (player == null) return;
        if (player.hasNextMediaItem()) {
            snapshotLoading = true;
            player.seekToNextMediaItem();
            player.prepare();
            player.play();
        }
    }

    private void goPrevious() {
        if (player == null) return;
        if (player.hasPreviousMediaItem()) {
            snapshotLoading = true;
            player.seekToPreviousMediaItem();
            player.prepare();
            player.play();
        } else {
            player.seekTo(0L);
        }
    }

    private void updateSnapshot() {
        if (player == null) {
            snapshotPlaying = false;
            snapshotPosition = 0;
            snapshotDuration = 0;
            snapshotVolume = 1.0;
            snapshotQueueIndex = -1;
            snapshotQueueSize = 0;
            return;
        }

        snapshotPlaying = player.isPlaying();
        snapshotPosition = Math.max(0L, player.getCurrentPosition()) / 1000.0;
        long duration = player.getDuration();
        snapshotDuration = duration > 0 ? duration / 1000.0 : 0;
        snapshotVolume = player.getVolume();
        snapshotQueueIndex = player.getCurrentMediaItemIndex();
        snapshotQueueSize = player.getMediaItemCount();
        MediaItem current = player.getCurrentMediaItem();
        if (current != null) snapshotVideoId = current.mediaId;
    }

    public static String getStateJson() {
        JSONObject state = new JSONObject();
        try {
            state.put("videoId", snapshotVideoId);
            state.put("loading", snapshotLoading);
            state.put("error", snapshotError);
            state.put("repeatOne", snapshotRepeatOne);
            state.put("playing", snapshotPlaying);
            state.put("position", snapshotPosition);
            state.put("duration", snapshotDuration);
            state.put("volume", snapshotVolume);
            state.put("queueIndex", snapshotQueueIndex);
            state.put("queueSize", snapshotQueueSize);
            state.put("engine", "Media3 ExoPlayer + native YouTube resolver");
        } catch (Exception ignored) {}
        return state.toString();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (player == null || player.getMediaItemCount() == 0) stopSelf();
    }

    @Override
    public void onDestroy() {
        if (mainHandler != null) mainHandler.removeCallbacks(stateTicker);
        instance = null;
        snapshotPlaying = false;
        snapshotLoading = false;
        if (mediaSession != null) mediaSession.release();
        if (player != null) player.release();
        mediaSession = null;
        player = null;
        super.onDestroy();
    }
}
`;

await writeFile(path.join(pkgDir, 'AudifyYoutubeDataSourceFactory.java'), dataSource, 'utf8');
await writeFile(path.join(pkgDir, 'AudifyPlaybackService.java'), service, 'utf8');

const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
if (manifest.includes('android:name=".AudifyPlaybackService"') && !/AudifyPlaybackService[\s\S]{0,300}stopWithTask/.test(manifest)) {
  manifest = manifest.replace(
    'android:name=".AudifyPlaybackService"',
    'android:name=".AudifyPlaybackService"\n            android:stopWithTask="false"'
  );
}
await writeFile(manifestPath, manifest, 'utf8');

const gradlePath = path.join(android, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
if (!gradle.includes('androidx.media3:media3-datasource:1.6.1')) {
  gradle = gradle.replace(
    'implementation "androidx.media3:media3-session:1.6.1"',
    'implementation "androidx.media3:media3-session:1.6.1"\n    implementation "androidx.media3:media3-datasource:1.6.1"'
  );
}
await writeFile(gradlePath, gradle, 'utf8');

console.log('Audify Android V67.5: Media3 queue native + resolving DataSource YouTube + background service appliqués.');
