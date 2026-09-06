import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const android=path.join(root,'audify-android','android');
const javaPath=path.join(android,'app','src','main','java','com','nova','audify','AudifyLyricsWidget.java');
const gradlePath=path.join(android,'app','build.gradle');

let java=await readFile(javaPath,'utf8');
java=java.replace('AUDIFY_V7062_LYRICS_ANIMATION','AUDIFY_V7063_LYRICS_ANIMATION_DEDUPE');

const start=java.indexOf('        // Double-buffer the complete lyric stack.');
const end=java.indexOf('        PendingIntent openLyrics=',start);
if(start<0||end<0)throw new Error('V70.6.3: V70.6.2 animation block not found');

const block=String.raw`        // V70.6.3: RemoteViews recreates the ViewFlipper on every refresh.
        // Rebuild a deterministic old -> new transition instead of persisting
        // the displayed child index. A lyric line can therefore animate once only.
        SharedPreferences anim=context.getSharedPreferences(ANIM_PREFS,Context.MODE_PRIVATE);
        String stateKey=safe(currentId,"")+"\u0001"+line+"\u0001"+next;
        String last=anim.getString("last_"+widgetId,"");
        String[] old=last==null?new String[0]:last.split("\\u0001",-1);
        boolean sameTrack=old.length>=3&&safe(currentId,"").equals(old[0]);
        boolean realLineChange=sameTrack&&!old[1].isEmpty()&&!line.equals(old[1]);
        if(realLineChange){
            setSlot(v,0,old[1],old[2]);
            setSlot(v,1,line,next);
            v.setDisplayedChild(R.id.audify_lyrics_flipper,0);
            v.showNext(R.id.audify_lyrics_flipper);
        }else{
            setSlot(v,0,line,next);
            setSlot(v,1,line,next);
            v.setDisplayedChild(R.id.audify_lyrics_flipper,1);
        }
        anim.edit().putString("last_"+widgetId,stateKey).putInt("slot_"+widgetId,1).apply();

`;
java=java.slice(0,start)+block+java.slice(end);
await writeFile(javaPath,java,'utf8');

let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 7063');
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "70.6.3"');
await writeFile(gradlePath,gradle,'utf8');

console.log('Audify V70.6.3: duplicate lyric transitions removed; auto lyrics and smooth animation preserved.');
