import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
const gradlePath=path.join(android,'app','build.gradle');

// V70.6.1: ne touche ni au layout ni aux animations du widget Lyrics.
// Le service de lecture déclenche seulement le résolveur lorsque le MediaItem change.
const helper=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Audify V70.6.1 — recherche automatique des paroles au changement de morceau.
 * Une requête est lancée une seule fois par morceau, avec cache local.
 * LRCLIB est prioritaire; lyrics.ovh est utilisé en secours.
 */
final class AudifyAutoLyricsResolver {
    static final String MARKER="AUDIFY_V7061_AUTO_LYRICS_BACKGROUND";
    private static final String PREFS="audify_auto_lyrics_v7061";
    private static final String CLIENT="AudifyAndroid/70.6.1 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)";
    private static final long MISS_TTL_MS=30L*60L*1000L;
    private static final Pattern LRC=Pattern.compile("\\[(\\d{1,3}):(\\d{1,2})(?:[\\.:](\\d{1,3}))?\\](.*)");
    private static final Set<String> IN_FLIGHT=ConcurrentHashMap.newKeySet();
    private static final ExecutorService EXEC=Executors.newSingleThreadExecutor(r->{
        Thread t=new Thread(r,"AudifyAutoLyrics");
        t.setDaemon(true);
        return t;
    });

    private AudifyAutoLyricsResolver(){}

    static void onTrackChanged(Context context,MediaItem item){
        if(context==null||item==null)return;
        final Context app=context.getApplicationContext();
        final String id=safe(item.mediaId).trim();
        if(id.isEmpty())return;

        String title="";
        String artist="";
        try{
            MediaMetadata md=item.mediaMetadata;
            if(md!=null){
                if(md.title!=null)title=md.title.toString();
                if(md.artist!=null)artist=md.artist.toString();
            }
        }catch(Throwable ignored){}
        title=cleanTitle(title);
        artist=cleanArtist(artist);
        if(title.isEmpty())return;

        SharedPreferences family=AudifyWidgetFamilyState.prefs(app);
        String publishedId=family.getString(AudifyWidgetFamilyState.K_LYRICS_ID,"");
        String publishedTimeline=family.getString(AudifyWidgetFamilyState.K_LYRICS_TIMELINE,"");
        if(id.equals(publishedId)&&publishedTimeline!=null&&!publishedTimeline.isEmpty()){
            AudifyLyricsWidget.updateAll(app);
            return;
        }

        SharedPreferences cache=app.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        String cached=cache.getString("timeline_"+id,"");
        if(cached!=null&&!cached.isEmpty()){
            publishIfCurrent(app,id,cached);
            return;
        }
        long missAt=cache.getLong("miss_"+id,0L);
        if(missAt>0L&&System.currentTimeMillis()-missAt<MISS_TTL_MS)return;
        if(!IN_FLIGHT.add(id))return;

        final String fTitle=title;
        final String fArtist=artist;
        EXEC.execute(()->{
            try{
                String timeline=resolve(fTitle,fArtist);
                if(timeline!=null&&!timeline.isEmpty()){
                    cache.edit().putString("timeline_"+id,timeline).remove("miss_"+id).apply();
                    publishIfCurrent(app,id,timeline);
                }else{
                    cache.edit().putLong("miss_"+id,System.currentTimeMillis()).apply();
                }
            }catch(Throwable ignored){
                // Un échec réseau temporaire ne bloque que brièvement ce morceau.
                cache.edit().putLong("miss_"+id,System.currentTimeMillis()-MISS_TTL_MS+60000L).apply();
            }finally{
                IN_FLIGHT.remove(id);
            }
        });
    }

    private static void publishIfCurrent(Context app,String id,String timeline){
        try{
            SharedPreferences family=AudifyWidgetFamilyState.prefs(app);
            String current=family.getString(AudifyWidgetFamilyState.K_CURRENT_ID,"");
            if(!id.equals(current))return; // évite qu'une réponse lente remplace les paroles du morceau suivant
            AudifyWidgetFamilyState.publishLyricsTimeline(app,id,timeline);
            AudifyLyricsWidget.updateAll(app);
        }catch(Throwable ignored){}
    }

    private static String resolve(String title,String artist) throws Exception {
        JSONObject exact=null;
        if(!artist.isEmpty()){
            exact=parseObject(httpGet("https://lrclib.net/api/get?track_name="+q(title)+"&artist_name="+q(artist)));
        }
        JSONObject best=usable(exact)?exact:null;

        if(best==null){
            JSONArray results=parseArray(httpGet("https://lrclib.net/api/search?track_name="+q(title)+(artist.isEmpty()?"":"&artist_name="+q(artist))));
            best=bestCandidate(results,title,artist);
        }
        if(best==null){
            JSONArray broad=parseArray(httpGet("https://lrclib.net/api/search?q="+q((title+" "+artist).trim())));
            best=bestCandidate(broad,title,artist);
        }

        if(best!=null){
            String synced=best.optString("syncedLyrics","");
            String plain=best.optString("plainLyrics","");
            String timeline=timelineFromSynced(synced);
            if(!timeline.isEmpty())return timeline;
            timeline=timelineFromPlain(plain);
            if(!timeline.isEmpty())return timeline;
        }

        if(!artist.isEmpty()){
            JSONObject ovh=parseObject(httpGet("https://api.lyrics.ovh/v1/"+pathPart(artist)+"/"+pathPart(title)));
            if(ovh!=null){
                String timeline=timelineFromPlain(ovh.optString("lyrics",""));
                if(!timeline.isEmpty())return timeline;
            }
        }
        return "";
    }

    private static JSONObject bestCandidate(JSONArray a,String title,String artist){
        if(a==null)return null;
        JSONObject best=null;
        double bestScore=0.0;
        for(int i=0;i<a.length();i++){
            JSONObject o=a.optJSONObject(i);
            if(!usable(o))continue;
            String t=o.optString("trackName",o.optString("name",""));
            String ar=o.optString("artistName","");
            double ts=similarity(title,t);
            double as=artist.isEmpty()?0.75:similarity(artist,ar);
            double score=ts*0.73+as*0.27;
            if(!o.optString("syncedLyrics","").trim().isEmpty())score+=0.04;
            if(score>bestScore){bestScore=score;best=o;}
        }
        return bestScore>=0.56?best:null;
    }

    private static boolean usable(JSONObject o){
        return o!=null&&(!o.optString("syncedLyrics","").trim().isEmpty()||!o.optString("plainLyrics","").trim().isEmpty());
    }

    private static String timelineFromSynced(String raw){
        if(raw==null||raw.trim().isEmpty())return "";
        JSONArray out=new JSONArray();
        String[] rows=raw.replace("\\r","").split("\\n");
        for(String row:rows){
            Matcher m=LRC.matcher(row.trim());
            if(!m.matches())continue;
            String text=safe(m.group(4)).trim();
            if(text.isEmpty())continue;
            try{
                double min=Double.parseDouble(m.group(1));
                double sec=Double.parseDouble(m.group(2));
                String frac=safe(m.group(3));
                double f=0.0;
                if(!frac.isEmpty()){
                    if(frac.length()==1)f=Double.parseDouble(frac)/10.0;
                    else if(frac.length()==2)f=Double.parseDouble(frac)/100.0;
                    else f=Double.parseDouble(frac.substring(0,Math.min(3,frac.length())))/1000.0;
                }
                JSONObject line=new JSONObject();
                line.put("time",min*60.0+sec+f);
                line.put("text",text);
                out.put(line);
            }catch(Throwable ignored){}
        }
        return out.length()==0?"":out.toString();
    }

    private static String timelineFromPlain(String raw){
        if(raw==null||raw.trim().isEmpty())return "";
        JSONArray out=new JSONArray();
        String[] rows=raw.replace("\\r","").split("\\n");
        for(String row:rows){
            String text=row.trim();
            if(text.isEmpty())continue;
            try{
                JSONObject line=new JSONObject();
                line.put("time",-1.0);
                line.put("text",text);
                out.put(line);
            }catch(Throwable ignored){}
        }
        return out.length()==0?"":out.toString();
    }

    private static String httpGet(String url) throws Exception {
        HttpURLConnection c=null;
        InputStream in=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();
            c.setConnectTimeout(6500);
            c.setReadTimeout(9000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("Accept","application/json");
            c.setRequestProperty("User-Agent",CLIENT);
            int code=c.getResponseCode();
            in=(code>=200&&code<300)?c.getInputStream():c.getErrorStream();
            if(in==null)return "";
            BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));
            StringBuilder b=new StringBuilder();
            String line;
            while((line=br.readLine())!=null)b.append(line);
            return code>=200&&code<300?b.toString():"";
        }finally{
            try{if(in!=null)in.close();}catch(Throwable ignored){}
            if(c!=null)c.disconnect();
        }
    }

    private static JSONObject parseObject(String raw){
        try{return raw==null||raw.trim().isEmpty()?null:new JSONObject(raw);}catch(Throwable ignored){return null;}
    }
    private static JSONArray parseArray(String raw){
        try{return raw==null||raw.trim().isEmpty()?null:new JSONArray(raw);}catch(Throwable ignored){return null;}
    }

    private static String q(String s){
        try{return URLEncoder.encode(safe(s),"UTF-8");}catch(Throwable ignored){return safe(s);}
    }
    private static String pathPart(String s){return q(s).replace("+","%20");}

    private static String cleanTitle(String raw){
        String s=safe(raw).replace('–','-').replace('—','-');
        s=s.replaceAll("(?i)\\s*[\\[(][^\\])]*(official|officiel|music\\s*video|video|audio|visualizer|lyrics?|paroles|4k|hd)[^\\])]*[\\])]\\s*"," ");
        s=s.replaceAll("(?i)\\s*\\|\\s*(official|officiel|video|audio|lyrics?).*$","");
        s=s.replaceAll("\\s+"," ").trim();
        return s;
    }
    private static String cleanArtist(String raw){
        String s=safe(raw).replace('–','-').replace('—','-');
        s=s.replaceAll("(?i)\\s*-\\s*topic\\s*$","");
        s=s.replaceAll("(?i)\\b(official|officiel|vevo)\\b"," ");
        return s.replaceAll("\\s+"," ").trim();
    }

    private static double similarity(String a,String b){
        String x=norm(a),y=norm(b);
        if(x.isEmpty()||y.isEmpty())return 0.0;
        if(x.equals(y))return 1.0;
        if((x.contains(y)||y.contains(x))&&Math.min(x.length(),y.length())>=4)return 0.90;
        String[] xa=x.split(" "),ya=y.split(" ");
        int common=0;
        for(String p:xa){
            if(p.length()<2)continue;
            for(String q:ya){if(p.equals(q)){common++;break;}}
        }
        int denom=Math.max(1,Math.max(xa.length,ya.length));
        return (double)common/(double)denom;
    }
    private static String norm(String raw){
        String s=Normalizer.normalize(safe(raw).toLowerCase(Locale.ROOT),Normalizer.Form.NFD).replaceAll("\\p{M}+","");
        return s.replaceAll("[^a-z0-9]+"," ").replaceAll("\\s+"," ").trim();
    }
    private static String safe(String s){return s==null?"":s;}
}
`;
await writeFile(path.join(pkgDir,'AudifyAutoLyricsResolver.java'),helper,'utf8');

let service=await readFile(servicePath,'utf8');
const marker='AUDIFY_V7061_AUTO_LYRICS_SERVICE_HOOK';
if(!service.includes(marker)){
  const anchor='        player = new ExoPlayer.Builder(this).build();';
  if(!service.includes(anchor))throw new Error('V70.6.1: ancre ExoPlayer introuvable dans AudifyPlaybackService');
  const hook=String.raw`
        // AUDIFY_V7061_AUTO_LYRICS_SERVICE_HOOK
        player.addListener(new Player.Listener(){
            @Override public void onMediaItemTransition(MediaItem item,int reason){
                try{
                    AudifyWidgetFamilyState.publish(AudifyPlaybackService.this,player);
                    AudifyAutoLyricsResolver.onTrackChanged(AudifyPlaybackService.this,item);
                }catch(Throwable ignored){}
            }
            @Override public void onPlaybackStateChanged(int state){
                if(state!=Player.STATE_READY)return;
                try{
                    MediaItem item=player==null?null:player.getCurrentMediaItem();
                    if(item!=null){
                        AudifyWidgetFamilyState.publish(AudifyPlaybackService.this,player);
                        AudifyAutoLyricsResolver.onTrackChanged(AudifyPlaybackService.this,item);
                    }
                }catch(Throwable ignored){}
            }
        });`;
  service=service.replace(anchor,anchor+hook);
}
await writeFile(servicePath,service,'utf8');

let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7061');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.6.1"');
await writeFile(gradlePath,gradle,'utf8');

console.log('Audify V70.6.1: auto-lyrics en arrière-plan sur changement de MediaItem; widget visuel inchangé.');
