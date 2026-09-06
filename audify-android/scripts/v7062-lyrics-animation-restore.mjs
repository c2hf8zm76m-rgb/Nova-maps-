import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const main=path.join(android,'app','src','main');
const pkgDir=path.join(main,'java','com','nova','audify');
const layoutDir=path.join(main,'res','layout');
const animDir=path.join(main,'res','anim');
await mkdir(animDir,{recursive:true});

// V70.6.2 — conserve l'auto-refresh V70.6.1 et restaure uniquement
// la transition fluide des phrases du widget Lyrics.
const javaPath=path.join(pkgDir,'AudifyLyricsWidget.java');
let java=await readFile(javaPath,'utf8');

if(!java.includes('AUDIFY_V7062_LYRICS_ANIMATION_RESTORE')){
  const textAnchor=`        v.setTextViewText(R.id.audify_lyrics_line,line);\n        v.setTextViewText(R.id.audify_lyrics_next,next);`;
  if(!java.includes(textAnchor))throw new Error('V70.6.2: lyrics text anchor missing');

  const animated=String.raw`        // AUDIFY_V7062_LYRICS_ANIMATION_RESTORE
        // Keep the previous stack alive in the inactive ViewFlipper child, fill the
        // other child with the new lyric, then flip only when the current line changes.
        // This avoids animation stacking while preserving the automatic V70.6.1 refresh.
        String animLineKey="v7062_lyrics_line_"+widgetId;
        String animSlotKey="v7062_lyrics_slot_"+widgetId;
        String previousLine=p.getString(animLineKey,"");
        int previousSlot=p.getInt(animSlotKey,0);
        if(previousSlot!=0&&previousSlot!=1)previousSlot=0;
        boolean firstFrame=previousLine==null||previousLine.isEmpty();
        boolean lineChanged=!firstFrame&&!line.equals(previousLine);
        int targetSlot=firstFrame?0:(lineChanged?(previousSlot==0?1:0):previousSlot);

        if(targetSlot==0){
            v.setTextViewText(R.id.audify_lyrics_line_a,line);
            v.setTextViewText(R.id.audify_lyrics_next_a,next);
        }else{
            v.setTextViewText(R.id.audify_lyrics_line_b,line);
            v.setTextViewText(R.id.audify_lyrics_next_b,next);
        }
        v.setInt(R.id.audify_lyrics_flipper,"setDisplayedChild",targetSlot);
        if(firstFrame||lineChanged||targetSlot!=previousSlot){
            p.edit().putString(animLineKey,line).putInt(animSlotKey,targetSlot).apply();
        }`;
  java=java.replace(textAnchor,animated);

  const clickAnchor=`        v.setOnClickPendingIntent(R.id.audify_lyrics_line,openLyrics);\n        v.setOnClickPendingIntent(R.id.audify_lyrics_next,openLyrics);`;
  if(!java.includes(clickAnchor))throw new Error('V70.6.2: lyrics click anchor missing');
  java=java.replace(clickAnchor,`        v.setOnClickPendingIntent(R.id.audify_lyrics_line_a,openLyrics);\n        v.setOnClickPendingIntent(R.id.audify_lyrics_next_a,openLyrics);\n        v.setOnClickPendingIntent(R.id.audify_lyrics_line_b,openLyrics);\n        v.setOnClickPendingIntent(R.id.audify_lyrics_next_b,openLyrics);`);
  await writeFile(javaPath,java,'utf8');
}

const layoutPath=path.join(layoutDir,'audify_widget_lyrics.xml');
let layout=await readFile(layoutPath,'utf8');
if(!layout.includes('audify_lyrics_flipper')){
  const block=/\n\s*<TextView\s+android:id="@\+id\/audify_lyrics_line"[\s\S]*?\/>\s*\n\s*<TextView\s+android:id="@\+id\/audify_lyrics_next"[\s\S]*?\/>/m;
  if(!block.test(layout))throw new Error('V70.6.2: lyrics layout text block missing');
  const flipper=String.raw`

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
  layout=layout.replace(block,flipper);
  await writeFile(layoutPath,layout,'utf8');
}

await writeFile(path.join(animDir,'audify_lyrics_in.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:interpolator="@android:interpolator/decelerate_cubic">
    <translate
        android:fromYDelta="14%p"
        android:toYDelta="0%p"
        android:duration="320" />
    <alpha
        android:fromAlpha="0.30"
        android:toAlpha="1.0"
        android:duration="300" />
</set>
`,'utf8');

await writeFile(path.join(animDir,'audify_lyrics_out.xml'),String.raw`<?xml version="1.0" encoding="utf-8"?>
<set xmlns:android="http://schemas.android.com/apk/res/android"
    android:interpolator="@android:interpolator/accelerate_cubic">
    <translate
        android:fromYDelta="0%p"
        android:toYDelta="-14%p"
        android:duration="280" />
    <alpha
        android:fromAlpha="1.0"
        android:toAlpha="0.20"
        android:duration="260" />
</set>
`,'utf8');

const gradlePath=path.join(android,'app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7062');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.6.2"');
await writeFile(gradlePath,gradle,'utf8');

console.log('Audify V70.6.2: auto lyrics preserved + smooth ViewFlipper lyric transitions restored.');
