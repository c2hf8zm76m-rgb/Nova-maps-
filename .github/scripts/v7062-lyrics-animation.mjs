import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const android=path.join(root,'audify-android','android');
const main=path.join(android,'app','src','main');
const pkgDir=path.join(main,'java','com','nova','audify');
const layoutDir=path.join(main,'res','layout');
const animDir=path.join(main,'res','anim');
await mkdir(animDir,{recursive:true});

// Audify V70.6.2 — restore the smooth Lyrics widget transition while keeping
// V70.6.1 automatic background lyrics resolution untouched.
const javaPath=path.join(pkgDir,'AudifyLyricsWidget.java');
const layoutPath=path.join(layoutDir,'audify_widget_lyrics.xml');
const gradlePath=path.join(android,'app','build.gradle');

const lyricsJava=String.raw`package com.nova.audify;

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
    public static final String ANIMATION_MARKER="AUDIFY_V7062_LYRICS_ANIMATION";
    private static final String ANIM_PREFS="audify_lyrics_anim_v7062";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id,null);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    @Override public void onDeleted(Context context,int[] ids){
        if(context==null||ids==null)return;
        SharedPreferences.Editor e=context.getSharedPreferences(ANIM_PREFS,Context.MODE_PRIVATE).edit();
        for(int id:ids){
            e.remove("last_"+id).remove("slot_"+id);
        }
        e.apply();
    }

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
            line=currentId==null||currentId.isEmpty()?"Lancez une musique dans Audify":"Touchez pour synchroniser les paroles";
            next=currentId==null||currentId.isEmpty()?"Karaoké Audify":"Les paroles apparaîtront ici";
        }

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_lyrics);
        v.setTextViewText(R.id.audify_lyrics_title,title);
        v.setTextViewText(R.id.audify_lyrics_artist,artist);
        v.setTextViewText(R.id.audify_lyrics_play,playing?"Ⅱ":"▶");
        v.setContentDescription(R.id.audify_lyrics_play,playing?"Pause":"Lecture");
        if(artwork!=null)v.setImageViewBitmap(R.id.audify_lyrics_art,artwork);
        else v.setImageViewResource(R.id.audify_lyrics_art,R.mipmap.ic_launcher);

        // Double-buffer the complete lyric stack. Only a real lyric change flips
        // the ViewFlipper, so the 3 s ticker can refresh safely without replaying
        // the animation or stacking multiple transitions.
        SharedPreferences anim=context.getSharedPreferences(ANIM_PREFS,Context.MODE_PRIVATE);
        String stateKey=safe(currentId,"")+"\u0001"+line+"\u0001"+next;
        String last=anim.getString("last_"+widgetId,"");
        int slot=anim.getInt("slot_"+widgetId,0)==1?1:0;
        if(last==null||last.isEmpty()){
            setSlot(v,0,line,next);
            setSlot(v,1,line,next);
            v.setDisplayedChild(R.id.audify_lyrics_flipper,0);
            slot=0;
            anim.edit().putString("last_"+widgetId,stateKey).putInt("slot_"+widgetId,slot).apply();
        }else if(!stateKey.equals(last)){
            int target=slot==0?1:0;
            setSlot(v,target,line,next);
            v.showNext(R.id.audify_lyrics_flipper);
            slot=target;
            anim.edit().putString("last_"+widgetId,stateKey).putInt("slot_"+widgetId,slot).apply();
        }else{
            setSlot(v,slot,line,next);
        }

        PendingIntent openLyrics=openLyrics(context,widgetId,currentId,title,artist,art);
        v.setOnClickPendingIntent(R.id.audify_lyrics_root,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_line_a,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_next_a,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_line_b,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_next_b,openLyrics);
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

    private static void setSlot(RemoteViews v,int slot,String line,String next){
        if(slot==0){
            v.setTextViewText(R.id.audify_lyrics_line_a,line);
            v.setTextViewText(R.id.audify_lyrics_next_a,next);
        }else{
            v.setTextViewText(R.id.audify_lyrics_line_b,line);
            v.setTextViewText(R.id.audify_lyrics_next_b,next);
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
await writeFile(javaPath,lyricsJava,'utf8');

let layout=await readFile(layoutPath,'utf8');
const lineToken='    <TextView\n        android:id="@+id/audify_lyrics_line"';
const nextToken='    <TextView\n        android:id="@+id/audify_lyrics_next"';
const start=layout.indexOf(lineToken);
const nextStart=layout.indexOf(nextToken);
if(start<0||nextStart<0||nextStart<=start)throw new Error('V70.6.2: lyric TextView anchors missing');
const end=layout.indexOf('/>',nextStart);
if(end<0)throw new Error('V70.6.2: lyric next TextView end missing');
const after=end+2;
const flipper=String.raw`    <ViewFlipper
        android:id="@+id/audify_lyrics_flipper"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:animateFirstView="false"
        android:inAnimation="@anim/audify_lyrics_in"
        android:outAnimation="@anim/audify_lyrics_out">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical">
            <TextView
                android:id="@+id/audify_lyrics_line_a"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:maxLines="2"
                android:ellipsize="end"
                android:text="Touchez pour synchroniser les paroles"
                android:textStyle="bold"
                android:textSize="16sp"
                android:textColor="#FFFFFF" />
            <TextView
                android:id="@+id/audify_lyrics_next_a"
                android:layout_width="match_parent"
                android:layout_height="24dp"
                android:gravity="center_vertical"
                android:maxLines="1"
                android:ellipsize="end"
                android:text="Les paroles apparaîtront ici"
                android:textSize="12sp"
                android:textColor="#9AA4B1" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical">
            <TextView
                android:id="@+id/audify_lyrics_line_b"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:maxLines="2"
                android:ellipsize="end"
                android:text="Touchez pour synchroniser les paroles"
                android:textStyle="bold"
                android:textSize="16sp"
                android:textColor="#FFFFFF" />
            <TextView
                android:id="@+id/audify_lyrics_next_b"
                android:layout_width="match_parent"
                android:layout_height="24dp"
                android:gravity="center_vertical"
                android:maxLines="1"
                android:ellipsize="end"
                android:text="Les paroles apparaîtront ici"
                android:textSize="12sp"
                android:textColor="#9AA4B1" />
        </LinearLayout>
    </ViewFlipper>`;
layout=layout.slice(0,start)+flipper+layout.slice(after);
await writeFile(layoutPath,layout,'utf8');

await writeFile(path.join(animDir,'audify_lyrics_in.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:interpolator="@android:anim/decelerate_interpolator"
    android:duration="320">
    <translate android:fromYDelta="32%p" android:toYDelta="0%p" />
    <alpha android:fromAlpha="0.0" android:toAlpha="1.0" />
</set>
`,'utf8');
await writeFile(path.join(animDir,'audify_lyrics_out.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:interpolator="@android:anim/accelerate_interpolator"
    android:duration="280">
    <translate android:fromYDelta="0%p" android:toYDelta="-24%p" />
    <alpha android:fromAlpha="1.0" android:toAlpha="0.0" />
</set>
`,'utf8');

let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7062');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.6.2"');
await writeFile(gradlePath,gradle,'utf8');

console.log('Audify V70.6.2: automatic lyrics preserved + smooth double-buffered lyric animation restored.');
