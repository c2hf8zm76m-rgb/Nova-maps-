import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const rootDir=path.resolve(here,'..');
const android=path.join(rootDir,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

// -----------------------------------------------------------------------------
// 1) Refonte totale du layout du grand lecteur, sans toucher au moteur.
// -----------------------------------------------------------------------------
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let src=await readFile(playerPath,'utf8');

if(!src.includes('import android.widget.ScrollView;')) {
  src=src.replace('import android.widget.SeekBar;', 'import android.widget.SeekBar;\nimport android.widget.ScrollView;');
}

const onCreateStart=src.indexOf('    @Override\n    protected void onCreate(Bundle savedInstanceState) {');
const weightedStart=src.indexOf('    private LinearLayout.LayoutParams weighted() {',onCreateStart);
if(onCreateStart<0 || weightedStart<0) throw new Error('NativePlayerActivity onCreate/weighted introuvables V68.7');

const newOnCreate=String.raw`    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getSupportActionBar() != null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.rgb(3,5,9));

        store = new AudifyLibraryStore(this);
        Intent source = getIntent();
        currentTrack = new AudifyLibraryStore.Track(
            source == null ? "" : source.getStringExtra("videoId"),
            source == null ? "Sans titre" : source.getStringExtra("title"),
            source == null ? "YouTube" : source.getStringExtra("artist"),
            source == null ? "" : source.getStringExtra("thumbnail")
        );
        displayedVideoId = currentTrack.id;

        root = new FrameLayout(this);
        applyGradient(themeTop, themeMid, themeBottom);

        // Zone centrale scrollable : actions hautes, pochette, titre et file.
        ScrollView scroller = new ScrollView(this);
        scroller.setFillViewport(true);
        scroller.setVerticalScrollBarEnabled(false);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(16), dp(12), dp(16), dp(190));
        scroller.addView(content,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroller,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        // En-tête compact en haut à gauche : Home, Playlist, Like.
        LinearLayout topActions = new LinearLayout(this);
        topActions.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        topActions.setOrientation(LinearLayout.HORIZONTAL);

        Button homeButton = iconButton("⌂");
        homeButton.setContentDescription("Accueil");
        homeButton.setOnClickListener(v -> {
            Intent homeIntent = new Intent(this, NativeHomeActivity.class);
            homeIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(homeIntent);
            finish();
        });
        topActions.addView(homeButton,iconLp());

        Button playlistTop = iconButton("＋");
        playlistTop.setContentDescription("Ajouter à une playlist");
        playlistTop.setOnClickListener(v -> showPlaylistPicker());
        LinearLayout.LayoutParams topIcon2=iconLp(); topIcon2.leftMargin=dp(9);
        topActions.addView(playlistTop,topIcon2);

        likeButton = iconButton("♡");
        likeButton.setContentDescription("Ajouter aux titres likés");
        likeButton.setOnClickListener(v -> {
            if (currentTrack == null || currentTrack.id.isEmpty()) {
                Toast.makeText(this,"Titre indisponible",Toast.LENGTH_SHORT).show();
                return;
            }
            boolean liked=store.toggleLike(currentTrack);
            applyLikeState(liked);
        });
        LinearLayout.LayoutParams topIcon3=iconLp(); topIcon3.leftMargin=dp(9);
        topActions.addView(likeButton,topIcon3);

        content.addView(topActions,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));

        int screenW=getResources().getDisplayMetrics().widthPixels;
        int screenH=getResources().getDisplayMetrics().heightPixels;
        int artworkSize=Math.max(dp(230),Math.min(dp(350),Math.min(screenW-dp(54),(int)(screenH*0.36f))));
        int discSize=(int)(artworkSize*0.72f);

        FrameLayout artwork=new FrameLayout(this);
        artwork.setClipChildren(false);
        artwork.setClipToPadding(false);

        coverImage=new ImageView(this);
        coverImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        coverImage.setBackgroundColor(Color.rgb(18,23,31));
        coverImage.setClipToOutline(true);
        coverImage.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){
                outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(25));
            }
        });
        artwork.addView(coverImage,new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER));

        View shade=new View(this);
        GradientDrawable shadeDrawable=new GradientDrawable();
        shadeDrawable.setShape(GradientDrawable.OVAL);
        shadeDrawable.setColor(Color.argb(105,0,0,0));
        shade.setBackground(shadeDrawable);
        artwork.addView(shade,new FrameLayout.LayoutParams(discSize+dp(18),discSize+dp(18),Gravity.CENTER));

        disc=new FrameLayout(this);
        GradientDrawable discBg=new GradientDrawable();
        discBg.setShape(GradientDrawable.OVAL);
        discBg.setColor(Color.rgb(5,7,10));
        discBg.setStroke(dp(5),Color.argb(190,235,240,248));
        disc.setBackground(discBg);
        disc.setPadding(dp(11),dp(11),dp(11),dp(11));
        artwork.addView(disc,new FrameLayout.LayoutParams(discSize,discSize,Gravity.CENTER));

        discImage=new ImageView(this);
        discImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        discImage.setClipToOutline(true);
        discImage.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){ outline.setOval(0,0,view.getWidth(),view.getHeight()); }
        });
        disc.addView(discImage,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        View spindle=new View(this);
        GradientDrawable spindleBg=new GradientDrawable();
        spindleBg.setShape(GradientDrawable.OVAL);
        spindleBg.setColor(Color.rgb(8,10,14));
        spindleBg.setStroke(dp(3),Color.WHITE);
        spindle.setBackground(spindleBg);
        disc.addView(spindle,new FrameLayout.LayoutParams(dp(27),dp(27),Gravity.CENTER));

        // Swipe Audify : droite = prochain, gauche = précédent.
        artwork.setClickable(true);
        artwork.setOnTouchListener((view,event)->{
            switch(event.getActionMasked()){
                case MotionEvent.ACTION_DOWN:
                    artworkTouchStartX=event.getRawX(); artworkTouchStartY=event.getRawY(); artworkSwiping=true;
                    view.animate().cancel(); return true;
                case MotionEvent.ACTION_MOVE:
                    if(!artworkSwiping) return true;
                    float liveDx=event.getRawX()-artworkTouchStartX;
                    float liveDy=event.getRawY()-artworkTouchStartY;
                    if(Math.abs(liveDx)>Math.abs(liveDy)) view.setTranslationX(liveDx*0.22f);
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if(!artworkSwiping) return true;
                    artworkSwiping=false;
                    float dx=event.getRawX()-artworkTouchStartX;
                    float dy=event.getRawY()-artworkTouchStartY;
                    boolean horizontal=Math.abs(dx)>=dp(70) && Math.abs(dx)>Math.abs(dy)*1.25f;
                    view.animate().translationX(0f).setDuration(180L).start();
                    if(horizontal){
                        startPlayerAction(dx>0 ? AudifyPlaybackService.ACTION_NEXT : AudifyPlaybackService.ACTION_PREVIOUS);
                        uiHandler.postDelayed(this::refreshFromPlayer,130L);
                        uiHandler.postDelayed(this::refreshFromPlayer,330L);
                    }
                    return true;
            }
            return true;
        });

        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(artworkSize,artworkSize);
        artLp.topMargin=dp(8);
        content.addView(artwork,artLp);

        titleView=new TextView(this);
        titleView.setText(currentTrack.title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(27f);
        titleView.setGravity(Gravity.CENTER);
        titleView.setMaxLines(2);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        titleView.setTypeface(titleView.getTypeface(),android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams titleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin=dp(20);
        content.addView(titleView,titleLp);

        artistView=new TextView(this);
        artistView.setText(currentTrack.artist);
        artistView.setTextColor(Color.rgb(190,197,207));
        artistView.setTextSize(16f);
        artistView.setGravity(Gravity.CENTER);
        artistView.setMaxLines(1);
        artistView.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams artistLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        artistLp.topMargin=dp(5);
        artistLp.bottomMargin=dp(13);
        content.addView(artistView,artistLp);

        // File d'attente façon capture : apparaît seulement s'il reste un titre.
        queueSection=new LinearLayout(this);
        queueSection.setOrientation(LinearLayout.VERTICAL);
        queueSection.setPadding(dp(12),dp(7),dp(12),dp(10));
        GradientDrawable queueBg=new GradientDrawable();
        queueBg.setColor(Color.argb(165,7,11,17));
        queueBg.setStroke(dp(1),Color.argb(110,130,145,165));
        queueBg.setCornerRadius(dp(22));
        queueSection.setBackground(queueBg);
        queueSection.setVisibility(View.GONE);

        LinearLayout queueHeader=new LinearLayout(this);
        queueHeader.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout queueTitles=new LinearLayout(this);
        queueTitles.setOrientation(LinearLayout.VERTICAL);
        TextView following=new TextView(this);
        following.setText("À SUIVRE"); following.setTextSize(11f); following.setTextColor(Color.rgb(168,255,63));
        following.setTypeface(following.getTypeface(),android.graphics.Typeface.BOLD);
        TextView queueLabel=new TextView(this);
        queueLabel.setText("File d’attente"); queueLabel.setTextSize(16f); queueLabel.setTextColor(Color.WHITE);
        queueLabel.setTypeface(queueLabel.getTypeface(),android.graphics.Typeface.BOLD);
        queueTitles.addView(following); queueTitles.addView(queueLabel);
        queueHeader.addView(queueTitles,new LinearLayout.LayoutParams(0,dp(48),1f));
        queueCountView=new TextView(this);
        queueCountView.setTextColor(Color.rgb(165,175,188)); queueCountView.setTextSize(12f);
        queueCountView.setGravity(Gravity.END|Gravity.CENTER_VERTICAL);
        queueHeader.addView(queueCountView,new LinearLayout.LayoutParams(dp(100),dp(48)));
        queueSection.addView(queueHeader,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        HorizontalScrollView queueScroll=new HorizontalScrollView(this);
        queueScroll.setHorizontalScrollBarEnabled(false);
        queueScroll.setFillViewport(false);
        queueRow=new LinearLayout(this);
        queueRow.setOrientation(LinearLayout.HORIZONTAL);
        queueRow.setGravity(Gravity.CENTER_VERTICAL);
        queueScroll.addView(queueRow,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(112)));
        queueSection.addView(queueScroll,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(116)));
        LinearLayout.LayoutParams queueLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        queueLp.topMargin=dp(10);
        content.addView(queueSection,queueLp);

        // -----------------------------------------------------------------
        // Bloc de contrôle fixe en bas, inspiré de la capture Audify Web.
        // -----------------------------------------------------------------
        LinearLayout controls=new LinearLayout(this);
        controls.setOrientation(LinearLayout.VERTICAL);
        controls.setPadding(dp(12),dp(10),dp(12),dp(8));
        GradientDrawable controlsBg=new GradientDrawable();
        controlsBg.setColor(Color.argb(230,30,35,43));
        controlsBg.setStroke(dp(1),Color.argb(120,145,155,170));
        controlsBg.setCornerRadius(dp(28));
        controls.setBackground(controlsBg);

        LinearLayout controlTop=new LinearLayout(this);
        controlTop.setGravity(Gravity.CENTER_VERTICAL);

        playPauseButton=new Button(this);
        playPauseButton.setAllCaps(false);
        playPauseButton.setText("⏸");
        playPauseButton.setTextSize(28f);
        playPauseButton.setTextColor(Color.rgb(8,11,16));
        playPauseButton.setPadding(0,0,0,0);
        GradientDrawable playBg=new GradientDrawable();
        playBg.setShape(GradientDrawable.OVAL);
        playBg.setColor(Color.rgb(241,244,249));
        playBg.setStroke(dp(7),Color.argb(60,255,255,255));
        playPauseButton.setBackground(playBg);
        playPauseButton.setOnClickListener(v->{
            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);
            lastPlaying=!lastPlaying;
            applyPlayState(lastPlaying);
            uiHandler.postDelayed(this::refreshFromPlayer,80);
        });
        controlTop.addView(playPauseButton,new LinearLayout.LayoutParams(dp(82),dp(82)));

        View spacer=new View(this);
        controlTop.addView(spacer,new LinearLayout.LayoutParams(0,1,1f));

        Button karaokeButton=pillButton("🎤  Paroles");
        karaokeButton.setContentDescription("Ouvrir le mode Karaoké");
        karaokeButton.setOnClickListener(v->openKaraoke());
        controlTop.addView(karaokeButton,new LinearLayout.LayoutParams(dp(165),dp(58)));
        controls.addView(controlTop,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(88)));

        LinearLayout timelineRow=new LinearLayout(this);
        timelineRow.setGravity(Gravity.CENTER_VERTICAL);
        timeline=new SeekBar(this);
        timeline.setMax(1000);
        timeline.setProgress(0);
        timeline.setPadding(0,0,0,0);
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){ userSeeking=true; }
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,lastDurationSeconds)*(s.getProgress()/1000.0);
                try{
                    startService(new Intent(NativePlayerActivity.this,AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_SEEK)
                        .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));
                }catch(Exception ignored){}
                userSeeking=false;
                uiHandler.postDelayed(NativePlayerActivity.this::refreshFromPlayer,80);
            }
        });
        timelineRow.addView(timeline,new LinearLayout.LayoutParams(0,dp(52),1f));

        repeatButton=iconButton("↻");
        repeatButton.setTextSize(22f);
        repeatButton.setOnClickListener(v->{
            repeatOne=!repeatOne;
            try{
                startService(new Intent(this,AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_REPEAT)
                    .putExtra(AudifyPlaybackService.EXTRA_REPEAT,repeatOne));
            }catch(Exception ignored){}
            applyRepeatState();
        });
        LinearLayout.LayoutParams repeatLp=new LinearLayout.LayoutParams(dp(52),dp(52)); repeatLp.leftMargin=dp(7);
        timelineRow.addView(repeatButton,repeatLp);
        controls.addView(timelineRow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));

        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(164),Gravity.BOTTOM);
        controlsLp.setMargins(dp(12),0,dp(12),dp(10));
        root.addView(controls,controlsLp);

        setContentView(root);
        loadArtwork(currentTrack.thumbnail,currentTrack.id);
        applyLikeState(currentTrack!=null && store.isLiked(currentTrack.id));
        refreshFromPlayer();
    }

`;
src=src.slice(0,onCreateStart)+newOnCreate+src.slice(weightedStart);

// Helpers de style et ouverture du mode karaoké.
const helperMarker='    private LinearLayout.LayoutParams weighted() {';
const helperMethods=String.raw`    private LinearLayout.LayoutParams iconLp() {
        return new LinearLayout.LayoutParams(dp(54),dp(54));
    }

    private Button iconButton(String text) {
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextSize(21f);
        b.setTextColor(Color.WHITE);
        b.setGravity(Gravity.CENTER);
        b.setPadding(0,0,0,0);
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(Color.argb(155,18,23,31));
        bg.setStroke(dp(1),Color.argb(125,145,155,170));
        bg.setCornerRadius(dp(18));
        b.setBackground(bg);
        return b;
    }

    private Button pillButton(String text) {
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextSize(16f);
        b.setTypeface(b.getTypeface(),android.graphics.Typeface.BOLD);
        b.setTextColor(Color.WHITE);
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(Color.argb(185,24,30,38));
        bg.setStroke(dp(1),Color.argb(130,168,255,63));
        bg.setCornerRadius(dp(24));
        b.setBackground(bg);
        return b;
    }

    private void openKaraoke() {
        if(currentTrack==null || currentTrack.id.isEmpty()) return;
        startActivity(new Intent(this,NativeKaraokeActivity.class)
            .putExtra("videoId",currentTrack.id)
            .putExtra("title",currentTrack.title)
            .putExtra("artist",currentTrack.artist)
            .putExtra("thumbnail",currentTrack.thumbnail));
    }

`;
if(!src.includes(helperMarker)) throw new Error('Insertion helpers V68.7 introuvable');
src=src.replace(helperMarker,helperMethods+helperMarker);

// Bouton lecture sous forme d'icône réelle.
const playStateStart=src.indexOf('    private void applyPlayState(boolean playing) {');
const discMethodStart=src.indexOf('    private void setDiscPlaying(boolean playing) {',playStateStart);
if(playStateStart<0 || discMethodStart<0) throw new Error('applyPlayState introuvable V68.7');
src=src.slice(0,playStateStart)+String.raw`    private void applyPlayState(boolean playing) {
        lastPlaying=playing;
        if(playPauseButton!=null){
            playPauseButton.setText(playing ? "⏸" : "▶");
            playPauseButton.setContentDescription(playing ? "Mettre en pause" : "Lancer la lecture");
        }
        setDiscPlaying(playing);
    }

`+src.slice(discMethodStart);

const repeatStateStart=src.indexOf('    private void applyRepeatState() {');
const likeStateStart=src.indexOf('    private void applyLikeState(boolean liked) {',repeatStateStart);
if(repeatStateStart<0 || likeStateStart<0) throw new Error('applyRepeatState introuvable V68.7');
src=src.slice(0,repeatStateStart)+String.raw`    private void applyRepeatState() {
        if(repeatButton==null) return;
        repeatButton.setText(repeatOne ? "↻¹" : "↻");
        repeatButton.setTextColor(repeatOne ? Color.rgb(168,255,63) : Color.WHITE);
        repeatButton.setContentDescription(repeatOne ? "Lecture en boucle activée" : "Lecture en boucle désactivée");
    }

`+src.slice(likeStateStart);

const likeStateStart2=src.indexOf('    private void applyLikeState(boolean liked) {');
const loadArtworkStart=src.indexOf('    private void loadArtwork(',likeStateStart2);
if(likeStateStart2<0 || loadArtworkStart<0) throw new Error('applyLikeState introuvable V68.7');
src=src.slice(0,likeStateStart2)+String.raw`    private void applyLikeState(boolean liked) {
        if(likeButton==null) return;
        likeButton.setText(liked ? "♥" : "♡");
        likeButton.setTextColor(liked ? Color.rgb(236,70,103) : Color.WHITE);
        likeButton.setContentDescription(liked ? "Titre liké" : "Ajouter aux titres likés");
    }

`+src.slice(loadArtworkStart);

await writeFile(playerPath,src,'utf8');

// -----------------------------------------------------------------------------
// 2) Page Karaoké native : grandes lignes + surbrillance synchronisée LRCLIB.
// -----------------------------------------------------------------------------
const karaoke=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Audify V68.7 — mode paroles / karaoké natif. */
public class NativeKaraokeActivity extends AppCompatActivity {
    private static final class LyricLine {
        final double time;
        final String text;
        LyricLine(double time,String text){ this.time=time; this.text=text; }
    }

    private final Handler handler=new Handler(Looper.getMainLooper());
    private final List<LyricLine> lines=new ArrayList<>();
    private final List<TextView> lineViews=new ArrayList<>();
    private ScrollView scroll;
    private LinearLayout lyricsBox;
    private Button toggle;
    private SeekBar timeline;
    private boolean userSeeking=false;
    private double duration=0.0;
    private int activeIndex=-1;
    private String title="";
    private String artist="";

    private final Runnable ticker=new Runnable(){
        @Override public void run(){ refresh(); handler.postDelayed(this,220); }
    };

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(3,5,8));
        Intent in=getIntent();
        title=in==null?"":safe(in.getStringExtra("title"));
        artist=in==null?"":safe(in.getStringExtra("artist"));

        FrameLayout root=new FrameLayout(this);
        GradientDrawable rootBg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(15,21,29),Color.rgb(5,8,13),Color.rgb(3,5,8)});
        root.setBackground(rootBg);

        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18),dp(12),dp(18),dp(154));

        LinearLayout header=new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        Button back=smallButton("‹ Lecteur");
        back.setOnClickListener(v->finish());
        header.addView(back,new LinearLayout.LayoutParams(dp(112),dp(48)));
        LinearLayout copy=new LinearLayout(this); copy.setOrientation(LinearLayout.VERTICAL); copy.setPadding(dp(10),0,0,0);
        TextView t=text(title,16f,true,Color.WHITE); t.setMaxLines(1); t.setEllipsize(TextUtils.TruncateAt.END);
        TextView a=text(artist,12f,false,Color.rgb(155,164,177)); a.setMaxLines(1); a.setEllipsize(TextUtils.TruncateAt.END);
        copy.addView(t); copy.addView(a);
        header.addView(copy,new LinearLayout.LayoutParams(0,dp(48),1f));
        page.addView(header,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));

        TextView mode=text("KARAOKÉ",12f,true,Color.rgb(168,255,63));
        LinearLayout.LayoutParams modeLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); modeLp.topMargin=dp(10);
        page.addView(mode,modeLp);

        scroll=new ScrollView(this); scroll.setVerticalScrollBarEnabled(false);
        lyricsBox=new LinearLayout(this); lyricsBox.setOrientation(LinearLayout.VERTICAL); lyricsBox.setPadding(dp(8),dp(30),dp(8),dp(80));
        TextView loading=text("Chargement des paroles…",29f,true,Color.rgb(110,118,130));
        lyricsBox.addView(loading);
        scroll.addView(lyricsBox,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        page.addView(scroll,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f));
        root.addView(page,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout controls=new LinearLayout(this); controls.setOrientation(LinearLayout.VERTICAL); controls.setPadding(dp(12),dp(8),dp(12),dp(6));
        GradientDrawable cbg=new GradientDrawable(); cbg.setColor(Color.argb(235,28,33,41)); cbg.setCornerRadius(dp(26)); cbg.setStroke(dp(1),Color.argb(100,150,160,175)); controls.setBackground(cbg);
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL);
        toggle=roundPlay("⏸");
        toggle.setOnClickListener(v->{ startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE)); handler.postDelayed(this::refresh,70); });
        top.addView(toggle,new LinearLayout.LayoutParams(dp(72),dp(72)));
        TextView now=text("Paroles synchronisées avec Audify",14f,true,Color.WHITE); now.setPadding(dp(15),0,0,0);
        top.addView(now,new LinearLayout.LayoutParams(0,dp(72),1f));
        controls.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(76)));

        timeline=new SeekBar(this); timeline.setMax(1000);
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){ userSeeking=true; }
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,duration)*(s.getProgress()/1000.0);
                startService(new Intent(NativeKaraokeActivity.this,AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_SEEK)
                    .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));
                userSeeking=false;
            }
        });
        controls.addView(timeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));
        FrameLayout.LayoutParams clp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(140),Gravity.BOTTOM); clp.setMargins(dp(12),0,dp(12),dp(9)); root.addView(controls,clp);

        setContentView(root);
        fetchLyrics();
    }

    private void fetchLyrics(){
        new Thread(()->{
            try{
                String query=cleanTitle(title)+" "+artist;
                String endpoint="https://lrclib.net/api/search?q="+URLEncoder.encode(query,StandardCharsets.UTF_8.name());
                HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();
                c.setConnectTimeout(7000); c.setReadTimeout(8000); c.setRequestProperty("User-Agent","AudifyAndroid/68.7");
                StringBuilder body=new StringBuilder();
                try(BufferedReader r=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8))){ String line; while((line=r.readLine())!=null) body.append(line); }
                c.disconnect();
                JSONArray arr=new JSONArray(body.toString());
                if(arr.length()==0){ runOnUiThread(()->showMessage("Paroles indisponibles pour ce titre.")); return; }
                JSONObject best=arr.optJSONObject(0);
                String synced=best==null?"":best.optString("syncedLyrics","");
                String plain=best==null?"":best.optString("plainLyrics","");
                if(!synced.isEmpty()) parseSynced(synced);
                else parsePlain(plain);
                runOnUiThread(this::renderLyrics);
            }catch(Throwable e){ runOnUiThread(()->showMessage("Paroles indisponibles pour ce titre.")); }
        },"audify-karaoke").start();
    }

    private void parseSynced(String raw){
        Pattern p=Pattern.compile("\\[(\\d{1,2}):(\\d{2})(?:\\.(\\d{1,3}))?\\]\\s*(.*)");
        for(String line:raw.split("\\n")){
            Matcher m=p.matcher(line.trim()); if(!m.matches()) continue;
            int min=Integer.parseInt(m.group(1)); int sec=Integer.parseInt(m.group(2));
            String fraction=m.group(3); double frac=0.0;
            if(fraction!=null&&!fraction.isEmpty()) frac=Double.parseDouble("0."+fraction);
            String text=m.group(4)==null?"":m.group(4).trim();
            if(!text.isEmpty()) lines.add(new LyricLine(min*60+sec+frac,text));
        }
    }

    private void parsePlain(String raw){
        if(raw==null||raw.trim().isEmpty()) return;
        double fake=0.0;
        for(String line:raw.split("\\n")){ String t=line.trim(); if(t.isEmpty()) continue; lines.add(new LyricLine(fake,t)); fake+=6.0; }
    }

    private void renderLyrics(){
        lyricsBox.removeAllViews(); lineViews.clear(); activeIndex=-1;
        if(lines.isEmpty()){ showMessage("Paroles indisponibles pour ce titre."); return; }
        for(LyricLine line:lines){
            TextView v=text(line.text,30f,true,Color.rgb(82,89,101));
            v.setPadding(0,dp(12),0,dp(12));
            v.setLineSpacing(0f,1.02f);
            lyricsBox.addView(v,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
            lineViews.add(v);
        }
        refresh();
    }

    private void refresh(){
        try{
            JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());
            boolean playing=state.optBoolean("playing",false);
            toggle.setText(playing?"⏸":"▶");
            double pos=Math.max(0.0,state.optDouble("position",0.0));
            duration=Math.max(0.0,state.optDouble("duration",0.0));
            if(!userSeeking){ int p=duration>0?(int)Math.max(0,Math.min(1000,Math.round(pos/duration*1000.0))):0; timeline.setProgress(p); }
            if(!lines.isEmpty()){
                int idx=0;
                for(int i=0;i<lines.size();i++){ if(lines.get(i).time<=pos) idx=i; else break; }
                if(idx!=activeIndex){
                    if(activeIndex>=0&&activeIndex<lineViews.size()){ lineViews.get(activeIndex).setTextColor(Color.rgb(82,89,101)); lineViews.get(activeIndex).setTextSize(30f); }
                    activeIndex=idx;
                    TextView active=lineViews.get(idx); active.setTextColor(Color.WHITE); active.setTextSize(34f);
                    active.post(()->scroll.smoothScrollTo(0,Math.max(0,active.getTop()-scroll.getHeight()/3)));
                }
            }
        }catch(Throwable ignored){}
    }

    private void showMessage(String message){ lyricsBox.removeAllViews(); lyricsBox.addView(text(message,28f,true,Color.rgb(130,138,150))); }
    private String cleanTitle(String s){ return safe(s).replaceAll("(?i)\\s*[\\[(].*?(official|clip|video|audio|visualizer).*?[\\])]\\s*"," ").replaceAll("(?i)official\\s+(music\\s+)?video|clip officiel|official audio|visualizer"," ").trim(); }
    private String safe(String s){ return s==null?"":s; }
    private Button smallButton(String label){ Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextColor(Color.WHITE); b.setTextSize(14f); return b; }
    private Button roundPlay(String label){ Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextSize(25f); b.setTextColor(Color.rgb(7,10,15)); GradientDrawable g=new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(Color.WHITE); b.setBackground(g); return b; }
    private TextView text(String value,float size,boolean bold,int color){ TextView t=new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD); t.setGravity(Gravity.CENTER_VERTICAL); return t; }
    private int dp(int v){ return Math.round(v*getResources().getDisplayMetrics().density); }
    @Override protected void onStart(){ super.onStart(); handler.removeCallbacks(ticker); handler.post(ticker); }
    @Override protected void onStop(){ handler.removeCallbacks(ticker); super.onStop(); }
    @Override protected void onDestroy(){ handler.removeCallbacksAndMessages(null); super.onDestroy(); }
}
`;
await writeFile(path.join(pkgDir,'NativeKaraokeActivity.java'),karaoke,'utf8');

const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".NativeKaraokeActivity"')){
  manifest=manifest.replace('</application>',`        <activity\n            android:name=".NativeKaraokeActivity"\n            android:exported="false"\n            android:screenOrientation="unspecified" />\n    </application>`);
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V68.7 : refonte lecteur type capture + actions hautes + contrôle bas + mode Karaoké natif.');
