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

// Audify V68.18 — first native Android home-screen widget.
// This patch is deliberately isolated from the frozen album-identification engine.
// It only adds AppWidget resources/provider and a tiny playback-service state bridge.

const widgetJava=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.widget.RemoteViews;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class AudifyPlayerWidget extends AppWidgetProvider {
    public static final String MARKER = "AUDIFY_V68180_ANDROID_HOME_WIDGET";
    public static final String PLAYER_MARKER = "AUDIFY_V68180_WIDGET_PLAYBACK_CONTROLS";
    public static final String ARTWORK_MARKER = "AUDIFY_V68180_WIDGET_LIVE_ARTWORK";

    private static final String PREFS="audify_widget_v68180";
    private static final String K_TITLE="title";
    private static final String K_ARTIST="artist";
    private static final String K_ART="art";
    private static final String K_PLAYING="playing";
    private static final ExecutorService ART_EXEC=Executors.newSingleThreadExecutor(r->{
        Thread t=new Thread(r,"AudifyWidgetArtwork");
        t.setDaemon(true);
        return t;
    });
    private static final Map<String,Bitmap> ART_CACHE=new ConcurrentHashMap<>();

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids){
        for(int id:ids) render(context,manager,id,null);
    }

    @Override public void onEnabled(Context context){
        updateAll(context);
    }

    @Override public void onReceive(Context context,Intent intent){
        super.onReceive(context,intent);
        if(AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent==null?null:intent.getAction())) updateAll(context);
    }

    public static void publish(Context context, Player player){
        if(context==null)return;
        String title="Aucune lecture";
        String artist="Audify";
        String art="";
        boolean playing=false;
        try{
            if(player!=null){
                playing=player.isPlaying();
                MediaItem item=player.getCurrentMediaItem();
                if(item!=null){
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
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
            .putString(K_TITLE,title)
            .putString(K_ARTIST,artist)
            .putString(K_ART,art)
            .putBoolean(K_PLAYING,playing)
            .apply();
        updateAll(context);
    }

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyPlayerWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id,null);
        String art=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(K_ART,"");
        if(art!=null&&!art.isEmpty())loadArtwork(context.getApplicationContext(),art,ids);
    }

    private static void render(Context context,AppWidgetManager manager,int id,Bitmap artwork){
        SharedPreferences p=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        String title=p.getString(K_TITLE,"Aucune lecture");
        String artist=p.getString(K_ARTIST,"Audify");
        boolean playing=p.getBoolean(K_PLAYING,false);
        String art=p.getString(K_ART,"");
        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_player);
        v.setTextViewText(R.id.audify_widget_title,title==null||title.isEmpty()?"Aucune lecture":title);
        v.setTextViewText(R.id.audify_widget_artist,artist==null||artist.isEmpty()?"Audify":artist);
        v.setTextViewText(R.id.audify_widget_play,playing?"Ⅱ":"▶");
        v.setContentDescription(R.id.audify_widget_play,playing?"Pause":"Lecture");
        if(artwork!=null)v.setImageViewBitmap(R.id.audify_widget_art,artwork);
        else if(art!=null&&ART_CACHE.containsKey(art))v.setImageViewBitmap(R.id.audify_widget_art,ART_CACHE.get(art));
        else v.setImageViewResource(R.id.audify_widget_art,R.mipmap.ic_launcher);

        Intent open=new Intent(context,MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi=PendingIntent.getActivity(context,681800,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.audify_widget_root,openPi);
        v.setOnClickPendingIntent(R.id.audify_widget_art,openPi);
        v.setOnClickPendingIntent(R.id.audify_widget_meta,openPi);

        v.setOnClickPendingIntent(R.id.audify_widget_previous,servicePi(context,681801,AudifyPlaybackService.ACTION_PREVIOUS));
        v.setOnClickPendingIntent(R.id.audify_widget_play,servicePi(context,681802,AudifyPlaybackService.ACTION_TOGGLE));
        v.setOnClickPendingIntent(R.id.audify_widget_next,servicePi(context,681803,AudifyPlaybackService.ACTION_NEXT));
        manager.updateAppWidget(id,v);
    }

    private static PendingIntent servicePi(Context context,int request,String action){
        Intent i=new Intent(context,AudifyPlaybackService.class).setAction(action);
        return PendingIntent.getService(context,request,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    private static void loadArtwork(Context context,String raw,int[] ids){
        Bitmap cached=ART_CACHE.get(raw);
        if(cached!=null){
            AppWidgetManager m=AppWidgetManager.getInstance(context);
            for(int id:ids)render(context,m,id,cached);
            return;
        }
        ART_EXEC.execute(()->{
            HttpURLConnection c=null;
            InputStream in=null;
            try{
                c=(HttpURLConnection)new URL(raw).openConnection();
                c.setConnectTimeout(6000);
                c.setReadTimeout(8000);
                c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent","Mozilla/5.0 Audify/68.18");
                in=c.getInputStream();
                Bitmap decoded=BitmapFactory.decodeStream(in);
                if(decoded==null)return;
                int w=Math.max(1,decoded.getWidth()),h=Math.max(1,decoded.getHeight());
                int side=Math.min(w,h);
                int x=Math.max(0,(w-side)/2),y=Math.max(0,(h-side)/2);
                Bitmap crop=Bitmap.createBitmap(decoded,x,y,side,side);
                Bitmap scaled=Bitmap.createScaledBitmap(crop,220,220,true);
                if(crop!=decoded&&!crop.isRecycled())crop.recycle();
                if(decoded!=scaled&&!decoded.isRecycled())decoded.recycle();
                ART_CACHE.put(raw,scaled);
                if(ART_CACHE.size()>6){
                    String first=ART_CACHE.keySet().iterator().next();
                    if(!first.equals(raw))ART_CACHE.remove(first);
                }
                AppWidgetManager m=AppWidgetManager.getInstance(context);
                for(int id:ids)render(context,m,id,scaled);
            }catch(Throwable ignored){}
            finally{
                try{if(in!=null)in.close();}catch(Throwable ignored){}
                if(c!=null)c.disconnect();
            }
        });
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyPlayerWidget.java'),widgetJava,'utf8');

const layout=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/audify_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:padding="12dp"
    android:background="@drawable/audify_widget_bg">

    <ImageView
        android:id="@+id/audify_widget_art"
        android:layout_width="94dp"
        android:layout_height="94dp"
        android:scaleType="centerCrop"
        android:contentDescription="Pochette Audify"
        android:src="@mipmap/ic_launcher" />

    <LinearLayout
        android:id="@+id/audify_widget_meta"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_marginStart="13dp"
        android:orientation="vertical"
        android:gravity="center_vertical">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="AUDIFY"
            android:textStyle="bold"
            android:textSize="11sp"
            android:textColor="#9DFF57"
            android:letterSpacing="0.12" />

        <TextView
            android:id="@+id/audify_widget_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="4dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="Aucune lecture"
            android:textStyle="bold"
            android:textSize="17sp"
            android:textColor="#F7F9FC" />

        <TextView
            android:id="@+id/audify_widget_artist"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="Audify"
            android:textSize="13sp"
            android:textColor="#B8C0CC" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="42dp"
            android:layout_marginTop="9dp"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <TextView
                android:id="@+id/audify_widget_previous"
                android:layout_width="42dp"
                android:layout_height="42dp"
                android:gravity="center"
                android:background="@drawable/audify_widget_control_bg"
                android:text="⏮"
                android:textSize="19sp"
                android:textColor="#F5F7FA"
                android:contentDescription="Morceau précédent" />

            <TextView
                android:id="@+id/audify_widget_play"
                android:layout_width="50dp"
                android:layout_height="42dp"
                android:layout_marginStart="8dp"
                android:gravity="center"
                android:background="@drawable/audify_widget_play_bg"
                android:text="▶"
                android:textStyle="bold"
                android:textSize="20sp"
                android:textColor="#101417"
                android:contentDescription="Lecture" />

            <TextView
                android:id="@+id/audify_widget_next"
                android:layout_width="42dp"
                android:layout_height="42dp"
                android:layout_marginStart="8dp"
                android:gravity="center"
                android:background="@drawable/audify_widget_control_bg"
                android:text="⏭"
                android:textSize="19sp"
                android:textColor="#F5F7FA"
                android:contentDescription="Morceau suivant" />
        </LinearLayout>
    </LinearLayout>
</LinearLayout>
`;
await writeFile(path.join(layoutDir,'audify_widget_player.xml'),layout,'utf8');

await writeFile(path.join(drawableDir,'audify_widget_bg.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#F211161D" />
    <corners android:radius="28dp" />
    <stroke android:width="1dp" android:color="#335D6977" />
    <padding android:left="2dp" android:top="2dp" android:right="2dp" android:bottom="2dp" />
</shape>
`,'utf8');

await writeFile(path.join(drawableDir,'audify_widget_control_bg.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#28313C" />
    <corners android:radius="18dp" />
    <stroke android:width="1dp" android:color="#58687989" />
</shape>
`,'utf8');

await writeFile(path.join(drawableDir,'audify_widget_play_bg.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#9DFF57" />
    <corners android:radius="19dp" />
</shape>
`,'utf8');

await writeFile(path.join(xmlDir,'audify_widget_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:minResizeWidth="190dp"
    android:minResizeHeight="96dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_player"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

// Register the native provider with Android/Nova Launcher.
const manifestPath=path.join(main,'AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".AudifyPlayerWidget"')){
    const receiver=String.raw`        <receiver
            android:name=".AudifyPlayerWidget"
            android:label="Audify"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_widget_info" />
        </receiver>
`;
    if(!manifest.includes('</application>'))throw new Error('V68.18 widget: manifest application closing tag missing');
    manifest=manifest.replace('</application>',receiver+'    </application>');
    await writeFile(manifestPath,manifest,'utf8');
}

// Bridge Media3 playback state to the widget. This only observes player state;
// no playback algorithm or album-identification code is changed.
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
if(!service.includes('AUDIFY_V68180_WIDGET_SERVICE_BRIDGE')){
    const anchors=[
        '        MediaLibrarySession.Callback libraryCallback',
        '        mediaSession = new MediaLibrarySession.Builder',
        '        mediaSession=new MediaSession.Builder'
    ];
    const anchor=anchors.find(a=>service.includes(a));
    if(!anchor)throw new Error('V68.18 widget: Media3 session anchor missing');
    const bridge=String.raw`        // AUDIFY_V68180_WIDGET_SERVICE_BRIDGE
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean isPlaying) {
                AudifyPlayerWidget.publish(AudifyPlaybackService.this,player);
            }
            @Override public void onMediaItemTransition(@Nullable MediaItem mediaItem,int reason) {
                AudifyPlayerWidget.publish(AudifyPlaybackService.this,player);
            }
            @Override public void onPlaybackStateChanged(int state) {
                AudifyPlayerWidget.publish(AudifyPlaybackService.this,player);
            }
        });
        mainHandler.postDelayed(()->AudifyPlayerWidget.publish(AudifyPlaybackService.this,player),350L);

`;
    service=service.replace(anchor,bridge+anchor);
    await writeFile(servicePath,service,'utf8');
}

console.log('Audify V68.18: native Android 4x2 home widget installed — live artwork/title/artist + previous/play-pause/next; frozen album engine untouched.');
