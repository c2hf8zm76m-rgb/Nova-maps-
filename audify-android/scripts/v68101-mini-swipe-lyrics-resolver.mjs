import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const karaokePath=path.join(pkgDir,'NativeKaraokeActivity.java');

function replaceMethod(source, signatures, replacement, label){
  for(const sig of signatures){
    const start=source.indexOf(sig);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){ end=i+1; break; }
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.10.1 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) MINI PLAYER — swipe uniquement sur les zones libres du mini lecteur.
//    Convention Audify existante : swipe droite = suivant, gauche = précédent.
// =============================================================================
let home=await readFile(homePath,'utf8');
if(!home.includes('import android.view.MotionEvent;')){
  home=home.replace('import android.view.Gravity;','import android.view.Gravity;\nimport android.view.MotionEvent;');
}
if(!home.includes('private float miniSwipeStartX')){
  home=home.replace(
    '    private String miniArtworkId="";',
    '    private String miniArtworkId="";\n    private float miniSwipeStartX=0f;\n    private float miniSwipeStartY=0f;\n    private boolean miniSwipeTracking=false;'
  );
}

home=replaceMethod(home,['    private LinearLayout buildMiniPlayer(){','    private LinearLayout buildMiniPlayer() {'],String.raw`    private LinearLayout buildMiniPlayer(){
        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(11),dp(9),dp(11),dp(7));
        GradientDrawable glass=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(214,66,76,94),Color.argb(178,35,43,58),Color.argb(155,20,26,36)}
        );
        glass.setStroke(dp(1),Color.argb(115,244,248,255));
        glass.setCornerRadius(dp(29));
        card.setBackground(glass);
        card.setElevation(dp(20));
        card.setVisibility(View.GONE);
        card.setClickable(true);

        LinearLayout top=new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);

        miniArtwork=new ImageView(this);
        miniArtwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
        miniArtwork.setClipToOutline(true);
        miniArtwork.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){ outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(15)); }
        });
        miniArtwork.setBackgroundColor(Color.rgb(25,31,41));
        miniArtwork.setOnClickListener(v->openCurrentPlayer());
        top.addView(miniArtwork,new LinearLayout.LayoutParams(dp(58),dp(58)));

        LinearLayout info=new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setGravity(Gravity.CENTER_VERTICAL);
        info.setPadding(dp(11),0,dp(8),0);
        info.setOnClickListener(v->openCurrentPlayer());
        miniTitle=text("",15.5f,true);
        miniTitle.setMaxLines(1);
        miniTitle.setEllipsize(TextUtils.TruncateAt.END);
        miniArtist=text("",12.5f,false);
        miniArtist.setTextColor(Color.rgb(190,199,212));
        miniArtist.setMaxLines(1);
        miniArtist.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(miniTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(29)));
        info.addView(miniArtist,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(23)));
        top.addView(info,new LinearLayout.LayoutParams(0,dp(58),1f));

        miniToggle=new Button(this);
        miniToggle.setAllCaps(false);
        miniToggle.setText("Ⅱ");
        miniToggle.setTextSize(20f);
        miniToggle.setTextColor(Color.rgb(8,11,16));
        miniToggle.setPadding(0,0,0,0);
        GradientDrawable toggleBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(255,255,255),Color.rgb(226,233,244)}
        );
        toggleBg.setShape(GradientDrawable.OVAL);
        toggleBg.setStroke(dp(2),Color.argb(180,255,255,255));
        miniToggle.setBackground(toggleBg);
        miniToggle.setElevation(dp(9));
        miniToggle.setOnClickListener(v->{
            animateHomePress(miniToggle);
            try{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));}catch(Exception ignored){}
            handler.postDelayed(this::refreshMiniPlayer,70);
        });
        top.addView(miniToggle,new LinearLayout.LayoutParams(dp(56),dp(56)));
        card.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        miniTimeline=new SeekBar(this);
        miniTimeline.setMax(1000);
        miniTimeline.setPadding(0,0,0,0);
        miniTimeline.setProgressTintList(ColorStateList.valueOf(ACCENT));
        miniTimeline.setProgressBackgroundTintList(ColorStateList.valueOf(Color.argb(90,238,244,252)));
        miniTimeline.setThumbTintList(ColorStateList.valueOf(Color.rgb(248,250,255)));
        miniTimeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){userSeeking=true;}
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,durationSeconds)*(s.getProgress()/1000.0);
                try{startService(new Intent(NativeHomeActivity.this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SEEK).putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));}catch(Exception ignored){}
                userSeeking=false;
                handler.postDelayed(NativeHomeActivity.this::refreshMiniPlayer,80);
            }
        });
        card.addView(miniTimeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(34)));

        // Le listener appartient seulement à la surface libre de la carte : les enfants
        // cliquables (pochette, infos, Play/Pause, timeline) conservent leurs gestes.
        card.setOnTouchListener((view,event)->{
            switch(event.getActionMasked()){
                case MotionEvent.ACTION_DOWN:
                    miniSwipeStartX=event.getRawX();
                    miniSwipeStartY=event.getRawY();
                    miniSwipeTracking=true;
                    view.animate().cancel();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if(!miniSwipeTracking) return true;
                    float liveDx=event.getRawX()-miniSwipeStartX;
                    float liveDy=event.getRawY()-miniSwipeStartY;
                    if(Math.abs(liveDx)>dp(8) && Math.abs(liveDx)>Math.abs(liveDy)*1.15f){
                        if(view.getParent()!=null) view.getParent().requestDisallowInterceptTouchEvent(true);
                        view.setTranslationX(liveDx*0.20f);
                        view.setAlpha(1f-Math.min(0.16f,Math.abs(liveDx)/(getResources().getDisplayMetrics().widthPixels*3.2f)));
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if(!miniSwipeTracking) return true;
                    miniSwipeTracking=false;
                    float dx=event.getRawX()-miniSwipeStartX;
                    float dy=event.getRawY()-miniSwipeStartY;
                    boolean horizontal=Math.abs(dx)>=dp(64) && Math.abs(dx)>Math.abs(dy)*1.25f;
                    if(horizontal){
                        float out=dx>0?dp(42):-dp(42);
                        view.animate().translationX(out).alpha(0.70f).setDuration(90L).withEndAction(()->{
                            try{
                                startService(new Intent(this,AudifyPlaybackService.class)
                                    .setAction(dx>0?AudifyPlaybackService.ACTION_NEXT:AudifyPlaybackService.ACTION_PREVIOUS));
                            }catch(Exception ignored){}
                            view.setTranslationX(-out*0.35f);
                            view.animate().translationX(0f).alpha(1f).setDuration(190L).start();
                            handler.postDelayed(this::refreshMiniPlayer,90L);
                            handler.postDelayed(this::refreshMiniPlayer,280L);
                            handler.postDelayed(this::refreshMiniPlayer,620L);
                        }).start();
                    }else{
                        view.animate().translationX(0f).alpha(1f).setDuration(150L).start();
                        if(Math.hypot(dx,dy)<dp(12)) openCurrentPlayer();
                    }
                    if(view.getParent()!=null) view.getParent().requestDisallowInterceptTouchEvent(false);
                    return true;
            }
            return true;
        });
        return card;
    }`,'buildMiniPlayer');

await writeFile(homePath,home,'utf8');

// =============================================================================
// 2) PAROLES — nouveau résolveur Audify : nettoyage YouTube, LRCLIB exact +
//    recherche scorée + fallback lyrics.ovh + cache local. Aucun faux timing.
// =============================================================================
const karaoke=String.raw`package com.nova.audify;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
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
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Audify V68.10.1 — paroles intelligentes et karaoké natif. */
public class NativeKaraokeActivity extends AppCompatActivity {
    private static final String CACHE_PREFS="audify_lyrics_cache_v68101";
    private static final String CLIENT="AudifyAndroid/68.10.1 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)";

    private static final class LyricLine {
        final double time;
        final String text;
        LyricLine(double time,String text){ this.time=time; this.text=text; }
    }
    private static final class Meta {
        final String title;
        final String artist;
        Meta(String title,String artist){ this.title=title; this.artist=artist; }
    }
    private static final class LyricsResult {
        final String synced;
        final String plain;
        final String source;
        final long lrclibId;
        LyricsResult(String synced,String plain,String source,long id){
            this.synced=synced==null?"":synced;
            this.plain=plain==null?"":plain;
            this.source=source==null?"":source;
            this.lrclibId=id;
        }
        boolean hasLyrics(){ return !synced.trim().isEmpty()||!plain.trim().isEmpty(); }
    }

    private final Handler handler=new Handler(Looper.getMainLooper());
    private final List<LyricLine> lines=new ArrayList<>();
    private final List<TextView> lineViews=new ArrayList<>();
    private ScrollView scroll;
    private LinearLayout lyricsBox;
    private Button toggle;
    private SeekBar timeline;
    private TextView modeView;
    private TextView statusView;
    private boolean userSeeking=false;
    private boolean syncedMode=false;
    private double duration=0.0;
    private int activeIndex=-1;
    private String rawTitle="";
    private String rawArtist="";
    private String videoId="";
    private Meta resolvedMeta;

    private final Runnable ticker=new Runnable(){
        @Override public void run(){ refresh(); handler.postDelayed(this,220); }
    };

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(3,5,8));
        Intent in=getIntent();
        rawTitle=in==null?"":safe(in.getStringExtra("title"));
        rawArtist=in==null?"":safe(in.getStringExtra("artist"));
        videoId=in==null?"":safe(in.getStringExtra("videoId"));
        resolvedMeta=resolveMetadata(rawTitle,rawArtist);

        FrameLayout root=new FrameLayout(this);
        GradientDrawable rootBg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(18,27,27),Color.rgb(8,13,16),Color.rgb(3,5,8)});
        root.setBackground(rootBg);

        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18),dp(12),dp(18),dp(154));

        LinearLayout header=new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        Button back=smallButton("‹ Lecteur");
        back.setOnClickListener(v->finish());
        header.addView(back,new LinearLayout.LayoutParams(dp(112),dp(48)));
        LinearLayout copy=new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10),0,0,0);
        TextView t=text(resolvedMeta.title,16f,true,Color.WHITE);
        t.setMaxLines(1); t.setEllipsize(TextUtils.TruncateAt.END);
        TextView a=text(resolvedMeta.artist,12f,false,Color.rgb(155,164,177));
        a.setMaxLines(1); a.setEllipsize(TextUtils.TruncateAt.END);
        copy.addView(t); copy.addView(a);
        header.addView(copy,new LinearLayout.LayoutParams(0,dp(48),1f));
        page.addView(header,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));

        modeView=text("PAROLES AUDIFY",12f,true,Color.rgb(168,255,63));
        LinearLayout.LayoutParams modeLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        modeLp.topMargin=dp(10);
        page.addView(modeView,modeLp);

        statusView=text("Recherche intelligente des paroles…",13f,false,Color.rgb(165,175,188));
        LinearLayout.LayoutParams statusLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38));
        statusLp.topMargin=dp(3);
        page.addView(statusView,statusLp);

        scroll=new ScrollView(this);
        scroll.setVerticalScrollBarEnabled(false);
        lyricsBox=new LinearLayout(this);
        lyricsBox.setOrientation(LinearLayout.VERTICAL);
        lyricsBox.setPadding(dp(8),dp(20),dp(8),dp(80));
        TextView loading=text("Recherche des paroles…",28f,true,Color.rgb(110,118,130));
        lyricsBox.addView(loading);
        scroll.addView(lyricsBox,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        page.addView(scroll,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f));
        root.addView(page,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout controls=new LinearLayout(this);
        controls.setOrientation(LinearLayout.VERTICAL);
        controls.setPadding(dp(12),dp(8),dp(12),dp(6));
        GradientDrawable cbg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(225,45,58,55),Color.argb(205,24,31,37),Color.argb(190,15,20,27)}
        );
        cbg.setCornerRadius(dp(26));
        cbg.setStroke(dp(1),Color.argb(135,168,255,63));
        controls.setBackground(cbg);
        controls.setElevation(dp(16));
        LinearLayout top=new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        toggle=roundPlay("⏸");
        toggle.setOnClickListener(v->{
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));
            handler.postDelayed(this::refresh,70);
        });
        top.addView(toggle,new LinearLayout.LayoutParams(dp(72),dp(72)));
        TextView now=text("Synchronisé avec le lecteur Audify",14f,true,Color.WHITE);
        now.setPadding(dp(15),0,0,0);
        top.addView(now,new LinearLayout.LayoutParams(0,dp(72),1f));
        controls.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(76)));

        timeline=new SeekBar(this);
        timeline.setMax(1000);
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
        FrameLayout.LayoutParams clp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(140),Gravity.BOTTOM);
        clp.setMargins(dp(12),0,dp(12),dp(9));
        root.addView(controls,clp);

        setContentView(root);
        fetchLyrics();
    }

    private void fetchLyrics(){
        statusView.setText("Nettoyage du titre et recherche…");
        LyricsResult cached=readCache();
        if(cached!=null&&cached.hasLyrics()){
            applyLyrics(cached,true);
            return;
        }

        new Thread(()->{
            try{
                double trackDuration=waitForDuration();
                runOnUiThread(()->statusView.setText("Recherche LRCLIB…"));
                LyricsResult result=resolveFromLrclib(resolvedMeta,trackDuration);
                if(result==null||!result.hasLyrics()){
                    runOnUiThread(()->statusView.setText("Recherche de secours…"));
                    result=resolveFromLyricsOvh(resolvedMeta);
                }
                if(result!=null&&result.hasLyrics()){
                    writeCache(result);
                    LyricsResult finalResult=result;
                    runOnUiThread(()->applyLyrics(finalResult,false));
                }else{
                    runOnUiThread(()->showFailure("Paroles introuvables après plusieurs recherches."));
                }
            }catch(Throwable e){
                runOnUiThread(()->showFailure("Impossible de récupérer les paroles pour le moment."));
            }
        },"audify-lyrics-resolver").start();
    }

    private double waitForDuration(){
        for(int i=0;i<8;i++){
            try{
                JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());
                double d=state.optDouble("duration",0.0);
                if(d>=1.0&&d<=3600.0) return d;
            }catch(Throwable ignored){}
            try{Thread.sleep(250L);}catch(InterruptedException ignored){Thread.currentThread().interrupt();break;}
        }
        return 0.0;
    }

    private LyricsResult resolveFromLrclib(Meta meta,double trackDuration) throws Exception {
        ArrayList<JSONObject> candidates=new ArrayList<>();
        Set<String> seen=new HashSet<>();

        // 1. Match exact avec durée, puis sans durée si nécessaire.
        String exact="https://lrclib.net/api/get?track_name="+q(meta.title)+"&artist_name="+q(meta.artist);
        if(trackDuration>=1&&trackDuration<=3600) exact+="&duration="+Math.round(trackDuration);
        JSONObject direct=parseObject(httpGet(exact));
        addCandidate(candidates,seen,direct);

        if(direct==null&&trackDuration>0){
            Thread.sleep(280L);
            direct=parseObject(httpGet("https://lrclib.net/api/get?track_name="+q(meta.title)+"&artist_name="+q(meta.artist)));
            addCandidate(candidates,seen,direct);
        }

        // 2. Recherche structurée : on récupère jusqu'à 20 candidats et on les score.
        Thread.sleep(280L);
        JSONArray structured=parseArray(httpGet("https://lrclib.net/api/search?track_name="+q(meta.title)+"&artist_name="+q(meta.artist)));
        addCandidates(candidates,seen,structured);

        // 3. Requête large uniquement si le moteur structuré est pauvre.
        if(candidates.size()<3){
            Thread.sleep(280L);
            JSONArray broad=parseArray(httpGet("https://lrclib.net/api/search?q="+q(meta.title+" "+meta.artist)));
            addCandidates(candidates,seen,broad);
        }

        JSONObject best=null;
        int bestScore=Integer.MIN_VALUE;
        for(JSONObject item:candidates){
            if(item==null) continue;
            String synced=item.optString("syncedLyrics","");
            String plain=item.optString("plainLyrics","");
            if(synced.trim().isEmpty()&&plain.trim().isEmpty()) continue;
            int score=scoreCandidate(item,meta,trackDuration);
            if(score>bestScore){ bestScore=score; best=item; }
        }
        if(best==null||bestScore<55) return null;
        return new LyricsResult(
            best.optString("syncedLyrics",""),
            best.optString("plainLyrics",""),
            "LRCLIB",
            best.optLong("id",0L)
        );
    }

    private LyricsResult resolveFromLyricsOvh(Meta meta) throws Exception {
        String endpoint="https://api.lyrics.ovh/v1/"+pathPart(meta.artist)+"/"+pathPart(meta.title);
        JSONObject json=parseObject(httpGet(endpoint));
        if(json==null) return null;
        String plain=json.optString("lyrics","");
        return plain.trim().isEmpty()?null:new LyricsResult("",plain,"lyrics.ovh",0L);
    }

    private int scoreCandidate(JSONObject item,Meta meta,double trackDuration){
        String wantedTitle=norm(meta.title);
        String wantedArtist=norm(meta.artist);
        String gotTitle=norm(item.optString("trackName",item.optString("name","")));
        String gotArtist=norm(item.optString("artistName",""));
        int score=0;

        if(gotTitle.equals(wantedTitle)) score+=72;
        else if(gotTitle.contains(wantedTitle)||wantedTitle.contains(gotTitle)) score+=38;
        score+=Math.round(tokenSimilarity(wantedTitle,gotTitle)*36f);

        if(gotArtist.equals(wantedArtist)) score+=62;
        else if(gotArtist.contains(wantedArtist)||wantedArtist.contains(gotArtist)) score+=30;
        score+=Math.round(tokenSimilarity(wantedArtist,gotArtist)*24f);

        double candidateDuration=item.optDouble("duration",0.0);
        if(trackDuration>0&&candidateDuration>0){
            double diff=Math.abs(candidateDuration-trackDuration);
            if(diff<=2.1) score+=42;
            else if(diff<=5.0) score+=26;
            else if(diff<=10.0) score+=12;
            else if(diff>=30.0) score-=22;
        }
        if(!item.optString("syncedLyrics","").trim().isEmpty()) score+=16;
        if(!item.optString("plainLyrics","").trim().isEmpty()) score+=7;
        if(item.optBoolean("instrumental",false)) score-=40;

        String[] variants={"live","remix","sped up","slowed","nightcore","acoustic"};
        for(String variant:variants){
            boolean wanted=wantedTitle.contains(variant);
            boolean got=gotTitle.contains(variant);
            if(got&&!wanted) score-=18;
        }
        return score;
    }

    private float tokenSimilarity(String a,String b){
        Set<String> aa=tokens(a),bb=tokens(b);
        if(aa.isEmpty()||bb.isEmpty()) return 0f;
        int intersection=0;
        for(String t:aa) if(bb.contains(t)) intersection++;
        int union=aa.size()+bb.size()-intersection;
        return union<=0?0f:(float)intersection/(float)union;
    }

    private Set<String> tokens(String value){
        Set<String> out=new HashSet<>();
        for(String t:value.split("\\s+")) if(t.length()>1) out.add(t);
        return out;
    }

    private void addCandidate(List<JSONObject> list,Set<String> seen,JSONObject item){
        if(item==null) return;
        String id=String.valueOf(item.optLong("id",0L));
        if("0".equals(id)) id=norm(item.optString("trackName",item.optString("name","")))+"|"+norm(item.optString("artistName",""));
        if(seen.add(id)) list.add(item);
    }

    private void addCandidates(List<JSONObject> list,Set<String> seen,JSONArray array){
        if(array==null) return;
        for(int i=0;i<array.length();i++) addCandidate(list,seen,array.optJSONObject(i));
    }

    private String httpGet(String endpoint) throws Exception {
        for(int attempt=0;attempt<2;attempt++){
            HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setConnectTimeout(7000);
            c.setReadTimeout(9000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent",CLIENT);
            c.setRequestProperty("Accept","application/json");
            int code=c.getResponseCode();
            if(code==429&&attempt==0){
                String retry=c.getHeaderField("Retry-After");
                c.disconnect();
                long wait=900L;
                try{ wait=Math.max(500L,Math.min(5000L,Long.parseLong(retry)*1000L)); }catch(Throwable ignored){}
                Thread.sleep(wait);
                continue;
            }
            if(code<200||code>=300){ c.disconnect(); return ""; }
            InputStream stream=c.getInputStream();
            StringBuilder body=new StringBuilder();
            try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
                String line;
                while((line=r.readLine())!=null) body.append(line);
            }
            c.disconnect();
            return body.toString();
        }
        return "";
    }

    private JSONObject parseObject(String raw){
        if(raw==null||raw.trim().isEmpty()) return null;
        try{return new JSONObject(raw);}catch(Throwable ignored){return null;}
    }
    private JSONArray parseArray(String raw){
        if(raw==null||raw.trim().isEmpty()) return null;
        try{return new JSONArray(raw);}catch(Throwable ignored){return null;}
    }

    private void applyLyrics(LyricsResult result,boolean fromCache){
        lines.clear();
        syncedMode=!result.synced.trim().isEmpty();
        if(syncedMode) parseSynced(result.synced);
        else parsePlain(result.plain);
        modeView.setText(syncedMode?"KARAOKÉ AUDIFY":"PAROLES AUDIFY");
        statusView.setText((fromCache?"Cache • ":"")+(syncedMode?"Synchronisées":"Texte")+" • "+result.source);
        renderLyrics();
    }

    private void parseSynced(String raw){
        Pattern p=Pattern.compile("\\[(\\d{1,2}):(\\d{2})(?:\\.(\\d{1,3}))?\\]\\s*(.*)");
        for(String line:raw.split("\\n")){
            Matcher m=p.matcher(line.trim());
            if(!m.matches()) continue;
            int min=Integer.parseInt(m.group(1));
            int sec=Integer.parseInt(m.group(2));
            String fraction=m.group(3);
            double frac=0.0;
            if(fraction!=null&&!fraction.isEmpty()) frac=Double.parseDouble("0."+fraction);
            String tx=m.group(4)==null?"":m.group(4).trim();
            if(!tx.isEmpty()) lines.add(new LyricLine(min*60+sec+frac,tx));
        }
    }

    private void parsePlain(String raw){
        if(raw==null||raw.trim().isEmpty()) return;
        for(String line:raw.split("\\n")){
            String tx=line.trim();
            if(!tx.isEmpty()) lines.add(new LyricLine(-1.0,tx));
        }
    }

    private void renderLyrics(){
        lyricsBox.removeAllViews();
        lineViews.clear();
        activeIndex=-1;
        if(lines.isEmpty()){ showFailure("Paroles reçues mais vides."); return; }
        for(LyricLine line:lines){
            int color=syncedMode?Color.rgb(93,102,113):Color.rgb(232,237,243);
            float size=syncedMode?29f:23f;
            TextView v=text(line.text,size,true,color);
            v.setPadding(0,dp(syncedMode?11:7),0,dp(syncedMode?11:7));
            v.setLineSpacing(0f,syncedMode?1.02f:1.12f);
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
            if(!userSeeking){
                int p=duration>0?(int)Math.max(0,Math.min(1000,Math.round(pos/duration*1000.0))):0;
                timeline.setProgress(p);
            }
            if(syncedMode&&!lines.isEmpty()){
                int idx=0;
                for(int i=0;i<lines.size();i++){ if(lines.get(i).time<=pos) idx=i; else break; }
                if(idx!=activeIndex&&idx<lineViews.size()){
                    if(activeIndex>=0&&activeIndex<lineViews.size()){
                        lineViews.get(activeIndex).setTextColor(Color.rgb(93,102,113));
                        lineViews.get(activeIndex).setTextSize(29f);
                    }
                    activeIndex=idx;
                    TextView active=lineViews.get(idx);
                    active.setTextColor(Color.WHITE);
                    active.setTextSize(33f);
                    active.post(()->scroll.smoothScrollTo(0,Math.max(0,active.getTop()-scroll.getHeight()/3)));
                }
            }
        }catch(Throwable ignored){}
    }

    private void showFailure(String message){
        statusView.setText("Aucune correspondance fiable");
        lyricsBox.removeAllViews();
        TextView msg=text(message,24f,true,Color.rgb(150,159,171));
        lyricsBox.addView(msg,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        Button retry=smallButton("↻ Réessayer");
        retry.setTextColor(Color.rgb(168,255,63));
        retry.setOnClickListener(v->{
            lyricsBox.removeAllViews();
            lyricsBox.addView(text("Nouvelle recherche…",27f,true,Color.rgb(115,123,136)));
            fetchLyrics();
        });
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(150),dp(50));
        lp.topMargin=dp(20);
        lyricsBox.addView(retry,lp);
    }

    private Meta resolveMetadata(String title,String artist){
        String cleanedArtist=cleanArtist(artist);
        String cleanedTitle=cleanTitle(title);
        int sep=cleanedTitle.indexOf(" - ");
        if(sep>0&&sep<cleanedTitle.length()-3){
            String left=cleanArtist(cleanedTitle.substring(0,sep));
            String right=cleanTitle(cleanedTitle.substring(sep+3));
            String na=norm(cleanedArtist),nl=norm(left);
            if(!left.isEmpty()&&!right.isEmpty()&&(!na.isEmpty())&&(na.equals(nl)||na.contains(nl)||nl.contains(na))){
                cleanedArtist=left;
                cleanedTitle=right;
            }
        }
        if(cleanedTitle.isEmpty()) cleanedTitle=safe(title).trim();
        if(cleanedArtist.isEmpty()) cleanedArtist=safe(artist).trim();
        return new Meta(cleanedTitle,cleanedArtist);
    }

    private String cleanTitle(String value){
        String s=safe(value);
        s=s.replaceAll("(?i)\\s*[\\[(](?:[^\\])]*)(?:official|officiel|clip|music\\s*video|video|audio|visualizer|lyrics?|paroles|4k|hd)(?:[^\\])]*)[\\])]\\s*"," ");
        s=s.replaceAll("(?i)\\b(official\\s+(music\\s+)?video|clip\\s+officiel|clip\\s+officiel|official\\s+audio|audio\\s+officiel|visualizer|lyrics?\\s+video|paroles)\\b"," ");
        s=s.replaceAll("(?i)\\s*\\|\\s*(official|officiel|video|audio|visualizer).*$"," ");
        s=s.replaceAll("\\s+"," ").trim();
        s=s.replaceAll("^[\\-–—|:]+|[\\-–—|:]+$","").trim();
        return s;
    }

    private String cleanArtist(String value){
        String s=safe(value);
        s=s.replaceAll("(?i)\\s*-\\s*topic\\s*$","");
        s=s.replaceAll("(?i)\\b(officiel|official|vevo)\\b"," ");
        s=s.replaceAll("\\s+"," ").trim();
        return s;
    }

    private String norm(String value){
        String s=safe(value).toLowerCase(Locale.ROOT);
        s=java.text.Normalizer.normalize(s,java.text.Normalizer.Form.NFD).replaceAll("\\p{M}+","");
        s=s.replaceAll("[^a-z0-9]+"," ").replaceAll("\\s+"," ").trim();
        return s;
    }

    private String cacheKey(){
        String basis=!videoId.isEmpty()?"yt:"+videoId:"meta:"+norm(resolvedMeta.artist)+"|"+norm(resolvedMeta.title);
        return "lyrics:"+Integer.toHexString(basis.hashCode());
    }

    private LyricsResult readCache(){
        try{
            String raw=getSharedPreferences(CACHE_PREFS,MODE_PRIVATE).getString(cacheKey(),"");
            if(raw==null||raw.isEmpty()) return null;
            JSONObject o=new JSONObject(raw);
            return new LyricsResult(o.optString("synced",""),o.optString("plain",""),o.optString("source","cache"),o.optLong("lrclibId",0L));
        }catch(Throwable ignored){return null;}
    }

    private void writeCache(LyricsResult result){
        try{
            JSONObject o=new JSONObject();
            o.put("synced",result.synced);
            o.put("plain",result.plain);
            o.put("source",result.source);
            o.put("lrclibId",result.lrclibId);
            o.put("title",resolvedMeta.title);
            o.put("artist",resolvedMeta.artist);
            o.put("savedAt",System.currentTimeMillis());
            SharedPreferences prefs=getSharedPreferences(CACHE_PREFS,MODE_PRIVATE);
            prefs.edit().putString(cacheKey(),o.toString()).apply();
        }catch(Throwable ignored){}
    }

    private String q(String s) throws Exception { return URLEncoder.encode(s,StandardCharsets.UTF_8.name()); }
    private String pathPart(String s) throws Exception { return URLEncoder.encode(s,StandardCharsets.UTF_8.name()).replace("+","%20"); }
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

await writeFile(karaokePath,karaoke,'utf8');
console.log('Audify Android V68.10.1 : swipe mini-player zones libres + Lyrics Resolver LRCLIB/lyrics.ovh/cache.');
