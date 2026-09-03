package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.widget.RemoteViews;

import java.io.InputStream;
import java.lang.reflect.Field;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Audify home-screen widget. It deliberately talks to the existing playback
 * service instead of creating a second player.
 */
public final class AudifyWidgetProvider extends AppWidgetProvider {
    // Dedicated resource: clean builds must not rely on APK-specific resource IDs.
    public static final int WIDGET_LAYOUT = R.layout.audify_widget;

    private static final String SERVICE = "com.nova.audify.AudifyPlaybackService";
    private static final String PLAYER = "com.nova.audify.NativePlayerActivity";
    private static final String HOME = "com.nova.audify.NativeHomeActivity";

    private static final String ACT_PREV = "com.nova.audify.widget.PREVIOUS";
    private static final String ACT_TOGGLE = "com.nova.audify.widget.TOGGLE";
    private static final String ACT_NEXT = "com.nova.audify.widget.NEXT";
    private static final String ACT_REFRESH = "com.nova.audify.widget.REFRESH";

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static volatile boolean tickerStarted;
    private static volatile String lastSignature = "";
    private static volatile String artworkUrl = "";
    private static volatile Bitmap artworkBitmap;

    public static void startTicker(Context context) {
        if (context == null || tickerStarted) return;
        tickerStarted = true;
        final Context app = context.getApplicationContext();
        MAIN.post(new Runnable() {
            @Override public void run() {
                try {
                    if (hasWidgets(app)) {
                        State s = readState();
                        String sig = s.signature();
                        if (!sig.equals(lastSignature)) {
                            lastSignature = sig;
                            renderAll(app, s);
                        }
                        maybeLoadArtwork(app, s.thumbnail);
                    }
                } catch (Throwable ignored) {}
                MAIN.postDelayed(this, 1500L);
            }
        });
    }

    @Override public void onEnabled(Context context) {
        super.onEnabled(context);
        startTicker(context);
        renderAll(context, readState());
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        startTicker(context);
        State s = readState();
        for (int id : ids) manager.updateAppWidget(id, buildViews(context, s, id));
        maybeLoadArtwork(context.getApplicationContext(), s.thumbnail);
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) {
        super.onAppWidgetOptionsChanged(context, manager, id, options);
        manager.updateAppWidget(id, buildViews(context, readState(), id));
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null) return;
        String a = intent.getAction();
        if (ACT_PREV.equals(a)) {
            sendPlayback(context, "com.nova.audify.PREVIOUS");
        } else if (ACT_TOGGLE.equals(a)) {
            sendPlayback(context, "com.nova.audify.TOGGLE");
        } else if (ACT_NEXT.equals(a)) {
            sendPlayback(context, "com.nova.audify.NEXT");
        } else if (ACT_REFRESH.equals(a)) {
            renderAll(context, readState());
        } else {
            return;
        }
        MAIN.postDelayed(() -> renderAll(context.getApplicationContext(), readState()), 180L);
        MAIN.postDelayed(() -> renderAll(context.getApplicationContext(), readState()), 700L);
    }

    private static boolean hasWidgets(Context c) {
        try {
            AppWidgetManager awm = AppWidgetManager.getInstance(c);
            int[] ids = awm.getAppWidgetIds(new ComponentName(c, AudifyWidgetProvider.class));
            return ids != null && ids.length > 0;
        } catch (Throwable ignored) { return false; }
    }

    private static void renderAll(Context c, State s) {
        try {
            AppWidgetManager awm = AppWidgetManager.getInstance(c);
            ComponentName cn = new ComponentName(c, AudifyWidgetProvider.class);
            int[] ids = awm.getAppWidgetIds(cn);
            if (ids == null) return;
            for (int id : ids) awm.updateAppWidget(id, buildViews(c, s, id));
        } catch (Throwable ignored) {}
    }

    private static RemoteViews buildViews(Context c, State s, int widgetId) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), WIDGET_LAYOUT);
        String title = TextUtils.isEmpty(s.title) ? "Audify" : s.title;
        String artist = TextUtils.isEmpty(s.title)
                ? "Appuyer pour écouter"
                : (TextUtils.isEmpty(s.artist) ? "Lecture en cours" : s.artist);
        rv.setTextViewText(android.R.id.text1, title);
        rv.setTextViewText(android.R.id.text2, artist);
        rv.setTextViewText(android.R.id.button1, "❮");
        rv.setTextViewText(android.R.id.button2, s.playing ? "Ⅱ" : "▶");
        rv.setTextViewText(android.R.id.button3, "❯");

        Bitmap art = artworkBitmap;
        if (art != null && !TextUtils.isEmpty(s.thumbnail) && s.thumbnail.equals(artworkUrl)) {
            rv.setImageViewBitmap(android.R.id.icon, art);
        } else {
            try {
                int icon = c.getApplicationInfo().icon;
                if (icon != 0) rv.setImageViewResource(android.R.id.icon, icon);
            } catch (Throwable ignored) {}
        }

        PendingIntent open = openPlayer(c, widgetId);
        rv.setOnClickPendingIntent(android.R.id.icon, open);
        rv.setOnClickPendingIntent(android.R.id.text1, open);
        rv.setOnClickPendingIntent(android.R.id.text2, open);
        rv.setOnClickPendingIntent(android.R.id.button1, control(c, ACT_PREV, widgetId * 10 + 1));
        rv.setOnClickPendingIntent(android.R.id.button2, control(c, ACT_TOGGLE, widgetId * 10 + 2));
        rv.setOnClickPendingIntent(android.R.id.button3, control(c, ACT_NEXT, widgetId * 10 + 3));
        return rv;
    }

    private static PendingIntent control(Context c, String action, int request) {
        Intent i = new Intent(c, AudifyWidgetProvider.class);
        i.setAction(action);
        return PendingIntent.getBroadcast(c, request, i, pendingFlags());
    }

    private static PendingIntent openPlayer(Context c, int request) {
        Intent i;
        try {
            Class<?> p = Class.forName(PLAYER);
            i = new Intent(c, p);
        } catch (Throwable e) {
            try {
                Class<?> h = Class.forName(HOME);
                i = new Intent(c, h);
            } catch (Throwable ignored) {
                i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
                if (i == null) i = new Intent();
            }
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, request + 9000, i, pendingFlags());
    }

    private static int pendingFlags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    private static void sendPlayback(Context c, String action) {
        try {
            Class<?> service = Class.forName(SERVICE);
            Intent i = new Intent(c, service);
            i.setAction(action);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Throwable ignored) {}
    }

    private static State readState() {
        State s = new State();
        try {
            Class<?> service = Class.forName(SERVICE);
            s.title = stringField(service, "snapshotTitle");
            s.artist = stringField(service, "snapshotArtist");
            s.thumbnail = stringField(service, "snapshotThumbnail");
            s.playing = boolField(service, "snapshotPlaying");
            s.videoId = stringField(service, "snapshotVideoId");
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
            return f.getBoolean(null);
        } catch (Throwable ignored) { return false; }
    }

    private static void maybeLoadArtwork(Context c, String url) {
        if (TextUtils.isEmpty(url)) return;
        if (url.equals(artworkUrl) && artworkBitmap != null) return;
        artworkUrl = url;
        IO.execute(() -> {
            Bitmap b = null;
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(7000);
                conn.setInstanceFollowRedirects(true);
                try (InputStream in = conn.getInputStream()) {
                    b = BitmapFactory.decodeStream(in);
                }
                if (b != null) {
                    int side = Math.min(b.getWidth(), b.getHeight());
                    int x = Math.max(0, (b.getWidth() - side) / 2);
                    int y = Math.max(0, (b.getHeight() - side) / 2);
                    Bitmap square = Bitmap.createBitmap(b, x, y, side, side);
                    Bitmap scaled = Bitmap.createScaledBitmap(square, 256, 256, true);
                    if (square != b) square.recycle();
                    if (b != scaled && !b.isRecycled()) b.recycle();
                    b = scaled;
                }
            } catch (Throwable ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
            if (url.equals(artworkUrl) && b != null) {
                Bitmap old = artworkBitmap;
                artworkBitmap = b;
                if (old != null && old != b && !old.isRecycled()) old.recycle();
                MAIN.post(() -> renderAll(c, readState()));
            } else if (b != null && !b.isRecycled()) {
                b.recycle();
            }
        });
    }

    private static final class State {
        String title = "";
        String artist = "";
        String thumbnail = "";
        String videoId = "";
        boolean playing;
        String signature() {
            return title + '\u0001' + artist + '\u0001' + thumbnail + '\u0001' + videoId + '\u0001' + playing;
        }
    }
}
