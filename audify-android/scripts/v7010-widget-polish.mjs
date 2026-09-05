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
const valuesDir=path.join(res,'values');
await Promise.all([mkdir(pkgDir,{recursive:true}),mkdir(layoutDir,{recursive:true}),mkdir(drawableDir,{recursive:true}),mkdir(xmlDir,{recursive:true}),mkdir(valuesDir,{recursive:true})]);

// Audify V70.1 — Widget Polish
// - Remove the redundant microphone button from Lyrics Live widget only.
// - Add rich picker previews for all six widgets (previewLayout + previewImage fallback).
// - Add Android 12+ widget descriptions and target cell sizes.

await writeFile(path.join(pkgDir,'AudifyV701WidgetPolishMarker.java'),String.raw`package com.nova.audify;
final class AudifyV701WidgetPolishMarker {
    static final String MARKER="AUDIFY_V7010_WIDGET_POLISH";
    static final String NO_MIC_MARKER="AUDIFY_V7010_NO_LYRICS_MIC";
    static final String PREVIEW_MARKER="AUDIFY_V7010_RICH_WIDGET_PREVIEWS";
    private AudifyV701WidgetPolishMarker(){}
}
`,'utf8');

// ---------------------------------------------------------------------------
// 1) Lyrics Live: remove microphone button from widget UI only.
// The lyric lines/root remain clickable and still open the Karaoke screen.
// ---------------------------------------------------------------------------
const lyricsLayoutPath=path.join(layoutDir,'audify_widget_lyrics.xml');
let lyricsLayout=await readFile(lyricsLayoutPath,'utf8');
lyricsLayout=lyricsLayout.replace(/\s*<TextView\s+android:id="@\+id\/audify_lyrics_mic"[\s\S]*?\/>\s*/m,'\n');
await writeFile(lyricsLayoutPath,lyricsLayout,'utf8');

const lyricsJavaPath=path.join(pkgDir,'AudifyLyricsWidget.java');
let lyricsJava=await readFile(lyricsJavaPath,'utf8');
lyricsJava=lyricsJava.replace(/^\s*v\.setOnClickPendingIntent\(R\.id\.audify_lyrics_mic,openLyrics\);\s*$/m,'');
await writeFile(lyricsJavaPath,lyricsJava,'utf8');

if((await readFile(lyricsLayoutPath,'utf8')).includes('audify_lyrics_mic')){
    throw new Error('V70.1 polish: microphone view still present in Lyrics Live layout');
}
if((await readFile(lyricsJavaPath,'utf8')).includes('R.id.audify_lyrics_mic')){
    throw new Error('V70.1 polish: microphone click binding still present in Lyrics Live provider');
}

// ---------------------------------------------------------------------------
// 2) Static preview layouts shown by Android 12+ / compatible launchers.
// These deliberately use realistic sample content instead of a lone app icon.
// ---------------------------------------------------------------------------
const playerPreview=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="horizontal" android:gravity="center_vertical"
    android:padding="14dp" android:background="@drawable/audify_widget_bg">
    <ImageView android:layout_width="86dp" android:layout_height="86dp" android:src="@mipmap/ic_launcher" android:scaleType="centerCrop" android:contentDescription="Audify" />
    <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="14dp" android:orientation="vertical" android:gravity="center_vertical">
        <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="AUDIFY PLAYER" android:textStyle="bold" android:textSize="10sp" android:letterSpacing="0.12" android:textColor="#9DFF57" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:text="Midnight Drive" android:textStyle="bold" android:textSize="17sp" android:textColor="#F7F9FC" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:text="Audify • Lecture en cours" android:textSize="12sp" android:textColor="#AEB8C5" />
        <LinearLayout android:layout_width="match_parent" android:layout_height="42dp" android:layout_marginTop="8dp" android:orientation="horizontal" android:gravity="center_vertical">
            <TextView android:layout_width="42dp" android:layout_height="38dp" android:gravity="center" android:background="@drawable/audify_widget_control_bg" android:text="⏮" android:textSize="17sp" android:textColor="#FFFFFF" />
            <TextView android:layout_width="50dp" android:layout_height="38dp" android:layout_marginStart="8dp" android:gravity="center" android:background="@drawable/audify_widget_play_bg" android:text="Ⅱ" android:textStyle="bold" android:textSize="18sp" android:textColor="#101417" />
            <TextView android:layout_width="42dp" android:layout_height="38dp" android:layout_marginStart="8dp" android:gravity="center" android:background="@drawable/audify_widget_control_bg" android:text="⏭" android:textSize="17sp" android:textColor="#FFFFFF" />
        </LinearLayout>
    </LinearLayout>
</LinearLayout>`;

const miniPreview=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="horizontal" android:gravity="center_vertical" android:padding="9dp" android:background="@drawable/audify_widget_bg">
    <ImageView android:layout_width="50dp" android:layout_height="50dp" android:src="@mipmap/ic_launcher" android:scaleType="centerCrop" android:contentDescription="Audify" />
    <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="10dp" android:orientation="vertical" android:gravity="center_vertical">
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Midnight Drive" android:textStyle="bold" android:textSize="14sp" android:textColor="#F7F9FC" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:text="AUDIFY MINI" android:textSize="10sp" android:textColor="#9DFF57" />
    </LinearLayout>
    <TextView android:layout_width="34dp" android:layout_height="34dp" android:gravity="center" android:text="⏮" android:textColor="#FFFFFF" android:textSize="15sp" />
    <TextView android:layout_width="42dp" android:layout_height="36dp" android:layout_marginStart="4dp" android:gravity="center" android:background="@drawable/audify_widget_play_bg" android:text="Ⅱ" android:textStyle="bold" android:textColor="#101417" android:textSize="16sp" />
    <TextView android:layout_width="34dp" android:layout_height="34dp" android:layout_marginStart="4dp" android:gravity="center" android:text="⏭" android:textColor="#FFFFFF" android:textSize="15sp" />
</LinearLayout>`;

const favoritesPreview=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="12dp" android:background="@drawable/audify_widget_bg">
    <TextView android:layout_width="match_parent" android:layout_height="32dp" android:gravity="center_vertical" android:text="♥  FAVORIS" android:textStyle="bold" android:textSize="13sp" android:letterSpacing="0.08" android:textColor="#9DFF57" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center">
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="52dp" android:layout_height="52dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Énergie" android:textSize="10sp" android:textColor="#F7F9FC" /></LinearLayout>
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="52dp" android:layout_height="52dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Nuit" android:textSize="10sp" android:textColor="#F7F9FC" /></LinearLayout>
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="52dp" android:layout_height="52dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Focus" android:textSize="10sp" android:textColor="#F7F9FC" /></LinearLayout>
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="52dp" android:layout_height="52dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Chill" android:textSize="10sp" android:textColor="#F7F9FC" /></LinearLayout>
    </LinearLayout>
</LinearLayout>`;

const resumePreview=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="12dp" android:background="@drawable/audify_widget_bg">
    <LinearLayout android:layout_width="match_parent" android:layout_height="38dp" android:orientation="horizontal" android:gravity="center_vertical"><TextView android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="▶  REPRENDRE" android:textStyle="bold" android:textSize="13sp" android:letterSpacing="0.08" android:textColor="#9DFF57" /><TextView android:layout_width="44dp" android:layout_height="34dp" android:gravity="center" android:background="@drawable/audify_widget_play_bg" android:text="▶" android:textColor="#101417" android:textSize="15sp" /></LinearLayout>
    <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center">
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="58dp" android:layout_height="58dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Dernière écoute" android:maxLines="1" android:textSize="9sp" android:textColor="#F7F9FC" /></LinearLayout>
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="58dp" android:layout_height="58dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Récemment" android:maxLines="1" android:textSize="9sp" android:textColor="#F7F9FC" /></LinearLayout>
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center"><ImageView android:layout_width="58dp" android:layout_height="58dp" android:src="@mipmap/ic_launcher" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:gravity="center" android:text="Hier" android:maxLines="1" android:textSize="9sp" android:textColor="#F7F9FC" /></LinearLayout>
    </LinearLayout>
</LinearLayout>`;

const queuePreview=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="12dp" android:background="@drawable/audify_widget_bg">
    <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="À SUIVRE" android:textStyle="bold" android:textSize="12sp" android:letterSpacing="0.12" android:textColor="#9DFF57" />
    <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:layout_marginBottom="6dp" android:text="Après • Midnight Drive" android:textSize="10sp" android:textColor="#AEB8C5" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical"><ImageView android:layout_width="42dp" android:layout_height="42dp" android:src="@mipmap/ic_launcher" /><LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical"><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Neon City" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Audify" android:textSize="10sp" android:textColor="#9EA9B7" /></LinearLayout><TextView android:layout_width="34dp" android:layout_height="34dp" android:gravity="center" android:text="▶" android:textColor="#9DFF57" /></LinearLayout>
    <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical"><ImageView android:layout_width="42dp" android:layout_height="42dp" android:src="@mipmap/ic_launcher" /><LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical"><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="After Hours" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Audify" android:textSize="10sp" android:textColor="#9EA9B7" /></LinearLayout><TextView android:layout_width="34dp" android:layout_height="34dp" android:gravity="center" android:text="▶" android:textColor="#9DFF57" /></LinearLayout>
    <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical"><ImageView android:layout_width="42dp" android:layout_height="42dp" android:src="@mipmap/ic_launcher" /><LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical"><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Last Light" android:textStyle="bold" android:textSize="13sp" android:textColor="#F7F9FC" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Audify" android:textSize="10sp" android:textColor="#9EA9B7" /></LinearLayout><TextView android:layout_width="34dp" android:layout_height="34dp" android:gravity="center" android:text="▶" android:textColor="#9DFF57" /></LinearLayout>
</LinearLayout>`;

const lyricsPreview=String.raw`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="12dp" android:background="@drawable/audify_widget_bg">
    <LinearLayout android:layout_width="match_parent" android:layout_height="52dp" android:orientation="horizontal" android:gravity="center_vertical">
        <ImageView android:layout_width="46dp" android:layout_height="46dp" android:src="@mipmap/ic_launcher" android:scaleType="centerCrop" />
        <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="10dp" android:orientation="vertical" android:gravity="center_vertical"><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Midnight Drive" android:textStyle="bold" android:textSize="14sp" android:textColor="#F7F9FC" /><TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="1dp" android:text="AUDIFY • LYRICS LIVE" android:textSize="10sp" android:textColor="#9DFF57" /></LinearLayout>
        <TextView android:layout_width="46dp" android:layout_height="40dp" android:gravity="center" android:background="@drawable/audify_widget_play_bg" android:text="Ⅱ" android:textStyle="bold" android:textColor="#101417" android:textSize="17sp" />
    </LinearLayout>
    <TextView android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:gravity="center_vertical" android:text="Running through the city lights" android:textStyle="bold" android:textSize="17sp" android:textColor="#FFFFFF" />
    <TextView android:layout_width="match_parent" android:layout_height="24dp" android:gravity="center_vertical" android:text="Next • Never looking back tonight" android:textSize="11sp" android:textColor="#AEB8C5" />
</LinearLayout>`;

const previews={
  audify_widget_preview_player:playerPreview,
  audify_widget_preview_mini:miniPreview,
  audify_widget_preview_favorites:favoritesPreview,
  audify_widget_preview_resume:resumePreview,
  audify_widget_preview_queue:queuePreview,
  audify_widget_preview_lyrics:lyricsPreview,
};
for(const [name,content] of Object.entries(previews)) await writeFile(path.join(layoutDir,name+'.xml'),content,'utf8');

// previewImage fallback for launchers that ignore previewLayout.
await writeFile(path.join(drawableDir,'audify_widget_preview_fallback.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><shape android:shape="rectangle"><solid android:color="#11161D"/><corners android:radius="26dp"/><stroke android:width="1dp" android:color="#45556576"/></shape></item>
    <item android:left="18dp" android:top="18dp" android:right="230dp" android:bottom="18dp"><bitmap android:src="@mipmap/ic_launcher" android:gravity="fill"/></item>
    <item android:left="112dp" android:top="34dp" android:right="30dp" android:bottom="94dp"><shape android:shape="rectangle"><solid android:color="#9DFF57"/><corners android:radius="6dp"/></shape></item>
    <item android:left="112dp" android:top="68dp" android:right="80dp" android:bottom="64dp"><shape android:shape="rectangle"><solid android:color="#EAF0F6"/><corners android:radius="5dp"/></shape></item>
    <item android:left="112dp" android:top="94dp" android:right="130dp" android:bottom="42dp"><shape android:shape="rectangle"><solid android:color="#82909F"/><corners android:radius="5dp"/></shape></item>
</layer-list>`,'utf8');

await writeFile(path.join(valuesDir,'audify_widget_descriptions.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="audify_widget_desc_player">Lecteur complet avec pochette et commandes</string>
    <string name="audify_widget_desc_mini">Contrôlez rapidement votre musique</string>
    <string name="audify_widget_desc_favorites">Vos morceaux favoris en un toucher</string>
    <string name="audify_widget_desc_resume">Reprenez vos dernières écoutes</string>
    <string name="audify_widget_desc_queue">Consultez les prochains morceaux de la file</string>
    <string name="audify_widget_desc_lyrics">Paroles synchronisées en direct</string>
</resources>`,'utf8');

async function patchInfo(file,preview,desc,cellsW,cellsH){
    const p=path.join(xmlDir,file);
    let s=await readFile(p,'utf8');
    s=s.replace(/\s+android:previewLayout="[^"]*"/g,'')
       .replace(/\s+android:previewImage="[^"]*"/g,'')
       .replace(/\s+android:description="[^"]*"/g,'')
       .replace(/\s+android:targetCellWidth="[^"]*"/g,'')
       .replace(/\s+android:targetCellHeight="[^"]*"/g,'');
    if(!s.includes('/>')) throw new Error('V70.1 polish: invalid widget metadata '+file);
    s=s.replace(/\s*\/>\s*$/,`\n    android:previewLayout="@layout/${preview}"\n    android:previewImage="@drawable/audify_widget_preview_fallback"\n    android:description="@string/${desc}"\n    android:targetCellWidth="${cellsW}"\n    android:targetCellHeight="${cellsH}" />\n`);
    await writeFile(p,s,'utf8');
}

await patchInfo('audify_widget_info.xml','audify_widget_preview_player','audify_widget_desc_player',4,2);
await patchInfo('audify_widget_mini_info.xml','audify_widget_preview_mini','audify_widget_desc_mini',4,1);
await patchInfo('audify_favorites_widget_info.xml','audify_widget_preview_favorites','audify_widget_desc_favorites',4,2);
await patchInfo('audify_resume_widget_info.xml','audify_widget_preview_resume','audify_widget_desc_resume',4,2);
await patchInfo('audify_queue_widget_info.xml','audify_widget_preview_queue','audify_widget_desc_queue',4,3);
await patchInfo('audify_lyrics_live_widget_info.xml','audify_widget_preview_lyrics','audify_widget_desc_lyrics',4,2);

// Android package version.
const gradlePath=path.join(android,'app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7010');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.1"');
await writeFile(gradlePath,gradle,'utf8');

console.log('AUDIFY V70.1 Widget Polish applied: Lyrics Live mic removed + rich previews/descriptions for all 6 widgets + version 70.1.');
