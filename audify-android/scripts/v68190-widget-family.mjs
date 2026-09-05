import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const main=path.join(android,'app','src','main');
const pkgDir=path.join(main,'java','com','nova','audify');
const res=path.join(main,'res');
const layoutDir=path.join(res,'layout');
const drawableDir=path.join(res,'drawable');
const xmlDir=path.join(res,'xml');
await Promise.all([mkdir(pkgDir,{recursive:true}),mkdir(layoutDir,{recursive:true}),mkdir(drawableDir,{recursive:true}),mkdir(xmlDir,{recursive:true})]);

// Audify V68.19 — three additional native Android widgets.
// Deliberately isolated from the frozen album-identification engine.
// Family:
// 1) existing V68.18 full Player
// 2) Mini Player (compact)
// 3) Quick Music (recents / favorites)
// 4) Lyrics / Karaoke (live line after lyrics have been resolved once)

const familyState=String.raw`package com.nova.audify;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;

import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

final class AudifyWidgetFamilyState {
    static final String MARKER="AUDIFY_V68190_WIDGET_FAMILY";
    static final String RECENTS_MARKER="AUDIFY_V68190_RECENTS_FAVORITES_WIDGET";
    static final String LYRICS_TIMELINE_MARKER="AUDIFY_V68190_LYRICS_TIMELINE_BRIDGE";

    static final String PREFS="audify_widget_v68180";
    static final String K_CURRENT_ID="family_current_id";
    static final String K_RECENTS="family_recents_json";
    static final String K_LYRICS_ID="family_lyrics_id";
    static final String K_LYRICS_TIMELINE="family_lyrics_timeline";
    static final String K_LYRIC_LINE="family_lyric_line";
    static final String K_LYRIC_NEXT="family_lyric_next";

    private static final Handler TICKER=new Handler(Looper.getMainLooper());
    private static WeakReference<Player> lastPlayer=new WeakReference<>(null);
    private static Context appContext;
    private static boolean tickerRunning=false;

    private AudifyWidgetFamilyState(){}

    static SharedPreferences prefs(Context context){
        return context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    static void publish(Context context,Player player){
        if(context==null)return;
        Context app=context.getApplicationContext();
        appContext=app;
        if(player!=null)lastPlayer=new WeakReference<>(player);

        String id="";
        String title="Aucune lecture";
        String artist="Audify";
        String art="";
        try{
            if(player!=null){
                MediaItem item=player.getCurrentMediaItem();
                if(item!=null){
                    id=safe(item.mediaId);
                    MediaMetadata md=item.mediaMetadata;
                    if(md!=null){
                        if(md.title!=null&&!md.title.toString().trim().isEmpty())title=md.title.toString().trim();
                        if(md.artist!=null&&!md.artist.toString().trim().isEmpty())artist=md.artist.toString().trim();
                        Uri u=md.artworkUri;
                        if(u!=null)art=u.toString();
                    }
                }
            }
        }catch(Throwable ignored){}

        SharedPreferences p=prefs(app);
        p.edit().putString(K_CURRENT_ID,id).apply();
        if(!id.isEmpty())pushRecent(p,id,title,artist,art);
        updateLyricFromTimeline(app,player,id);
        AudifyMiniWidget.updateAll(app);
        AudifyQuickMusicWidget.updateAll(app);
        AudifyLyricsWidget.updateAll(app);
        ensureTicker(app,player);
    }

    static List<AudifyLibraryStore.Track> recentTracks(Context context){
        ArrayList<AudifyLibraryStore.Track> out=new ArrayList<>();
        try{
            JSONArray a=new JSONArray(prefs(context).getString(K_RECENTS,"[]"));
            for(int i=0;i<a.length();i++){
                JSONObject o=a.optJSONObject(i);
                if(o==null)continue;
                String id=o.optString("id","");
                if(id.isEmpty())continue;
                out.add(new AudifyLibraryStore.Track(
                    id,
                    o.optString("title","Sans titre"),
                    o.optString("artist","Audify"),
                    o.optString("art","")
                ));
            }
        }catch(Throwable ignored){}
        return out;
    }

    static void publishLyricsTimeline(Context context,String videoId,String json){
        if(context==null)return;
        String id=safe(videoId);
        String raw=safe(json);
        SharedPreferences p=prefs(context);
        p.edit()
            .putString(K_LYRICS_ID,id)
            .putString(K_LYRICS_TIMELINE,raw)
            .apply();
        publishFirstLyrics(context,id,raw);
        AudifyLyricsWidget.updateAll(context.getApplicationContext());
        Player player=lastPlayer.get();
        if(player!=null)ensureTicker(context.getApplicationContext(),player);
    }

    private static void publishFirstLyrics(Context context,String id,String raw){
        try{
            JSONArray a=new JSONArray(raw);
            String line="";
            String next="";
            for(int i=0;i<a.length();i++){
                JSONObject o=a.optJSONObject(i);
                if(o==null)continue;
                String text=o.optString("text","").trim();
                if(text.isEmpty())continue;
                if(line.isEmpty())line=text;
                else{next=text;break;}
            }
            prefs(context).edit()
                .putString(K_LYRICS_ID,id)
                .putString(K_LYRIC_LINE,line)
                .putString(K_LYRIC_NEXT,next)
                .apply();
        }catch(Throwable ignored){}
    }

    private static void pushRecent(SharedPreferences p,String id,String title,String artist,String art){
        try{
            JSONArray old=new JSONArray(p.getString(K_RECENTS,"[]"));
            JSONArray next=new JSONArray();
            JSONObject current=new JSONObject();
            current.put("id",id);
            current.put("title",safe(title));
            current.put("artist",safe(artist));
            current.put("art",safe(art));
            next.put(current);
            for(int i=0;i<old.length()&&next.length()<4;i++){
                JSONObject o=old.optJSONObject(i);
                if(o==null)continue;
                String oldId=o.optString("id","");
                if(oldId.isEmpty()||oldId.equals(id))continue;
                next.put(o);
            }
            p.edit().putString(K_RECENTS,next.toString()).apply();
        }catch(Throwable ignored){}
    }

    private static void updateLyricFromTimeline(Context context,Player player,String currentId){
        if(player==null||currentId==null||currentId.isEmpty())return;
        SharedPreferences p=prefs(context);
        if(!currentId.equals(p.getString(K_LYRICS_ID,"")))return;
        String raw=p.getString(K_LYRICS_TIMELINE,"");
        if(raw==null||raw.isEmpty())return;
        try{
            JSONArray a=new JSONArray(raw);
            if(a.length()==0)return;
            double pos=Math.max(0.0,player.getCurrentPosition()/1000.0);
            int chosen=-1;
            boolean hasTimed=false;
            for(int i=0;i<a.length();i++){
                JSONObject o=a.optJSONObject(i);
                if(o==null)continue;
                double t=o.optDouble("time",-1.0);
                if(t>=0.0){
                    hasTimed=true;
                    if(t<=pos)chosen=i;
                    else break;
                }
            }
            if(!hasTimed){
                for(int i=0;i<a.length();i++){
                    JSONObject o=a.optJSONObject(i);
                    if(o!=null&&!o.optString("text","").trim().isEmpty()){chosen=i;break;}
                }
            }else if(chosen<0){
                chosen=0;
            }
            if(chosen<0||chosen>=a.length())return;
            String line=a.optJSONObject(chosen)==null?"":a.optJSONObject(chosen).optString("text","").trim();
            String next="";
            for(int i=chosen+1;i<a.length();i++){
                JSONObject n=a.optJSONObject(i);
                if(n==null)continue;
                String tx=n.optString("text","").trim();
                if(!tx.isEmpty()){next=tx;break;}
            }
            if(line.isEmpty())return;
            if(line.equals(p.getString(K_LYRIC_LINE,""))&&next.equals(p.getString(K_LYRIC_NEXT,"")))return;
            p.edit().putString(K_LYRIC_LINE,line).putString(K_LYRIC_NEXT,next).apply();
        }catch(Throwable ignored){}
    }

    private static void ensureTicker(Context context,Player player){
        if(context==null||player==null)return;
        appContext=context.getApplicationContext();
        lastPlayer=new WeakReference<>(player);
        if(tickerRunning)return;
        if(!player.isPlaying())return;
        if(!hasLyricsWidget(appContext))return;
        SharedPreferences p=prefs(appContext);
        String current=safe(player.getCurrentMediaItem()==null?"":player.getCurrentMediaItem().mediaId);
        if(current.isEmpty()||!current.equals(p.getString(K_LYRICS_ID,""))||p.getString(K_LYRICS_TIMELINE,"").isEmpty())return;
        tickerRunning=true;
        TICKER.post(ticker);
    }

    private static final Runnable ticker=new Runnable(){
        @Override public void run(){
            Context context=appContext;
            Player player=lastPlayer.get();
            if(context==null||player==null||!player.isPlaying()||!hasLyricsWidget(context)){
                tickerRunning=false;
                return;
            }
            String id="";
            try{
                MediaItem item=player.getCurrentMediaItem();
                if(item!=null)id=safe(item.mediaId);
            }catch(Throwable ignored){}
            SharedPreferences p=prefs(context);
            if(id.isEmpty()||!id.equals(p.getString(K_LYRICS_ID,""))||p.getString(K_LYRICS_TIMELINE,"").isEmpty()){
                tickerRunning=false;
                return;
            }
            updateLyricFromTimeline(context,player,id);
            AudifyLyricsWidget.updateAll(context);
            TICKER.postDelayed(this,3000L);
        }
    };

    private static boolean hasLyricsWidget(Context context){
        try{
            int[] ids=AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context,AudifyLyricsWidget.class));
            return ids!=null&&ids.length>0;
        }catch(Throwable ignored){return false;}
    }

    private static String safe(String s){return s==null?"":s;}
}
`;
await writeFile(path.join(pkgDir,'AudifyWidgetFamilyState.java'),familyState,'utf8');

const artwork=String.raw`package com.nova.audify;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class AudifyWidgetArtwork {
    interface Callback { void onBitmap(Bitmap bitmap); }

    private static final ExecutorService EXEC=Executors.newSingleThreadExecutor(r->{
        Thread t=new Thread(r,"AudifyWidgetFamilyArtwork");
        t.setDaemon(true);
        return t;
    });
    private static final Map<String,Bitmap> CACHE=new ConcurrentHashMap<>();

    private AudifyWidgetArtwork(){}

    static void load(Context context,String raw,int size,Callback callback){
        if(raw==null||raw.trim().isEmpty()||callback==null)return;
        String url=raw.trim();
        String key=url+"#"+Math.max(48,size);
        Bitmap cached=CACHE.get(key);
        if(cached!=null){callback.onBitmap(cached);return;}
        EXEC.execute(()->{
            HttpURLConnection c=null;
            InputStream in=null;
            try{
                c=(HttpURLConnection)new URL(url).openConnection();
                c.setConnectTimeout(6000);
                c.setReadTimeout(8000);
                c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent","Mozilla/5.0 Audify/68.19");
                in=c.getInputStream();
                Bitmap decoded=BitmapFactory.decodeStream(in);
                if(decoded==null)return;
                int w=Math.max(1,decoded.getWidth()),h=Math.max(1,decoded.getHeight());
                int side=Math.min(w,h);
                int x=Math.max(0,(w-side)/2),y=Math.max(0,(h-side)/2);
                Bitmap crop=Bitmap.createBitmap(decoded,x,y,side,side);
                int px=Math.max(48,size);
                Bitmap scaled=Bitmap.createScaledBitmap(crop,px,px,true);
                if(crop!=decoded&&!crop.isRecycled())crop.recycle();
                if(decoded!=scaled&&!decoded.isRecycled())decoded.recycle();
                CACHE.put(key,scaled);
                if(CACHE.size()>18){
                    String first=CACHE.keySet().iterator().next();
                    if(!first.equals(key))CACHE.remove(first);
                }
                callback.onBitmap(scaled);
            }catch(Throwable ignored){}
            finally{
                try{if(in!=null)in.close();}catch(Throwable ignored){}
                if(c!=null)c.disconnect();
            }
        });
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyWidgetArtwork.java'),artwork,'utf8');

const mini=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

public final class AudifyMiniWidget extends AppWidgetProvider {
    public static final String MARKER="AUDIFY_V68190_MINI_WIDGET";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id,null);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyMiniWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id,null);
    }

    private static void render(Context context,AppWidgetManager manager,int widgetId,Bitmap artwork){
        SharedPreferences p=AudifyWidgetFamilyState.prefs(context);
        String currentId=p.getString(AudifyWidgetFamilyState.K_CURRENT_ID,"");
        String title=p.getString("title","Aucune lecture");
        String artist=p.getString("artist","Audify");
        String art=p.getString("art","");
        boolean playing=p.getBoolean("playing",false);

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_mini);
        v.setTextViewText(R.id.audify_mini_title,currentId==null||currentId.isEmpty()?"Appuyer pour écouter":safe(title,"Aucune lecture"));
        v.setTextViewText(R.id.audify_mini_artist,currentId==null||currentId.isEmpty()?"AUDIFY MINI":safe(artist,"Audify"));
        v.setTextViewText(R.id.audify_mini_play,playing?"Ⅱ":"▶");
        v.setContentDescription(R.id.audify_mini_play,playing?"Pause":"Lecture");
        if(artwork!=null)v.setImageViewBitmap(R.id.audify_mini_art,artwork);
        else v.setImageViewResource(R.id.audify_mini_art,R.mipmap.ic_launcher);

        PendingIntent open=openCurrent(context,widgetId,currentId,title,artist,art);
        v.setOnClickPendingIntent(R.id.audify_mini_root,open);
        v.setOnClickPendingIntent(R.id.audify_mini_art,open);
        v.setOnClickPendingIntent(R.id.audify_mini_meta,open);
        v.setOnClickPendingIntent(R.id.audify_mini_previous,servicePi(context,request(widgetId,1),AudifyPlaybackService.ACTION_PREVIOUS));
        v.setOnClickPendingIntent(R.id.audify_mini_play,servicePi(context,request(widgetId,2),AudifyPlaybackService.ACTION_TOGGLE));
        v.setOnClickPendingIntent(R.id.audify_mini_next,servicePi(context,request(widgetId,3),AudifyPlaybackService.ACTION_NEXT));
        manager.updateAppWidget(widgetId,v);

        if(artwork==null&&art!=null&&!art.isEmpty()){
            AudifyWidgetArtwork.load(context.getApplicationContext(),art,128,bmp->{
                RemoteViews fresh=new RemoteViews(context.getPackageName(),R.layout.audify_widget_mini);
                fresh.setImageViewBitmap(R.id.audify_mini_art,bmp);
                manager.partiallyUpdateAppWidget(widgetId,fresh);
            });
        }
    }

    private static PendingIntent openCurrent(Context context,int widgetId,String id,String title,String artist,String art){
        Intent i;
        if(id==null||id.isEmpty()){
            i=new Intent(context,NativeHomeActivity.class);
        }else{
            i=new Intent(context,NativePlayerActivity.class)
                .putExtra("videoId",id)
                .putExtra("title",safe(title,"Sans titre"))
                .putExtra("artist",safe(artist,"Audify"))
                .putExtra("thumbnail",safe(art,""));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context,request(widgetId,4),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent servicePi(Context context,int request,String action){
        Intent i=new Intent(context,AudifyPlaybackService.class).setAction(action);
        return PendingIntent.getService(context,request,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    private static int request(int widgetId,int offset){return 681900+Math.abs(widgetId%100000)*10+offset;}
    private static String safe(String s,String fallback){return s==null||s.trim().isEmpty()?fallback:s.trim();}
}
`;
await writeFile(path.join(pkgDir,'AudifyMiniWidget.java'),mini,'utf8');

const quick=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class AudifyQuickMusicWidget extends AppWidgetProvider {
    public static final String MARKER="AUDIFY_V68190_QUICK_MUSIC_WIDGET";
    public static final String ACTION_TOGGLE_MODE="com.nova.audify.widget.QUICK_TOGGLE_MODE";
    public static final String ACTION_PLAY_TRACK="com.nova.audify.widget.QUICK_PLAY_TRACK";
    private static final String EXTRA_WIDGET_ID="widget_id";
    private static final String EXTRA_ID="videoId";
    private static final String EXTRA_TITLE="title";
    private static final String EXTRA_ARTIST="artist";
    private static final String EXTRA_ART="thumbnail";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    @Override public void onReceive(Context context,Intent intent){
        super.onReceive(context,intent);
        if(intent==null)return;
        String action=intent.getAction();
        if(ACTION_TOGGLE_MODE.equals(action)){
            int widgetId=intent.getIntExtra(EXTRA_WIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID);
            if(widgetId==AppWidgetManager.INVALID_APPWIDGET_ID)return;
            SharedPreferences p=AudifyWidgetFamilyState.prefs(context);
            String key="quick_mode_"+widgetId;
            String old=p.getString(key,"recent");
            p.edit().putString(key,"likes".equals(old)?"recent":"likes").apply();
            render(context,AppWidgetManager.getInstance(context),widgetId);
            return;
        }
        if(ACTION_PLAY_TRACK.equals(action)){
            String id=intent.getStringExtra(EXTRA_ID);
            if(id==null||id.isEmpty())return;
            String title=safe(intent.getStringExtra(EXTRA_TITLE),"Sans titre");
            String artist=safe(intent.getStringExtra(EXTRA_ARTIST),"Audify");
            String art=safe(intent.getStringExtra(EXTRA_ART),"");
            try{
                context.startService(new Intent(context,AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_LOAD)
                    .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,id)
                    .putExtra(AudifyPlaybackService.EXTRA_TITLE,title)
                    .putExtra(AudifyPlaybackService.EXTRA_ARTIST,artist)
                    .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,art));
            }catch(Throwable ignored){}
            try{
                Intent player=new Intent(context,NativePlayerActivity.class)
                    .putExtra("videoId",id)
                    .putExtra("title",title)
                    .putExtra("artist",artist)
                    .putExtra("thumbnail",art)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(player);
            }catch(Throwable ignored){}
        }
    }

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyQuickMusicWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id);
    }

    private static void render(Context context,AppWidgetManager manager,int widgetId){
        SharedPreferences p=AudifyWidgetFamilyState.prefs(context);
        String mode=p.getString("quick_mode_"+widgetId,"recent");
        boolean likes="likes".equals(mode);
        List<AudifyLibraryStore.Track> tracks;
        if(likes){
            tracks=new ArrayList<>(new AudifyLibraryStore(context).getLikes());
            Collections.reverse(tracks);
        }else{
            tracks=new ArrayList<>(AudifyWidgetFamilyState.recentTracks(context));
        }
        if(tracks.size()>4)tracks=tracks.subList(0,4);

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_quick);
        v.setTextViewText(R.id.audify_quick_mode,likes?"♥ FAVORIS":"RÉCENTS");
        v.setContentDescription(R.id.audify_quick_mode,likes?"Afficher les récents":"Afficher les favoris");
        Intent toggle=new Intent(context,AudifyQuickMusicWidget.class)
            .setAction(ACTION_TOGGLE_MODE)
            .putExtra(EXTRA_WIDGET_ID,widgetId);
        v.setOnClickPendingIntent(R.id.audify_quick_mode,PendingIntent.getBroadcast(
            context,request(widgetId,90),toggle,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));

        Intent library=new Intent(context,NativeLibraryActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.audify_quick_header,PendingIntent.getActivity(
            context,request(widgetId,91),library,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));

        int[] slots={R.id.audify_quick_slot1,R.id.audify_quick_slot2,R.id.audify_quick_slot3,R.id.audify_quick_slot4};
        int[] arts={R.id.audify_quick_art1,R.id.audify_quick_art2,R.id.audify_quick_art3,R.id.audify_quick_art4};
        int[] titles={R.id.audify_quick_title1,R.id.audify_quick_title2,R.id.audify_quick_title3,R.id.audify_quick_title4};

        for(int i=0;i<4;i++){
            if(i<tracks.size()){
                AudifyLibraryStore.Track t=tracks.get(i);
                v.setViewVisibility(slots[i],View.VISIBLE);
                v.setTextViewText(titles[i],shortTitle(t.title));
                v.setImageViewResource(arts[i],R.mipmap.ic_launcher);
                Intent play=new Intent(context,AudifyQuickMusicWidget.class)
                    .setAction(ACTION_PLAY_TRACK)
                    .putExtra(EXTRA_WIDGET_ID,widgetId)
                    .putExtra(EXTRA_ID,t.id)
                    .putExtra(EXTRA_TITLE,t.title)
                    .putExtra(EXTRA_ARTIST,t.artist)
                    .putExtra(EXTRA_ART,t.thumbnail);
                v.setOnClickPendingIntent(slots[i],PendingIntent.getBroadcast(
                    context,request(widgetId,i+1),play,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
            }else{
                v.setViewVisibility(slots[i],View.INVISIBLE);
            }
        }

        boolean empty=tracks.isEmpty();
        v.setViewVisibility(R.id.audify_quick_empty,empty?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.audify_quick_empty,likes?"Aucun favori pour le moment":"Écoutez un titre pour remplir vos récents");
        manager.updateAppWidget(widgetId,v);

        for(int i=0;i<tracks.size();i++){
            AudifyLibraryStore.Track t=tracks.get(i);
            String art=t.thumbnail;
            if(art==null||art.isEmpty())continue;
            final int artId=arts[i];
            AudifyWidgetArtwork.load(context.getApplicationContext(),art,144,bmp->{
                RemoteViews partial=new RemoteViews(context.getPackageName(),R.layout.audify_widget_quick);
                partial.setImageViewBitmap(artId,bmp);
                manager.partiallyUpdateAppWidget(widgetId,partial);
            });
        }
    }

    private static String shortTitle(String s){
        String t=safe(s,"Sans titre");
        return t.length()>18?t.substring(0,17)+"…":t;
    }
    private static int request(int widgetId,int offset){return 682000+Math.abs(widgetId%100000)*100+offset;}
    private static String safe(String s,String fallback){return s==null||s.trim().isEmpty()?fallback:s.trim();}
}
`;
await writeFile(path.join(pkgDir,'AudifyQuickMusicWidget.java'),quick,'utf8');

const lyrics=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.widget.RemoteViews;

public final class AudifyLyricsWidget extends AppWidgetProvider {
    public static final String MARKER="AUDIFY_V68190_LYRICS_WIDGET";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id,null);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyLyricsWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id,null);
    }

    private static void render(Context context,AppWidgetManager manager,int widgetId,Bitmap artwork){
        SharedPreferences p=AudifyWidgetFamilyState.prefs(context);
        String currentId=p.getString(AudifyWidgetFamilyState.K_CURRENT_ID,"");
        String title=safe(p.getString("title","Aucune lecture"),"Aucune lecture");
        String artist=safe(p.getString("artist","Audify"),"Audify");
        String art=safe(p.getString("art",""),"");
        boolean playing=p.getBoolean("playing",false);
        String lyricId=p.getString(AudifyWidgetFamilyState.K_LYRICS_ID,"");
        String line="";
        String next="";
        if(currentId!=null&&!currentId.isEmpty()&&currentId.equals(lyricId)){
            line=safe(p.getString(AudifyWidgetFamilyState.K_LYRIC_LINE,""),"");
            next=safe(p.getString(AudifyWidgetFamilyState.K_LYRIC_NEXT,""),"");
        }
        if(line.isEmpty()){
            line=currentId==null||currentId.isEmpty()?"Lancez une musique dans Audify":"Touchez 🎤 pour synchroniser les paroles";
            next=currentId==null||currentId.isEmpty()?"Karaoké Audify":"Les paroles apparaîtront ici";
        }

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_lyrics);
        v.setTextViewText(R.id.audify_lyrics_title,title);
        v.setTextViewText(R.id.audify_lyrics_artist,artist);
        v.setTextViewText(R.id.audify_lyrics_line,line);
        v.setTextViewText(R.id.audify_lyrics_next,next);
        v.setTextViewText(R.id.audify_lyrics_play,playing?"Ⅱ":"▶");
        v.setContentDescription(R.id.audify_lyrics_play,playing?"Pause":"Lecture");
        if(artwork!=null)v.setImageViewBitmap(R.id.audify_lyrics_art,artwork);
        else v.setImageViewResource(R.id.audify_lyrics_art,R.mipmap.ic_launcher);

        PendingIntent openLyrics=openLyrics(context,widgetId,currentId,title,artist,art);
        v.setOnClickPendingIntent(R.id.audify_lyrics_root,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_mic,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_line,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_next,openLyrics);
        Intent toggle=new Intent(context,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE);
        v.setOnClickPendingIntent(R.id.audify_lyrics_play,PendingIntent.getService(
            context,request(widgetId,2),toggle,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(widgetId,v);

        if(artwork==null&&!art.isEmpty()){
            AudifyWidgetArtwork.load(context.getApplicationContext(),art,128,bmp->{
                RemoteViews partial=new RemoteViews(context.getPackageName(),R.layout.audify_widget_lyrics);
                partial.setImageViewBitmap(R.id.audify_lyrics_art,bmp);
                manager.partiallyUpdateAppWidget(widgetId,partial);
            });
        }
    }

    private static PendingIntent openLyrics(Context context,int widgetId,String id,String title,String artist,String art){
        Intent i;
        if(id==null||id.isEmpty()){
            i=new Intent(context,NativeHomeActivity.class);
        }else{
            i=new Intent(context,NativeKaraokeActivity.class)
                .putExtra("videoId",id)
                .putExtra("title",title)
                .putExtra("artist",artist)
                .putExtra("thumbnail",art);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context,request(widgetId,1),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    private static int request(int widgetId,int offset){return 683000+Math.abs(widgetId%100000)*10+offset;}
    private static String safe(String s,String fallback){return s==null||s.trim().isEmpty()?fallback:s.trim();}
}
`;
await writeFile(path.join(pkgDir,'AudifyLyricsWidget.java'),lyrics,'utf8');

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
await writeFile(path.join(layoutDir,'audify_widget_mini.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/audify_mini_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:padding="8dp"
    android:background="@drawable/audify_widget_bg">

    <ImageView
        android:id="@+id/audify_mini_art"
        android:layout_width="50dp"
        android:layout_height="50dp"
        android:scaleType="centerCrop"
        android:src="@mipmap/ic_launcher"
        android:contentDescription="Pochette Audify" />

    <LinearLayout
        android:id="@+id/audify_mini_meta"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_marginStart="9dp"
        android:orientation="vertical"
        android:gravity="center_vertical">

        <TextView
            android:id="@+id/audify_mini_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="Appuyer pour écouter"
            android:textStyle="bold"
            android:textSize="14sp"
            android:textColor="#F7F9FC" />

        <TextView
            android:id="@+id/audify_mini_artist"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="AUDIFY MINI"
            android:textSize="11sp"
            android:textColor="#9DFF57" />
    </LinearLayout>

    <TextView
        android:id="@+id/audify_mini_previous"
        android:layout_width="36dp"
        android:layout_height="36dp"
        android:layout_marginStart="4dp"
        android:gravity="center"
        android:background="@drawable/audify_widget_control_bg"
        android:text="⏮"
        android:textSize="16sp"
        android:textColor="#F5F7FA"
        android:contentDescription="Morceau précédent" />

    <TextView
        android:id="@+id/audify_mini_play"
        android:layout_width="42dp"
        android:layout_height="38dp"
        android:layout_marginStart="5dp"
        android:gravity="center"
        android:background="@drawable/audify_widget_play_bg"
        android:text="▶"
        android:textStyle="bold"
        android:textSize="18sp"
        android:textColor="#101417"
        android:contentDescription="Lecture" />

    <TextView
        android:id="@+id/audify_mini_next"
        android:layout_width="36dp"
        android:layout_height="36dp"
        android:layout_marginStart="5dp"
        android:gravity="center"
        android:background="@drawable/audify_widget_control_bg"
        android:text="⏭"
        android:textSize="16sp"
        android:textColor="#F5F7FA"
        android:contentDescription="Morceau suivant" />
</LinearLayout>
`,'utf8');

await writeFile(path.join(layoutDir,'audify_widget_quick.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="10dp"
    android:background="@drawable/audify_widget_bg">

    <LinearLayout
        android:id="@+id/audify_quick_header"
        android:layout_width="match_parent"
        android:layout_height="34dp"
        android:gravity="center_vertical"
        android:orientation="horizontal">

        <TextView
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:gravity="center_vertical"
            android:text="AUDIFY QUICK"
            android:textStyle="bold"
            android:textSize="11sp"
            android:letterSpacing="0.12"
            android:textColor="#9DFF57" />

        <TextView
            android:id="@+id/audify_quick_mode"
            android:layout_width="96dp"
            android:layout_height="30dp"
            android:gravity="center"
            android:background="@drawable/audify_widget_control_bg"
            android:text="RÉCENTS"
            android:textStyle="bold"
            android:textSize="10sp"
            android:textColor="#F7F9FC" />
    </LinearLayout>

    <FrameLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="horizontal"
            android:gravity="center">

            <LinearLayout
                android:id="@+id/audify_quick_slot1"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_weight="1"
                android:orientation="vertical"
                android:gravity="center"
                android:padding="3dp"
                android:background="@drawable/audify_widget_slot_bg">
                <ImageView android:id="@+id/audify_quick_art1" android:layout_width="54dp" android:layout_height="54dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" />
                <TextView android:id="@+id/audify_quick_title1" android:layout_width="match_parent" android:layout_height="22dp" android:gravity="center" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#EAF0F7" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/audify_quick_slot2"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_weight="1"
                android:layout_marginStart="5dp"
                android:orientation="vertical"
                android:gravity="center"
                android:padding="3dp"
                android:background="@drawable/audify_widget_slot_bg">
                <ImageView android:id="@+id/audify_quick_art2" android:layout_width="54dp" android:layout_height="54dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" />
                <TextView android:id="@+id/audify_quick_title2" android:layout_width="match_parent" android:layout_height="22dp" android:gravity="center" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#EAF0F7" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/audify_quick_slot3"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_weight="1"
                android:layout_marginStart="5dp"
                android:orientation="vertical"
                android:gravity="center"
                android:padding="3dp"
                android:background="@drawable/audify_widget_slot_bg">
                <ImageView android:id="@+id/audify_quick_art3" android:layout_width="54dp" android:layout_height="54dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" />
                <TextView android:id="@+id/audify_quick_title3" android:layout_width="match_parent" android:layout_height="22dp" android:gravity="center" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#EAF0F7" />
            </LinearLayout>

            <LinearLayout
                android:id="@+id/audify_quick_slot4"
                android:layout_width="0dp"
                android:layout_height="match_parent"
                android:layout_weight="1"
                android:layout_marginStart="5dp"
                android:orientation="vertical"
                android:gravity="center"
                android:padding="3dp"
                android:background="@drawable/audify_widget_slot_bg">
                <ImageView android:id="@+id/audify_quick_art4" android:layout_width="54dp" android:layout_height="54dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" />
                <TextView android:id="@+id/audify_quick_title4" android:layout_width="match_parent" android:layout_height="22dp" android:gravity="center" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#EAF0F7" />
            </LinearLayout>
        </LinearLayout>

        <TextView
            android:id="@+id/audify_quick_empty"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:gravity="center"
            android:text="Écoutez un titre pour remplir vos récents"
            android:textSize="13sp"
            android:textColor="#B8C0CC"
            android:visibility="gone" />
    </FrameLayout>
</LinearLayout>
`,'utf8');

await writeFile(path.join(layoutDir,'audify_widget_lyrics.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/audify_lyrics_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="10dp"
    android:background="@drawable/audify_widget_bg">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="50dp"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <ImageView
            android:id="@+id/audify_lyrics_art"
            android:layout_width="46dp"
            android:layout_height="46dp"
            android:scaleType="centerCrop"
            android:src="@mipmap/ic_launcher"
            android:contentDescription="Pochette Audify" />

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginStart="10dp"
            android:orientation="vertical"
            android:gravity="center_vertical">
            <TextView
                android:id="@+id/audify_lyrics_title"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:textStyle="bold"
                android:textSize="14sp"
                android:textColor="#F7F9FC" />
            <TextView
                android:id="@+id/audify_lyrics_artist"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="1dp"
                android:maxLines="1"
                android:ellipsize="end"
                android:textSize="11sp"
                android:textColor="#9DFF57" />
        </LinearLayout>

        <TextView
            android:id="@+id/audify_lyrics_mic"
            android:layout_width="44dp"
            android:layout_height="40dp"
            android:gravity="center"
            android:background="@drawable/audify_widget_control_bg"
            android:text="🎤"
            android:textSize="18sp"
            android:contentDescription="Ouvrir le karaoké" />

        <TextView
            android:id="@+id/audify_lyrics_play"
            android:layout_width="44dp"
            android:layout_height="40dp"
            android:layout_marginStart="6dp"
            android:gravity="center"
            android:background="@drawable/audify_widget_play_bg"
            android:text="▶"
            android:textStyle="bold"
            android:textSize="18sp"
            android:textColor="#101417"
            android:contentDescription="Lecture" />
    </LinearLayout>

    <TextView
        android:id="@+id/audify_lyrics_line"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:gravity="center_vertical"
        android:maxLines="2"
        android:ellipsize="end"
        android:text="Touchez 🎤 pour synchroniser les paroles"
        android:textStyle="bold"
        android:textSize="16sp"
        android:textColor="#FFFFFF" />

    <TextView
        android:id="@+id/audify_lyrics_next"
        android:layout_width="match_parent"
        android:layout_height="24dp"
        android:gravity="center_vertical"
        android:maxLines="1"
        android:ellipsize="end"
        android:text="Les paroles apparaîtront ici"
        android:textSize="12sp"
        android:textColor="#9AA4B1" />
</LinearLayout>
`,'utf8');

await writeFile(path.join(drawableDir,'audify_widget_slot_bg.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#18212B" />
    <corners android:radius="13dp" />
    <stroke android:width="1dp" android:color="#364653" />
</shape>
`,'utf8');

// ---------------------------------------------------------------------------
// AppWidget provider metadata.
// ---------------------------------------------------------------------------
await writeFile(path.join(xmlDir,'audify_widget_mini_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="58dp"
    android:minResizeWidth="190dp"
    android:minResizeHeight="58dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_mini"
    android:resizeMode="horizontal"
    android:widgetCategory="home_screen" />
`,'utf8');

await writeFile(path.join(xmlDir,'audify_widget_quick_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="128dp"
    android:minResizeWidth="230dp"
    android:minResizeHeight="116dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_quick"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

await writeFile(path.join(xmlDir,'audify_widget_lyrics_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="118dp"
    android:minResizeWidth="220dp"
    android:minResizeHeight="108dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_lyrics"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

// ---------------------------------------------------------------------------
// Bridge the existing V68.18 player widget publisher into the whole family.
// ---------------------------------------------------------------------------
const playerWidgetPath=path.join(pkgDir,'AudifyPlayerWidget.java');
let playerWidget=await readFile(playerWidgetPath,'utf8');
if(!playerWidget.includes('AudifyWidgetFamilyState.publish(context,player);')){
    const anchor=`            .putBoolean(K_PLAYING,playing)
            .apply();
        updateAll(context);`;
    if(!playerWidget.includes(anchor))throw new Error('V68.19 widget family: V68.18 publisher anchor missing');
    playerWidget=playerWidget.replace(anchor,
        `            .putBoolean(K_PLAYING,playing)
            .apply();
        AudifyWidgetFamilyState.publish(context,player);
        updateAll(context);`);
    await writeFile(playerWidgetPath,playerWidget,'utf8');
}

// ---------------------------------------------------------------------------
// Publish the resolved lyrics timeline once. The family state then keeps the
// home-screen lyrics widget in sync from Media3 position while the song plays.
// This only observes the already-resolved lyrics; it does not alter the frozen
// lyrics resolver itself.
// ---------------------------------------------------------------------------
const karaokePath=path.join(pkgDir,'NativeKaraokeActivity.java');
let karaoke=await readFile(karaokePath,'utf8');
if(!karaoke.includes('AUDIFY_V68190_LYRICS_WIDGET_TIMELINE')){
    const anchor='        renderLyrics();';
    if(!karaoke.includes(anchor))throw new Error('V68.19 lyrics widget: renderLyrics anchor missing');
    const bridge=String.raw`        // AUDIFY_V68190_LYRICS_WIDGET_TIMELINE
        try{
            JSONArray widgetTimeline=new JSONArray();
            for(LyricLine widgetLine:lines){
                JSONObject o=new JSONObject();
                o.put("time",widgetLine.time);
                o.put("text",widgetLine.text);
                widgetTimeline.put(o);
            }
            AudifyWidgetFamilyState.publishLyricsTimeline(this,videoId,widgetTimeline.toString());
        }catch(Throwable ignored){}
`;
    karaoke=karaoke.replace(anchor,bridge+anchor);
    await writeFile(karaokePath,karaoke,'utf8');
}

// ---------------------------------------------------------------------------
// Register three additional native providers. Keep the existing Player widget.
// ---------------------------------------------------------------------------
const manifestPath=path.join(main,'AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
manifest=manifest.replace(
    `android:name=".AudifyPlayerWidget"
            android:label="Audify"`,
    `android:name=".AudifyPlayerWidget"
            android:label="Audify Player"`
);
if(!manifest.includes('android:name=".AudifyMiniWidget"')){
    const receivers=String.raw`        <receiver
            android:name=".AudifyMiniWidget"
            android:label="Audify Mini"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_widget_mini_info" />
        </receiver>

        <receiver
            android:name=".AudifyQuickMusicWidget"
            android:label="Audify Quick Music"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_widget_quick_info" />
        </receiver>

        <receiver
            android:name=".AudifyLyricsWidget"
            android:label="Audify Lyrics"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_widget_lyrics_info" />
        </receiver>
`;
    if(!manifest.includes('</application>'))throw new Error('V68.19 widget family: manifest closing tag missing');
    manifest=manifest.replace('</application>',receivers+'    </application>');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.19: widget family installed — Player + Mini + Quick Music (recents/favorites) + Lyrics/Karaoke, with shared Media3 state and artwork.');
