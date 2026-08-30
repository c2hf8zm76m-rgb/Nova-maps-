import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

const activity=String.raw`package com.nova.audify;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.animation.LinearInterpolator;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Audify V68.0 — première vraie version du lecteur natif.
 * Pochette + disque miniature rotatif synchronisé à ExoPlayer,
 * titre/artiste, timeline, boucle, like, playlists et bibliothèque persistante.
 */
public class NativePlayerActivity extends AppCompatActivity {
    private Button playPauseButton;
    private Button repeatButton;
    private Button likeButton;
    private SeekBar timeline;
    private FrameLayout disc;
    private ImageView coverImage;
    private ImageView discImage;
    private TextView titleView;
    private TextView artistView;
    private ObjectAnimator discAnimator;
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

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7,10,15));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(20), dp(18), dp(20), dp(18));

        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        int artworkSize = Math.max(dp(230), Math.min(dp(350), Math.min(screenW - dp(44), (int)(screenH * 0.40f))));
        int discSize = (int)(artworkSize * 0.72f);

        FrameLayout artwork = new FrameLayout(this);
        artwork.setClipChildren(false);
        artwork.setClipToPadding(false);

        coverImage = new ImageView(this);
        coverImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        coverImage.setBackgroundColor(Color.rgb(18,23,31));
        coverImage.setClipToOutline(true);
        coverImage.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) {
                outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), dp(28));
            }
        });
        artwork.addView(coverImage, new FrameLayout.LayoutParams(artworkSize, artworkSize, Gravity.CENTER));

        View shade = new View(this);
        GradientDrawable shadeDrawable = new GradientDrawable();
        shadeDrawable.setShape(GradientDrawable.OVAL);
        shadeDrawable.setColor(Color.argb(92, 0, 0, 0));
        shade.setBackground(shadeDrawable);
        FrameLayout.LayoutParams shadeLp = new FrameLayout.LayoutParams(discSize + dp(18), discSize + dp(18), Gravity.CENTER);
        artwork.addView(shade, shadeLp);

        disc = new FrameLayout(this);
        GradientDrawable discBg = new GradientDrawable();
        discBg.setShape(GradientDrawable.OVAL);
        discBg.setColor(Color.rgb(5,7,10));
        discBg.setStroke(dp(6), Color.argb(180, 255,255,255));
        disc.setBackground(discBg);
        disc.setPadding(dp(12),dp(12),dp(12),dp(12));
        FrameLayout.LayoutParams discLp = new FrameLayout.LayoutParams(discSize, discSize, Gravity.CENTER);
        artwork.addView(disc, discLp);

        discImage = new ImageView(this);
        discImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        discImage.setClipToOutline(true);
        discImage.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) {
                outline.setOval(0,0,view.getWidth(),view.getHeight());
            }
        });
        disc.addView(discImage, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        View spindle = new View(this);
        GradientDrawable spindleBg = new GradientDrawable();
        spindleBg.setShape(GradientDrawable.OVAL);
        spindleBg.setColor(Color.rgb(7,10,15));
        spindleBg.setStroke(dp(3), Color.WHITE);
        spindle.setBackground(spindleBg);
        FrameLayout.LayoutParams spindleLp = new FrameLayout.LayoutParams(dp(26), dp(26), Gravity.CENTER);
        disc.addView(spindle, spindleLp);

        content.addView(artwork, new LinearLayout.LayoutParams(artworkSize, artworkSize));

        titleView = new TextView(this);
        titleView.setText(currentTrack.title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(23f);
        titleView.setGravity(Gravity.CENTER);
        titleView.setMaxLines(2);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        titleView.setTypeface(titleView.getTypeface(), android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin = dp(20);
        content.addView(titleView, titleLp);

        artistView = new TextView(this);
        artistView.setText(currentTrack.artist);
        artistView.setTextColor(Color.rgb(166,176,191));
        artistView.setTextSize(16f);
        artistView.setGravity(Gravity.CENTER);
        artistView.setMaxLines(1);
        artistView.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams artistLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        artistLp.topMargin = dp(5);
        content.addView(artistView, artistLp);

        timeline = new SeekBar(this);
        timeline.setMax(1000);
        timeline.setProgress(0);
        timeline.setPadding(0,0,0,0);
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
        LinearLayout.LayoutParams timelineLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46));
        timelineLp.topMargin = dp(10);
        content.addView(timeline, timelineLp);

        playPauseButton = button("Pause");
        playPauseButton.setTextSize(18f);
        playPauseButton.setOnClickListener(v -> {
            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);
            lastPlaying = !lastPlaying;
            applyPlayState(lastPlaying);
            uiHandler.postDelayed(this::refreshFromPlayer, 80);
        });
        LinearLayout.LayoutParams playLp = new LinearLayout.LayoutParams(dp(180), dp(58));
        content.addView(playPauseButton, playLp);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);
        actions.setPadding(0, dp(12), 0, 0);

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
        content.addView(actions, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button libraryButton = button("Bibliothèque");
        libraryButton.setOnClickListener(v -> startActivity(new Intent(this, NativeLibraryActivity.class)));
        LinearLayout.LayoutParams libLp = new LinearLayout.LayoutParams(dp(220), dp(54));
        libLp.topMargin = dp(10);
        content.addView(libraryButton, libLp);

        FrameLayout.LayoutParams contentLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        root.addView(content, contentLp);
        setContentView(root);

        loadArtwork(currentTrack.thumbnail, currentTrack.id);
        applyLikeState(currentTrack != null && store.isLiked(currentTrack.id));
        refreshFromPlayer();
    }

    private LinearLayout.LayoutParams weighted() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(54), 1f);
        lp.setMargins(dp(3),0,dp(3),0);
        return lp;
    }

    private Button button(String text) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextSize(14f);
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
        setDiscPlaying(playing);
    }

    private void setDiscPlaying(boolean playing) {
        if (disc == null) return;
        if (playing) {
            if (discAnimator == null) {
                discAnimator = ObjectAnimator.ofFloat(disc, View.ROTATION, 0f, 360f);
                discAnimator.setDuration(12000L);
                discAnimator.setInterpolator(new LinearInterpolator());
                discAnimator.setRepeatCount(ValueAnimator.INFINITE);
                discAnimator.setRepeatMode(ValueAnimator.RESTART);
            }
            if (!discAnimator.isStarted()) discAnimator.start();
            else if (discAnimator.isPaused()) discAnimator.resume();
        } else if (discAnimator != null && discAnimator.isStarted() && !discAnimator.isPaused()) {
            discAnimator.pause();
        }
    }

    private void applyRepeatState() {
        repeatButton.setText(repeatOne ? "Boucle : ON" : "Boucle : OFF");
        repeatButton.setContentDescription(repeatOne ? "Lecture en boucle activée" : "Lecture en boucle désactivée");
    }

    private void applyLikeState(boolean liked) {
        likeButton.setText(liked ? "♥ Aimé" : "♡ Like");
        likeButton.setContentDescription(liked ? "Titre liké" : "Ajouter aux titres likés");
    }

    private void loadArtwork(String rawUrl, String videoId) {
        final String imageUrl = rawUrl != null && !rawUrl.trim().isEmpty()
            ? rawUrl.trim()
            : (videoId == null || videoId.isEmpty() ? "" : "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg");
        if (imageUrl.isEmpty()) return;
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(imageUrl).openConnection();
                connection.setConnectTimeout(7000);
                connection.setReadTimeout(7000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "AudifyAndroid/68.0");
                try (InputStream input = connection.getInputStream()) {
                    Bitmap bitmap = BitmapFactory.decodeStream(input);
                    if (bitmap != null) runOnUiThread(() -> {
                        coverImage.setImageBitmap(bitmap);
                        discImage.setImageBitmap(bitmap);
                    });
                }
            } catch (Throwable ignored) {
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "audify-artwork").start();
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
        input.setPadding(pad,pad,pad,pad);
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
                int progress = duration > 0 ? (int)Math.max(0, Math.min(1000, Math.round(position / duration * 1000.0))) : 0;
                timeline.setProgress(progress);
            }
        } catch (Exception ignored) {}
    }

    @Override protected void onResume() {
        super.onResume();
        uiHandler.removeCallbacks(uiTicker);
        uiHandler.post(uiTicker);
    }

    @Override protected void onPause() {
        uiHandler.removeCallbacks(uiTicker);
        super.onPause();
    }

    @Override protected void onDestroy() {
        uiHandler.removeCallbacks(uiTicker);
        if (discAnimator != null) discAnimator.cancel();
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
`;

await writeFile(path.join(pkgDir,'NativePlayerActivity.java'),activity,'utf8');
console.log('Audify Android V68.0 : pochette native + disque miniature rotatif synchronisé à la lecture + titre/artiste.');
