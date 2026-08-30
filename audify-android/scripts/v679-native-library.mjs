import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

const store=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Audify V67.9 — bibliothèque locale persistante. */
public final class AudifyLibraryStore {
    private static final String PREFS = "audify_native_library_v679";
    private static final String KEY_LIKES = "likes_json";
    private static final String KEY_PLAYLISTS = "playlists_json";

    public static final class Track {
        public final String id;
        public final String title;
        public final String artist;
        public final String thumbnail;

        public Track(String id, String title, String artist, String thumbnail) {
            this.id = id == null ? "" : id;
            this.title = title == null || title.isEmpty() ? "Sans titre" : title;
            this.artist = artist == null || artist.isEmpty() ? "YouTube" : artist;
            this.thumbnail = thumbnail == null ? "" : thumbnail;
        }

        JSONObject toJson() {
            JSONObject o = new JSONObject();
            try {
                o.put("id", id);
                o.put("title", title);
                o.put("artist", artist);
                o.put("thumbnail", thumbnail);
            } catch (Exception ignored) {}
            return o;
        }

        static Track fromJson(JSONObject o) {
            if (o == null) return null;
            String id = o.optString("id", "");
            if (id.isEmpty()) return null;
            return new Track(id, o.optString("title", "Sans titre"), o.optString("artist", "YouTube"), o.optString("thumbnail", ""));
        }
    }

    private final SharedPreferences prefs;

    public AudifyLibraryStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private JSONArray readLikesArray() {
        try { return new JSONArray(prefs.getString(KEY_LIKES, "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    private JSONObject readPlaylistsObject() {
        try { return new JSONObject(prefs.getString(KEY_PLAYLISTS, "{}")); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    private void saveLikes(JSONArray arr) {
        prefs.edit().putString(KEY_LIKES, arr.toString()).apply();
    }

    private void savePlaylists(JSONObject obj) {
        prefs.edit().putString(KEY_PLAYLISTS, obj.toString()).apply();
    }

    public boolean isLiked(String id) {
        if (id == null || id.isEmpty()) return false;
        JSONArray arr = readLikesArray();
        for (int i=0;i<arr.length();i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && id.equals(o.optString("id", ""))) return true;
        }
        return false;
    }

    /** @return true si le titre est désormais liké. */
    public boolean toggleLike(Track track) {
        if (track == null || track.id.isEmpty()) return false;
        JSONArray old = readLikesArray();
        JSONArray next = new JSONArray();
        boolean found = false;
        for (int i=0;i<old.length();i++) {
            JSONObject o = old.optJSONObject(i);
            if (o == null) continue;
            if (track.id.equals(o.optString("id", ""))) { found = true; continue; }
            next.put(o);
        }
        if (!found) next.put(track.toJson());
        saveLikes(next);
        return !found;
    }

    public List<Track> getLikes() {
        ArrayList<Track> out = new ArrayList<>();
        JSONArray arr = readLikesArray();
        for (int i=0;i<arr.length();i++) {
            Track t = Track.fromJson(arr.optJSONObject(i));
            if (t != null) out.add(t);
        }
        return out;
    }

    public List<String> getPlaylistNames() {
        ArrayList<String> out = new ArrayList<>();
        JSONObject root = readPlaylistsObject();
        java.util.Iterator<String> it = root.keys();
        while (it.hasNext()) out.add(it.next());
        Collections.sort(out, String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    public void addToPlaylist(String rawName, Track track) {
        if (track == null || track.id.isEmpty()) return;
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) name = "Ma playlist";
        JSONObject root = readPlaylistsObject();
        JSONArray arr = root.optJSONArray(name);
        if (arr == null) arr = new JSONArray();
        boolean exists = false;
        for (int i=0;i<arr.length();i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && track.id.equals(o.optString("id", ""))) { exists = true; break; }
        }
        if (!exists) arr.put(track.toJson());
        try { root.put(name, arr); } catch (Exception ignored) {}
        savePlaylists(root);
    }

    public List<Track> getPlaylist(String name) {
        ArrayList<Track> out = new ArrayList<>();
        JSONObject root = readPlaylistsObject();
        JSONArray arr = root.optJSONArray(name == null ? "" : name);
        if (arr == null) return out;
        for (int i=0;i<arr.length();i++) {
            Track t = Track.fromJson(arr.optJSONObject(i));
            if (t != null) out.add(t);
        }
        return out;
    }

    public String queueJson(List<Track> tracks, int index) {
        JSONObject root = new JSONObject();
        JSONArray arr = new JSONArray();
        if (tracks != null) for (Track t : tracks) if (t != null && !t.id.isEmpty()) arr.put(t.toJson());
        try {
            root.put("items", arr);
            root.put("index", Math.max(0, Math.min(Math.max(0, arr.length()-1), index)));
        } catch (Exception ignored) {}
        return root.toString();
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyLibraryStore.java'),store,'utf8');

const activity=String.raw`package com.nova.audify;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Audify V67.9 — lecteur natif : Play/Pause, timeline, boucle, like, playlist, bibliothèque. */
public class NativePlayerActivity extends AppCompatActivity {
    private Button playPauseButton;
    private Button repeatButton;
    private Button likeButton;
    private SeekBar timeline;
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private boolean userSeeking = false;
    private boolean lastPlaying = true;
    private boolean repeatOne = false;
    private double lastDurationSeconds = 0.0;
    private AudifyLibraryStore store;
    private AudifyLibraryStore.Track currentTrack;

    private final Runnable uiTicker = new Runnable() {
        @Override public void run() {
            refreshFromPlayer();
            uiHandler.postDelayed(this, 200);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7,10,15));
        getWindow().setNavigationBarColor(Color.rgb(7,10,15));

        store = new AudifyLibraryStore(this);
        Intent source = getIntent();
        currentTrack = new AudifyLibraryStore.Track(
            source == null ? "" : source.getStringExtra("videoId"),
            source == null ? "Sans titre" : source.getStringExtra("title"),
            source == null ? "YouTube" : source.getStringExtra("artist"),
            source == null ? "" : source.getStringExtra("thumbnail")
        );

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(22), dp(22), dp(22), dp(22));
        root.setBackgroundColor(Color.rgb(7,10,15));

        LinearLayout transport = new LinearLayout(this);
        transport.setOrientation(LinearLayout.HORIZONTAL);
        transport.setGravity(Gravity.CENTER_VERTICAL);

        playPauseButton = button("Pause");
        playPauseButton.setOnClickListener(v -> {
            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);
            lastPlaying = !lastPlaying;
            applyPlayState(lastPlaying);
            uiHandler.postDelayed(this::refreshFromPlayer, 80);
        });
        transport.addView(playPauseButton, new LinearLayout.LayoutParams(dp(150), dp(62)));

        timeline = new SeekBar(this);
        timeline.setMax(1000);
        timeline.setProgress(0);
        timeline.setPadding(dp(16), 0, 0, 0);
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar s, int p, boolean fromUser) {}
            @Override public void onStartTrackingTouch(SeekBar s) { userSeeking = true; }
            @Override public void onStopTrackingTouch(SeekBar s) {
                double seconds = Math.max(0.0, lastDurationSeconds) * (s.getProgress()/1000.0);
                try {
                    startService(new Intent(NativePlayerActivity.this, AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_SEEK)
                        .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS, seconds));
                } catch (Exception ignored) {}
                userSeeking = false;
                uiHandler.postDelayed(NativePlayerActivity.this::refreshFromPlayer, 80);
            }
        });
        transport.addView(timeline, new LinearLayout.LayoutParams(0, dp(62), 1f));
        root.addView(transport, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);
        actions.setPadding(0, dp(18), 0, 0);

        repeatButton = button("Boucle : OFF");
        repeatButton.setOnClickListener(v -> {
            repeatOne = !repeatOne;
            try {
                startService(new Intent(this, AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_REPEAT)
                    .putExtra(AudifyPlaybackService.EXTRA_REPEAT, repeatOne));
            } catch (Exception ignored) {}
            applyRepeatState();
        });
        actions.addView(repeatButton, weighted());

        likeButton = button("♡ Like");
        likeButton.setOnClickListener(v -> {
            if (currentTrack == null || currentTrack.id.isEmpty()) {
                Toast.makeText(this, "Titre indisponible", Toast.LENGTH_SHORT).show();
                return;
            }
            boolean liked = store.toggleLike(currentTrack);
            applyLikeState(liked);
            Toast.makeText(this, liked ? "Ajouté aux titres likés" : "Retiré des titres likés", Toast.LENGTH_SHORT).show();
        });
        actions.addView(likeButton, weighted());

        Button playlistButton = button("＋ Playlist");
        playlistButton.setOnClickListener(v -> showPlaylistPicker());
        actions.addView(playlistButton, weighted());
        root.addView(actions, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button libraryButton = button("Bibliothèque");
        libraryButton.setOnClickListener(v -> startActivity(new Intent(this, NativeLibraryActivity.class)));
        LinearLayout.LayoutParams libLp = new LinearLayout.LayoutParams(dp(220), dp(58));
        libLp.topMargin = dp(16);
        root.addView(libraryButton, libLp);

        setContentView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        applyLikeState(currentTrack != null && store.isLiked(currentTrack.id));
        refreshFromPlayer();
    }

    private LinearLayout.LayoutParams weighted() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(58), 1f);
        lp.setMargins(dp(4), 0, dp(4), 0);
        return lp;
    }

    private Button button(String text) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextSize(16f);
        return b;
    }

    private void startPlayerAction(String action) {
        try { startService(new Intent(this, AudifyPlaybackService.class).setAction(action)); }
        catch (Exception ignored) {}
    }

    private void applyPlayState(boolean playing) {
        lastPlaying = playing;
        playPauseButton.setText(playing ? "Pause" : "Lecture");
        playPauseButton.setContentDescription(playing ? "Musique en lecture" : "Musique en pause");
    }

    private void applyRepeatState() {
        repeatButton.setText(repeatOne ? "Boucle : ON" : "Boucle : OFF");
        repeatButton.setContentDescription(repeatOne ? "Lecture en boucle activée" : "Lecture en boucle désactivée");
    }

    private void applyLikeState(boolean liked) {
        likeButton.setText(liked ? "♥ Aimé" : "♡ Like");
        likeButton.setContentDescription(liked ? "Titre liké" : "Ajouter aux titres likés");
    }

    private void showPlaylistPicker() {
        if (currentTrack == null || currentTrack.id.isEmpty()) {
            Toast.makeText(this, "Titre indisponible", Toast.LENGTH_SHORT).show();
            return;
        }
        List<String> existing = new ArrayList<>(store.getPlaylistNames());
        existing.add(0, "＋ Nouvelle playlist…");
        String[] labels = existing.toArray(new String[0]);
        new AlertDialog.Builder(this)
            .setTitle("Ajouter à une playlist")
            .setItems(labels, (dialog, which) -> {
                if (which == 0) promptNewPlaylist();
                else {
                    String name = existing.get(which);
                    store.addToPlaylist(name, currentTrack);
                    Toast.makeText(this, "Ajouté à « " + name + " »", Toast.LENGTH_SHORT).show();
                }
            })
            .setNegativeButton("Annuler", null)
            .show();
    }

    private void promptNewPlaylist() {
        EditText input = new EditText(this);
        input.setHint("Nom de la playlist");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        int pad = dp(20);
        input.setPadding(pad, pad, pad, pad);
        new AlertDialog.Builder(this)
            .setTitle("Nouvelle playlist")
            .setView(input)
            .setPositiveButton("Créer", (d,w) -> {
                String name = input.getText() == null ? "" : input.getText().toString().trim();
                if (name.isEmpty()) name = "Ma playlist";
                store.addToPlaylist(name, currentTrack);
                Toast.makeText(this, "Ajouté à « " + name + " »", Toast.LENGTH_SHORT).show();
            })
            .setNegativeButton("Annuler", null)
            .show();
    }

    private void refreshFromPlayer() {
        try {
            JSONObject state = new JSONObject(AudifyPlaybackService.getStateJson());
            boolean playing = state.optBoolean("playing", false);
            double position = Math.max(0.0, state.optDouble("position", 0.0));
            double duration = Math.max(0.0, state.optDouble("duration", 0.0));
            repeatOne = state.optBoolean("repeatOne", false);
            applyPlayState(playing);
            applyRepeatState();
            lastDurationSeconds = duration;
            if (!userSeeking) {
                int progress = duration > 0 ? (int)Math.max(0, Math.min(1000, Math.round((position/duration)*1000.0))) : 0;
                timeline.setProgress(progress);
                timeline.setEnabled(duration > 0);
            }
        } catch (Throwable ignored) {
            if (!userSeeking) timeline.setEnabled(false);
        }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override protected void onStart() { super.onStart(); uiHandler.removeCallbacks(uiTicker); uiHandler.post(uiTicker); }
    @Override protected void onStop() { uiHandler.removeCallbacks(uiTicker); super.onStop(); }
    @Override protected void onDestroy() { uiHandler.removeCallbacksAndMessages(null); super.onDestroy(); }
}
`;
await writeFile(path.join(pkgDir,'NativePlayerActivity.java'),activity,'utf8');

const library=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.AlertDialog;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.List;

/** Audify V67.9 — bibliothèque native persistante : likes + playlists. */
public class NativeLibraryActivity extends AppCompatActivity {
    private AudifyLibraryStore store;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7,10,15));
        getWindow().setNavigationBarColor(Color.rgb(7,10,15));
        store = new AudifyLibraryStore(this);
        render();
    }

    @Override protected void onResume() { super.onResume(); render(); }

    private void render() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(7,10,15));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(22), dp(22), dp(30));
        scroll.removeAllViews();
        scroll.addView(root, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        root.addView(label("Bibliothèque", 28f, Color.WHITE));
        TextView likesHeader = label("Titres likés", 20f, Color.rgb(168,255,63));
        likesHeader.setPadding(0, dp(22), 0, dp(8));
        root.addView(likesHeader);

        List<AudifyLibraryStore.Track> likes = store.getLikes();
        if (likes.isEmpty()) root.addView(label("Aucun titre liké pour l’instant.", 15f, Color.LTGRAY));
        else for (int i=0;i<likes.size();i++) addTrackRow(root, likes, i);

        TextView playlistsHeader = label("Playlists", 20f, Color.rgb(168,255,63));
        playlistsHeader.setPadding(0, dp(26), 0, dp(8));
        root.addView(playlistsHeader);
        List<String> names = store.getPlaylistNames();
        if (names.isEmpty()) root.addView(label("Aucune playlist pour l’instant.", 15f, Color.LTGRAY));
        else for (String name : names) {
            List<AudifyLibraryStore.Track> tracks = store.getPlaylist(name);
            TextView row = label(name + "  •  " + tracks.size() + " titre" + (tracks.size()>1 ? "s" : ""), 17f, Color.WHITE);
            row.setPadding(dp(14), dp(16), dp(14), dp(16));
            row.setBackgroundColor(Color.rgb(18,23,31));
            row.setOnClickListener(v -> showPlaylist(name, tracks));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.bottomMargin = dp(8);
            root.addView(row, lp);
        }
        setContentView(scroll);
    }

    private void showPlaylist(String name, List<AudifyLibraryStore.Track> tracks) {
        if (tracks == null || tracks.isEmpty()) { Toast.makeText(this,"Playlist vide",Toast.LENGTH_SHORT).show(); return; }
        String[] labels = new String[tracks.size()];
        for (int i=0;i<tracks.size();i++) labels[i] = tracks.get(i).title + "\n" + tracks.get(i).artist;
        new AlertDialog.Builder(this).setTitle(name).setItems(labels, (d,which) -> play(tracks, which)).setNegativeButton("Fermer", null).show();
    }

    private void addTrackRow(LinearLayout root, List<AudifyLibraryStore.Track> tracks, int index) {
        AudifyLibraryStore.Track t = tracks.get(index);
        TextView row = label(t.title + "\n" + t.artist, 16f, Color.WHITE);
        row.setPadding(dp(14), dp(14), dp(14), dp(14));
        row.setBackgroundColor(Color.rgb(18,23,31));
        row.setOnClickListener(v -> play(tracks, index));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(8);
        root.addView(row, lp);
    }

    private void play(List<AudifyLibraryStore.Track> tracks, int index) {
        if (tracks == null || index < 0 || index >= tracks.size()) return;
        AudifyLibraryStore.Track t = tracks.get(index);
        try {
            startService(new Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON, store.queueJson(tracks,index)));
            startService(new Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,t.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,t.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,t.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,t.thumbnail));
            Intent player = new Intent(this, NativePlayerActivity.class)
                .putExtra("videoId",t.id).putExtra("title",t.title).putExtra("artist",t.artist).putExtra("thumbnail",t.thumbnail);
            startActivity(player);
        } catch (Throwable error) {
            Toast.makeText(this,"Impossible de lancer ce titre",Toast.LENGTH_SHORT).show();
        }
    }

    private TextView label(String text, float size, int color) {
        TextView v = new TextView(this);
        v.setText(text); v.setTextSize(size); v.setTextColor(color); v.setGravity(Gravity.CENTER_VERTICAL);
        return v;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
`;
await writeFile(path.join(pkgDir,'NativeLibraryActivity.java'),library,'utf8');

// Transmettre les métadonnées du résultat natif à la nouvelle Activity afin que Like/Playlist sachent quel titre sauvegarder.
const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
const oldLaunch='startActivity(new android.content.Intent(this, NativePlayerActivity.class));';
if(!main.includes(oldLaunch)) throw new Error('Ouverture NativePlayerActivity V67.7 introuvable');
main=main.replace(oldLaunch, `startActivity(new android.content.Intent(this, NativePlayerActivity.class)\n                    .putExtra("videoId", chosen.id)\n                    .putExtra("title", chosen.title)\n                    .putExtra("artist", chosen.artist)\n                    .putExtra("thumbnail", chosen.thumbnail));`);
await writeFile(mainPath,main,'utf8');

const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".NativeLibraryActivity"')) {
    manifest=manifest.replace('</application>', `        <activity\n            android:name=".NativeLibraryActivity"\n            android:exported="false"\n            android:screenOrientation="unspecified" />\n    </application>`);
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V67.9 : boucle + likes + playlists + bibliothèque persistante SharedPreferences.');
