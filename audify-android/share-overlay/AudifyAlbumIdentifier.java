package com.nova.audify;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
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
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.ref.WeakReference;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Audify Album Identifier V68.12.52.
 *
 * Detects the most likely official album / EP for the currently playing song
 * with MusicBrainz metadata, shows the official track order, then resolves the
 * album tracks through Audify's existing YouTube search engine and sends one
 * native queue to the existing AudifyPlaybackService.
 *
 * MusicBrainz public API policy: meaningful User-Agent and <= 1 request/sec.
 */
public final class AudifyAlbumIdentifier {
    private static final String TAG = "AUDIFY_ALBUM_IDENTIFIER_V681252";
    private static final String TAG_PILL = TAG + "_PILL";
    private static final String TAG_LABEL = TAG + "_LABEL";
    private static final String SERVICE = "com.nova.audify.AudifyPlaybackService";
    private static final String SEARCH_ENGINE = "com.nova.audify.AudifyYoutubeSearchEngine";
    private static final String PLAYER = "com.nova.audify.NativePlayerActivity";
    private static final String PREFS = "audify_album_identifier_v1";
    private static final long CACHE_MS = 30L * 24L * 60L * 60L * 1000L;
    private static final long MB_GAP_MS = 1100L;

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final ExecutorService NET = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "AudifyAlbumIdentifier");
        t.setDaemon(true);
        return t;
    });
    private static final AtomicInteger GENERATION = new AtomicInteger();
    private static WeakReference<Activity> active = new WeakReference<>(null);
    private static volatile String observedTrackKey = "";
    private static volatile AlbumInfo currentAlbum;
    private static volatile String currentAlbumForKey = "";
    private static volatile long lastMbCall;

    private AudifyAlbumIdentifier() {}

    public static void attach(Activity activity) {
        if (activity == null) return;
        active = new WeakReference<>(activity);
        installUi(activity);
        pollNow(activity);
        schedulePoll(activity);
    }

    private static void installUi(final Activity activity) {
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        ViewGroup root = (ViewGroup) content;
        if (root.findViewWithTag(TAG) != null) return;

        DiscButton disc = new DiscButton(activity);
        disc.setTag(TAG);
        disc.setContentDescription("Identifier l’album de ce morceau");
        disc.setElevation(dp(activity, 10));
        GradientDrawable dbg = new GradientDrawable();
        dbg.setShape(GradientDrawable.OVAL);
        dbg.setColor(Color.argb(226, 12, 17, 24));
        dbg.setStroke(dp(activity, 1), Color.argb(235, 168, 255, 63));
        disc.setBackground(dbg);
        disc.setOnClickListener(v -> {
            Snapshot s = readSnapshot();
            if (TextUtils.isEmpty(s.title)) {
                Toast.makeText(activity, "Lance un morceau pour identifier son album.", Toast.LENGTH_SHORT).show();
                return;
            }
            AlbumInfo album = currentAlbum;
            String key = trackKey(s);
            if (album != null && key.equals(currentAlbumForKey)) showAlbum(activity, album, s);
            else {
                Toast.makeText(activity, "Recherche de l’album…", Toast.LENGTH_SHORT).show();
                detectAsync(activity, s, true);
            }
        });

        LinearLayout pill = new LinearLayout(activity);
        pill.setTag(TAG_PILL);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(activity, 12), dp(activity, 8), dp(activity, 14), dp(activity, 8));
        pill.setElevation(dp(activity, 9));
        pill.setVisibility(View.GONE);
        pill.setAlpha(0f);
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(Color.argb(234, 11, 16, 23));
        pbg.setCornerRadius(dp(activity, 24));
        pbg.setStroke(dp(activity, 1), Color.argb(220, 168, 255, 63));
        pill.setBackground(pbg);

        MiniDiscIcon icon = new MiniDiscIcon(activity);
        pill.addView(icon, new LinearLayout.LayoutParams(dp(activity, 24), dp(activity, 24)));
        TextView label = new TextView(activity);
        label.setTag(TAG_LABEL);
        label.setTextColor(Color.WHITE);
        label.setTextSize(12.5f);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setSingleLine(true);
        label.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        llp.leftMargin = dp(activity, 9);
        pill.addView(label, llp);
        TextView chevron = new TextView(activity);
        chevron.setText("›");
        chevron.setTextSize(22f);
        chevron.setTextColor(Color.rgb(168, 255, 63));
        chevron.setGravity(Gravity.CENTER);
        pill.addView(chevron, new LinearLayout.LayoutParams(dp(activity, 22), dp(activity, 30)));
        pill.setOnClickListener(v -> {
            Snapshot s = readSnapshot();
            AlbumInfo album = currentAlbum;
            if (album != null) showAlbum(activity, album, s);
        });

        FrameLayout holder;
        if (root instanceof FrameLayout) holder = (FrameLayout) root;
        else {
            holder = new FrameLayout(activity);
            root.addView(holder, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }

        FrameLayout.LayoutParams dlp = new FrameLayout.LayoutParams(dp(activity, 46), dp(activity, 46), Gravity.TOP | Gravity.END);
        dlp.topMargin = dp(activity, 194);
        dlp.rightMargin = dp(activity, 18);
        holder.addView(disc, dlp);

        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 48), Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        plp.leftMargin = dp(activity, 16);
        plp.rightMargin = dp(activity, 16);
        plp.bottomMargin = dp(activity, 184);
        holder.addView(pill, plp);
    }

    private static void schedulePoll(final Activity activity) {
        final WeakReference<Activity> ref = new WeakReference<>(activity);
        MAIN.postDelayed(new Runnable() {
            @Override public void run() {
                Activity a = ref.get();
                if (a == null || a.isFinishing() || (Build.VERSION.SDK_INT >= 17 && a.isDestroyed()) || active.get() != a) return;
                pollNow(a);
                MAIN.postDelayed(this, 1500L);
            }
        }, 1200L);
    }

    private static void pollNow(Activity activity) {
        Snapshot s = readSnapshot();
        String key = trackKey(s);
        if (TextUtils.isEmpty(key)) {
            observedTrackKey = "";
            currentAlbum = null;
            currentAlbumForKey = "";
            hidePill(activity);
            return;
        }
        if (!key.equals(observedTrackKey)) {
            observedTrackKey = key;
            currentAlbum = null;
            currentAlbumForKey = "";
            hidePill(activity);
            int generation = GENERATION.incrementAndGet();
            MAIN.postDelayed(() -> {
                Snapshot latest = readSnapshot();
                if (generation == GENERATION.get() && key.equals(trackKey(latest))) detectAsync(activity, latest, false);
            }, 1400L);
        } else if (currentAlbum != null && key.equals(currentAlbumForKey)) {
            showPill(activity, currentAlbum);
        }
    }

    private static void detectAsync(final Activity activity, final Snapshot s, final boolean userRequested) {
        final String key = trackKey(s);
        if (TextUtils.isEmpty(key)) return;
        final int generation = GENERATION.incrementAndGet();
        NET.execute(() -> {
            AlbumInfo album = null;
            try {
                album = readCache(activity.getApplicationContext(), key);
                if (album == null) {
                    album = identify(s.title, s.artist);
                    if (album != null) writeCache(activity.getApplicationContext(), key, album);
                }
            } catch (Throwable ignored) {}
            final AlbumInfo result = album;
            MAIN.post(() -> {
                Activity a = active.get();
                if (a == null || a.isFinishing()) return;
                String nowKey = trackKey(readSnapshot());
                if (!key.equals(nowKey)) return;
                if (!userRequested && generation != GENERATION.get()) return;
                if (result != null && result.tracks.size() >= 2) {
                    currentAlbum = result;
                    currentAlbumForKey = key;
                    showPill(a, result);
                    if (userRequested) showAlbum(a, result, readSnapshot());
                } else if (userRequested) {
                    Toast.makeText(a, "Aucun album fiable trouvé pour ce morceau.", Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private static AlbumInfo identify(String rawTitle, String rawArtist) throws Exception {
        String title = cleanTitle(rawTitle);
        String artist = cleanArtist(rawArtist);
        if (TextUtils.isEmpty(title)) return null;

        String query = "recording:\"" + lucene(title) + "\"";
        if (!TextUtils.isEmpty(artist)) query += " AND artist:\"" + lucene(artist) + "\"";
        String searchUrl = "https://musicbrainz.org/ws/2/recording/?query=" + enc(query) + "&fmt=json&limit=8";
        JSONObject root = getJson(searchUrl);
        JSONArray recordings = root.optJSONArray("recordings");
        if (recordings == null || recordings.length() == 0) return null;

        Candidate best = null;
        for (int i = 0; i < recordings.length(); i++) {
            JSONObject rec = recordings.optJSONObject(i);
            if (rec == null) continue;
            int recordingScore = rec.optInt("score", 0);
            String recTitle = rec.optString("title", "");
            recordingScore += titleSimilarity(title, recTitle) * 30;
            String credited = artistCredit(rec.optJSONArray("artist-credit"));
            if (!TextUtils.isEmpty(artist) && containsNorm(credited, artist)) recordingScore += 20;
            JSONArray releases = rec.optJSONArray("releases");
            if (releases == null) continue;
            for (int r = 0; r < releases.length(); r++) {
                JSONObject rel = releases.optJSONObject(r);
                if (rel == null || TextUtils.isEmpty(rel.optString("id"))) continue;
                int score = recordingScore + scoreRelease(rel, title);
                Candidate c = new Candidate(rel.optString("id"), score, rel.optInt("track-count", 0));
                if (best == null || c.score > best.score || (c.score == best.score && preferTrackCount(c.trackCount, best.trackCount))) best = c;
            }
        }
        if (best == null || best.score < 65) return null;

        throttleMb();
        JSONObject release = getJson("https://musicbrainz.org/ws/2/release/" + encPath(best.releaseId) + "?inc=recordings+artist-credits+release-groups&fmt=json");
        AlbumInfo album = parseRelease(release, title, artist, best.score);
        if (album == null || album.tracks.size() < 2) return null;
        return album;
    }

    private static int scoreRelease(JSONObject rel, String songTitle) {
        int s = 0;
        String status = rel.optString("status", "");
        if ("Official".equalsIgnoreCase(status)) s += 28;
        JSONObject rg = rel.optJSONObject("release-group");
        String type = rg == null ? "" : rg.optString("primary-type", "");
        if ("Album".equalsIgnoreCase(type)) s += 65;
        else if ("EP".equalsIgnoreCase(type)) s += 42;
        else if ("Single".equalsIgnoreCase(type)) s -= 30;
        JSONArray secondary = rg == null ? null : rg.optJSONArray("secondary-types");
        if (secondary != null) {
            for (int i = 0; i < secondary.length(); i++) {
                String v = secondary.optString(i, "").toLowerCase(Locale.ROOT);
                if (v.contains("compilation")) s -= 40;
                if (v.contains("live")) s -= 25;
                if (v.contains("remix")) s -= 25;
            }
        }
        int count = rel.optInt("track-count", 0);
        if (count >= 6 && count <= 24) s += 22;
        else if (count >= 4 && count <= 35) s += 12;
        else if (count <= 2 && count > 0) s -= 25;
        String title = rel.optString("title", "");
        if (!norm(title).equals(norm(songTitle))) s += 8;
        String low = title.toLowerCase(Locale.ROOT);
        if (low.contains("deluxe") || low.contains("expanded") || low.contains("anniversary")) s -= 7;
        return s;
    }

    private static AlbumInfo parseRelease(JSONObject release, String currentTitle, String currentArtist, int score) {
        if (release == null) return null;
        AlbumInfo out = new AlbumInfo();
        out.releaseId = release.optString("id", "");
        out.title = release.optString("title", "Album");
        out.artist = artistCredit(release.optJSONArray("artist-credit"));
        if (TextUtils.isEmpty(out.artist)) out.artist = currentArtist;
        out.date = release.optString("date", "");
        JSONObject rg = release.optJSONObject("release-group");
        out.releaseGroupId = rg == null ? "" : rg.optString("id", "");
        out.type = rg == null ? "Album" : rg.optString("primary-type", "Album");
        out.confidence = Math.max(60, Math.min(99, 65 + Math.max(0, score - 100) / 4));

        JSONArray media = release.optJSONArray("media");
        if (media == null) return null;
        int global = 0;
        for (int m = 0; m < media.length(); m++) {
            JSONObject medium = media.optJSONObject(m);
            if (medium == null) continue;
            JSONArray tracks = medium.optJSONArray("tracks");
            if (tracks == null) continue;
            for (int i = 0; i < tracks.length(); i++) {
                JSONObject tr = tracks.optJSONObject(i);
                if (tr == null) continue;
                Track track = new Track();
                track.position = ++global;
                track.disc = m + 1;
                track.title = tr.optString("title", "");
                track.lengthMs = tr.optLong("length", -1L);
                track.artist = artistCredit(tr.optJSONArray("artist-credit"));
                if (TextUtils.isEmpty(track.artist)) {
                    JSONObject rec = tr.optJSONObject("recording");
                    if (rec != null) track.artist = artistCredit(rec.optJSONArray("artist-credit"));
                }
                if (TextUtils.isEmpty(track.artist)) track.artist = out.artist;
                if (!TextUtils.isEmpty(track.title)) out.tracks.add(track);
            }
        }
        String ncur = norm(currentTitle);
        for (int i = 0; i < out.tracks.size(); i++) {
            if (titleSimilarity(ncur, out.tracks.get(i).title) >= 2) { out.currentTrackIndex = i; break; }
        }
        return out;
    }

    private static void showAlbum(final Activity activity, final AlbumInfo album, final Snapshot snapshot) {
        final Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(activity, 22), dp(activity, 19), dp(activity, 22), dp(activity, 18));
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(19, 25, 35), Color.rgb(8, 11, 17)});
        bg.setCornerRadius(dp(activity, 28));
        bg.setStroke(dp(activity, 1), Color.argb(200, 168, 255, 63));
        panel.setBackground(bg);

        TextView eyebrow = text(activity, "AUDIFY · ALBUM IDENTIFIER", 11.5f, Color.rgb(168,255,63), true);
        panel.addView(eyebrow, fullWrap());
        TextView title = text(activity, album.title, 25f, Color.WHITE, true);
        LinearLayout.LayoutParams tlp = fullWrap(); tlp.topMargin = dp(activity, 7);
        panel.addView(title, tlp);
        String meta = emptyTo(album.artist, "Artiste inconnu");
        if (!TextUtils.isEmpty(album.date) && album.date.length() >= 4) meta += " · " + album.date.substring(0,4);
        meta += " · " + album.tracks.size() + " titres";
        TextView artist = text(activity, meta, 14f, Color.rgb(174,184,200), false);
        LinearLayout.LayoutParams alp = fullWrap(); alp.topMargin = dp(activity, 4); alp.bottomMargin = dp(activity, 9);
        panel.addView(artist, alp);

        TextView confidence = text(activity, "Album détecté · correspondance " + album.confidence + "%", 11.5f, Color.rgb(203,255,150), true);
        confidence.setPadding(dp(activity,10), dp(activity,6), dp(activity,10), dp(activity,6));
        GradientDrawable cbg = new GradientDrawable(); cbg.setColor(Color.argb(50,168,255,63)); cbg.setCornerRadius(dp(activity,12));
        confidence.setBackground(cbg);
        LinearLayout.LayoutParams cp = wrap(); cp.bottomMargin = dp(activity, 12);
        panel.addView(confidence, cp);

        // V68.12.54: save references in Playlists; never changes the active queue.
        final AudifyLibraryStore albumStore = new AudifyLibraryStore(activity);
        final String albumKey = savedAlbumKey(album);
        final String savedName = albumStore.findSavedAlbum(albumKey);
        final java.util.concurrent.atomic.AtomicBoolean cancelled = new java.util.concurrent.atomic.AtomicBoolean();
        dialog.setOnDismissListener(d -> cancelled.set(true));
        TextView save = text(activity, savedName.isEmpty() ? "＋ Enregistrer dans mes playlists" : "✓ Album enregistré · Ouvrir", 14f, Color.rgb(190,255,113), true);
        save.setGravity(Gravity.CENTER);
        save.setMinHeight(dp(activity,48));
        save.setPadding(dp(activity,12),dp(activity,12),dp(activity,12),dp(activity,12));
        GradientDrawable sbg = new GradientDrawable();
        sbg.setColor(Color.rgb(26,40,27)); sbg.setCornerRadius(dp(activity,18));
        sbg.setStroke(dp(activity,1),Color.rgb(99,145,59)); save.setBackground(sbg);
        LinearLayout.LayoutParams sp = fullWrap(); sp.bottomMargin=dp(activity,12);
        panel.addView(save,sp);

        ScrollView scroll = new ScrollView(activity);
        scroll.setFillViewport(false);
        LinearLayout list = new LinearLayout(activity);
        list.setOrientation(LinearLayout.VERTICAL);
        for (int i = 0; i < album.tracks.size(); i++) {
            Track tr = album.tracks.get(i);
            boolean current = i == album.currentTrackIndex || titleSimilarity(snapshot.title, tr.title) >= 2;
            TextView row = text(activity, tr.position + ".  " + tr.title + (TextUtils.isEmpty(tr.artist) || norm(tr.artist).equals(norm(album.artist)) ? "" : "\n     " + tr.artist),
                    14f, current ? Color.rgb(190,255,113) : Color.rgb(232,236,242), current);
            row.setPadding(dp(activity,9), dp(activity,8), dp(activity,9), dp(activity,8));
            if (current) {
                GradientDrawable rbg = new GradientDrawable();
                rbg.setColor(Color.argb(45,168,255,63)); rbg.setCornerRadius(dp(activity,12));
                row.setBackground(rbg);
            }
            list.addView(row, fullWrap());
        }
        scroll.addView(list, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        panel.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 250)));

        TextView play = text(activity, "▶  Écouter l’album", 15f, Color.rgb(7,14,8), true);
        play.setGravity(Gravity.CENTER);
        play.setPadding(dp(activity,12), dp(activity,14), dp(activity,12), dp(activity,14));
        GradientDrawable pbg = new GradientDrawable(); pbg.setColor(Color.rgb(168,255,63)); pbg.setCornerRadius(dp(activity,22));
        play.setBackground(pbg);
        LinearLayout.LayoutParams pp = fullWrap(); pp.topMargin = dp(activity, 14);
        panel.addView(play, pp);

        TextView note = text(activity, "Audify va retrouver les versions jouables des titres et construire automatiquement la file dans l’ordre de l’album.",
                11.5f, Color.rgb(124,136,153), false);
        LinearLayout.LayoutParams np = fullWrap(); np.topMargin = dp(activity, 9);
        panel.addView(note, np);

        play.setOnClickListener(v -> prepareAlbumQueue(activity, album, play, dialog));
        save.setOnClickListener(v -> {
            String existing=albumStore.findSavedAlbum(albumKey);
            if(!existing.isEmpty()) openSavedAlbum(activity,existing,dialog);
            else prepareAlbumSave(activity,album,albumStore,save,play,dialog,cancelled);
        });
        // A scrollable sheet keeps both actions reachable on small screens / large fonts.
        ScrollView sheet=new ScrollView(activity);
        sheet.addView(panel,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        dialog.setContentView(sheet);
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawableResource(android.R.color.transparent);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams p = new WindowManager.LayoutParams();
            p.copyFrom(w.getAttributes());
            p.width = Math.min(activity.getResources().getDisplayMetrics().widthPixels - dp(activity,24), dp(activity,450));
            panel.measure(View.MeasureSpec.makeMeasureSpec(p.width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));
            p.height = Math.min(panel.getMeasuredHeight(),(int)(activity.getResources().getDisplayMetrics().heightPixels*.85f));
            p.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            p.dimAmount = .74f;
            p.y = dp(activity, 14);
            w.setAttributes(p);
        }
        dialog.show();
    }

    private static String savedAlbumKey(AlbumInfo album) {
        return !TextUtils.isEmpty(album.releaseId) ? "release:"+album.releaseId : "album:"+norm(album.artist)+"|"+norm(album.title);
    }

    private static void openSavedAlbum(Activity activity,String name,Dialog dialog) {
        activity.startActivity(new Intent(activity,NativePlaylistActivity.class).putExtra("playlist",name));
        dialog.dismiss();
    }

    private static void prepareAlbumSave(final Activity activity,final AlbumInfo album,final AudifyLibraryStore store,
            final TextView button,final TextView play,final Dialog dialog,final java.util.concurrent.atomic.AtomicBoolean cancelled) {
        button.setEnabled(false); button.setAlpha(.75f); button.setText("Préparation de la playlist…");
        play.setEnabled(false); // Prevent two competing album searches, without pausing current playback.
        NET.execute(() -> {
            final ArrayList<AudifyLibraryStore.Track> found=new ArrayList<>();
            final Set<String> ids=new HashSet<>();
            try {
                Class<?> cls=Class.forName(SEARCH_ENGINE);
                Constructor<?> ctor=cls.getDeclaredConstructor();ctor.setAccessible(true);
                Object engine=ctor.newInstance();
                Method search=cls.getDeclaredMethod("search",String.class);search.setAccessible(true);
                for(int i=0;i<album.tracks.size();i++) {
                    if(cancelled.get()) return;
                    final int number=i+1;
                    MAIN.post(() -> {if(!cancelled.get()&&dialog.isShowing())button.setText("Recherche "+number+" / "+album.tracks.size()+"…");});
                    // Reuse the exact existing resolver; no extractor or player modifications.
                    Playable p=resolveYoutube(engine,search,album.tracks.get(i),album.title);
                    if(p!=null&&ids.add(p.id)) found.add(new AudifyLibraryStore.Track(p.id,p.title,p.artist,p.thumbnail));
                }
            } catch(Exception ignored) {}
            MAIN.post(() -> {
                if(cancelled.get()||activity.isFinishing()||activity.isDestroyed()||!dialog.isShowing())return;
                Runnable reset=() -> {button.setEnabled(true);button.setAlpha(1f);button.setText("＋ Réessayer l’enregistrement");play.setEnabled(true);};
                if(found.isEmpty()) {
                    reset.run();
                    Toast.makeText(activity,"Aucun titre trouvé. Aucune playlist n’a été créée.",Toast.LENGTH_LONG).show();
                    return;
                }
                Runnable save=() -> {
                    if(cancelled.get()||activity.isFinishing()||activity.isDestroyed())return;
                    try {
                        JSONObject meta=new JSONObject().put("albumKey",savedAlbumKey(album)).put("title",album.title)
                            .put("artist",album.artist).put("date",album.date).put("releaseId",album.releaseId)
                            .put("totalCount",album.tracks.size());
                        // Documented thumbnail endpoint: musicbrainz.org/doc/Cover_Art_Archive/API.
                        String cover=album.releaseId.matches("[0-9a-fA-F-]{36}")
                            ? "https://coverartarchive.org/release/"+album.releaseId+"/front-500" : found.get(0).thumbnail;
                        meta.put("cover",cover);
                        String name=store.saveAlbumPlaylist(meta,found);
                        if(name.isEmpty()) {
                            reset.run();
                            Toast.makeText(activity,"Enregistrement impossible : vérifie le compte actif et l’espace disponible.",Toast.LENGTH_LONG).show();
                            return;
                        }
                        button.setEnabled(true);button.setAlpha(1f);play.setEnabled(true);
                        button.setText("✓ Album enregistré · Ouvrir");
                        button.setOnClickListener(v -> openSavedAlbum(activity,name,dialog));
                        Toast.makeText(activity,"Album ajouté dans Playlists · "+found.size()+" titres",Toast.LENGTH_LONG).show();
                    } catch(Exception failure) {reset.run();Toast.makeText(activity,"Impossible d’enregistrer l’album.",Toast.LENGTH_LONG).show();}
                };
                if(found.size()<album.tracks.size()) {
                    new android.app.AlertDialog.Builder(activity).setTitle("Album partiellement retrouvé")
                        .setMessage(found.size()+" titres sur "+album.tracks.size()+" ont été retrouvés. Enregistrer uniquement ces titres, dans leur ordre d’origine ?")
                        .setPositiveButton("Enregistrer ces titres",(d,w)->save.run())
                        .setNegativeButton("Annuler",(d,w)->reset.run()).setOnCancelListener(d->reset.run()).show();
                } else save.run();
            });
        });
    }

    private static void prepareAlbumQueue(final Activity activity, final AlbumInfo album, final TextView button, final Dialog dialog) {
        button.setEnabled(false);
        button.setAlpha(.75f);
        button.setText("Préparation de l’album…");
        NET.execute(() -> {
            final ArrayList<Playable> playable = new ArrayList<>();
            Object engine = null;
            Method search = null;
            try {
                Class<?> cls = Class.forName(SEARCH_ENGINE);
                Constructor<?> ctor = cls.getDeclaredConstructor();
                ctor.setAccessible(true);
                engine = ctor.newInstance();
                search = cls.getDeclaredMethod("search", String.class);
                search.setAccessible(true);
            } catch (Throwable ignored) {}

            if (engine != null && search != null) {
                int max = Math.min(album.tracks.size(), 40);
                for (int i = 0; i < max; i++) {
                    final int n = i + 1;
                    MAIN.post(() -> {
                        if (dialog.isShowing()) button.setText("Recherche " + n + "/" + Math.min(album.tracks.size(),40) + "…");
                    });
                    Track tr = album.tracks.get(i);
                    Playable p = resolveYoutube(engine, search, tr, album.title);
                    if (p != null) playable.add(p);
                }
            }

            MAIN.post(() -> {
                if (activity.isFinishing()) return;
                if (playable.size() < 2) {
                    button.setEnabled(true); button.setAlpha(1f); button.setText("▶  Réessayer");
                    Toast.makeText(activity, "Audify n’a pas trouvé assez de titres jouables pour cet album.", Toast.LENGTH_LONG).show();
                    return;
                }
                try {
                    launchQueue(activity, playable);
                    dialog.dismiss();
                    int missing = Math.max(0, Math.min(album.tracks.size(),40) - playable.size());
                    Toast.makeText(activity, missing == 0 ? "Album prêt · " + playable.size() + " titres" : "Album prêt · " + playable.size() + " titres trouvés", Toast.LENGTH_LONG).show();
                } catch (Throwable e) {
                    button.setEnabled(true); button.setAlpha(1f); button.setText("▶  Réessayer");
                    Toast.makeText(activity, "Impossible de lancer l’album pour le moment.", Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private static Playable resolveYoutube(Object engine, Method search, Track track, String albumTitle) {
        try {
            String q = track.title + " " + emptyTo(track.artist, "") + " " + emptyTo(albumTitle, "") + " audio";
            Object raw = search.invoke(engine, q.trim());
            if (!(raw instanceof List)) return null;
            List<?> list = (List<?>) raw;
            Object best = null; int bestScore = Integer.MIN_VALUE;
            for (Object result : list) {
                if (result == null) continue;
                String id = fieldString(result, "id");
                if (TextUtils.isEmpty(id)) continue;
                String rt = fieldString(result, "title");
                String ra = fieldString(result, "artist");
                long dur = fieldLong(result, "durationSeconds") * 1000L;
                int score = 0;
                int sim = titleSimilarity(track.title, rt);
                score += sim * 55;
                if (!TextUtils.isEmpty(track.artist) && (containsNorm(ra, track.artist) || containsNorm(rt, track.artist))) score += 35;
                String low = (rt + " " + ra).toLowerCase(Locale.ROOT);
                if (low.contains("topic") || low.contains("official audio")) score += 12;
                if ((low.contains("live") || low.contains("remix") || low.contains("sped up")) && !norm(track.title).contains("live") && !norm(track.title).contains("remix")) score -= 25;
                if (track.lengthMs > 0 && dur > 0) {
                    long diff = Math.abs(track.lengthMs - dur);
                    if (diff < 8000L) score += 25;
                    else if (diff < 20000L) score += 15;
                    else if (diff > 60000L) score -= 20;
                }
                if (score > bestScore) { bestScore = score; best = result; }
            }
            if (best == null || bestScore < 50) return null;
            Playable p = new Playable();
            p.id = fieldString(best, "id");
            p.title = track.title;
            p.artist = TextUtils.isEmpty(track.artist) ? fieldString(best,"artist") : track.artist;
            p.thumbnail = fieldString(best, "thumbnail");
            return p;
        } catch (Throwable ignored) { return null; }
    }

    private static void launchQueue(Activity activity, List<Playable> items) throws Exception {
        JSONArray arr = new JSONArray();
        for (Playable p : items) {
            JSONObject o = new JSONObject();
            o.put("id", p.id); o.put("title", p.title); o.put("artist", p.artist); o.put("thumbnail", p.thumbnail);
            arr.put(o);
        }
        JSONObject queue = new JSONObject();
        queue.put("items", arr); queue.put("index", 0);
        Class<?> service = Class.forName(SERVICE);
        String setAction = staticString(service, "ACTION_SET_QUEUE", "com.nova.audify.SET_QUEUE");
        String playIndexAction = staticString(service, "ACTION_PLAY_QUEUE_INDEX", "com.nova.audify.PLAY_QUEUE_INDEX");
        String queueExtra = staticString(service, "EXTRA_QUEUE_JSON", "queueJson");
        String indexExtra = staticString(service, "EXTRA_QUEUE_INDEX", "queueIndex");

        Intent set = new Intent(activity, service);
        set.setAction(setAction); set.putExtra(queueExtra, queue.toString());
        startService(activity, set);
        MAIN.postDelayed(() -> {
            try {
                Intent play = new Intent(activity, service);
                play.setAction(playIndexAction); play.putExtra(indexExtra, 0);
                startService(activity, play);
                Class<?> player = Class.forName(PLAYER);
                Intent open = new Intent(activity, player);
                open.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                activity.startActivity(open);
            } catch (Throwable ignored) {}
        }, 220L);
    }

    private static void startService(Context c, Intent i) {
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    private static JSONObject getJson(String url) throws Exception {
        throttleMb();
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(7500); conn.setReadTimeout(10000); conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("User-Agent", "Audify/68.12.52 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)");
        try {
            int code = conn.getResponseCode();
            InputStream in = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            if (in == null) throw new IllegalStateException("HTTP " + code);
            BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder(); String line;
            while ((line = br.readLine()) != null) b.append(line);
            br.close();
            if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code);
            return new JSONObject(b.toString());
        } finally { conn.disconnect(); }
    }

    private static synchronized void throttleMb() throws InterruptedException {
        long now = android.os.SystemClock.elapsedRealtime();
        long wait = MB_GAP_MS - (now - lastMbCall);
        if (wait > 0) Thread.sleep(wait);
        lastMbCall = android.os.SystemClock.elapsedRealtime();
    }

    private static AlbumInfo readCache(Context c, String key) {
        try {
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = p.getString("a_" + Integer.toHexString(key.hashCode()), null);
            if (TextUtils.isEmpty(raw)) return null;
            JSONObject o = new JSONObject(raw);
            if (System.currentTimeMillis() - o.optLong("saved",0L) > CACHE_MS) return null;
            AlbumInfo a = AlbumInfo.fromJson(o.optJSONObject("album"));
            return a != null && a.tracks.size() >= 2 ? a : null;
        } catch (Throwable ignored) { return null; }
    }

    private static void writeCache(Context c, String key, AlbumInfo album) {
        try {
            JSONObject root = new JSONObject(); root.put("saved", System.currentTimeMillis()); root.put("album", album.toJson());
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("a_" + Integer.toHexString(key.hashCode()), root.toString()).apply();
        } catch (Throwable ignored) {}
    }

    private static Snapshot readSnapshot() {
        Snapshot s = new Snapshot();
        try {
            Class<?> cls = Class.forName(SERVICE);
            s.videoId = staticString(cls, "snapshotVideoId", "");
            s.title = staticString(cls, "snapshotTitle", "");
            s.artist = staticString(cls, "snapshotArtist", "");
        } catch (Throwable ignored) {}
        return s;
    }

    private static String staticString(Class<?> cls, String name, String fallback) {
        try {
            Field f = cls.getDeclaredField(name); f.setAccessible(true); Object v = f.get(null);
            String s = v == null ? "" : String.valueOf(v); return TextUtils.isEmpty(s) ? fallback : s;
        } catch (Throwable ignored) { return fallback; }
    }
    private static String fieldString(Object o, String name) {
        try { Field f=o.getClass().getDeclaredField(name); f.setAccessible(true); Object v=f.get(o); return v==null?"":String.valueOf(v); }
        catch(Throwable ignored){ return ""; }
    }
    private static long fieldLong(Object o, String name) {
        try { Field f=o.getClass().getDeclaredField(name); f.setAccessible(true); return f.getLong(o); }
        catch(Throwable ignored){ return 0L; }
    }

    private static String artistCredit(JSONArray a) {
        if (a == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i=0;i<a.length();i++) {
            JSONObject x=a.optJSONObject(i); if(x==null) continue;
            String n=x.optString("name","");
            if(TextUtils.isEmpty(n)) { JSONObject ar=x.optJSONObject("artist"); if(ar!=null)n=ar.optString("name",""); }
            if(!TextUtils.isEmpty(n)) { if(b.length()>0)b.append(x.optString("joinphrase", " & ")); b.append(n); }
        }
        return b.toString();
    }

    private static String trackKey(Snapshot s) {
        if (s == null || TextUtils.isEmpty(s.title)) return "";
        if (!TextUtils.isEmpty(s.videoId)) return s.videoId + "|" + norm(s.title) + "|" + norm(s.artist);
        return norm(s.title) + "|" + norm(s.artist);
    }
    private static String cleanArtist(String s) {
        if (s == null) return "";
        return s.replaceAll("(?i)\\s*-\\s*Topic$", "").replaceAll("(?i)VEVO$", "").replaceAll("(?i)\\s*Official$", "").trim();
    }
    private static String cleanTitle(String s) {
        if (s == null) return "";
        String x=s;
        x=x.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio)[\\])]", "");
        x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er).*$", "");
        return x.replaceAll("\\s+", " ").trim();
    }
    private static String norm(String s) {
        if (s == null) return "";
        String n=Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
        n=n.replaceAll("(?i)\\b(feat|ft|featuring)\\.?\\b.*$", "");
        return n.replaceAll("[^a-z0-9]+", " ").trim().replaceAll("\\s+", " ");
    }
    private static int titleSimilarity(String a, String b) {
        String x=norm(a), y=norm(b); if(TextUtils.isEmpty(x)||TextUtils.isEmpty(y))return 0;
        if(x.equals(y))return 3; if(x.contains(y)||y.contains(x))return 2;
        Set<String> ax=new HashSet<>(), by=new HashSet<>(); for(String p:x.split(" "))if(p.length()>1)ax.add(p); for(String p:y.split(" "))if(p.length()>1)by.add(p);
        int common=0; for(String p:ax)if(by.contains(p))common++;
        return common>=Math.max(2, Math.min(ax.size(),by.size())*2/3)?1:0;
    }
    private static boolean containsNorm(String hay, String needle) { String h=norm(hay), n=norm(needle); return !TextUtils.isEmpty(n)&&h.contains(n); }
    private static boolean preferTrackCount(int a, int b) { if(a<=0)return false; if(b<=0)return true; return Math.abs(a-14)<Math.abs(b-14); }
    private static String lucene(String s) { return s.replace("\\","\\\\").replace("\"","\\\""); }
    private static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }
    private static String encPath(String s) throws Exception { return URLEncoder.encode(s,"UTF-8").replace("+","%20"); }
    private static String emptyTo(String s,String f){ return TextUtils.isEmpty(s)?f:s; }

    private static void showPill(Activity a, AlbumInfo album) {
        View content=a.findViewById(android.R.id.content); if(!(content instanceof ViewGroup))return;
        View p=((ViewGroup)content).findViewWithTag(TAG_PILL); if(!(p instanceof ViewGroup))return;
        View l=((ViewGroup)p).findViewWithTag(TAG_LABEL); if(l instanceof TextView)((TextView)l).setText("Album détecté · " + album.title + " · " + album.tracks.size() + " titres");
        if(p.getVisibility()!=View.VISIBLE){ p.setVisibility(View.VISIBLE); p.setAlpha(0f); p.animate().alpha(1f).setDuration(220).start(); }
    }
    private static void hidePill(Activity a) {
        View content=a.findViewById(android.R.id.content); if(!(content instanceof ViewGroup))return;
        View p=((ViewGroup)content).findViewWithTag(TAG_PILL); if(p!=null&&p.getVisibility()==View.VISIBLE)p.animate().alpha(0f).setDuration(150).withEndAction(()->p.setVisibility(View.GONE)).start();
    }

    private static TextView text(Activity c,String s,float sp,int color,boolean bold){ TextView v=new TextView(c); v.setText(s); v.setTextSize(sp); v.setTextColor(color); if(bold)v.setTypeface(Typeface.DEFAULT_BOLD); return v; }
    private static LinearLayout.LayoutParams fullWrap(){ return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); }
    private static LinearLayout.LayoutParams wrap(){ return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT); }
    private static int dp(Context c,int v){ return Math.round(v*c.getResources().getDisplayMetrics().density); }

    private static final class Snapshot { String videoId="", title="", artist=""; }
    private static final class Candidate { final String releaseId; final int score,trackCount; Candidate(String r,int s,int t){releaseId=r;score=s;trackCount=t;} }
    private static final class Playable { String id,title,artist,thumbnail; }
    private static final class Track {
        int position,disc; String title="",artist=""; long lengthMs=-1L;
        JSONObject toJson() throws Exception { JSONObject o=new JSONObject(); o.put("p",position);o.put("d",disc);o.put("t",title);o.put("a",artist);o.put("l",lengthMs);return o; }
        static Track fromJson(JSONObject o){ if(o==null)return null; Track t=new Track();t.position=o.optInt("p");t.disc=o.optInt("d",1);t.title=o.optString("t","");t.artist=o.optString("a","");t.lengthMs=o.optLong("l",-1L);return t; }
    }
    private static final class AlbumInfo {
        String releaseId="",releaseGroupId="",title="",artist="",date="",type="Album"; int confidence=70,currentTrackIndex=-1; final ArrayList<Track> tracks=new ArrayList<>();
        JSONObject toJson() throws Exception { JSONObject o=new JSONObject();o.put("release",releaseId);o.put("group",releaseGroupId);o.put("title",title);o.put("artist",artist);o.put("date",date);o.put("type",type);o.put("confidence",confidence);o.put("current",currentTrackIndex);JSONArray a=new JSONArray();for(Track t:tracks)a.put(t.toJson());o.put("tracks",a);return o; }
        static AlbumInfo fromJson(JSONObject o){ if(o==null)return null; AlbumInfo a=new AlbumInfo();a.releaseId=o.optString("release","");a.releaseGroupId=o.optString("group","");a.title=o.optString("title","");a.artist=o.optString("artist","");a.date=o.optString("date","");a.type=o.optString("type","Album");a.confidence=o.optInt("confidence",70);a.currentTrackIndex=o.optInt("current",-1);JSONArray tr=o.optJSONArray("tracks");if(tr!=null)for(int i=0;i<tr.length();i++){Track t=Track.fromJson(tr.optJSONObject(i));if(t!=null&&!TextUtils.isEmpty(t.title))a.tracks.add(t);}return a; }
    }

    private static final class DiscButton extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        DiscButton(Context c){super(c);}
        @Override protected void onDraw(Canvas c){ super.onDraw(c); float w=getWidth(),h=getHeight(),cx=w/2f,cy=h/2f; p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(Math.max(2f,w*.055f));p.setColor(Color.rgb(168,255,63));c.drawCircle(cx,cy,w*.27f,p);c.drawCircle(cx,cy,w*.09f,p);p.setStyle(Paint.Style.FILL);c.drawCircle(cx,cy,w*.035f,p); }
    }
    private static final class MiniDiscIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        MiniDiscIcon(Context c){super(c);}
        @Override protected void onDraw(Canvas c){super.onDraw(c);float w=getWidth(),h=getHeight(),r=Math.min(w,h)*.42f;p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(Math.max(2f,w*.08f));p.setColor(Color.rgb(168,255,63));c.drawCircle(w/2f,h/2f,r,p);c.drawCircle(w/2f,h/2f,r*.32f,p);}
    }
}
