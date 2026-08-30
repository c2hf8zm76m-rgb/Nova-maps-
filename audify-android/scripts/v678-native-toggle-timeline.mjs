import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

const activity=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.SeekBar;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

/**
 * Audify V67.8 — deuxième étape du lecteur 100% natif.
 * - bouton Play/Pause réellement booléen et synchronisé avec ExoPlayer
 * - timeline SeekBar native, synchronisée et déplaçable
 */
public class NativePlayerActivity extends AppCompatActivity {
    private Button playPauseButton;
    private SeekBar timeline;
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private boolean userSeeking = false;
    private boolean lastPlaying = true;
    private double lastDurationSeconds = 0.0;

    private final Runnable uiTicker = new Runnable() {
        @Override
        public void run() {
            refreshFromPlayer();
            uiHandler.postDelayed(this, 200);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(7,10,15));
        getWindow().setNavigationBarColor(Color.rgb(7,10,15));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.setBackgroundColor(Color.rgb(7,10,15));

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER_VERTICAL);

        playPauseButton = new Button(this);
        playPauseButton.setAllCaps(false);
        playPauseButton.setTextSize(19f);
        playPauseButton.setMinHeight(dp(60));
        playPauseButton.setText("Pause");
        playPauseButton.setOnClickListener(v -> {
            try {
                startService(new Intent(this, AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_TOGGLE));
                // Mise à jour visuelle immédiate, puis confirmation par l'état réel ExoPlayer.
                lastPlaying = !lastPlaying;
                applyBooleanState(lastPlaying);
                uiHandler.postDelayed(this::refreshFromPlayer, 80);
            } catch (Exception ignored) {}
        });

        LinearLayout.LayoutParams buttonLp = new LinearLayout.LayoutParams(dp(160), dp(64));
        controls.addView(playPauseButton, buttonLp);

        timeline = new SeekBar(this);
        timeline.setMax(1000);
        timeline.setProgress(0);
        timeline.setPadding(dp(18), 0, 0, 0);
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {}

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                userSeeking = true;
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                try {
                    double duration = Math.max(0.0, lastDurationSeconds);
                    double seconds = duration * (seekBar.getProgress() / 1000.0);
                    startService(new Intent(NativePlayerActivity.this, AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_SEEK)
                        .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS, seconds));
                } catch (Exception ignored) {}
                userSeeking = false;
                uiHandler.postDelayed(NativePlayerActivity.this::refreshFromPlayer, 80);
            }
        });

        LinearLayout.LayoutParams timelineLp = new LinearLayout.LayoutParams(0, dp(64), 1f);
        controls.addView(timeline, timelineLp);

        LinearLayout.LayoutParams controlsLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        root.addView(controls, controlsLp);

        setContentView(root, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        refreshFromPlayer();
    }

    private void applyBooleanState(boolean playing) {
        lastPlaying = playing;
        if (playPauseButton == null) return;
        // Le libellé indique l'action disponible et montre donc clairement l'état actuel :
        // si ça joue -> bouton Pause ; si c'est en pause -> bouton Lecture.
        playPauseButton.setText(playing ? "Pause" : "Lecture");
        playPauseButton.setContentDescription(playing
            ? "Musique en lecture. Appuyer pour mettre en pause."
            : "Musique en pause. Appuyer pour reprendre la lecture.");
    }

    private void refreshFromPlayer() {
        try {
            JSONObject state = new JSONObject(AudifyPlaybackService.getStateJson());
            boolean playing = state.optBoolean("playing", false);
            double position = Math.max(0.0, state.optDouble("position", 0.0));
            double duration = Math.max(0.0, state.optDouble("duration", 0.0));

            applyBooleanState(playing);
            lastDurationSeconds = duration;

            if (!userSeeking && timeline != null) {
                int progress = duration > 0.0
                    ? (int) Math.max(0, Math.min(1000, Math.round((position / duration) * 1000.0)))
                    : 0;
                timeline.setProgress(progress);
                timeline.setEnabled(duration > 0.0);
            }
        } catch (Throwable ignored) {
            if (timeline != null && !userSeeking) timeline.setEnabled(false);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onStart() {
        super.onStart();
        uiHandler.removeCallbacks(uiTicker);
        uiHandler.post(uiTicker);
    }

    @Override
    protected void onStop() {
        uiHandler.removeCallbacks(uiTicker);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        uiHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
`;

await writeFile(path.join(pkgDir,'NativePlayerActivity.java'),activity,'utf8');
console.log('Audify Android V67.8 : bouton Play/Pause booleen + timeline native interactive.');
