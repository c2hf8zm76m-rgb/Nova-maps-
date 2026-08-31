import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const mainPath=path.join(pkgDir,'MainActivity.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const storePath=path.join(pkgDir,'AudifyLibraryStore.java');
const affinityPath=path.join(pkgDir,'AudifyAffinityStore.java');
const karaokePath=path.join(pkgDir,'NativeKaraokeActivity.java');
const splashPath=path.join(pkgDir,'AudifySplashActivity.java');
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
const resDir=path.join(android,'app','src','main','res');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
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
  throw new Error(`V68.10.4 méthode introuvable: ${label}`);
}

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.10.4 bloc introuvable: ${label}`);
  return source.replace(needle,replacement);
}

// =============================================================================
// 1) PERSISTANCE FORTE : SharedPreferences synchrones + copies de secours.
// =============================================================================
let store=await readFile(storePath,'utf8');
store=replaceMethod(store,['    private JSONArray readArray(String key){','    private JSONArray readArray(String key) {'],String.raw`    private synchronized JSONArray readArray(String key){
        String raw=prefs.getString(key,null);
        if(raw==null||raw.trim().isEmpty()) raw=prefs.getString(key+"_backup","[]");
        try{return new JSONArray(raw==null?"[]":raw);}catch(Exception ignored){
            try{return new JSONArray(prefs.getString(key+"_backup","[]"));}catch(Exception ignored2){return new JSONArray();}
        }
    }`,'readArray');
store=replaceMethod(store,['    private JSONObject readPlaylistsObject(){','    private JSONObject readPlaylistsObject() {'],String.raw`    private synchronized JSONObject readPlaylistsObject(){
        String raw=prefs.getString(KEY_PLAYLISTS,null);
        if(raw==null||raw.trim().isEmpty()) raw=prefs.getString(KEY_PLAYLISTS+"_backup","{}");
        try{return new JSONObject(raw==null?"{}":raw);}catch(Exception ignored){
            try{return new JSONObject(prefs.getString(KEY_PLAYLISTS+"_backup","{}"));}catch(Exception ignored2){return new JSONObject();}
        }
    }`,'readPlaylistsObject');
store=replaceMethod(store,['    private void saveArray(String key,JSONArray arr){','    private void saveArray(String key, JSONArray arr){','    private void saveArray(String key,JSONArray arr) {'],String.raw`    private synchronized void saveArray(String key,JSONArray arr){
        String json=arr==null?"[]":arr.toString();
        prefs.edit().putString(key,json).putString(key+"_backup",json).commit();
    }`,'saveArray');
store=replaceMethod(store,['    private void savePlaylists(JSONObject obj){','    private void savePlaylists(JSONObject obj) {'],String.raw`    private synchronized void savePlaylists(JSONObject obj){
        String json=obj==null?"{}":obj.toString();
        prefs.edit().putString(KEY_PLAYLISTS,json).putString(KEY_PLAYLISTS+"_backup",json).commit();
    }`,'savePlaylists');

if(!store.includes('public void removeFromPlaylist(String rawName,String trackId)')){
  const queueMarker='    public String queueJson(List<Track> tracks,int index){';
  if(!store.includes(queueMarker)) throw new Error('V68.10.4 queueJson store introuvable');
  const extra=String.raw`    public synchronized void removeFromPlaylist(String rawName,String trackId){
        String name=rawName==null?"":rawName.trim();
        if(name.isEmpty()||trackId==null||trackId.isEmpty()) return;
        JSONObject root=readPlaylistsObject();
        JSONArray old=root.optJSONArray(name); if(old==null) return;
        JSONArray next=new JSONArray();
        for(int i=0;i<old.length();i++){
            JSONObject o=old.optJSONObject(i); if(o==null) continue;
            if(trackId.equals(o.optString("id",""))) continue;
            next.put(o);
        }
        try{root.put(name,next);}catch(Exception ignored){}
        savePlaylists(root);
    }

    public synchronized void deletePlaylist(String rawName){
        String name=rawName==null?"":rawName.trim(); if(name.isEmpty()) return;
        JSONObject root=readPlaylistsObject(); root.remove(name); savePlaylists(root);
    }

`;
  store=store.replace(queueMarker,extra+queueMarker);
}
await writeFile(storePath,store,'utf8');

try{
  let affinity=await readFile(affinityPath,'utf8');
  affinity=affinity.replace('prefs.edit().putInt(key,next).apply();','prefs.edit().putInt(key,next).commit();');
  await writeFile(affinityPath,affinity,'utf8');
}catch{}

// =============================================================================
// 2) PLAYLISTS 2.0 : vraie Activity native moderne au lieu de l'AlertDialog.
// =============================================================================
const playlistActivity=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NativePlaylistActivity extends AppCompatActivity {
    private static final int ACCENT=Color.rgb(168,255,63);
    private AudifyLibraryStore store;
    private String playlistName="";
    private LinearLayout content;
    private final ExecutorService images=Executors.newFixedThreadPool(3);
    private final Handler handler=new Handler(Looper.getMainLooper());

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(3,5,8));
        playlistName=getIntent()==null?"":safe(getIntent().getStringExtra("playlist"));
        store=new AudifyLibraryStore(this);
        build();
    }

    private void build(){
        FrameLayout root=new FrameLayout(this);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(11,17,18),Color.rgb(5,9,13),Color.rgb(3,5,8)}));

        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true); scroll.setVerticalScrollBarEnabled(false);
        content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16),dp(12),dp(16),dp(42));
        scroll.addView(content,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        rebuild();
    }

    private void rebuild(){
        content.removeAllViews();
        List<AudifyLibraryStore.Track> tracks=store.getPlaylist(playlistName);

        LinearLayout header=new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL);
        Button back=button("‹ Home",false); back.setOnClickListener(v->finish());
        header.addView(back,new LinearLayout.LayoutParams(dp(94),dp(48)));
        TextView brand=text("AUDIFY PLAYLIST",11f,true,ACCENT); brand.setGravity(Gravity.END|Gravity.CENTER_VERTICAL); brand.setLetterSpacing(0.12f);
        header.addView(brand,new LinearLayout.LayoutParams(0,dp(48),1f));
        content.addView(header,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));

        LinearLayout hero=new LinearLayout(this); hero.setOrientation(LinearLayout.VERTICAL); hero.setPadding(dp(16),dp(16),dp(16),dp(17));
        GradientDrawable heroBg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(34,48,42),Color.rgb(18,26,29),Color.rgb(11,16,22)});
        heroBg.setStroke(dp(1),Color.argb(145,168,255,63)); heroBg.setCornerRadius(dp(28)); hero.setBackground(heroBg); hero.setElevation(dp(12));

        LinearLayout heroTop=new LinearLayout(this); heroTop.setGravity(Gravity.CENTER_VERTICAL);
        ImageView art=new ImageView(this); art.setScaleType(ImageView.ScaleType.CENTER_CROP); art.setBackgroundColor(Color.rgb(28,35,43)); art.setClipToOutline(true);
        art.setOutlineProvider(new ViewOutlineProvider(){@Override public void getOutline(View view,Outline o){o.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(22));}});
        if(!tracks.isEmpty()) loadImage(art,tracks.get(0).thumbnail);
        heroTop.addView(art,new LinearLayout.LayoutParams(dp(112),dp(112)));

        LinearLayout copy=new LinearLayout(this); copy.setOrientation(LinearLayout.VERTICAL); copy.setPadding(dp(15),0,0,0); copy.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text(playlistName.isEmpty()?"Ma playlist":playlistName,26f,true,Color.WHITE); title.setMaxLines(2); title.setEllipsize(TextUtils.TruncateAt.END);
        TextView meta=text(tracks.size()+" titre"+(tracks.size()>1?"s":"")+" · Bibliothèque Audify",13f,false,Color.rgb(184,194,207));
        copy.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(70))); copy.addView(meta,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));
        heroTop.addView(copy,new LinearLayout.LayoutParams(0,dp(112),1f)); hero.addView(heroTop);

        LinearLayout actions=new LinearLayout(this); actions.setGravity(Gravity.CENTER_VERTICAL); actions.setPadding(0,dp(14),0,0);
        Button play=button("▶  Tout lire",true); play.setEnabled(!tracks.isEmpty()); play.setOnClickListener(v->playCollection(tracks,0));
        actions.addView(play,new LinearLayout.LayoutParams(0,dp(54),1f));
        Button del=button("Supprimer",false); del.setTextColor(Color.rgb(255,126,139)); del.setOnClickListener(v->confirmDelete());
        LinearLayout.LayoutParams dlp=new LinearLayout.LayoutParams(dp(112),dp(54)); dlp.leftMargin=dp(9); actions.addView(del,dlp);
        hero.addView(actions,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(68)));
        LinearLayout.LayoutParams heroLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(211)); heroLp.topMargin=dp(8); content.addView(hero,heroLp);

        TextView section=text("Titres",22f,true,Color.WHITE); LinearLayout.LayoutParams slp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)); slp.topMargin=dp(15); content.addView(section,slp);

        if(tracks.isEmpty()){
            LinearLayout empty=new LinearLayout(this); empty.setOrientation(LinearLayout.VERTICAL); empty.setGravity(Gravity.CENTER); empty.setPadding(dp(20),dp(30),dp(20),dp(30));
            empty.setBackground(round(Color.rgb(13,18,25),Color.rgb(44,54,64),24));
            empty.addView(text("Cette playlist est vide",20f,true,Color.WHITE));
            TextView hint=text("Ajoute un titre depuis le lecteur ou depuis les résultats de recherche.",14f,false,Color.rgb(164,175,188)); hint.setGravity(Gravity.CENTER); hint.setPadding(0,dp(8),0,0); empty.addView(hint);
            content.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(150)));
            return;
        }

        for(int i=0;i<tracks.size();i++){
            final int index=i; AudifyLibraryStore.Track t=tracks.get(i);
            LinearLayout card=new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(9),dp(8),dp(8),dp(8));
            card.setBackground(round(Color.rgb(18,24,31),Color.rgb(49,59,70),21)); card.setElevation(dp(4));
            ImageView image=new ImageView(this); image.setScaleType(ImageView.ScaleType.CENTER_CROP); image.setBackgroundColor(Color.rgb(27,34,43)); image.setClipToOutline(true);
            image.setOutlineProvider(new ViewOutlineProvider(){@Override public void getOutline(View view,Outline o){o.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(14));}});
            loadImage(image,t.thumbnail); image.setOnClickListener(v->playCollection(tracks,index)); card.addView(image,new LinearLayout.LayoutParams(dp(72),dp(72)));
            LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setGravity(Gravity.CENTER_VERTICAL); info.setPadding(dp(11),0,dp(8),0); info.setOnClickListener(v->playCollection(tracks,index));
            TextView tt=text(t.title,15.5f,true,Color.WHITE); tt.setMaxLines(2); tt.setEllipsize(TextUtils.TruncateAt.END);
            TextView aa=text(t.artist,12.5f,false,Color.rgb(175,185,199)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
            info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42))); info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
            card.addView(info,new LinearLayout.LayoutParams(0,dp(72),1f));
            Button remove=button("×",false); remove.setTextSize(22f); remove.setContentDescription("Retirer de la playlist"); remove.setOnClickListener(v->{store.removeFromPlaylist(playlistName,t.id); rebuild();});
            card.addView(remove,new LinearLayout.LayoutParams(dp(46),dp(46)));
            LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(92)); cp.bottomMargin=dp(9); content.addView(card,cp);
        }
    }

    private void playCollection(List<AudifyLibraryStore.Track> tracks,int index){
        if(tracks==null||tracks.isEmpty()||index<0||index>=tracks.size()) return;
        AudifyLibraryStore.Track t=tracks.get(index);
        try{
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SET_QUEUE).putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(tracks,index)));
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,t.id).putExtra(AudifyPlaybackService.EXTRA_TITLE,t.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,t.artist).putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,t.thumbnail));
            handler.postDelayed(()->startActivity(new Intent(this,NativePlayerActivity.class).putExtra("videoId",t.id).putExtra("title",t.title).putExtra("artist",t.artist).putExtra("thumbnail",t.thumbnail)),130L);
        }catch(Exception e){Toast.makeText(this,"Impossible de lire ce titre",Toast.LENGTH_SHORT).show();}
    }

    private void confirmDelete(){
        new android.app.AlertDialog.Builder(this).setTitle("Supprimer la playlist ?").setMessage("Les titres ne seront pas supprimés de ta bibliothèque.")
            .setPositiveButton("Supprimer",(d,w)->{store.deletePlaylist(playlistName); finish();})
            .setNegativeButton("Annuler",null).show();
    }

    private void loadImage(ImageView target,String raw){
        String url=safe(raw); if(url.isEmpty()) return;
        images.execute(()->{HttpURLConnection c=null; try{c=(HttpURLConnection)new URL(url).openConnection(); c.setConnectTimeout(6000); c.setReadTimeout(7000); c.setUseCaches(true); try(InputStream in=c.getInputStream()){Bitmap b=BitmapFactory.decodeStream(in); if(b!=null) runOnUiThread(()->target.setImageBitmap(b));}}catch(Exception ignored){}finally{if(c!=null)c.disconnect();}});
    }

    private GradientDrawable round(int fill,int stroke,int radius){GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));g.setStroke(dp(1),stroke);return g;}
    private Button button(String label,boolean green){Button b=new Button(this);b.setAllCaps(false);b.setText(label);b.setTextSize(14f);b.setTextColor(green?Color.rgb(8,18,7):Color.WHITE);b.setPadding(dp(12),0,dp(12),0);b.setStateListAnimator(null);b.setBackground(round(green?ACCENT:Color.rgb(29,36,45),green?Color.rgb(211,255,168):Color.rgb(70,81,94),20));return b;}
    private TextView text(String value,float sp,boolean bold,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(sp);t.setTextColor(color);t.setGravity(Gravity.CENTER_VERTICAL);if(bold)t.setTypeface(t.getTypeface(),android.graphics.Typeface.BOLD);return t;}
    private String safe(String s){return s==null?"":s.trim();}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}

    @Override protected void onDestroy(){images.shutdownNow();handler.removeCallbacksAndMessages(null);super.onDestroy();}
}`;
await writeFile(path.join(pkgDir,'NativePlaylistActivity.java'),playlistActivity,'utf8');

let home=await readFile(homePath,'utf8');
const playlistOpen='open.setOnClickListener(v->showPlaylist(name));';
if(home.includes(playlistOpen)){
  home=home.replace(playlistOpen,'open.setOnClickListener(v->startActivity(new Intent(this,NativePlaylistActivity.class).putExtra("playlist",name)));');
}else{
  // Ancienne variante du Home.
  home=home.replace('b.setOnClickListener(v -> showPlaylist(name));','b.setOnClickListener(v -> startActivity(new Intent(this,NativePlaylistActivity.class).putExtra("playlist",name)));');
}
await writeFile(homePath,home,'utf8');

// =============================================================================
// 3) RECHERCHE 2.0 : Home button, retour auto à vide, cartes, mini-player permanent.
// =============================================================================
let main=await readFile(mainPath,'utf8');
const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker)) throw new Error('V68.10.4 MainActivity introuvable');
if(!main.includes('private android.widget.LinearLayout audifySearchMiniV68104;')){
  const members=String.raw`
    private android.widget.Button audifySearchHomeV68104;
    private android.widget.LinearLayout audifySearchMiniV68104;
    private android.widget.ImageView audifySearchMiniArtV68104;
    private android.widget.TextView audifySearchMiniTitleV68104;
    private android.widget.TextView audifySearchMiniArtistV68104;
    private android.widget.Button audifySearchMiniToggleV68104;
    private android.widget.SeekBar audifySearchMiniProgressV68104;
    private final android.os.Handler audifySearchUiV68104=new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean audifySearchHadTextV68104=false;
    private boolean audifySearchReturningHomeV68104=false;
    private String audifySearchMiniIdV68104="";

    private final Runnable audifySearchMiniTickerV68104=new Runnable(){
        @Override public void run(){ audifyRefreshSearchMiniV68104(); audifySearchUiV68104.postDelayed(this,450L); }
    };

    private void audifyGoHomeV68104(){
        if(audifySearchReturningHomeV68104) return;
        audifySearchReturningHomeV68104=true;
        try{
            android.content.Intent i=new android.content.Intent(this,NativeHomeActivity.class);
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP|android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
            finish();
        }catch(Exception ignored){audifySearchReturningHomeV68104=false;}
    }

    private void installAudifySearchChromeV68104(){
        try{
            android.view.View raw=findViewById(android.R.id.content);
            if(!(raw instanceof android.widget.FrameLayout)) return;
            android.widget.FrameLayout content=(android.widget.FrameLayout)raw;
            if(audifyNativeSearchV670==null||audifyNativeSearchButtonV671==null) return;

            android.widget.Button home=new android.widget.Button(this);
            audifySearchHomeV68104=home;
            home.setText("⌂"); home.setTextSize(22f); home.setTextColor(android.graphics.Color.WHITE); home.setAllCaps(false);
            home.setPadding(0,0,0,0); home.setStateListAnimator(null); home.setElevation(audifyDp(42));
            android.graphics.drawable.GradientDrawable hbg=new android.graphics.drawable.GradientDrawable(); hbg.setColor(android.graphics.Color.rgb(29,36,46)); hbg.setCornerRadius(audifyDp(24)); hbg.setStroke(audifyDp(1),android.graphics.Color.rgb(73,84,98)); home.setBackground(hbg);
            android.widget.FrameLayout.LayoutParams hlp=new android.widget.FrameLayout.LayoutParams(audifyDp(52),audifyDp(52),android.view.Gravity.TOP|android.view.Gravity.LEFT); hlp.setMargins(audifyDp(14),audifyDp(18),0,0); content.addView(home,hlp);
            home.setOnClickListener(v->audifyGoHomeV68104());

            android.widget.FrameLayout.LayoutParams inputLp=(android.widget.FrameLayout.LayoutParams)audifyNativeSearchV670.getLayoutParams();
            inputLp.setMargins(audifyDp(76),audifyDp(10),audifyDp(148),0); audifyNativeSearchV670.setLayoutParams(inputLp);
            audifyNativeSearchV670.setTextSize(16f); audifyNativeSearchV670.setHint("Artiste ou titre…");

            android.widget.FrameLayout.LayoutParams buttonLp=(android.widget.FrameLayout.LayoutParams)audifyNativeSearchButtonV671.getLayoutParams();
            buttonLp.width=audifyDp(122); buttonLp.height=audifyDp(52); buttonLp.setMargins(0,audifyDp(18),audifyDp(14),0); audifyNativeSearchButtonV671.setLayoutParams(buttonLp);

            audifyNativeSearchV670.addTextChangedListener(new android.text.TextWatcher(){
                @Override public void beforeTextChanged(CharSequence s,int st,int c,int a){}
                @Override public void onTextChanged(CharSequence s,int st,int before,int count){}
                @Override public void afterTextChanged(android.text.Editable e){
                    String q=e==null?"":e.toString();
                    if(!q.trim().isEmpty()){audifySearchHadTextV68104=true;return;}
                    if(audifySearchHadTextV68104&&!audifySearchReturningHomeV68104){
                        audifySearchUiV68104.postDelayed(MainActivity.this::audifyGoHomeV68104,120L);
                    }
                }
            });

            ensureAudifySearchResultsV672();
            if(audifySearchScrollV672!=null){
                audifySearchScrollV672.setPadding(audifyDp(14),audifyDp(8),audifyDp(14),audifyDp(132));
                audifySearchScrollV672.setClipToPadding(false);
            }
            buildAudifySearchMiniV68104(content);
            home.bringToFront(); audifyNativeSearchV670.bringToFront(); audifyNativeSearchButtonV671.bringToFront();
            audifySearchUiV68104.removeCallbacks(audifySearchMiniTickerV68104); audifySearchUiV68104.post(audifySearchMiniTickerV68104);
        }catch(Throwable ignored){}
    }

    private void buildAudifySearchMiniV68104(android.widget.FrameLayout content){
        if(audifySearchMiniV68104!=null) return;
        android.widget.LinearLayout card=new android.widget.LinearLayout(this); audifySearchMiniV68104=card;
        card.setOrientation(android.widget.LinearLayout.VERTICAL); card.setPadding(audifyDp(10),audifyDp(8),audifyDp(10),audifyDp(5)); card.setVisibility(android.view.View.GONE); card.setElevation(audifyDp(36));
        android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,new int[]{android.graphics.Color.argb(235,55,67,82),android.graphics.Color.argb(225,27,35,47),android.graphics.Color.argb(220,14,20,29)}); bg.setCornerRadius(audifyDp(28)); bg.setStroke(audifyDp(1),android.graphics.Color.argb(155,168,255,63)); card.setBackground(bg);
        android.widget.LinearLayout top=new android.widget.LinearLayout(this); top.setGravity(android.view.Gravity.CENTER_VERTICAL);
        audifySearchMiniArtV68104=new android.widget.ImageView(this); audifySearchMiniArtV68104.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP); audifySearchMiniArtV68104.setBackgroundColor(android.graphics.Color.rgb(27,34,43)); top.addView(audifySearchMiniArtV68104,new android.widget.LinearLayout.LayoutParams(audifyDp(54),audifyDp(54)));
        android.widget.LinearLayout info=new android.widget.LinearLayout(this); info.setOrientation(android.widget.LinearLayout.VERTICAL); info.setGravity(android.view.Gravity.CENTER_VERTICAL); info.setPadding(audifyDp(10),0,audifyDp(6),0);
        audifySearchMiniTitleV68104=audifyResultTextV672("",14.5f,android.graphics.Color.WHITE); audifySearchMiniTitleV68104.setPadding(0,0,0,0); audifySearchMiniTitleV68104.setMaxLines(1); audifySearchMiniTitleV68104.setEllipsize(android.text.TextUtils.TruncateAt.END);
        audifySearchMiniArtistV68104=audifyResultTextV672("",12f,android.graphics.Color.rgb(186,196,209)); audifySearchMiniArtistV68104.setPadding(0,0,0,0); audifySearchMiniArtistV68104.setMaxLines(1); audifySearchMiniArtistV68104.setEllipsize(android.text.TextUtils.TruncateAt.END);
        info.addView(audifySearchMiniTitleV68104,new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(28))); info.addView(audifySearchMiniArtistV68104,new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(22))); top.addView(info,new android.widget.LinearLayout.LayoutParams(0,audifyDp(54),1f));
        audifySearchMiniToggleV68104=new android.widget.Button(this); audifySearchMiniToggleV68104.setAllCaps(false); audifySearchMiniToggleV68104.setText("Ⅱ"); audifySearchMiniToggleV68104.setTextSize(19f); audifySearchMiniToggleV68104.setTextColor(android.graphics.Color.rgb(8,14,8)); audifySearchMiniToggleV68104.setPadding(0,0,0,0); audifySearchMiniToggleV68104.setStateListAnimator(null); android.graphics.drawable.GradientDrawable tbg=new android.graphics.drawable.GradientDrawable(); tbg.setShape(android.graphics.drawable.GradientDrawable.OVAL); tbg.setColor(android.graphics.Color.rgb(220,255,186)); audifySearchMiniToggleV68104.setBackground(tbg); top.addView(audifySearchMiniToggleV68104,new android.widget.LinearLayout.LayoutParams(audifyDp(52),audifyDp(52)));
        card.addView(top,new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(57)));
        audifySearchMiniProgressV68104=new android.widget.SeekBar(this); audifySearchMiniProgressV68104.setMax(1000); audifySearchMiniProgressV68104.setEnabled(false); card.addView(audifySearchMiniProgressV68104,new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(28)));
        card.setOnClickListener(v->audifyOpenCurrentPlayerV68104()); info.setOnClickListener(v->audifyOpenCurrentPlayerV68104()); audifySearchMiniArtV68104.setOnClickListener(v->audifyOpenCurrentPlayerV68104());
        audifySearchMiniToggleV68104.setOnClickListener(v->{try{startService(new android.content.Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));}catch(Exception ignored){} audifySearchUiV68104.postDelayed(this::audifyRefreshSearchMiniV68104,80L);});
        int width=Math.min(getResources().getDisplayMetrics().widthPixels-audifyDp(26),audifyDp(520)); android.widget.FrameLayout.LayoutParams lp=new android.widget.FrameLayout.LayoutParams(width,audifyDp(102),android.view.Gravity.BOTTOM|android.view.Gravity.CENTER_HORIZONTAL); lp.bottomMargin=audifyDp(14); content.addView(card,lp);
    }

    private void audifyRefreshSearchMiniV68104(){
        try{
            if(audifySearchMiniV68104==null) return;
            org.json.JSONObject state=new org.json.JSONObject(AudifyPlaybackService.getStateJson()); String id=state.optString("videoId","");
            if(id.isEmpty()){audifySearchMiniV68104.setVisibility(android.view.View.GONE);return;}
            audifySearchMiniV68104.setVisibility(android.view.View.VISIBLE); String title=state.optString("title","Sans titre"),artist=state.optString("artist","YouTube"),thumb=state.optString("thumbnail","");
            audifySearchMiniTitleV68104.setText(title); audifySearchMiniArtistV68104.setText(artist); audifySearchMiniToggleV68104.setText(state.optBoolean("playing",false)?"Ⅱ":"▶");
            double pos=Math.max(0,state.optDouble("position",0)),dur=Math.max(0,state.optDouble("duration",0)); audifySearchMiniProgressV68104.setProgress(dur>0?(int)Math.max(0,Math.min(1000,Math.round(pos/dur*1000.0))):0);
            if(!id.equals(audifySearchMiniIdV68104)){audifySearchMiniIdV68104=id;audifySearchMiniArtV68104.setImageDrawable(null);audifyLoadThumbV674(thumb,audifySearchMiniArtV68104);}
            audifySearchMiniV68104.bringToFront(); if(audifySearchHomeV68104!=null)audifySearchHomeV68104.bringToFront(); if(audifyNativeSearchV670!=null)audifyNativeSearchV670.bringToFront(); if(audifyNativeSearchButtonV671!=null)audifyNativeSearchButtonV671.bringToFront();
        }catch(Throwable ignored){}
    }

    private void audifyOpenCurrentPlayerV68104(){
        try{org.json.JSONObject s=new org.json.JSONObject(AudifyPlaybackService.getStateJson());String id=s.optString("videoId","");if(id.isEmpty())return;startActivity(new android.content.Intent(this,NativePlayerActivity.class).putExtra("videoId",id).putExtra("title",s.optString("title","Sans titre")).putExtra("artist",s.optString("artist","YouTube")).putExtra("thumbnail",s.optString("thumbnail","")));}catch(Throwable ignored){}
    }
`;
  main=main.replace(classMarker,classMarker+members);
}

// Modernise les cartes de résultats.
main=replaceMethod(main,['    private void renderAudifyNativeResultsV672(java.util.List<AudifySearchItemV673> items, String query, int generation) {','    private void renderAudifyNativeResultsV672(java.util.List<AudifySearchItemV673> items,String query,int generation){'],String.raw`    private void renderAudifyNativeResultsV672(java.util.List<AudifySearchItemV673> items, String query, int generation) {
        if(generation!=audifySearchGenerationV672) return;
        ensureAudifySearchResultsV672();
        if(audifySearchScrollV672==null||audifySearchListV672==null) return;
        audifySearchScrollV672.setVisibility(android.view.View.VISIBLE); audifySearchListV672.removeAllViews();

        android.widget.LinearLayout heading=new android.widget.LinearLayout(this); heading.setGravity(android.view.Gravity.CENTER_VERTICAL); heading.setPadding(audifyDp(4),audifyDp(4),audifyDp(4),audifyDp(12));
        android.widget.TextView h1=audifyResultTextV672(items.isEmpty()?"Aucun résultat":"Résultats",23f,android.graphics.Color.WHITE); h1.setTypeface(h1.getTypeface(),android.graphics.Typeface.BOLD); h1.setPadding(0,0,0,0); heading.addView(h1,new android.widget.LinearLayout.LayoutParams(0,audifyDp(52),1f));
        android.widget.TextView count=audifyResultTextV672(items.size()+" titres",12.5f,android.graphics.Color.rgb(168,255,63)); count.setGravity(android.view.Gravity.CENTER); count.setPadding(audifyDp(10),0,audifyDp(10),0); android.graphics.drawable.GradientDrawable cbg=new android.graphics.drawable.GradientDrawable(); cbg.setColor(android.graphics.Color.rgb(28,45,28)); cbg.setCornerRadius(audifyDp(18)); cbg.setStroke(audifyDp(1),android.graphics.Color.rgb(79,124,48)); count.setBackground(cbg); heading.addView(count,new android.widget.LinearLayout.LayoutParams(audifyDp(82),audifyDp(36))); audifySearchListV672.addView(heading);
        android.widget.TextView queryView=audifyResultTextV672("Pour « "+query+" »",13f,android.graphics.Color.rgb(160,171,185)); queryView.setPadding(audifyDp(4),0,audifyDp(4),audifyDp(14)); audifySearchListV672.addView(queryView);

        final java.util.ArrayList<AudifySearchItemV673> queueItems=new java.util.ArrayList<>(items); int displayIndex=0;
        for(AudifySearchItemV673 item:items){
            if(displayIndex>=20)break; final int chosenIndex=displayIndex++;
            android.widget.LinearLayout card=new android.widget.LinearLayout(this); card.setGravity(android.view.Gravity.CENTER_VERTICAL); card.setPadding(audifyDp(9),audifyDp(8),audifyDp(8),audifyDp(8)); card.setClickable(true); card.setFocusable(true); card.setElevation(audifyDp(4));
            android.graphics.drawable.GradientDrawable shape=new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,new int[]{android.graphics.Color.rgb(27,35,45),android.graphics.Color.rgb(17,23,31),android.graphics.Color.rgb(12,17,24)}); shape.setCornerRadius(audifyDp(22)); shape.setStroke(audifyDp(1),android.graphics.Color.rgb(55,67,80)); card.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(android.graphics.Color.argb(62,168,255,63)),shape,null));
            android.widget.ImageView art=new android.widget.ImageView(this); art.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP); art.setBackgroundColor(android.graphics.Color.rgb(28,35,45)); card.addView(art,new android.widget.LinearLayout.LayoutParams(audifyDp(102),audifyDp(72))); audifyLoadThumbV674(item.thumbnail,art);
            android.widget.LinearLayout info=new android.widget.LinearLayout(this); info.setOrientation(android.widget.LinearLayout.VERTICAL); info.setGravity(android.view.Gravity.CENTER_VERTICAL); info.setPadding(audifyDp(11),0,audifyDp(6),0);
            android.widget.TextView tt=audifyResultTextV672(item.title,15.5f,android.graphics.Color.WHITE); tt.setTypeface(tt.getTypeface(),android.graphics.Typeface.BOLD); tt.setPadding(0,0,0,0); tt.setMaxLines(2); tt.setEllipsize(android.text.TextUtils.TruncateAt.END);
            android.widget.TextView aa=audifyResultTextV672(item.artist,12.5f,android.graphics.Color.rgb(177,188,202)); aa.setPadding(0,0,0,0); aa.setMaxLines(1); aa.setEllipsize(android.text.TextUtils.TruncateAt.END); info.addView(tt,new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(43))); info.addView(aa,new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(23))); card.addView(info,new android.widget.LinearLayout.LayoutParams(0,audifyDp(72),1f));
            android.widget.LinearLayout actions=new android.widget.LinearLayout(this); actions.setOrientation(android.widget.LinearLayout.VERTICAL); actions.setGravity(android.view.Gravity.CENTER);
            android.widget.Button play=new android.widget.Button(this); play.setAllCaps(false); play.setText("▶"); play.setTextSize(16f); play.setTextColor(android.graphics.Color.rgb(9,18,7)); play.setPadding(0,0,0,0); play.setStateListAnimator(null); android.graphics.drawable.GradientDrawable pbg=new android.graphics.drawable.GradientDrawable(); pbg.setShape(android.graphics.drawable.GradientDrawable.OVAL); pbg.setColor(android.graphics.Color.rgb(168,255,63)); play.setBackground(pbg); play.setOnClickListener(v->audifyPlaySearchResultV674(queueItems,chosenIndex)); actions.addView(play,new android.widget.LinearLayout.LayoutParams(audifyDp(42),audifyDp(42)));
            android.widget.Button queue=new android.widget.Button(this); queue.setAllCaps(false); queue.setText("＋ File"); queue.setTextSize(10.5f); queue.setTextColor(android.graphics.Color.rgb(208,220,233)); queue.setPadding(audifyDp(3),0,audifyDp(3),0); queue.setStateListAnimator(null); android.graphics.drawable.GradientDrawable qbg=new android.graphics.drawable.GradientDrawable(); qbg.setColor(android.graphics.Color.rgb(35,43,54)); qbg.setCornerRadius(audifyDp(12)); qbg.setStroke(audifyDp(1),android.graphics.Color.rgb(74,88,103)); queue.setBackground(qbg); queue.setOnClickListener(v->{try{startService(new android.content.Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_ENQUEUE).putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,item.id).putExtra(AudifyPlaybackService.EXTRA_TITLE,item.title).putExtra(AudifyPlaybackService.EXTRA_ARTIST,item.artist).putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,item.thumbnail));android.widget.Toast.makeText(this,"Ajouté à la file",android.widget.Toast.LENGTH_SHORT).show();}catch(Exception ignored){}}); android.widget.LinearLayout.LayoutParams qlp=new android.widget.LinearLayout.LayoutParams(audifyDp(56),audifyDp(27)); qlp.topMargin=audifyDp(5); actions.addView(queue,qlp); card.addView(actions,new android.widget.LinearLayout.LayoutParams(audifyDp(62),audifyDp(76)));
            card.setOnClickListener(v->audifyPlaySearchResultV674(queueItems,chosenIndex)); android.widget.LinearLayout.LayoutParams cp=new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT,audifyDp(94)); cp.bottomMargin=audifyDp(10); audifySearchListV672.addView(card,cp);
        }
        audifySearchScrollV672.scrollTo(0,0); audifySearchUiV68104.postDelayed(this::audifyRefreshSearchMiniV68104,120L);
    }`,'renderAudifyNativeResultsV672');

const installMarker='upgradeAudifyNativeSearchV671();';
if(!main.includes('installAudifySearchChromeV68104();')) main=replaceRequired(main,installMarker,installMarker+'\n        installAudifySearchChromeV68104();','installation search chrome');
const destroyNeedle='        try { audifyThumbExecutorV674.shutdownNow(); } catch (Exception ignored) {}';
if(main.includes(destroyNeedle)&&!main.includes('audifySearchUiV68104.removeCallbacksAndMessages(null)')) main=main.replace(destroyNeedle,destroyNeedle+'\n        try { audifySearchUiV68104.removeCallbacksAndMessages(null); } catch (Exception ignored) {}');
await writeFile(mainPath,main,'utf8');

// =============================================================================
// 4) PAROLES 2.0 : vraie page lyrics premium, contenu central, lecteur compact.
// =============================================================================
let karaoke=await readFile(karaokePath,'utf8');
karaoke=replaceMethod(karaoke,['    @Override protected void onCreate(Bundle state){','    @Override protected void onCreate(Bundle state) {'],String.raw`    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12)); getWindow().setNavigationBarColor(Color.rgb(3,5,8));
        Intent in=getIntent(); rawTitle=in==null?"":safe(in.getStringExtra("title")); rawArtist=in==null?"":safe(in.getStringExtra("artist")); videoId=in==null?"":safe(in.getStringExtra("videoId")); resolvedMeta=resolveMetadata(rawTitle,rawArtist);

        FrameLayout root=new FrameLayout(this); root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.rgb(23,34,31),Color.rgb(8,14,17),Color.rgb(3,5,8)}));
        LinearLayout page=new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL); page.setPadding(dp(16),dp(10),dp(16),dp(134));
        LinearLayout header=new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL); Button back=smallButton("‹ Lecteur"); back.setOnClickListener(v->finish()); header.addView(back,new LinearLayout.LayoutParams(dp(104),dp(46)));
        LinearLayout copy=new LinearLayout(this); copy.setOrientation(LinearLayout.VERTICAL); copy.setPadding(dp(11),0,0,0); TextView title=text(resolvedMeta.title,16f,true,Color.WHITE); title.setMaxLines(1); title.setEllipsize(TextUtils.TruncateAt.END); TextView artist=text(resolvedMeta.artist,12.5f,false,Color.rgb(177,188,201)); artist.setMaxLines(1); artist.setEllipsize(TextUtils.TruncateAt.END); copy.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27))); copy.addView(artist,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(21))); header.addView(copy,new LinearLayout.LayoutParams(0,dp(48),1f)); page.addView(header,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));
        LinearLayout hero=new LinearLayout(this); hero.setOrientation(LinearLayout.VERTICAL); hero.setPadding(dp(15),dp(13),dp(15),dp(12)); GradientDrawable hbg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.rgb(34,48,42),Color.rgb(17,25,29)}); hbg.setCornerRadius(dp(24)); hbg.setStroke(dp(1),Color.argb(150,168,255,63)); hero.setBackground(hbg); modeView=text("PAROLES AUDIFY · LIVE",11.5f,true,Color.rgb(168,255,63)); modeView.setLetterSpacing(0.11f); hero.addView(modeView,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28))); statusView=text("Recherche intelligente des paroles…",13f,false,Color.rgb(193,203,215)); hero.addView(statusView,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30))); LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(76)); hp.topMargin=dp(8); page.addView(hero,hp);
        scroll=new ScrollView(this); scroll.setVerticalScrollBarEnabled(false); lyricsBox=new LinearLayout(this); lyricsBox.setOrientation(LinearLayout.VERTICAL); lyricsBox.setPadding(dp(16),dp(24),dp(16),dp(80)); GradientDrawable lbg=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{Color.argb(175,19,27,34),Color.argb(145,9,14,20)}); lbg.setCornerRadius(dp(25)); lbg.setStroke(dp(1),Color.rgb(43,54,64)); lyricsBox.setBackground(lbg); TextView loading=text("Recherche des paroles…",25f,true,Color.rgb(138,149,162)); loading.setGravity(Gravity.CENTER); lyricsBox.addView(loading,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(120))); scroll.addView(lyricsBox,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT)); LinearLayout.LayoutParams scp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f); scp.topMargin=dp(12); page.addView(scroll,scp); root.addView(page,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout controls=new LinearLayout(this); controls.setOrientation(LinearLayout.VERTICAL); controls.setPadding(dp(11),dp(7),dp(11),dp(5)); GradientDrawable cbg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.argb(232,48,62,56),Color.argb(220,23,31,38),Color.argb(212,13,19,27)}); cbg.setCornerRadius(dp(28)); cbg.setStroke(dp(1),Color.argb(165,168,255,63)); controls.setBackground(cbg); controls.setElevation(dp(18)); LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); toggle=roundPlay("⏸"); toggle.setOnClickListener(v->{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));handler.postDelayed(this::refresh,70);}); top.addView(toggle,new LinearLayout.LayoutParams(dp(62),dp(62))); LinearLayout nowBox=new LinearLayout(this); nowBox.setOrientation(LinearLayout.VERTICAL); nowBox.setGravity(Gravity.CENTER_VERTICAL); nowBox.setPadding(dp(12),0,0,0); nowBox.addView(text("Synchronisé avec le lecteur",13.5f,true,Color.WHITE)); nowBox.addView(text("Les paroles suivent automatiquement la timeline.",11.5f,false,Color.rgb(178,190,202))); top.addView(nowBox,new LinearLayout.LayoutParams(0,dp(62),1f)); controls.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66)));
        timeline=new SeekBar(this); timeline.setMax(1000); timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){@Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){} @Override public void onStartTrackingTouch(SeekBar s){userSeeking=true;} @Override public void onStopTrackingTouch(SeekBar s){double seconds=Math.max(0.0,duration)*(s.getProgress()/1000.0);try{startService(new Intent(NativeKaraokeActivity.this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SEEK).putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));}catch(Exception ignored){}userSeeking=false;handler.postDelayed(NativeKaraokeActivity.this::refresh,80);}}); controls.addView(timeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(34)));
        int cw=Math.min(getResources().getDisplayMetrics().widthPixels-dp(24),dp(520)); FrameLayout.LayoutParams clp=new FrameLayout.LayoutParams(cw,dp(112),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL); clp.bottomMargin=dp(12); root.addView(controls,clp); setContentView(root); fetchLyrics();
    }`,'karaoke onCreate');
await writeFile(karaokePath,karaoke,'utf8');

// =============================================================================
// 5) SPLASH FIABLE : vrai écran visible ~1.55 s puis Home natif.
// =============================================================================
const splash=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class AudifySplashActivity extends AppCompatActivity {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean opened=false;

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null)getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(4,7,10)); getWindow().setNavigationBarColor(Color.rgb(4,7,10));
        FrameLayout root=new FrameLayout(this); root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.rgb(9,14,15),Color.rgb(4,7,10),Color.rgb(2,4,7)}));
        ImageView full=new ImageView(this); full.setImageResource(R.drawable.audify_splash); full.setScaleType(ImageView.ScaleType.CENTER_CROP); full.setAlpha(0.0f); root.addView(full,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout brand=new LinearLayout(this); brand.setOrientation(LinearLayout.VERTICAL); brand.setGravity(Gravity.CENTER); TextView a=new TextView(this); a.setText("A"); a.setTextSize(76f); a.setTextColor(Color.rgb(168,255,63)); a.setGravity(Gravity.CENTER); a.setTypeface(a.getTypeface(),android.graphics.Typeface.BOLD); brand.addView(a,new LinearLayout.LayoutParams(dp(124),dp(116))); TextView name=new TextView(this); name.setText("AUDIFY"); name.setTextSize(20f); name.setLetterSpacing(0.22f); name.setTextColor(Color.WHITE); name.setGravity(Gravity.CENTER); name.setTypeface(name.getTypeface(),android.graphics.Typeface.BOLD); brand.addView(name,new LinearLayout.LayoutParams(dp(220),dp(42))); TextView sub=new TextView(this); sub.setText("YOUR MUSIC · YOUR FLOW"); sub.setTextSize(10.5f); sub.setLetterSpacing(0.12f); sub.setTextColor(Color.rgb(167,177,189)); sub.setGravity(Gravity.CENTER); brand.addView(sub,new LinearLayout.LayoutParams(dp(260),dp(34))); brand.setAlpha(0f); brand.setScaleX(0.86f); brand.setScaleY(0.86f); root.addView(brand,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.CENTER)); setContentView(root);
        full.animate().alpha(0.34f).setDuration(420L).start(); brand.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(520L).setInterpolator(new android.view.animation.OvershootInterpolator(0.42f)).start(); handler.postDelayed(this::openAudify,1550L);
    }
    private void openAudify(){if(opened||isFinishing())return;opened=true;startActivity(new Intent(this,NativeHomeActivity.class));overridePendingTransition(android.R.anim.fade_in,android.R.anim.fade_out);finish();}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);super.onDestroy();}
}`;
await writeFile(splashPath,splash,'utf8');

const valuesDir=path.join(resDir,'values'); await mkdir(valuesDir,{recursive:true});
await writeFile(path.join(valuesDir,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowActionModeOverlay">true</item>\n        <item name="android:windowNoTitle">true</item>\n        <item name="android:fontFamily">sans</item>\n        <item name="android:colorAccent">#A8FF3F</item>\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:navigationBarColor">#04070A</item>\n        <item name="android:statusBarColor">#04070A</item>\n        <item name="android:windowBackground">#04070A</item>\n    </style>\n</resources>\n`,'utf8');
const values31=path.join(resDir,'values-v31'); await mkdir(values31,{recursive:true});
await writeFile(path.join(values31,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowSplashScreenBackground">#04070A</item>\n        <item name="android:windowSplashScreenAnimatedIcon">@drawable/audify_launcher</item>\n        <item name="android:windowSplashScreenIconBackgroundColor">#04070A</item>\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:navigationBarColor">#04070A</item>\n        <item name="android:statusBarColor">#04070A</item>\n    </style>\n</resources>\n`,'utf8');

let manifest=await readFile(manifestPath,'utf8');
manifest=manifest.replace(/<activity\s+android:name="\.AudifySplashActivity"[\s\S]*?<\/activity>/m,`<activity\n            android:name=".AudifySplashActivity"\n            android:exported="true"\n            android:noHistory="true"\n            android:excludeFromRecents="true"\n            android:theme="@style/AudifySplashTheme">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>`);
if(!manifest.includes('android:name=".NativePlaylistActivity"')) manifest=manifest.replace('</application>','        <activity android:name=".NativePlaylistActivity" android:exported="false" />\n    </application>');
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V68.10.4 : splash fiable, playlists 2.0, recherche 2.0 + mini permanent, paroles premium et persistance forte.');
