import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

// 1) Enrichir le snapshot du moteur avec les métadonnées du titre courant.
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
service=service.replace(
  'private static volatile String snapshotVideoId = "";',
  'private static volatile String snapshotVideoId = "";\n    private static volatile String snapshotTitle = "";\n    private static volatile String snapshotArtist = "";\n    private static volatile String snapshotThumbnail = "";'
);
service=service.replace(
  'MediaItem current = player.getCurrentMediaItem();\n        if (current != null) snapshotVideoId = current.mediaId;',
  `MediaItem current = player.getCurrentMediaItem();\n        if (current != null) {\n            snapshotVideoId = current.mediaId;\n            snapshotTitle = current.mediaMetadata.title == null ? "Sans titre" : current.mediaMetadata.title.toString();\n            snapshotArtist = current.mediaMetadata.artist == null ? "YouTube" : current.mediaMetadata.artist.toString();\n            snapshotThumbnail = current.mediaMetadata.artworkUri == null ? "" : current.mediaMetadata.artworkUri.toString();\n        } else {\n            snapshotVideoId = "";\n            snapshotTitle = "";\n            snapshotArtist = "";\n            snapshotThumbnail = "";\n        }`
);
service=service.replace(
  'state.put("videoId", snapshotVideoId);',
  'state.put("videoId", snapshotVideoId);\n            state.put("title", snapshotTitle);\n            state.put("artist", snapshotArtist);\n            state.put("thumbnail", snapshotThumbnail);'
);
await writeFile(servicePath,service,'utf8');

// 2) Ajouter le bouton Home au grand lecteur natif.
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');
const artworkNeedle='        content.addView(artwork, new LinearLayout.LayoutParams(artworkSize, artworkSize));';
if(!player.includes(artworkNeedle)) throw new Error('Point insertion bouton Home introuvable dans NativePlayerActivity');
const homeHeader=`        LinearLayout playerHeader = new LinearLayout(this);\n        playerHeader.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);\n        Button homeButton = button("⌂ Home");\n        homeButton.setOnClickListener(v -> {\n            Intent homeIntent = new Intent(this, NativeHomeActivity.class);\n            homeIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);\n            startActivity(homeIntent);\n            finish();\n        });\n        playerHeader.addView(homeButton, new LinearLayout.LayoutParams(dp(120), dp(48)));\n        LinearLayout.LayoutParams headerLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);\n        headerLp.bottomMargin = dp(10);\n        content.addView(playerHeader, headerLp);\n\n` + artworkNeedle;
player=player.replace(artworkNeedle,homeHeader);
await writeFile(playerPath,player,'utf8');

// 3) Vraie page Home native + bibliothèque + mini lecteur fixe.
const home=String.raw`package com.nova.audify;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.util.List;

/** Audify V68.4 — Home native : likes, playlists et mini lecteur persistant. */
public class NativeHomeActivity extends AppCompatActivity {
    private AudifyLibraryStore store;
    private LinearLayout libraryContent;
    private LinearLayout miniPlayer;
    private TextView miniTitle;
    private TextView miniArtist;
    private Button miniToggle;
    private SeekBar miniTimeline;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean userSeeking = false;
    private double durationSeconds = 0.0;
    private AudifyLibraryStore.Track snapshotTrack;

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            refreshMiniPlayer();
            handler.postDelayed(this, 250);
        }
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(8,12,18));
        getWindow().setNavigationBarColor(Color.rgb(4,7,11));
        store = new AudifyLibraryStore(this);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8,12,18));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        libraryContent = new LinearLayout(this);
        libraryContent.setOrientation(LinearLayout.VERTICAL);
        libraryContent.setPadding(dp(18), dp(18), dp(18), dp(160));
        scroll.addView(libraryContent, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        miniPlayer = buildMiniPlayer();
        FrameLayout.LayoutParams miniLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(138), Gravity.BOTTOM);
        miniLp.setMargins(dp(10),0,dp(10),dp(8));
        root.addView(miniPlayer, miniLp);

        setContentView(root);
        rebuildLibrary();
        refreshMiniPlayer();
    }

    private void rebuildLibrary() {
        libraryContent.removeAllViews();

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        TextView logo = text("Audify", 28f, true);
        header.addView(logo, new LinearLayout.LayoutParams(0, dp(56), 1f));
        Button search = button("Recherche");
        search.setOnClickListener(v -> {
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
        });
        header.addView(search, new LinearLayout.LayoutParams(dp(135), dp(50)));
        libraryContent.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView likesTitle = text("Titres likés", 22f, true);
        LinearLayout.LayoutParams sectionLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sectionLp.topMargin = dp(20);
        libraryContent.addView(likesTitle, sectionLp);

        List<AudifyLibraryStore.Track> likes = store.getLikes();
        if (likes.isEmpty()) {
            TextView empty = text("Aucun titre liké pour l’instant.", 15f, false);
            empty.setTextColor(Color.rgb(150,160,174));
            empty.setPadding(0,dp(10),0,dp(8));
            libraryContent.addView(empty);
        } else {
            for (int i=0;i<likes.size();i++) {
                final int index=i;
                AudifyLibraryStore.Track t=likes.get(i);
                Button card=trackButton(t);
                card.setOnClickListener(v -> playCollection(likes,index));
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66));
                lp.topMargin=dp(7);
                libraryContent.addView(card,lp);
            }
        }

        TextView playlistsTitle = text("Playlists", 22f, true);
        LinearLayout.LayoutParams playlistsLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        playlistsLp.topMargin = dp(24);
        libraryContent.addView(playlistsTitle, playlistsLp);

        List<String> names=store.getPlaylistNames();
        if(names.isEmpty()) {
            TextView empty = text("Aucune playlist créée pour l’instant.", 15f, false);
            empty.setTextColor(Color.rgb(150,160,174));
            empty.setPadding(0,dp(10),0,dp(8));
            libraryContent.addView(empty);
        } else {
            for(String name:names) {
                List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
                Button b=button("▣  " + name + "   ·   " + tracks.size() + " titre" + (tracks.size()>1?"s":""));
                b.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
                b.setPadding(dp(16),0,dp(12),0);
                b.setOnClickListener(v -> showPlaylist(name));
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62));
                lp.topMargin=dp(7);
                libraryContent.addView(b,lp);
            }
        }
    }

    private LinearLayout buildMiniPlayer() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14),dp(9),dp(14),dp(8));
        card.setBackgroundColor(Color.rgb(24,29,38));
        card.setVisibility(View.GONE);
        card.setOnClickListener(v -> openCurrentPlayer());

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(0,0,dp(8),0);
        info.setOnClickListener(v -> openCurrentPlayer());
        miniTitle = text("",16f,true);
        miniTitle.setMaxLines(1);
        miniTitle.setEllipsize(TextUtils.TruncateAt.END);
        miniArtist = text("",13f,false);
        miniArtist.setTextColor(Color.rgb(174,183,196));
        miniArtist.setMaxLines(1);
        miniArtist.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(miniTitle);
        info.addView(miniArtist);
        top.addView(info,new LinearLayout.LayoutParams(0,dp(60),1f));

        miniToggle = button("Pause");
        miniToggle.setTextSize(14f);
        miniToggle.setOnClickListener(v -> {
            try { startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE)); }
            catch(Exception ignored) {}
            handler.postDelayed(this::refreshMiniPlayer,70);
        });
        top.addView(miniToggle,new LinearLayout.LayoutParams(dp(105),dp(52)));
        card.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        miniTimeline = new SeekBar(this);
        miniTimeline.setMax(1000);
        miniTimeline.setPadding(0,0,0,0);
        miniTimeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar,int progress,boolean fromUser) {}
            @Override public void onStartTrackingTouch(SeekBar seekBar) { userSeeking=true; }
            @Override public void onStopTrackingTouch(SeekBar seekBar) {
                double seconds=Math.max(0.0,durationSeconds)*(seekBar.getProgress()/1000.0);
                try {
                    startService(new Intent(NativeHomeActivity.this,AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_SEEK)
                        .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));
                } catch(Exception ignored) {}
                userSeeking=false;
                handler.postDelayed(NativeHomeActivity.this::refreshMiniPlayer,80);
            }
        });
        card.addView(miniTimeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52)));
        return card;
    }

    private void refreshMiniPlayer() {
        try {
            JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());
            String id=state.optString("videoId","");
            if(id.isEmpty()) {
                miniPlayer.setVisibility(View.GONE);
                snapshotTrack=null;
                return;
            }
            String title=state.optString("title","Sans titre");
            String artist=state.optString("artist","YouTube");
            String thumbnail=state.optString("thumbnail","");
            snapshotTrack=new AudifyLibraryStore.Track(id,title,artist,thumbnail);
            miniPlayer.setVisibility(View.VISIBLE);
            miniTitle.setText(title);
            miniArtist.setText(artist);
            boolean playing=state.optBoolean("playing",false);
            miniToggle.setText(playing?"Pause":"Lecture");
            double position=Math.max(0.0,state.optDouble("position",0.0));
            durationSeconds=Math.max(0.0,state.optDouble("duration",0.0));
            if(!userSeeking) {
                int p=durationSeconds>0 ? (int)Math.max(0,Math.min(1000,Math.round(position/durationSeconds*1000.0))) : 0;
                miniTimeline.setProgress(p);
            }
        } catch(Exception ignored) {}
    }

    private void openCurrentPlayer() {
        if(snapshotTrack==null || snapshotTrack.id.isEmpty()) return;
        Intent i=new Intent(this,NativePlayerActivity.class)
            .putExtra("videoId",snapshotTrack.id)
            .putExtra("title",snapshotTrack.title)
            .putExtra("artist",snapshotTrack.artist)
            .putExtra("thumbnail",snapshotTrack.thumbnail);
        startActivity(i);
    }

    private void showPlaylist(String name) {
        List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
        if(tracks.isEmpty()) return;
        String[] labels=new String[tracks.size()];
        for(int i=0;i<tracks.size();i++) labels[i]=tracks.get(i).title + "\n" + tracks.get(i).artist;
        new AlertDialog.Builder(this)
            .setTitle(name)
            .setItems(labels,(dialog,which)->playCollection(tracks,which))
            .setNegativeButton("Fermer",null)
            .show();
    }

    private void playCollection(List<AudifyLibraryStore.Track> tracks,int index) {
        if(tracks==null || tracks.isEmpty() || index<0 || index>=tracks.size()) return;
        AudifyLibraryStore.Track chosen=tracks.get(index);
        try {
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(tracks,index)));
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,chosen.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,chosen.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,chosen.thumbnail));
        } catch(Exception ignored) {}
        snapshotTrack=chosen;
        openCurrentPlayer();
    }

    private Button trackButton(AudifyLibraryStore.Track t) {
        Button b=button(t.title + "\n" + t.artist);
        b.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        b.setPadding(dp(16),0,dp(12),0);
        b.setMaxLines(2);
        b.setEllipsize(TextUtils.TruncateAt.END);
        return b;
    }

    private Button button(String label) {
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(15f);
        return b;
    }

    private TextView text(String value,float size,boolean bold) {
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextColor(Color.WHITE);
        t.setTextSize(size);
        if(bold) t.setTypeface(t.getTypeface(),android.graphics.Typeface.BOLD);
        t.setGravity(Gravity.CENTER_VERTICAL);
        return t;
    }

    @Override protected void onResume() {
        super.onResume();
        rebuildLibrary();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }

    @Override protected void onPause() {
        handler.removeCallbacks(ticker);
        super.onPause();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
`;
await writeFile(path.join(pkgDir,'NativeHomeActivity.java'),home,'utf8');

// 4) Déclarer la nouvelle Activity native.
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".NativeHomeActivity"')) {
  manifest=manifest.replace('</application>', `        <activity\n            android:name=".NativeHomeActivity"\n            android:exported="false"\n            android:screenOrientation="unspecified" />\n    </application>`);
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V68.4 : Home natif + likes/playlists + mini player persistant appliqués.');
