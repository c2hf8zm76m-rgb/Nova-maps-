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
const xmlDir=path.join(res,'xml');
await Promise.all([mkdir(pkgDir,{recursive:true}),mkdir(layoutDir,{recursive:true}),mkdir(xmlDir,{recursive:true})]);

// Audify V70.0 — two premium Android home widgets.
// 1) A suivre: real Media3/ExoPlayer queue preview.
// 2) Lyrics Live: re-enable the already validated V68.19 live lyrics provider.

const marker=String.raw`package com.nova.audify;
final class AudifyV70WidgetPackMarker {
    static final String MARKER="AUDIFY_V7000_QUEUE_LYRICS_WIDGET_PACK";
    static final String LYRICS_MARKER="AUDIFY_V7000_LYRICS_LIVE_WIDGET";
    private AudifyV70WidgetPackMarker(){}
}
`;
await writeFile(path.join(pkgDir,'AudifyV70WidgetPackMarker.java'),marker,'utf8');

const queueJava=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;

import org.json.JSONArray;
import org.json.JSONObject;

public final class AudifyQueueWidget extends AppWidgetProvider {
    public static final String MARKER="AUDIFY_V7000_QUEUE_WIDGET";
    public static final String MEDIA3_MARKER="AUDIFY_V7000_REAL_MEDIA3_QUEUE";
    private static final String K_QUEUE="v7000_queue_json";
    private static final String PLAY_ACTION="com.nova.audify.widget.QUICK_PLAY_TRACK";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    public static void publish(Context context,Player player){
        if(context==null)return;
        JSONArray out=new JSONArray();
        try{
            if(player!=null){
                int count=player.getMediaItemCount();
                int current=player.getCurrentMediaItemIndex();
                if(current<0)current=-1;
                for(int i=current+1;i<count&&out.length()<4;i++){
                    MediaItem item=player.getMediaItemAt(i);
                    if(item==null)continue;
                    MediaMetadata md=item.mediaMetadata;
                    String id=item.mediaId==null?"":item.mediaId;
                    String title="À venir";
                    String artist="Audify";
                    String art="";
                    if(md!=null){
                        if(md.title!=null&&!md.title.toString().trim().isEmpty())title=md.title.toString().trim();
                        if(md.artist!=null&&!md.artist.toString().trim().isEmpty())artist=md.artist.toString().trim();
                        Uri u=md.artworkUri;
                        if(u!=null)art=u.toString();
                    }
                    JSONObject o=new JSONObject();
                    o.put("id",id);
                    o.put("title",title);
                    o.put("artist",artist);
                    o.put("art",art);
                    out.put(o);
                }
            }
        }catch(Throwable ignored){}
        AudifyWidgetFamilyState.prefs(context).edit().putString(K_QUEUE,out.toString()).apply();
        updateAll(context);
    }

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyQueueWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id);
    }

    private static void render(Context context,AppWidgetManager manager,int widgetId){
        SharedPreferences p=AudifyWidgetFamilyState.prefs(context);
        JSONArray items;
        try{items=new JSONArray(p.getString(K_QUEUE,"[]"));}catch(Throwable ex){items=new JSONArray();}

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_queue);
        String current=p.getString("title","Aucune lecture");
        v.setTextViewText(R.id.audify_queue_now,current==null||current.trim().isEmpty()?"Aucune lecture":"Après • "+shortText(current,30));

        Intent player=new Intent(context,NativePlayerActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent playerPi=PendingIntent.getActivity(context,request(widgetId,90),player,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.audify_queue_root,playerPi);
        v.setOnClickPendingIntent(R.id.audify_queue_header,playerPi);

        int[] rows={R.id.audify_queue_row1,R.id.audify_queue_row2,R.id.audify_queue_row3,R.id.audify_queue_row4};
        int[] arts={R.id.audify_queue_art1,R.id.audify_queue_art2,R.id.audify_queue_art3,R.id.audify_queue_art4};
        int[] titles={R.id.audify_queue_title1,R.id.audify_queue_title2,R.id.audify_queue_title3,R.id.audify_queue_title4};
        int[] artists={R.id.audify_queue_artist1,R.id.audify_queue_artist2,R.id.audify_queue_artist3,R.id.audify_queue_artist4};

        for(int i=0;i<4;i++){
            JSONObject o=i<items.length()?items.optJSONObject(i):null;
            if(o==null){
                v.setViewVisibility(rows[i],View.GONE);
                continue;
            }
            v.setViewVisibility(rows[i],View.VISIBLE);
            String id=o.optString("id","");
            String title=o.optString("title","À venir");
            String artist=o.optString("artist","Audify");
            String art=o.optString("art","");
            v.setTextViewText(titles[i],shortText(title,25));
            v.setTextViewText(artists[i],shortText(artist,28));
            v.setImageViewResource(arts[i],R.mipmap.ic_launcher);

            Intent play=new Intent(context,AudifyQuickMusicWidget.class)
                .setAction(PLAY_ACTION)
                .putExtra("widget_id",widgetId)
                .putExtra("videoId",id)
                .putExtra("title",title)
                .putExtra("artist",artist)
                .putExtra("thumbnail",art);
            v.setOnClickPendingIntent(rows[i],PendingIntent.getBroadcast(
                context,request(widgetId,i),play,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));

            if(!art.isEmpty()){
                final int artView=arts[i];
                AudifyWidgetArtwork.load(context.getApplicationContext(),art,112,(Bitmap bmp)->{
                    RemoteViews partial=new RemoteViews(context.getPackageName(),R.layout.audify_widget_queue);
                    partial.setImageViewBitmap(artView,bmp);
                    manager.partiallyUpdateAppWidget(widgetId,partial);
                });
            }
        }

        boolean empty=items.length()==0;
        v.setViewVisibility(R.id.audify_queue_empty,empty?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.audify_queue_empty,"Aucun morceau après celui-ci");
        manager.updateAppWidget(widgetId,v);
    }

    private static int request(int widgetId,int slot){return 7000000+(widgetId%10000)*10+slot;}
    private static String shortText(String raw,int max){
        String s=raw==null?"":raw.trim();
        if(s.isEmpty())return "Audify";
        return s.length()>max?s.substring(0,max-1)+"…":s;
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyQueueWidget.java'),queueJava,'utf8');

await writeFile(path.join(layoutDir,'audify_widget_queue.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/audify_queue_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/audify_widget_bg">

    <LinearLayout
        android:id="@+id/audify_queue_header"
        android:layout_width="match_parent"
        android:layout_height="42dp"
        android:orientation="vertical"
        android:gravity="center_vertical">
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="À SUIVRE"
            android:textStyle="bold"
            android:textSize="12sp"
            android:letterSpacing="0.12"
            android:textColor="#9DFF57" />
        <TextView
            android:id="@+id/audify_queue_now"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="Après • Aucune lecture"
            android:textSize="11sp"
            android:textColor="#AEB8C5" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:orientation="vertical">

        <LinearLayout android:id="@+id/audify_queue_row1" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical" android:paddingTop="3dp" android:paddingBottom="3dp">
            <ImageView android:id="@+id/audify_queue_art1" android:layout_width="38dp" android:layout_height="38dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" android:contentDescription="Pochette suivante" />
            <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical">
                <TextView android:id="@+id/audify_queue_title1" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" />
                <TextView android:id="@+id/audify_queue_artist1" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#9EA9B7" />
            </LinearLayout>
            <TextView android:layout_width="30dp" android:layout_height="30dp" android:gravity="center" android:text="▶" android:textSize="13sp" android:textColor="#9DFF57" />
        </LinearLayout>

        <LinearLayout android:id="@+id/audify_queue_row2" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical" android:paddingTop="3dp" android:paddingBottom="3dp">
            <ImageView android:id="@+id/audify_queue_art2" android:layout_width="38dp" android:layout_height="38dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" android:contentDescription="Pochette suivante" />
            <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical">
                <TextView android:id="@+id/audify_queue_title2" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" />
                <TextView android:id="@+id/audify_queue_artist2" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#9EA9B7" />
            </LinearLayout>
            <TextView android:layout_width="30dp" android:layout_height="30dp" android:gravity="center" android:text="▶" android:textSize="13sp" android:textColor="#9DFF57" />
        </LinearLayout>

        <LinearLayout android:id="@+id/audify_queue_row3" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical" android:paddingTop="3dp" android:paddingBottom="3dp">
            <ImageView android:id="@+id/audify_queue_art3" android:layout_width="38dp" android:layout_height="38dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" android:contentDescription="Pochette suivante" />
            <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical">
                <TextView android:id="@+id/audify_queue_title3" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" />
                <TextView android:id="@+id/audify_queue_artist3" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#9EA9B7" />
            </LinearLayout>
            <TextView android:layout_width="30dp" android:layout_height="30dp" android:gravity="center" android:text="▶" android:textSize="13sp" android:textColor="#9DFF57" />
        </LinearLayout>

        <LinearLayout android:id="@+id/audify_queue_row4" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical" android:paddingTop="3dp" android:paddingBottom="3dp">
            <ImageView android:id="@+id/audify_queue_art4" android:layout_width="38dp" android:layout_height="38dp" android:scaleType="centerCrop" android:src="@mipmap/ic_launcher" android:contentDescription="Pochette suivante" />
            <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical">
                <TextView android:id="@+id/audify_queue_title4" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" />
                <TextView android:id="@+id/audify_queue_artist4" android:layout_width="match_parent" android:layout_height="wrap_content" android:maxLines="1" android:ellipsize="end" android:textSize="10sp" android:textColor="#9EA9B7" />
            </LinearLayout>
            <TextView android:layout_width="30dp" android:layout_height="30dp" android:gravity="center" android:text="▶" android:textSize="13sp" android:textColor="#9DFF57" />
        </LinearLayout>
    </LinearLayout>

    <TextView
        android:id="@+id/audify_queue_empty"
        android:layout_width="match_parent"
        android:layout_height="48dp"
        android:gravity="center"
        android:text="Aucun morceau après celui-ci"
        android:textSize="12sp"
        android:textColor="#AEB8C5"
        android:visibility="gone" />
</LinearLayout>
`,'utf8');

await writeFile(path.join(xmlDir,'audify_queue_widget_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="220dp"
    android:minResizeWidth="220dp"
    android:minResizeHeight="170dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_queue"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

// Re-use the already validated Lyrics Live layout/provider generated by V68.19.
await writeFile(path.join(xmlDir,'audify_lyrics_live_widget_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="150dp"
    android:minResizeWidth="220dp"
    android:minResizeHeight="120dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/audify_widget_lyrics"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

// Add queue publishing to the shared Media3 widget state bridge.
const familyPath=path.join(pkgDir,'AudifyWidgetFamilyState.java');
let family=await readFile(familyPath,'utf8');
if(!family.includes('AudifyQueueWidget.publish(app,player);')){
    const anchor='        AudifyResumeWidget.updateAll(app);';
    if(!family.includes(anchor))throw new Error('V70.0: V69 family anchor missing');
    family=family.replace(anchor,anchor+'\n        AudifyQueueWidget.publish(app,player);');
    await writeFile(familyPath,family,'utf8');
}

// V69 intentionally hid the internal V68.19 Lyrics widget. V70 makes it public again,
// and adds the new queue widget as the sixth visible home widget.
const manifestPath=path.join(main,'AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
function removeReceiver(name){
    const paired=new RegExp('\\s*<receiver\\s+android:name="\\.'+name+'"[\\s\\S]*?<\\/receiver>\\s*','m');
    manifest=manifest.replace(paired,'\n');
    const single=new RegExp('\\s*<receiver\\s+android:name="\\.'+name+'"[^>]*/>\\s*','m');
    manifest=manifest.replace(single,'\n');
}
for(const name of ['AudifyLyricsWidget','AudifyQueueWidget'])removeReceiver(name);

const receivers=String.raw`        <receiver
            android:name=".AudifyLyricsWidget"
            android:label="Audify • Lyrics Live"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_lyrics_live_widget_info" />
        </receiver>
        <receiver
            android:name=".AudifyQueueWidget"
            android:label="Audify • À suivre"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_queue_widget_info" />
        </receiver>
`;
if(!manifest.includes('</application>'))throw new Error('V70.0: manifest application closing tag missing');
manifest=manifest.replace('</application>',receivers+'    </application>');
await writeFile(manifestPath,manifest,'utf8');

const gradlePath=path.join(android,'app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
if(!/versionCode\s+\d+/.test(gradle)||!/versionName\s+["'][^"']+["']/.test(gradle)){
    throw new Error('V70.0: versionCode/versionName missing');
}
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7000');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.0"');
await writeFile(gradlePath,gradle,'utf8');

console.log('AUDIFY V70.0 applied: 6 visible widgets = Player + Mini + Favorites + Resume + A suivre + Lyrics Live.');
