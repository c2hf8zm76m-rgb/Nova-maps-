package com.nova.audify;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.os.SystemClock;
import android.text.TextUtils;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Audify Stats foundation.
 *
 * Test mode uses a rolling 5-minute window so tracking can be validated
 * immediately. The long-term design is already stored in daily aggregates,
 * so switching the UI to a 7-day window later does not require redesigning
 * the tracking engine.
 *
 * Important: listened time is derived primarily from the playback service's
 * real media position, not from the phone wall clock. Changing the device
 * date therefore cannot manufacture hours of listening time.
 */
public final class AudifyStatsTracker {
    public static final long TEST_WINDOW_MS = 5L * 60L * 1000L;
    public static final long QUALIFY_PLAY_MS = 30L * 1000L;
    private static final long BUCKET_MS = 10L * 1000L;
    private static final long RAW_RETENTION_MS = 35L * 24L * 60L * 60L * 1000L;
    private static final long DAILY_RETENTION_MS = 800L * 24L * 60L * 60L * 1000L;
    private static final String SERVICE = "com.nova.audify.AudifyPlaybackService";

    private static final Object LOCK = new Object();
    private static volatile boolean started;
    private static Context app;
    private static Db db;
    private static ScheduledExecutorService timer;

    private static String activeVideoId = "";
    private static String activeTitle = "";
    private static String activeArtist = "";
    private static long activeSessionId = -1L;
    private static long activeListenedMs;
    private static boolean activeQualified;

    private static long lastMono;
    private static long lastWall;
    private static long lastPosition = -1L;
    private static long lastDuration = -1L;
    private static boolean lastPlaying;
    private static String lastVideoId = "";

    private AudifyStatsTracker() {}

    public static void start(Context context) {
        if (context == null || started) return;
        synchronized (LOCK) {
            if (started) return;
            app = context.getApplicationContext();
            db = new Db(app);
            started = true;
            timer = Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "AudifyStats");
                t.setDaemon(true);
                return t;
            });
            timer.scheduleAtFixedRate(() -> {
                try { tick(); } catch (Throwable ignored) {}
            }, 250L, 1000L, TimeUnit.MILLISECONDS);
            timer.scheduleAtFixedRate(() -> {
                try { prune(); } catch (Throwable ignored) {}
            }, 2L, 6L, TimeUnit.HOURS);
        }
    }

    private static void tick() {
        if (!started || db == null) return;
        State s = readState();
        final long nowMono = SystemClock.elapsedRealtime();
        final long nowWall = System.currentTimeMillis();

        synchronized (LOCK) {
            if (lastMono == 0L) {
                lastMono = nowMono;
                lastWall = nowWall;
                lastPosition = s.position;
                lastDuration = s.duration;
                lastPlaying = s.playing;
                lastVideoId = s.videoId;
                if (!TextUtils.isEmpty(s.videoId)) beginSession(s, nowWall);
                return;
            }

            boolean newTrack = !TextUtils.equals(activeVideoId, s.videoId);
            boolean repeatedSameTrack = false;
            if (!newTrack && !TextUtils.isEmpty(s.videoId) && lastPosition >= 0 && s.position >= 0) {
                long dur = s.duration > 0 ? s.duration : lastDuration;
                repeatedSameTrack = dur > 0
                        && lastPosition >= Math.max(15000L, dur - 7000L)
                        && s.position <= 5000L
                        && lastPosition - s.position > 10000L;
            }

            if (newTrack || repeatedSameTrack) {
                finishSession(nowWall);
                if (!TextUtils.isEmpty(s.videoId)) beginSession(s, nowWall);
                lastMono = nowMono;
                lastWall = nowWall;
                lastPosition = s.position;
                lastDuration = s.duration;
                lastPlaying = s.playing;
                lastVideoId = s.videoId;
                return;
            }

            if (!TextUtils.isEmpty(activeVideoId)) {
                if (!TextUtils.isEmpty(s.title)) activeTitle = s.title;
                if (!TextUtils.isEmpty(s.artist)) activeArtist = s.artist;

                long elapsed = Math.max(0L, nowMono - lastMono);
                long listened = estimateListenedDelta(s, elapsed);
                if (listened > 0L) {
                    long span = Math.max(1L, Math.min(elapsed, Math.max(listened, 1000L) + 2500L));
                    long intervalStartWall = nowWall - span;
                    persistListened(intervalStartWall, nowWall, listened, activeVideoId, activeTitle, activeArtist);
                    activeListenedMs += listened;
                    if (!activeQualified && activeListenedMs >= QUALIFY_PLAY_MS) {
                        activeQualified = true;
                        markQualified(nowWall);
                    }
                    updateSession(nowWall);
                } else if (activeSessionId > 0 && nowWall - lastWall >= 5000L) {
                    updateSession(nowWall);
                }
            }

            lastMono = nowMono;
            lastWall = nowWall;
            lastPosition = s.position;
            lastDuration = s.duration;
            lastPlaying = s.playing;
            lastVideoId = s.videoId;
        }
    }

    private static long estimateListenedDelta(State s, long elapsed) {
        if (elapsed <= 0L || lastPosition < 0L || s.position < 0L) return 0L;
        long posDelta = s.position - lastPosition;

        // Normal playback, including long gaps while the screen is locked.
        if (posDelta > 0L && posDelta <= elapsed + 3000L) {
            return Math.min(posDelta, elapsed + 1000L);
        }

        // A large positive jump is a seek. Count only the real time that could
        // have elapsed, never the skipped media position.
        if (posDelta > elapsed + 3000L) {
            return (lastPlaying || s.playing) ? Math.min(elapsed, 1200L) : 0L;
        }

        // A negative jump is normally a seek backwards. The playback time
        // elapsed during the sampling interval can still count, but we cap it.
        if (posDelta < -1500L) {
            return (lastPlaying || s.playing) ? Math.min(elapsed, 1200L) : 0L;
        }

        // If media position did not move, it was paused/buffering: no listen time.
        return 0L;
    }

    private static void beginSession(State s, long nowWall) {
        activeVideoId = empty(s.videoId);
        activeTitle = empty(s.title);
        activeArtist = empty(s.artist);
        activeListenedMs = 0L;
        activeQualified = false;
        activeSessionId = -1L;
        try {
            SQLiteDatabase w = db.getWritableDatabase();
            ContentValues cv = new ContentValues();
            cv.put("video_id", activeVideoId);
            cv.put("title", activeTitle);
            cv.put("artist", activeArtist);
            cv.put("started_at", nowWall);
            cv.put("last_at", nowWall);
            cv.put("listened_ms", 0L);
            cv.put("qualified", 0);
            cv.putNull("qualified_at");
            activeSessionId = w.insert("play_sessions", null, cv);
        } catch (Throwable ignored) {}
    }

    private static void finishSession(long nowWall) {
        if (activeSessionId > 0L) updateSession(nowWall);
        activeVideoId = "";
        activeTitle = "";
        activeArtist = "";
        activeSessionId = -1L;
        activeListenedMs = 0L;
        activeQualified = false;
    }

    private static void updateSession(long nowWall) {
        if (activeSessionId <= 0L) return;
        try {
            ContentValues cv = new ContentValues();
            cv.put("title", activeTitle);
            cv.put("artist", activeArtist);
            cv.put("last_at", nowWall);
            cv.put("listened_ms", activeListenedMs);
            cv.put("qualified", activeQualified ? 1 : 0);
            db.getWritableDatabase().update("play_sessions", cv, "id=?", new String[]{String.valueOf(activeSessionId)});
        } catch (Throwable ignored) {}
    }

    private static void markQualified(long nowWall) {
        if (activeSessionId <= 0L) return;
        try {
            ContentValues cv = new ContentValues();
            cv.put("qualified", 1);
            cv.put("qualified_at", nowWall);
            cv.put("listened_ms", activeListenedMs);
            db.getWritableDatabase().update("play_sessions", cv, "id=?", new String[]{String.valueOf(activeSessionId)});

            long day = dayStart(nowWall);
            upsertDailyPlay(day, activeVideoId, activeTitle, activeArtist);
        } catch (Throwable ignored) {}
    }

    private static void persistListened(long startWall, long endWall, long listenedMs,
                                         String videoId, String title, String artist) {
        if (listenedMs <= 0L || endWall <= startWall) return;
        SQLiteDatabase w = db.getWritableDatabase();
        w.beginTransaction();
        try {
            long span = endWall - startWall;
            long cursor = startWall;
            long assigned = 0L;
            while (cursor < endWall) {
                long bucketStart = (cursor / BUCKET_MS) * BUCKET_MS;
                long bucketEnd = bucketStart + BUCKET_MS;
                long pieceEnd = Math.min(endWall, bucketEnd);
                long overlap = Math.max(1L, pieceEnd - cursor);
                long piece;
                if (pieceEnd >= endWall) {
                    piece = listenedMs - assigned;
                } else {
                    piece = Math.max(0L, Math.round((double) listenedMs * (double) overlap / (double) span));
                    assigned += piece;
                }
                if (piece > 0L) {
                    upsertBucket(w, bucketStart, videoId, title, artist, piece);
                    upsertDailyTime(w, dayStart(bucketStart), videoId, title, artist, piece);
                }
                cursor = pieceEnd;
            }
            w.setTransactionSuccessful();
        } finally {
            w.endTransaction();
        }
    }

    private static void upsertBucket(SQLiteDatabase w, long bucketStart, String videoId,
                                     String title, String artist, long ms) {
        w.execSQL("INSERT INTO listening_buckets(bucket_start,video_id,title,artist,listened_ms) VALUES(?,?,?,?,?) " +
                        "ON CONFLICT(bucket_start,video_id) DO UPDATE SET title=excluded.title, artist=excluded.artist, listened_ms=listened_ms+excluded.listened_ms",
                new Object[]{bucketStart, videoId, title, artist, ms});
    }

    private static void upsertDailyTime(SQLiteDatabase w, long dayStart, String videoId,
                                        String title, String artist, long ms) {
        w.execSQL("INSERT INTO daily_track(day_start,video_id,title,artist,listened_ms,play_count) VALUES(?,?,?,?,?,0) " +
                        "ON CONFLICT(day_start,video_id) DO UPDATE SET title=excluded.title, artist=excluded.artist, listened_ms=listened_ms+excluded.listened_ms",
                new Object[]{dayStart, videoId, title, artist, ms});
    }

    private static void upsertDailyPlay(long dayStart, String videoId, String title, String artist) {
        SQLiteDatabase w = db.getWritableDatabase();
        w.execSQL("INSERT INTO daily_track(day_start,video_id,title,artist,listened_ms,play_count) VALUES(?,?,?,?,0,1) " +
                        "ON CONFLICT(day_start,video_id) DO UPDATE SET title=excluded.title, artist=excluded.artist, play_count=play_count+1",
                new Object[]{dayStart, videoId, title, artist});
    }

    public static Snapshot snapshot() {
        Context c = app;
        if (c == null || db == null) return new Snapshot();
        synchronized (LOCK) {
            final long now = System.currentTimeMillis();
            final long from = now - TEST_WINDOW_MS;
            final long queryFrom = ((from / BUCKET_MS) * BUCKET_MS);
            Snapshot out = new Snapshot();
            out.windowMs = TEST_WINDOW_MS;
            out.generatedAt = now;
            out.mode = "MODE TEST · 5 MIN";
            State state = readState();
            out.currentTitle = state.title;
            out.currentArtist = state.artist;
            out.currentPlaying = state.playing;

            SQLiteDatabase r = db.getReadableDatabase();
            Cursor cur = null;
            try {
                cur = r.rawQuery("SELECT COALESCE(SUM(listened_ms),0), COUNT(DISTINCT CASE WHEN video_id<>'' THEN video_id END), COUNT(DISTINCT CASE WHEN artist<>'' THEN artist END) FROM listening_buckets WHERE bucket_start>=?",
                        new String[]{String.valueOf(queryFrom)});
                if (cur.moveToFirst()) {
                    out.listenedMs = cur.getLong(0);
                    out.uniqueTracks = cur.getInt(1);
                    out.uniqueArtists = cur.getInt(2);
                }
            } finally { if (cur != null) cur.close(); }

            try {
                cur = r.rawQuery("SELECT COUNT(*) FROM play_sessions WHERE qualified=1 AND qualified_at>=?",
                        new String[]{String.valueOf(from)});
                if (cur.moveToFirst()) out.playCount = cur.getInt(0);
            } finally { if (cur != null) cur.close(); }

            try {
                cur = r.rawQuery("SELECT artist, SUM(listened_ms) AS total FROM listening_buckets WHERE bucket_start>=? AND artist<>'' GROUP BY artist ORDER BY total DESC LIMIT 5",
                        new String[]{String.valueOf(queryFrom)});
                while (cur.moveToNext()) out.topArtists.add(new Rank(cur.getString(0), "", cur.getLong(1)));
            } finally { if (cur != null) cur.close(); }

            try {
                cur = r.rawQuery("SELECT title, artist, SUM(listened_ms) AS total FROM listening_buckets WHERE bucket_start>=? AND video_id<>'' GROUP BY video_id,title,artist ORDER BY total DESC LIMIT 5",
                        new String[]{String.valueOf(queryFrom)});
                while (cur.moveToNext()) out.topTracks.add(new Rank(cur.getString(0), cur.getString(1), cur.getLong(2)));
            } finally { if (cur != null) cur.close(); }
            return out;
        }
    }

    public static void resetTestData() {
        if (db == null) return;
        synchronized (LOCK) {
            try {
                SQLiteDatabase w = db.getWritableDatabase();
                w.beginTransaction();
                try {
                    w.delete("listening_buckets", null, null);
                    w.delete("play_sessions", null, null);
                    w.delete("daily_track", null, null);
                    w.setTransactionSuccessful();
                } finally { w.endTransaction(); }
            } catch (Throwable ignored) {}
            activeVideoId = "";
            activeTitle = "";
            activeArtist = "";
            activeSessionId = -1L;
            activeListenedMs = 0L;
            activeQualified = false;
            lastMono = 0L;
            lastWall = 0L;
            lastPosition = -1L;
            lastDuration = -1L;
            lastPlaying = false;
            lastVideoId = "";
        }
    }

    private static void prune() {
        if (db == null) return;
        long now = System.currentTimeMillis();
        SQLiteDatabase w = db.getWritableDatabase();
        w.delete("listening_buckets", "bucket_start<?", new String[]{String.valueOf(now - RAW_RETENTION_MS)});
        w.delete("play_sessions", "started_at<?", new String[]{String.valueOf(now - RAW_RETENTION_MS)});
        w.delete("daily_track", "day_start<?", new String[]{String.valueOf(now - DAILY_RETENTION_MS)});
    }

    private static State readState() {
        State s = new State();
        try {
            Class<?> cls = Class.forName(SERVICE);
            s.videoId = stringField(cls, "snapshotVideoId");
            s.title = stringField(cls, "snapshotTitle");
            s.artist = stringField(cls, "snapshotArtist");
            s.playing = boolField(cls, "snapshotPlaying");
            s.position = longField(cls, "snapshotPosition", -1L);
            s.duration = longField(cls, "snapshotDuration", -1L);
        } catch (Throwable ignored) {}
        return s;
    }

    private static String stringField(Class<?> cls, String name) {
        try {
            Field f = cls.getDeclaredField(name);
            f.setAccessible(true);
            Object v = f.get(null);
            return v == null ? "" : String.valueOf(v);
        } catch (Throwable ignored) { return ""; }
    }

    private static boolean boolField(Class<?> cls, String name) {
        try {
            Field f = cls.getDeclaredField(name);
            f.setAccessible(true);
            Object v = f.get(null);
            return v instanceof Boolean ? (Boolean) v : f.getBoolean(null);
        } catch (Throwable ignored) { return false; }
    }

    private static long longField(Class<?> cls, String name, long fallback) {
        try {
            Field f = cls.getDeclaredField(name);
            f.setAccessible(true);
            Object v = f.get(null);
            if (v instanceof Double || v instanceof Float) {
                return Math.round(((Number) v).doubleValue() * 1000.0);
            }
            return v instanceof Number ? ((Number) v).longValue() : fallback;
        } catch (Throwable ignored) { return fallback; }
    }

    private static long dayStart(long wallMs) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTimeInMillis(wallMs);
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    private static String empty(String s) { return s == null ? "" : s; }

    private static final class State {
        String videoId = "";
        String title = "";
        String artist = "";
        boolean playing;
        long position = -1L;
        long duration = -1L;
    }

    public static final class Rank {
        public final String name;
        public final String secondary;
        public final long listenedMs;
        Rank(String name, String secondary, long listenedMs) {
            this.name = name == null ? "" : name;
            this.secondary = secondary == null ? "" : secondary;
            this.listenedMs = listenedMs;
        }
    }

    public static final class Snapshot {
        public String mode = "MODE TEST · 5 MIN";
        public long windowMs = TEST_WINDOW_MS;
        public long generatedAt;
        public long listenedMs;
        public int playCount;
        public int uniqueTracks;
        public int uniqueArtists;
        public boolean currentPlaying;
        public String currentTitle = "";
        public String currentArtist = "";
        public final List<Rank> topArtists = new ArrayList<>();
        public final List<Rank> topTracks = new ArrayList<>();
    }

    private static final class Db extends SQLiteOpenHelper {
        Db(Context c) { super(c, "audify_stats.db", null, 1); }

        @Override public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE IF NOT EXISTS listening_buckets (bucket_start INTEGER NOT NULL, video_id TEXT NOT NULL, title TEXT, artist TEXT, listened_ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(bucket_start,video_id))");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_buckets_time ON listening_buckets(bucket_start)");
            db.execSQL("CREATE TABLE IF NOT EXISTS play_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT, title TEXT, artist TEXT, started_at INTEGER NOT NULL, last_at INTEGER NOT NULL, listened_ms INTEGER NOT NULL DEFAULT 0, qualified INTEGER NOT NULL DEFAULT 0, qualified_at INTEGER)");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_sessions_qualified ON play_sessions(qualified_at)");
            db.execSQL("CREATE TABLE IF NOT EXISTS daily_track (day_start INTEGER NOT NULL, video_id TEXT NOT NULL, title TEXT, artist TEXT, listened_ms INTEGER NOT NULL DEFAULT 0, play_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day_start,video_id))");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_daily_time ON daily_track(day_start)");
        }

        @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
    }
}
