package com.nova.audify;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Small in-player panel used to validate Audify Stats in 5-minute test mode. */
public final class AudifyStatsOverlay {
    private static final String TAG = "AUDIFY_STATS_V681251";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private AudifyStatsOverlay() {}

    public static void attach(Activity activity) {
        if (activity == null) return;
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        ViewGroup root = (ViewGroup) content;
        if (root.findViewWithTag(TAG) != null) return;

        TextView button = new TextView(activity);
        button.setTag(TAG);
        button.setText("S");
        button.setTextColor(Color.rgb(168, 255, 63));
        button.setTextSize(18f);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setGravity(Gravity.CENTER);
        button.setContentDescription("Audify Stats");
        button.setElevation(dp(activity, 10));
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.argb(226, 12, 17, 24));
        bg.setStroke(dp(activity, 1), Color.argb(235, 168, 255, 63));
        button.setBackground(bg);
        button.setOnClickListener(v -> show(activity));

        if (root instanceof FrameLayout) {
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(activity, 46), dp(activity, 46), Gravity.TOP | Gravity.END);
            lp.topMargin = dp(activity, 136);
            lp.rightMargin = dp(activity, 18);
            ((FrameLayout) root).addView(button, lp);
        } else {
            FrameLayout overlay = new FrameLayout(activity);
            root.addView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(activity, 46), dp(activity, 46), Gravity.TOP | Gravity.END);
            lp.topMargin = dp(activity, 136);
            lp.rightMargin = dp(activity, 18);
            overlay.addView(button, lp);
        }
    }

    private static void show(final Activity activity) {
        final Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(activity, 22), dp(activity, 20), dp(activity, 22), dp(activity, 18));
        GradientDrawable panelBg = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(18, 24, 34), Color.rgb(8, 11, 17)});
        panelBg.setCornerRadius(dp(activity, 28));
        panelBg.setStroke(dp(activity, 1), Color.argb(190, 168, 255, 63));
        panel.setBackground(panelBg);

        TextView eyebrow = text(activity, "AUDIFY STATS", 12, Color.rgb(168, 255, 63), true);
        panel.addView(eyebrow, fullWrap());
        TextView heading = text(activity, "Ton écoute en direct", 24, Color.WHITE, true);
        LinearLayout.LayoutParams hp = fullWrap(); hp.topMargin = dp(activity, 7);
        panel.addView(heading, hp);

        TextView mode = text(activity, "MODE TEST · 5 DERNIÈRES MINUTES", 11, Color.rgb(202, 255, 145), true);
        GradientDrawable mbg = new GradientDrawable();
        mbg.setColor(Color.argb(52, 168, 255, 63));
        mbg.setCornerRadius(dp(activity, 12));
        mode.setBackground(mbg);
        mode.setPadding(dp(activity, 10), dp(activity, 6), dp(activity, 10), dp(activity, 6));
        LinearLayout.LayoutParams mp = wrap(); mp.topMargin = dp(activity, 10); mp.bottomMargin = dp(activity, 16);
        panel.addView(mode, mp);

        LinearLayout metrics = new LinearLayout(activity);
        metrics.setOrientation(LinearLayout.HORIZONTAL);
        TextView time = metric(activity, "00:00", "ÉCOUTÉ"); time.setTag(TAG + "_TIME");
        TextView plays = metric(activity, "0", "ÉCOUTES"); plays.setTag(TAG + "_PLAYS");
        TextView tracks = metric(activity, "0", "TITRES"); tracks.setTag(TAG + "_TRACKS");
        metrics.addView(time, new LinearLayout.LayoutParams(0, dp(activity, 78), 1f));
        LinearLayout.LayoutParams p2 = new LinearLayout.LayoutParams(0, dp(activity, 78), 1f); p2.leftMargin = dp(activity, 8);
        metrics.addView(plays, p2);
        LinearLayout.LayoutParams p3 = new LinearLayout.LayoutParams(0, dp(activity, 78), 1f); p3.leftMargin = dp(activity, 8);
        metrics.addView(tracks, p3);
        panel.addView(metrics, fullWrap());

        TextView live = text(activity, "En attente d’une lecture…", 13, Color.rgb(173, 184, 201), false);
        live.setTag(TAG + "_LIVE");
        LinearLayout.LayoutParams lpLive = fullWrap(); lpLive.topMargin = dp(activity, 13); lpLive.bottomMargin = dp(activity, 13);
        panel.addView(live, lpLive);

        TextView artistLabel = text(activity, "ARTISTE LE PLUS ÉCOUTÉ", 11, Color.rgb(137, 148, 165), true);
        panel.addView(artistLabel, fullWrap());
        TextView artist = text(activity, "—", 20, Color.WHITE, true); artist.setTag(TAG + "_ARTIST");
        LinearLayout.LayoutParams ap = fullWrap(); ap.topMargin = dp(activity, 4); ap.bottomMargin = dp(activity, 13);
        panel.addView(artist, ap);

        TextView trackLabel = text(activity, "MORCEAU LE PLUS ÉCOUTÉ", 11, Color.rgb(137, 148, 165), true);
        panel.addView(trackLabel, fullWrap());
        TextView track = text(activity, "—", 18, Color.WHITE, true); track.setTag(TAG + "_TOPTRACK");
        LinearLayout.LayoutParams tp = fullWrap(); tp.topMargin = dp(activity, 4);
        panel.addView(track, tp);
        TextView trackArtist = text(activity, "", 13, Color.rgb(173, 184, 201), false); trackArtist.setTag(TAG + "_TOPTRACK_ARTIST");
        LinearLayout.LayoutParams tap = fullWrap(); tap.topMargin = dp(activity, 2); tap.bottomMargin = dp(activity, 14);
        panel.addView(trackArtist, tap);

        TextView note = text(activity,
                "Le compteur suit le temps réellement joué. Pause et buffering ne comptent pas. Il continue pendant la lecture en arrière-plan.",
                12, Color.rgb(128, 139, 157), false);
        panel.addView(note, fullWrap());

        TextView reset = text(activity, "Réinitialiser le test", 13, Color.rgb(215, 225, 238), true);
        reset.setGravity(Gravity.CENTER);
        reset.setPadding(dp(activity, 12), dp(activity, 12), dp(activity, 12), dp(activity, 12));
        GradientDrawable rbg = new GradientDrawable();
        rbg.setColor(Color.argb(100, 32, 39, 52));
        rbg.setCornerRadius(dp(activity, 16));
        reset.setBackground(rbg);
        LinearLayout.LayoutParams rp = fullWrap(); rp.topMargin = dp(activity, 15);
        panel.addView(reset, rp);
        reset.setOnClickListener(v -> new AlertDialog.Builder(activity)
                .setTitle("Réinitialiser Audify Stats ?")
                .setMessage("Cela efface uniquement les statistiques de ce test local.")
                .setNegativeButton("Annuler", null)
                .setPositiveButton("Réinitialiser", (d, which) -> {
                    AudifyStatsTracker.resetTestData();
                    refresh(panel);
                }).show());

        dialog.setContentView(panel);
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawableResource(android.R.color.transparent);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams p = new WindowManager.LayoutParams();
            p.copyFrom(w.getAttributes());
            p.width = Math.min(activity.getResources().getDisplayMetrics().widthPixels - dp(activity, 24), dp(activity, 440));
            p.height = WindowManager.LayoutParams.WRAP_CONTENT;
            p.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            p.dimAmount = 0.72f;
            p.y = dp(activity, 16);
            w.setAttributes(p);
        }

        dialog.setOnDismissListener(d -> panel.removeCallbacks(null));
        dialog.show();
        refresh(panel);
        final Runnable ticker = new Runnable() {
            @Override public void run() {
                if (!dialog.isShowing()) return;
                refresh(panel);
                panel.postDelayed(this, 1000L);
            }
        };
        panel.postDelayed(ticker, 1000L);
    }

    private static void refresh(ViewGroup panel) {
        AudifyStatsTracker.Snapshot s = AudifyStatsTracker.snapshot();
        set(panel, TAG + "_TIME", formatTime(s.listenedMs));
        set(panel, TAG + "_PLAYS", String.valueOf(s.playCount));
        set(panel, TAG + "_TRACKS", String.valueOf(s.uniqueTracks));

        String live;
        if (s.currentPlaying && !TextUtils.isEmpty(s.currentTitle)) {
            live = "● En direct · " + s.currentTitle + (TextUtils.isEmpty(s.currentArtist) ? "" : " — " + s.currentArtist);
        } else if (!TextUtils.isEmpty(s.currentTitle)) {
            live = "Ⅱ En pause · " + s.currentTitle;
        } else {
            live = "En attente d’une lecture…";
        }
        set(panel, TAG + "_LIVE", live);

        if (!s.topArtists.isEmpty()) {
            AudifyStatsTracker.Rank r = s.topArtists.get(0);
            set(panel, TAG + "_ARTIST", r.name + "  ·  " + formatTime(r.listenedMs));
        } else set(panel, TAG + "_ARTIST", "—");

        if (!s.topTracks.isEmpty()) {
            AudifyStatsTracker.Rank r = s.topTracks.get(0);
            set(panel, TAG + "_TOPTRACK", r.name + "  ·  " + formatTime(r.listenedMs));
            set(panel, TAG + "_TOPTRACK_ARTIST", r.secondary);
        } else {
            set(panel, TAG + "_TOPTRACK", "—");
            set(panel, TAG + "_TOPTRACK_ARTIST", "");
        }
    }

    private static TextView metric(Activity c, String value, String label) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(130, 23, 30, 40));
        bg.setCornerRadius(dp(c, 17));
        box.setBackground(bg);

        TextView v = text(c, value, 20, Color.WHITE, true);
        // Returning a proxy TextView would not let us update the nested value, so
        // use one TextView with two lines and update only the first line later.
        v.setGravity(Gravity.CENTER);
        v.setText(value + "\n" + label);
        v.setLineSpacing(dp(c, 2), 1f);
        v.setTextSize(14f);
        v.setTypeface(Typeface.DEFAULT_BOLD);
        v.setTextColor(Color.WHITE);
        return v;
    }

    private static void set(ViewGroup root, String tag, String value) {
        View v = root.findViewWithTag(tag);
        if (!(v instanceof TextView)) return;
        TextView tv = (TextView) v;
        if (tag.endsWith("_TIME")) tv.setText(value + "\nÉCOUTÉ");
        else if (tag.endsWith("_PLAYS")) tv.setText(value + "\nÉCOUTES");
        else if (tag.endsWith("_TRACKS")) tv.setText(value + "\nTITRES");
        else tv.setText(value);
    }

    private static String formatTime(long ms) {
        long total = Math.max(0L, ms) / 1000L;
        long min = total / 60L;
        long sec = total % 60L;
        if (min >= 60L) return (min / 60L) + "h " + (min % 60L) + "m";
        return String.format(java.util.Locale.ROOT, "%02d:%02d", min, sec);
    }

    private static TextView text(Activity c, String s, float sp, int color, boolean bold) {
        TextView v = new TextView(c);
        v.setText(s);
        v.setTextSize(sp);
        v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        return v;
    }

    private static LinearLayout.LayoutParams fullWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
    private static LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
    private static int dp(Activity c, int v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }
}
