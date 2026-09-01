import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');

function replaceRequired(src, from, to, label){
  if(!src.includes(from)) throw new Error(`V68.12.0 ${label} introuvable`);
  return src.replace(from,to);
}

// ---------------------------------------------------------------------------
// 1. Media3 1.11.0 : tous les modules Media3 doivent garder la même version.
// ---------------------------------------------------------------------------
const gradlePath=path.join(android,'app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/androidx\.media3:media3-exoplayer:[0-9A-Za-z.\-]+/g,'androidx.media3:media3-exoplayer:1.11.0');
gradle=gradle.replace(/androidx\.media3:media3-session:[0-9A-Za-z.\-]+/g,'androidx.media3:media3-session:1.11.0');
await writeFile(gradlePath,gradle,'utf8');

// ---------------------------------------------------------------------------
// 2. Le service est LA source de vérité : MediaLibrarySession -> ExoPlayer.
//    Suppression du ForwardingPlayer qui cachait l'état réel à SystemUI.
// ---------------------------------------------------------------------------
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
service=service.replace('import androidx.media3.common.ForwardingPlayer;\n','');
service=service.replace('    private Player systemPlayer;\n','');
service=service.replace('        systemPlayer = null;\n','');

const forwardingStart=service.indexOf('        systemPlayer = new ForwardingPlayer(player) {');
const libraryStart=service.indexOf('        MediaLibrarySession.Callback libraryCallback', forwardingStart);
if(forwardingStart<0 || libraryStart<0) throw new Error('V68.12.0 bloc ForwardingPlayer/MediaLibrarySession introuvable');
service=service.slice(0,forwardingStart)+service.slice(libraryStart);

service=replaceRequired(
  service,
  'mediaSession = new MediaLibrarySession.Builder(this, systemPlayer, libraryCallback)',
  'mediaSession = new MediaLibrarySession.Builder(this, player, libraryCallback)\n            .setId("audify-main-session")',
  'liaison directe MediaLibrarySession -> ExoPlayer'
);

// Le morceau doit être explicitement annoncé comme musique à Android SystemUI.
service=replaceRequired(
  service,
  `        MediaMetadata.Builder metadata = new MediaMetadata.Builder()\n            .setTitle(track.title)\n            .setArtist(track.artist);`,
  `        MediaMetadata.Builder metadata = new MediaMetadata.Builder()\n            .setTitle(track.title)\n            .setArtist(track.artist)\n            .setAlbumTitle("Audify")\n            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC);`,
  'métadonnées toMediaItem'
);

// S'assurer que la session reste la session exposée à tous les contrôleurs externes.
if(!service.includes('public MediaLibrarySession onGetSession(MediaSession.ControllerInfo controllerInfo)')){
  throw new Error('V68.12.0 onGetSession MediaLibrarySession introuvable');
}
await writeFile(servicePath,service,'utf8');

// ---------------------------------------------------------------------------
// 3. L'UI web commande la même session via MediaController.
//    Les actions de chargement/file restent des intents vers le service, car le
//    service construit les audifyyt:// MediaItems et reste seul propriétaire de
//    la playlist. Play/Pause/Next/Previous/Seek/Repeat/Volume passent par le
//    MediaController dès qu'il est connecté.
// ---------------------------------------------------------------------------
const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');

if(!main.includes('import android.content.ComponentName;')){
  main=main.replace('import android.content.Intent;','import android.content.ComponentName;\nimport android.content.Intent;');
}
if(!main.includes('import androidx.media3.session.MediaController;')){
  const anchor='import androidx.core.content.ContextCompat;';
  if(!main.includes(anchor)) throw new Error('V68.12.0 import ContextCompat MainActivity introuvable');
  main=main.replace(anchor,anchor+'\n\nimport androidx.media3.common.Player;\nimport androidx.media3.session.MediaController;\nimport androidx.media3.session.SessionToken;\n\nimport com.google.common.util.concurrent.ListenableFuture;');
}

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker)) throw new Error('V68.12.0 classe MainActivity introuvable');
if(!main.includes('private ListenableFuture<MediaController> audifyControllerFutureV68120;')){
  main=main.replace(classMarker,`${classMarker}\n    private ListenableFuture<MediaController> audifyControllerFutureV68120;\n    private volatile MediaController audifyControllerV68120;\n\n    private void connectAudifyMediaControllerV68120(){\n        try{\n            SessionToken token=new SessionToken(this,new ComponentName(this,AudifyPlaybackService.class));\n            audifyControllerFutureV68120=new MediaController.Builder(this,token).buildAsync();\n            audifyControllerFutureV68120.addListener(()->{\n                try{audifyControllerV68120=audifyControllerFutureV68120.get();}catch(Exception ignored){}\n            },ContextCompat.getMainExecutor(this));\n        }catch(Exception ignored){}\n    }\n\n    private boolean sendThroughMediaControllerV68120(String action){\n        MediaController c=audifyControllerV68120;\n        if(c==null)return false;\n        try{\n            if(AudifyPlaybackService.ACTION_TOGGLE.equals(action)){if(c.isPlaying())c.pause();else c.play();return true;}\n            if(AudifyPlaybackService.ACTION_PLAY.equals(action)){c.play();return true;}\n            if(AudifyPlaybackService.ACTION_PAUSE.equals(action)){c.pause();return true;}\n            if(AudifyPlaybackService.ACTION_NEXT.equals(action)){c.seekToNextMediaItem();return true;}\n            if(AudifyPlaybackService.ACTION_PREVIOUS.equals(action)){c.seekToPreviousMediaItem();return true;}\n        }catch(Exception ignored){}\n        return false;\n    }\n`);
}

const sendRegex=/    private void send\(String action\)\s*\{[\s\S]*?\n    \}/;
if(!sendRegex.test(main)) throw new Error('V68.12.0 méthode send MainActivity introuvable');
main=main.replace(sendRegex,`    private void send(String action){\n        if(sendThroughMediaControllerV68120(action))return;\n        try{startService(new Intent(this,AudifyPlaybackService.class).setAction(action));}catch(Exception ignored){}\n    }`);

// Connecter après la création de l'Activity.
const onCreateMarker='        super.onCreate(savedInstanceState);';
if(!main.includes(onCreateMarker)) throw new Error('V68.12.0 super.onCreate MainActivity introuvable');
if(!main.includes('connectAudifyMediaControllerV68120();')){
  main=main.replace(onCreateMarker,onCreateMarker+'\n        connectAudifyMediaControllerV68120();');
}

// Seek utilise directement le MediaController quand disponible.
main=main.replace(
  /public void seekTo\(double seconds\)\s*\{[\s\S]*?\n        \}/,
  `public void seekTo(double seconds){\n            MediaController c=audifyControllerV68120;\n            if(c!=null){try{c.seekTo(Math.max(0L,(long)(seconds*1000.0)));return;}catch(Exception ignored){}}\n            try{startService(new Intent(MainActivity.this,AudifyPlaybackService.class)\n                .setAction(AudifyPlaybackService.ACTION_SEEK)\n                .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));}catch(Exception ignored){}\n        }`
);

main=main.replace(
  /public void setRepeat\(boolean enabled\)\s*\{[\s\S]*?\n        \}/,
  `public void setRepeat(boolean enabled){\n            MediaController c=audifyControllerV68120;\n            if(c!=null){try{c.setRepeatMode(enabled?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);return;}catch(Exception ignored){}}\n            try{startService(new Intent(MainActivity.this,AudifyPlaybackService.class)\n                .setAction(AudifyPlaybackService.ACTION_REPEAT)\n                .putExtra(AudifyPlaybackService.EXTRA_REPEAT,enabled));}catch(Exception ignored){}\n        }`
);

main=main.replace(
  /public void setVolume\(double volume\)\s*\{[\s\S]*?\n        \}/,
  `public void setVolume(double volume){\n            MediaController c=audifyControllerV68120;\n            if(c!=null){try{c.setVolume((float)Math.max(0.0,Math.min(1.0,volume)));return;}catch(Exception ignored){}}\n            try{startService(new Intent(MainActivity.this,AudifyPlaybackService.class)\n                .setAction(AudifyPlaybackService.ACTION_VOLUME)\n                .putExtra(AudifyPlaybackService.EXTRA_VOLUME,volume));}catch(Exception ignored){}\n        }`
);

// Libérer proprement uniquement le contrôleur de l'Activity, jamais le Player du service.
const destroyRegex=/    @Override public void onDestroy\(\)\s*\{[^}]*\}/;
if(destroyRegex.test(main)){
  main=main.replace(destroyRegex,`    @Override public void onDestroy(){\n        audifyControllerV68120=null;\n        if(audifyControllerFutureV68120!=null){try{MediaController.releaseFuture(audifyControllerFutureV68120);}catch(Exception ignored){}}\n        super.onDestroy();\n    }`);
}else{
  const last=main.lastIndexOf('}');
  main=main.slice(0,last)+`    @Override public void onDestroy(){\n        audifyControllerV68120=null;\n        if(audifyControllerFutureV68120!=null){try{MediaController.releaseFuture(audifyControllerFutureV68120);}catch(Exception ignored){}}\n        super.onDestroy();\n    }\n`+main.slice(last);
}
await writeFile(mainPath,main,'utf8');

// ---------------------------------------------------------------------------
// 4. Manifest : annoncer le vrai MediaLibraryService aux clients système.
// ---------------------------------------------------------------------------
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
manifest=manifest.replace(/<action android:name="androidx\.media3\.session\.MediaSessionService"\s*\/>/g,'<action android:name="androidx.media3.session.MediaLibraryService" />');
if(manifest.includes('android:name=".AudifyPlaybackService"') && !manifest.includes('androidx.media3.session.MediaLibraryService')){
  manifest=manifest.replace('<action android:name="android.media.browse.MediaBrowserService" />','<action android:name="androidx.media3.session.MediaLibraryService" />\n                <action android:name="android.media.browse.MediaBrowserService" />');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.12.0 : Media3 1.11.0 + MediaLibrarySession directement sur ExoPlayer + UI MediaController.');
