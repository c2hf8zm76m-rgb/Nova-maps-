package com.nova.audify;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;
import android.widget.Toast;

import java.lang.reflect.Field;
import java.net.URLEncoder;

/**
 * V68.12.48 - HTTPS share link -> exact Audify track.
 * Framework-only helper intentionally isolated in classes9.dex.
 */
public final class AudifyDeepLinkBridge {
    private static final String SERVICE_CLASS = "com.nova.audify.AudifyPlaybackService";
    private static final String PLAYER_CLASS = "com.nova.audify.NativePlayerActivity";
    private static final String PUBLIC_LINK = "https://raw.githack.com/c2hf8zm76m-rgb/Nova-maps-/main/audify/open.html";

    private AudifyDeepLinkBridge() {}

    public static String buildShareUrl(String videoId, String title, String artist, String thumbnail) {
        StringBuilder b = new StringBuilder(PUBLIC_LINK);
        b.append("?v=").append(enc(videoId));
        b.append("&t=").append(enc(title));
        b.append("&a=").append(enc(artist));
        if (!TextUtils.isEmpty(thumbnail)) b.append("&th=").append(enc(thumbnail));
        return b.toString();
    }

    public static boolean handle(Activity activity) {
        if (activity == null) return false;
        Intent incoming = activity.getIntent();
        if (incoming == null) return false;

        String videoId = incoming.getStringExtra("audify_video_id");
        String title = incoming.getStringExtra("audify_title");
        String artist = incoming.getStringExtra("audify_artist");
        String thumbnail = incoming.getStringExtra("audify_thumbnail");

        Uri data = incoming.getData();
        if (TextUtils.isEmpty(videoId) && data != null && "audify".equalsIgnoreCase(data.getScheme())) {
            videoId = data.getQueryParameter("v");
            title = data.getQueryParameter("t");
            artist = data.getQueryParameter("a");
            thumbnail = data.getQueryParameter("th");
        }
        if (TextUtils.isEmpty(videoId)) return false;

        // Consume immediately so a resume after the player closes does not replay the link.
        incoming.removeExtra("audify_video_id");
        incoming.removeExtra("audify_title");
        incoming.removeExtra("audify_artist");
        incoming.removeExtra("audify_thumbnail");
        incoming.setData(null);

        try {
            Class<?> service = Class.forName(SERVICE_CLASS);
            String action = staticString(service, "ACTION_PLAY", "com.nova.audify.PLAY");
            String extraVideo = staticString(service, "EXTRA_VIDEO_ID", "videoId");
            String extraTitle = staticString(service, "EXTRA_TITLE", "title");
            String extraArtist = staticString(service, "EXTRA_ARTIST", "artist");
            String extraThumb = staticString(service, "EXTRA_THUMBNAIL", "thumbnail");

            Intent play = new Intent(activity, service);
            play.setAction(action);
            play.putExtra(extraVideo, videoId);
            if (!TextUtils.isEmpty(title)) play.putExtra(extraTitle, title);
            if (!TextUtils.isEmpty(artist)) play.putExtra(extraArtist, artist);
            if (!TextUtils.isEmpty(thumbnail)) play.putExtra(extraThumb, thumbnail);

            if (Build.VERSION.SDK_INT >= 26) activity.startForegroundService(play);
            else activity.startService(play);

            final Activity a = activity;
            activity.getWindow().getDecorView().postDelayed(() -> {
                try {
                    Class<?> player = Class.forName(PLAYER_CLASS);
                    Intent openPlayer = new Intent(a, player);
                    openPlayer.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    a.startActivity(openPlayer);
                } catch (Throwable ignored) {}
            }, 180);
            Toast.makeText(activity, "Ouverture du morceau dans Audify…", Toast.LENGTH_SHORT).show();
            return true;
        } catch (Throwable ignored) {
            Toast.makeText(activity, "Audify n’a pas pu ouvrir ce morceau.", Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    public static void copyLink(Context context, String url, boolean toast) {
        if (context == null || TextUtils.isEmpty(url)) return;
        try {
            ClipboardManager cm = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Lien Audify", url));
            if (toast) Toast.makeText(context, "Lien Audify copié.", Toast.LENGTH_SHORT).show();
        } catch (Throwable ignored) {}
    }

    private static String staticString(Class<?> cls, String field, String fallback) {
        try {
            Field f = cls.getDeclaredField(field);
            f.setAccessible(true);
            Object v = f.get(null);
            String s = v == null ? "" : String.valueOf(v);
            return TextUtils.isEmpty(s) ? fallback : s;
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    private static String enc(String s) {
        try { return URLEncoder.encode(s == null ? "" : s, "UTF-8"); }
        catch (Throwable ignored) { return ""; }
    }
}
