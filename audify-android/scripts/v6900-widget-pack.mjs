import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const main=path.join(android,'app','src','main');
const pkgDir=path.join(main,'java','com','nova','audify');
const xmlDir=path.join(main,'res','xml');
await Promise.all([mkdir(pkgDir,{recursive:true}),mkdir(xmlDir,{recursive:true})]);

// Audify V69.0 — final Android home widget pack.
// Visible widgets: Full Player (V68.18), Mini Control, Favorites, Resume/Recent.
// The V68.19 Quick/Lyrics providers stay as internal compatibility code only.

const marker=String.raw`package com.nova.audify;
final class AudifyV69WidgetPackMarker {
    static final String MARKER="AUDIFY_V6900_ANDROID_MULTI_WIDGET";
    private AudifyV69WidgetPackMarker(){}
}
`;
await writeFile(path.join(pkgDir,'AudifyV69WidgetPackMarker.java'),marker,'utf8');

const favorites=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class AudifyFavoritesWidget extends AppWidgetProvider {
    public static final String MARKER="AUDIFY_V6900_FAVORITES_WIDGET";
    private static final String PLAY_ACTION="com.nova.audify.widget.QUICK_PLAY_TRACK";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyFavoritesWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id);
    }

    private static void render(Context context,AppWidgetManager manager,int widgetId){
        List<AudifyLibraryStore.Track> tracks=new ArrayList<>(new AudifyLibraryStore(context).getLikes());
        Collections.reverse(tracks);
        if(tracks.size()>4)tracks=tracks.subList(0,4);

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_quick);
        v.setTextViewText(R.id.audify_quick_mode,"♥ FAVORIS");
        v.setContentDescription(R.id.audify_quick_mode,"Ouvrir les favoris Audify");

        Intent likes=new Intent(context,NativeLikesActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent likesPi=PendingIntent.getActivity(context,request(widgetId,70),likes,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.audify_quick_header,likesPi);
        v.setOnClickPendingIntent(R.id.audify_quick_mode,likesPi);

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
                    .setAction(PLAY_ACTION)
                    .putExtra("widget_id",widgetId)
                    .putExtra("videoId",t.id)
                    .putExtra("title",t.title)
                    .putExtra("artist",t.artist)
                    .putExtra("thumbnail",t.thumbnail);
                v.setOnClickPendingIntent(slots[i],PendingIntent.getBroadcast(
                    context,request(widgetId,i),play,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
            }else{
                v.setViewVisibility(slots[i],View.GONE);
            }
        }

        boolean empty=tracks.isEmpty();
        v.setViewVisibility(R.id.audify_quick_empty,empty?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.audify_quick_empty,"Ajoutez des morceaux aux favoris dans Audify");
        manager.updateAppWidget(widgetId,v);

        for(int i=0;i<tracks.size();i++){
            AudifyLibraryStore.Track t=tracks.get(i);
            String art=t.thumbnail;
            if(art==null||art.isEmpty())continue;
            final int artId=arts[i];
            AudifyWidgetArtwork.load(context.getApplicationContext(),art,144,(Bitmap bmp)->{
                RemoteViews partial=new RemoteViews(context.getPackageName(),R.layout.audify_widget_quick);
                partial.setImageViewBitmap(artId,bmp);
                manager.partiallyUpdateAppWidget(widgetId,partial);
            });
        }
    }

    private static int request(int widgetId,int slot){return 6900000+(widgetId%10000)*10+slot;}
    private static String shortTitle(String raw){
        String s=raw==null||raw.trim().isEmpty()?"Sans titre":raw.trim();
        return s.length()>21?s.substring(0,20)+"…":s;
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyFavoritesWidget.java'),favorites,'utf8');

const resume=String.raw`package com.nova.audify;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.List;

public final class AudifyResumeWidget extends AppWidgetProvider {
    public static final String MARKER="AUDIFY_V6900_RESUME_RECENT_WIDGET";
    public static final String EXACT_RESUME_MARKER="AUDIFY_V6900_RESUME_CURRENT_POSITION";
    private static final String PLAY_ACTION="com.nova.audify.widget.QUICK_PLAY_TRACK";

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id);
    }

    @Override public void onEnabled(Context context){updateAll(context);}

    public static void updateAll(Context context){
        if(context==null)return;
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        int[] ids=manager.getAppWidgetIds(new ComponentName(context,AudifyResumeWidget.class));
        if(ids==null||ids.length==0)return;
        for(int id:ids)render(context,manager,id);
    }

    private static void render(Context context,AppWidgetManager manager,int widgetId){
        List<AudifyLibraryStore.Track> tracks=new ArrayList<>(AudifyWidgetFamilyState.recentTracks(context));
        if(tracks.size()>4)tracks=tracks.subList(0,4);

        RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.audify_widget_quick);
        v.setTextViewText(R.id.audify_quick_mode,"▶ REPRENDRE");
        v.setContentDescription(R.id.audify_quick_mode,"Reprendre la lecture là où elle s'est arrêtée");

        Intent home=new Intent(context,NativeHomeActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.audify_quick_header,PendingIntent.getActivity(
            context,request(widgetId,80),home,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));

        Intent toggle=new Intent(context,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE);
        v.setOnClickPendingIntent(R.id.audify_quick_mode,PendingIntent.getService(
            context,request(widgetId,81),toggle,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));

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
                    .setAction(PLAY_ACTION)
                    .putExtra("widget_id",widgetId)
                    .putExtra("videoId",t.id)
                    .putExtra("title",t.title)
                    .putExtra("artist",t.artist)
                    .putExtra("thumbnail",t.thumbnail);
                v.setOnClickPendingIntent(slots[i],PendingIntent.getBroadcast(
                    context,request(widgetId,i),play,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
            }else{
                v.setViewVisibility(slots[i],View.GONE);
            }
        }

        boolean empty=tracks.isEmpty();
        v.setViewVisibility(R.id.audify_quick_empty,empty?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.audify_quick_empty,"Écoutez un morceau pour pouvoir le reprendre ici");
        manager.updateAppWidget(widgetId,v);

        for(int i=0;i<tracks.size();i++){
            AudifyLibraryStore.Track t=tracks.get(i);
            String art=t.thumbnail;
            if(art==null||art.isEmpty())continue;
            final int artId=arts[i];
            AudifyWidgetArtwork.load(context.getApplicationContext(),art,144,(Bitmap bmp)->{
                RemoteViews partial=new RemoteViews(context.getPackageName(),R.layout.audify_widget_quick);
                partial.setImageViewBitmap(artId,bmp);
                manager.partiallyUpdateAppWidget(widgetId,partial);
            });
        }
    }

    private static int request(int widgetId,int slot){return 6910000+(widgetId%10000)*10+slot;}
    private static String shortTitle(String raw){
        String s=raw==null||raw.trim().isEmpty()?"Sans titre":raw.trim();
        return s.length()>21?s.substring(0,20)+"…":s;
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyResumeWidget.java'),resume,'utf8');

await writeFile(path.join(xmlDir,'audify_favorites_widget_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="150dp"
    android:minResizeWidth="220dp"
    android:minResizeHeight="120dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_quick"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

await writeFile(path.join(xmlDir,'audify_resume_widget_info.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="150dp"
    android:minResizeWidth="220dp"
    android:minResizeHeight="120dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/audify_widget_quick"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`,'utf8');

// Keep the V68.19 Quick receiver as an internal explicit-broadcast bridge, but hide it from the widget picker.
const manifestPath=path.join(main,'AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
function removeReceiver(name){
    const re=new RegExp('\\s*<receiver\\s+android:name="\\.'+name+'"[\\s\\S]*?<\\/receiver>\\s*','m');
    manifest=manifest.replace(re,'\n');
    const selfClosing=new RegExp('\\s*<receiver\\s+android:name="\\.'+name+'"[^>]*/>\\s*','m');
    manifest=manifest.replace(selfClosing,'\n');
}
for(const name of ['AudifyQuickMusicWidget','AudifyLyricsWidget','AudifyFavoritesWidget','AudifyResumeWidget'])removeReceiver(name);

const receivers=String.raw`        <receiver
            android:name=".AudifyQuickMusicWidget"
            android:exported="false" />
        <receiver
            android:name=".AudifyFavoritesWidget"
            android:label="Audify • Favoris"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_favorites_widget_info" />
        </receiver>
        <receiver
            android:name=".AudifyResumeWidget"
            android:label="Audify • Reprendre"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/audify_resume_widget_info" />
        </receiver>
`;
if(!manifest.includes('</application>'))throw new Error('V69.0 widgets: manifest application closing tag missing');
manifest=manifest.replace('</application>',receivers+'    </application>');
await writeFile(manifestPath,manifest,'utf8');

// Refresh visible V69 widgets whenever the Media3 player bridge publishes state.
const familyPath=path.join(pkgDir,'AudifyWidgetFamilyState.java');
let family=await readFile(familyPath,'utf8');
if(!family.includes('AudifyFavoritesWidget.updateAll(app);')){
    const anchor='        AudifyQuickMusicWidget.updateAll(app);';
    if(!family.includes(anchor))throw new Error('V69.0 widgets: family publish anchor missing');
    family=family.replace(anchor,anchor+'\n        AudifyFavoritesWidget.updateAll(app);\n        AudifyResumeWidget.updateAll(app);');
    await writeFile(familyPath,family,'utf8');
}

// Make the Android package itself report the new version instead of keeping 1.0/1.
const gradlePath=path.join(android,'app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
if(!/versionCode\s+\d+/.test(gradle)||!/versionName\s+["'][^"']+["']/.test(gradle)){
    throw new Error('V69.0 widgets: versionCode/versionName not found in app/build.gradle');
}
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 6900');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "69.0"');
await writeFile(gradlePath,gradle,'utf8');

console.log('AUDIFY V69.0 widget pack applied: Player + Mini + Favorites + Resume/Recent; Android versionName=69.0 versionCode=6900.');
