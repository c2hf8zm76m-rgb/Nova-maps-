import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const android=path.join(root,'audify-android','android');
const main=path.join(android,'app','src','main');
const pkgDir=path.join(main,'java','com','nova','audify');
const javaPath=path.join(pkgDir,'AudifyLyricsWidget.java');
const familyPath=path.join(pkgDir,'AudifyWidgetFamilyState.java');
const layoutPath=path.join(main,'res','layout','audify_widget_lyrics.xml');
const gradlePath=path.join(android,'app','build.gradle');

// V70.6.4 — keep V70.6.1 automatic lyrics + V70.6.3 duplicate-safe animation,
// while restoring a Spotify-like hierarchy: previous/next lyrics are large,
// bold and grey around an even larger white active line.

let family=await readFile(familyPath,'utf8');
if(!family.includes('K_LYRIC_PREV')){
    family=family.replace(
        '    static final String K_LYRIC_LINE="family_lyric_line";\n',
        '    static final String K_LYRIC_PREV="family_lyric_prev";\n    static final String K_LYRIC_LINE="family_lyric_line";\n'
    );

    family=family.replace(
`            prefs(context).edit()
                .putString(K_LYRICS_ID,id)
                .putString(K_LYRIC_LINE,line)
                .putString(K_LYRIC_NEXT,next)
                .apply();`,
`            prefs(context).edit()
                .putString(K_LYRICS_ID,id)
                .putString(K_LYRIC_PREV,"")
                .putString(K_LYRIC_LINE,line)
                .putString(K_LYRIC_NEXT,next)
                .apply();`
    );

    const lineAnchor='            String line=a.optJSONObject(chosen)==null?"":a.optJSONObject(chosen).optString("text","").trim();\n            String next="";';
    if(!family.includes(lineAnchor))throw new Error('V70.6.4: lyric chosen-line anchor missing');
    family=family.replace(lineAnchor,
`            String line=a.optJSONObject(chosen)==null?"":a.optJSONObject(chosen).optString("text","").trim();
            String prev="";
            for(int i=chosen-1;i>=0;i--){
                JSONObject before=a.optJSONObject(i);
                if(before==null)continue;
                String tx=before.optString("text","").trim();
                if(!tx.isEmpty()){prev=tx;break;}
            }
            String next="";`);

    const compare='            if(line.equals(p.getString(K_LYRIC_LINE,""))&&next.equals(p.getString(K_LYRIC_NEXT,"")))return;';
    if(!family.includes(compare))throw new Error('V70.6.4: lyric compare anchor missing');
    family=family.replace(compare,
        '            if(prev.equals(p.getString(K_LYRIC_PREV,""))&&line.equals(p.getString(K_LYRIC_LINE,""))&&next.equals(p.getString(K_LYRIC_NEXT,"")))return;'
    );

    const store='            p.edit().putString(K_LYRIC_LINE,line).putString(K_LYRIC_NEXT,next).apply();';
    if(!family.includes(store))throw new Error('V70.6.4: lyric store anchor missing');
    family=family.replace(store,
        '            p.edit().putString(K_LYRIC_PREV,prev).putString(K_LYRIC_LINE,line).putString(K_LYRIC_NEXT,next).apply();'
    );
}
await writeFile(familyPath,family,'utf8');

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
    public static final String ANIMATION_MARKER="AUDIFY_V7064_LYRICS_LARGE_CONTEXT";
    private static final String ANIM_PREFS="audify_lyrics_anim_v7064";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id,null);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    @Override public void onDeleted(Context context,int[] ids){
        if(context==null||ids==null)return;
        SharedPreferences.Editor e=context.getSharedPreferences(ANIM_PREFS,Context.MODE_PRIVATE).edit();
        for(int id:ids)e.remove("last_"+id);
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
        String prev="";
        String line="";
        String next="";
        if(currentId!=null&&!currentId.isEmpty()&&currentId.equals(lyricId)){
            prev=safe(p.getString(AudifyWidgetFamilyState.K_LYRIC_PREV,""),"");
            line=safe(p.getString(AudifyWidgetFamilyState.K_LYRIC_LINE,""),"");
            next=safe(p.getString(AudifyWidgetFamilyState.K_LYRIC_NEXT,""),"");
        }
        if(line.isEmpty()){
            prev="";
            line=currentId==null||currentId.isEmpty()?"Lancez une musique dans Audify":"Synchronisation des paroles…";
            next=currentId==null||currentId.isEmpty()?"Karaoké Audify":"Les paroles apparaîtront ici";
        }

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_lyrics);
        v.setTextViewText(R.id.audify_lyrics_title,title);
        v.setTextViewText(R.id.audify_lyrics_artist,artist);
        v.setTextViewText(R.id.audify_lyrics_play,playing?"Ⅱ":"▶");
        v.setContentDescription(R.id.audify_lyrics_play,playing?"Pause":"Lecture");
        if(artwork!=null)v.setImageViewBitmap(R.id.audify_lyrics_art,artwork);
        else v.setImageViewResource(R.id.audify_lyrics_art,R.mipmap.ic_launcher);

        // V70.6.4 keeps the V70.6.3 one-transition-per-line rule, but the
        // complete animated stack now contains previous + active + next lyrics.
        SharedPreferences anim=context.getSharedPreferences(ANIM_PREFS,Context.MODE_PRIVATE);
        String stateKey=safe(currentId,"")+"\u0001"+prev+"\u0001"+line+"\u0001"+next;
        String last=anim.getString("last_"+widgetId,"");
        String[] old=last==null?new String[0]:last.split("\\u0001",-1);
        boolean sameTrack=old.length>=4&&safe(currentId,"").equals(old[0]);
        boolean realLineChange=sameTrack&&!old[2].isEmpty()&&!line.equals(old[2]);
        if(realLineChange){
            setSlot(v,0,old[1],old[2],old[3]);
            setSlot(v,1,prev,line,next);
            v.setDisplayedChild(R.id.audify_lyrics_flipper,0);
            v.showNext(R.id.audify_lyrics_flipper);
        }else{
            setSlot(v,0,prev,line,next);
            setSlot(v,1,prev,line,next);
            v.setDisplayedChild(R.id.audify_lyrics_flipper,1);
        }
        anim.edit().putString("last_"+widgetId,stateKey).apply();

        PendingIntent openLyrics=openLyrics(context,widgetId,currentId,title,artist,art);
        v.setOnClickPendingIntent(R.id.audify_lyrics_root,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_prev_a,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_line_a,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_next_a,openLyrics);
        v.setOnClickPendingIntent(R.id.audify_lyrics_prev_b,openLyrics);
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

    private static void setSlot(RemoteViews v,int slot,String prev,String line,String next){
        if(slot==0){
            v.setTextViewText(R.id.audify_lyrics_prev_a,prev);
            v.setTextViewText(R.id.audify_lyrics_line_a,line);
            v.setTextViewText(R.id.audify_lyrics_next_a,next);
        }else{
            v.setTextViewText(R.id.audify_lyrics_prev_b,prev);
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

const layout=String.raw`<?xml version="1.0" encoding="utf-8"?>
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

    <ViewFlipper
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
                android:id="@+id/audify_lyrics_prev_a"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="bottom|start"
                android:maxLines="2"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:textStyle="bold"
                android:textSize="18sp"
                android:textColor="#69727D" />
            <TextView
                android:id="@+id/audify_lyrics_line_a"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1.45"
                android:gravity="center_vertical|start"
                android:maxLines="3"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:text="Synchronisation des paroles…"
                android:textStyle="bold"
                android:textSize="23sp"
                android:textColor="#FFFFFF" />
            <TextView
                android:id="@+id/audify_lyrics_next_a"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="top|start"
                android:maxLines="2"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:text="Les paroles apparaîtront ici"
                android:textStyle="bold"
                android:textSize="18sp"
                android:textColor="#69727D" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical">
            <TextView
                android:id="@+id/audify_lyrics_prev_b"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="bottom|start"
                android:maxLines="2"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:textStyle="bold"
                android:textSize="18sp"
                android:textColor="#69727D" />
            <TextView
                android:id="@+id/audify_lyrics_line_b"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1.45"
                android:gravity="center_vertical|start"
                android:maxLines="3"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:text="Synchronisation des paroles…"
                android:textStyle="bold"
                android:textSize="23sp"
                android:textColor="#FFFFFF" />
            <TextView
                android:id="@+id/audify_lyrics_next_b"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="top|start"
                android:maxLines="2"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:text="Les paroles apparaîtront ici"
                android:textStyle="bold"
                android:textSize="18sp"
                android:textColor="#69727D" />
        </LinearLayout>
    </ViewFlipper>
</LinearLayout>`;
await writeFile(layoutPath,layout,'utf8');

let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7064');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.6.4"');
await writeFile(gradlePath,gradle,'utf8');

console.log('Audify V70.6.4: large grey previous/next lyrics + 23sp active line, auto-refresh and deduped animation preserved.');
