package com.nova.audify;

import android.app.Activity;
import android.app.Application;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * V68.12.47 - isolated sharing overlay.
 * This provider is intentionally framework-only and lives in classes9.dex so the
 * validated Audify classes.dex..classes8.dex can remain byte-for-byte unchanged.
 */
public final class AudifyShareBootstrapProvider extends ContentProvider {
    private static final String PLAYER_CLASS = "com.nova.audify.NativePlayerActivity";
    private static final String SERVICE_CLASS = "com.nova.audify.AudifyPlaybackService";
    private static final String FILE_AUTHORITY = "com.nova.audify.fileprovider";
    private static final String SHARE_TAG = "AUDIFY_SHARE_V681247";

    @Override public boolean onCreate() {
        Context c = getContext();
        if (c == null) return true;
        Context app = c.getApplicationContext();
        if (app instanceof Application) {
            ((Application) app).registerActivityLifecycleCallbacks(new ShareLifecycle());
        }
        return true;
    }

    private static final class ShareLifecycle implements Application.ActivityLifecycleCallbacks {
        @Override public void onActivityResumed(Activity activity) {
            if (activity == null || !PLAYER_CLASS.equals(activity.getClass().getName())) return;
            try { installShareButton(activity); } catch (Throwable ignored) {}
        }
        @Override public void onActivityCreated(Activity a, Bundle b) {}
        @Override public void onActivityStarted(Activity a) {}
        @Override public void onActivityPaused(Activity a) {}
        @Override public void onActivityStopped(Activity a) {}
        @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
        @Override public void onActivityDestroyed(Activity a) {}
    }

    private static void installShareButton(final Activity activity) {
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        ViewGroup root = (ViewGroup) content;
        if (root.findViewWithTag(SHARE_TAG) != null) return;

        TextView share = new TextView(activity);
        share.setTag(SHARE_TAG);
        share.setText("↗");
        share.setTextColor(Color.WHITE);
        share.setTextSize(25f);
        share.setGravity(Gravity.CENTER);
        share.setContentDescription("Partager ce morceau");
        share.setElevation(dp(activity, 10));
        share.setPadding(0, 0, 0, dp(activity, 2));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.argb(218, 15, 20, 28));
        bg.setStroke(dp(activity, 1), Color.argb(220, 168, 255, 63));
        share.setBackground(bg);
        share.setOnClickListener(v -> showShareMenu(activity));

        if (root instanceof FrameLayout) {
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(activity, 50), dp(activity, 50), Gravity.TOP | Gravity.END);
            lp.topMargin = dp(activity, 76);
            lp.rightMargin = dp(activity, 16);
            ((FrameLayout) root).addView(share, lp);
        } else {
            FrameLayout overlay = new FrameLayout(activity);
            root.addView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(activity, 50), dp(activity, 50), Gravity.TOP | Gravity.END);
            lp.topMargin = dp(activity, 76);
            lp.rightMargin = dp(activity, 16);
            overlay.addView(share, lp);
        }
    }

    private static void showShareMenu(final Activity activity) {
        final TrackInfo info = readTrackInfo();
        if (info == null || TextUtils.isEmpty(info.title)) {
            Toast.makeText(activity, "Lance un morceau avant de le partager.", Toast.LENGTH_SHORT).show();
            return;
        }

        final Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(activity, 22), dp(activity, 20), dp(activity, 22), dp(activity, 18));
        GradientDrawable panelBg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(20, 25, 35), Color.rgb(9, 12, 18)}
        );
        panelBg.setCornerRadius(dp(activity, 28));
        panelBg.setStroke(dp(activity, 1), Color.argb(175, 168, 255, 63));
        panel.setBackground(panelBg);

        TextView eyebrow = text(activity, "AUDIFY · PARTAGER", 12, Color.rgb(168, 255, 63), true);
        panel.addView(eyebrow, fullWrap());
        TextView title = text(activity, info.title, 23, Color.WHITE, true);
        LinearLayout.LayoutParams tlp = fullWrap(); tlp.topMargin = dp(activity, 8);
        panel.addView(title, tlp);
        TextView artist = text(activity, emptyTo(info.artist, "Artiste inconnu"), 15, Color.rgb(175, 184, 199), false);
        LinearLayout.LayoutParams alp = fullWrap(); alp.topMargin = dp(activity, 3); alp.bottomMargin = dp(activity, 14);
        panel.addView(artist, alp);

        panel.addView(menuButton(activity, "Snapchat", "Partager une carte Audify dans Snapchat", () -> {
            dialog.dismiss(); prepareAndShare(activity, info, Target.SNAPCHAT);
        }), fullWrap());
        panel.addView(menuButton(activity, "Instagram Story", "Créer une Story avec la carte Audify", () -> {
            dialog.dismiss(); prepareAndShare(activity, info, Target.INSTAGRAM_STORY);
        }), spacedWrap(activity));
        panel.addView(menuButton(activity, "Plus d’applications", "WhatsApp, Messages et autres applications", () -> {
            dialog.dismiss(); prepareAndShare(activity, info, Target.GENERIC);
        }), spacedWrap(activity));
        panel.addView(menuButton(activity, "Copier le texte", "Copier le titre et l’artiste", () -> {
            copyShareText(activity, info);
            dialog.dismiss();
        }), spacedWrap(activity));

        dialog.setContentView(panel);
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawableResource(android.R.color.transparent);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams p = new WindowManager.LayoutParams();
            p.copyFrom(w.getAttributes());
            p.width = Math.min(activity.getResources().getDisplayMetrics().widthPixels - dp(activity, 26), dp(activity, 430));
            p.height = WindowManager.LayoutParams.WRAP_CONTENT;
            p.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            p.dimAmount = 0.72f;
            p.y = dp(activity, 18);
            w.setAttributes(p);
        }
        dialog.show();
    }

    private enum Target { SNAPCHAT, INSTAGRAM_STORY, GENERIC }

    private static void prepareAndShare(final Activity activity, final TrackInfo info, final Target target) {
        Toast.makeText(activity, "Préparation de la carte Audify…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                File image = renderShareCard(activity, info);
                activity.runOnUiThread(() -> launchShare(activity, info, image, target));
            } catch (Throwable e) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "Impossible de préparer le partage.", Toast.LENGTH_SHORT).show());
            }
        }, "AudifyShareCard").start();
    }

    private static void launchShare(Activity activity, TrackInfo info, File image, Target target) {
        Uri uri = fileProviderUri(activity, image);
        if (uri == null) {
            Toast.makeText(activity, "Impossible d’ouvrir la carte de partage.", Toast.LENGTH_SHORT).show();
            return;
        }
        String caption = "🎧 J’écoute " + info.title + (TextUtils.isEmpty(info.artist) ? "" : " — " + info.artist) + " sur Audify";
        try {
            if (target == Target.INSTAGRAM_STORY) {
                Intent story = new Intent("com.instagram.share.ADD_TO_STORY");
                story.setDataAndType(uri, "image/png");
                story.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                story.setPackage("com.instagram.android");
                activity.grantUriPermission("com.instagram.android", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(story);
                return;
            }

            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TEXT, caption);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            send.setClipData(ClipData.newRawUri("Audify", uri));
            if (target == Target.SNAPCHAT) {
                send.setPackage("com.snapchat.android");
                activity.grantUriPermission("com.snapchat.android", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    activity.startActivity(send);
                    return;
                } catch (ActivityNotFoundException ignored) {
                    send.setPackage(null);
                }
            }
            activity.startActivity(Intent.createChooser(send, "Partager depuis Audify"));
        } catch (ActivityNotFoundException e) {
            Intent fallback = new Intent(Intent.ACTION_SEND);
            fallback.setType("image/png");
            fallback.putExtra(Intent.EXTRA_STREAM, uri);
            fallback.putExtra(Intent.EXTRA_TEXT, caption);
            fallback.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            fallback.setClipData(ClipData.newRawUri("Audify", uri));
            activity.startActivity(Intent.createChooser(fallback, "Partager depuis Audify"));
        } catch (Throwable e) {
            Toast.makeText(activity, "Cette application n’accepte pas encore ce partage.", Toast.LENGTH_SHORT).show();
        }
    }

    private static Uri fileProviderUri(Context context, File file) {
        try {
            Class<?> fp = Class.forName("androidx.core.content.FileProvider");
            Method m = fp.getMethod("getUriForFile", Context.class, String.class, File.class);
            Object out = m.invoke(null, context, FILE_AUTHORITY, file);
            return out instanceof Uri ? (Uri) out : null;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static File renderShareCard(Context context, TrackInfo info) throws Exception {
        final int W = 1080, H = 1920;
        Bitmap out = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);

        p.setShader(new LinearGradient(0, 0, W, H,
            new int[]{Color.rgb(5, 8, 14), Color.rgb(17, 8, 34), Color.rgb(3, 19, 20), Color.rgb(2, 5, 9)},
            new float[]{0f, .42f, .72f, 1f}, Shader.TileMode.CLAMP));
        c.drawRect(0, 0, W, H, p);
        p.setShader(new RadialGradient(875, 520, 620, Color.argb(135, 120, 0, 255), Color.TRANSPARENT, Shader.TileMode.CLAMP));
        c.drawCircle(875, 520, 620, p);
        p.setShader(new RadialGradient(160, 1480, 560, Color.argb(120, 150, 255, 45), Color.TRANSPARENT, Shader.TileMode.CLAMP));
        c.drawCircle(160, 1480, 560, p);
        p.setShader(null);

        p.setColor(Color.argb(85, 255, 255, 255));
        for (int i = 0; i < 28; i++) {
            float x = (i * 193) % W;
            float y = 130 + ((i * 317) % 1580);
            float r = 2 + (i % 4);
            c.drawCircle(x, y, r, p);
        }

        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        p.setTextSize(62);
        p.setColor(Color.WHITE);
        c.drawText("AUDIFY", 92, 150, p);
        p.setTextSize(25);
        p.setColor(Color.rgb(168, 255, 63));
        c.drawText("NOW PLAYING · PARTAGE", 94, 205, p);

        RectF card = new RectF(70, 285, W - 70, 1275);
        p.setColor(Color.argb(155, 13, 17, 27));
        p.setStyle(Paint.Style.FILL);
        c.drawRoundRect(card, 52, 52, p);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(3);
        p.setColor(Color.argb(170, 178, 90, 255));
        c.drawRoundRect(card, 52, 52, p);
        p.setStyle(Paint.Style.FILL);

        RectF coverRect = new RectF(135, 355, W - 135, 1165);
        Bitmap cover = downloadCover(info.thumbnail);
        if (cover != null) {
            Path clip = new Path();
            clip.addRoundRect(coverRect, 46, 46, Path.Direction.CW);
            int save = c.save();
            c.clipPath(clip);
            drawCenterCrop(c, cover, coverRect);
            c.restoreToCount(save);
            cover.recycle();
        } else {
            p.setShader(new LinearGradient(coverRect.left, coverRect.top, coverRect.right, coverRect.bottom,
                new int[]{Color.rgb(100, 34, 188), Color.rgb(37, 12, 84), Color.rgb(113, 190, 31)}, null, Shader.TileMode.CLAMP));
            c.drawRoundRect(coverRect, 46, 46, p);
            p.setShader(null);
            p.setTextAlign(Paint.Align.CENTER);
            p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            p.setTextSize(190);
            p.setColor(Color.argb(225, 255, 255, 255));
            c.drawText("A", W / 2f, 835, p);
            p.setTextAlign(Paint.Align.LEFT);
        }

        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        p.setTextSize(68);
        p.setColor(Color.WHITE);
        float y = 1390;
        y = drawWrapped(c, p, info.title, 88, y, W - 176, 78, 2);
        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        p.setTextSize(42);
        p.setColor(Color.rgb(194, 201, 213));
        y += 20;
        drawWrapped(c, p, emptyTo(info.artist, "Artiste inconnu"), 90, y, W - 180, 54, 1);

        RectF pill = new RectF(88, 1680, W - 88, 1805);
        p.setShader(new LinearGradient(pill.left, 0, pill.right, 0,
            new int[]{Color.rgb(168, 255, 63), Color.rgb(216, 255, 48)}, null, Shader.TileMode.CLAMP));
        c.drawRoundRect(pill, 62, 62, p);
        p.setShader(null);
        p.setTextAlign(Paint.Align.CENTER);
        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        p.setTextSize(42);
        p.setColor(Color.rgb(6, 10, 12));
        c.drawText("J’écoute sur Audify", W / 2f, 1759, p);
        p.setTextAlign(Paint.Align.LEFT);

        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        p.setTextSize(25);
        p.setColor(Color.argb(180, 223, 228, 237));
        c.drawText("La musique se partage mieux ensemble.", 90, 1870, p);

        File dir = new File(context.getCacheDir(), "audify_share");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cache dir");
        File file = new File(dir, "audify_share.png");
        FileOutputStream fos = new FileOutputStream(file, false);
        try { out.compress(Bitmap.CompressFormat.PNG, 96, fos); } finally { try { fos.close(); } catch (Throwable ignored) {} out.recycle(); }
        return file;
    }

    private static Bitmap downloadCover(String url) {
        if (TextUtils.isEmpty(url)) return null;
        HttpURLConnection conn = null;
        InputStream in = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(7000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Audify/68");
            in = conn.getInputStream();
            return BitmapFactory.decodeStream(in);
        } catch (Throwable ignored) {
            return null;
        } finally {
            try { if (in != null) in.close(); } catch (Throwable ignored) {}
            if (conn != null) conn.disconnect();
        }
    }

    private static void drawCenterCrop(Canvas c, Bitmap bitmap, RectF dst) {
        float scale = Math.max(dst.width() / bitmap.getWidth(), dst.height() / bitmap.getHeight());
        float sw = dst.width() / scale;
        float sh = dst.height() / scale;
        float left = (bitmap.getWidth() - sw) / 2f;
        float top = (bitmap.getHeight() - sh) / 2f;
        Rect src = new Rect((int) left, (int) top, (int) (left + sw), (int) (top + sh));
        c.drawBitmap(bitmap, src, dst, new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG));
    }

    private static float drawWrapped(Canvas c, Paint p, String text, float x, float y, float maxWidth, float lineHeight, int maxLines) {
        if (text == null) text = "";
        String remaining = text.trim();
        int line = 0;
        while (!remaining.isEmpty() && line < maxLines) {
            int count = p.breakText(remaining, true, maxWidth, null);
            if (count <= 0) break;
            if (count < remaining.length()) {
                int space = remaining.lastIndexOf(' ', count - 1);
                if (space > 0) count = space;
            }
            String part = remaining.substring(0, count).trim();
            if (line == maxLines - 1 && count < remaining.length()) {
                while (p.measureText(part + "…") > maxWidth && part.length() > 1) part = part.substring(0, part.length() - 1);
                part += "…";
            }
            c.drawText(part, x, y, p);
            y += lineHeight;
            remaining = remaining.substring(Math.min(count, remaining.length())).trim();
            line++;
        }
        return y;
    }

    private static TrackInfo readTrackInfo() {
        try {
            Class<?> service = Class.forName(SERVICE_CLASS);
            String title = staticString(service, "snapshotTitle");
            String artist = staticString(service, "snapshotArtist");
            String thumb = staticString(service, "snapshotThumbnail");
            String videoId = staticString(service, "snapshotVideoId");
            return new TrackInfo(title, artist, thumb, videoId);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static String staticString(Class<?> cls, String name) {
        try {
            Field f = cls.getDeclaredField(name);
            f.setAccessible(true);
            Object v = f.get(null);
            return v == null ? "" : String.valueOf(v);
        } catch (Throwable ignored) { return ""; }
    }

    private static void copyShareText(Context context, TrackInfo info) {
        try {
            ClipboardManager cm = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            String s = "🎧 " + info.title + (TextUtils.isEmpty(info.artist) ? "" : " — " + info.artist) + " · Audify";
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Audify", s));
            Toast.makeText(context, "Texte copié.", Toast.LENGTH_SHORT).show();
        } catch (Throwable ignored) {}
    }

    private static View menuButton(Context c, String label, String sub, final Runnable action) {
        LinearLayout row = new LinearLayout(c);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(c, 16), dp(c, 12), dp(c, 16), dp(c, 12));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(180, 28, 34, 45));
        bg.setCornerRadius(dp(c, 18));
        bg.setStroke(dp(c, 1), Color.argb(85, 205, 220, 235));
        row.setBackground(bg);
        TextView a = text(c, label, 17, Color.WHITE, true);
        TextView b = text(c, sub, 12, Color.rgb(155, 165, 182), false);
        row.addView(a, fullWrap());
        LinearLayout.LayoutParams blp = fullWrap(); blp.topMargin = dp(c, 2);
        row.addView(b, blp);
        row.setOnClickListener(v -> action.run());
        return row;
    }

    private static LinearLayout.LayoutParams fullWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private static LinearLayout.LayoutParams spacedWrap(Context c) {
        LinearLayout.LayoutParams p = fullWrap(); p.topMargin = dp(c, 8); return p;
    }

    private static TextView text(Context c, String s, int sp, int color, boolean bold) {
        TextView v = new TextView(c);
        v.setText(s);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setTypeface(Typeface.create(Typeface.DEFAULT, bold ? Typeface.BOLD : Typeface.NORMAL));
        return v;
    }

    private static String emptyTo(String s, String fallback) { return TextUtils.isEmpty(s) ? fallback : s; }
    private static int dp(Context c, int v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }

    private static final class TrackInfo {
        final String title, artist, thumbnail, videoId;
        TrackInfo(String t, String a, String th, String v) { title=t; artist=a; thumbnail=th; videoId=v; }
    }

    @Override public String getType(Uri uri) { return null; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
