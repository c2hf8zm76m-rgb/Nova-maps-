import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');

// V68.2 : aligner le service système sur l'architecture MediaLibrary utilisée
// par les lecteurs musicaux Android modernes (et Umihi), sans changer le
// niveau compileSdk de l'application pendant ce test ciblé.
service=service.replace(
  'import androidx.media3.session.MediaSessionService;',
  'import androidx.media3.session.MediaLibraryService;\nimport androidx.media3.session.MediaLibraryService.MediaLibrarySession;\nimport androidx.media3.session.DefaultMediaNotificationProvider;\nimport androidx.media3.session.CacheBitmapLoader;\nimport androidx.media3.datasource.DataSourceBitmapLoader;'
);
service=service.replace(
  'public class AudifyPlaybackService extends MediaSessionService {',
  'public class AudifyPlaybackService extends MediaLibraryService {'
);
service=service.replace(
  'private MediaSession mediaSession;',
  'private MediaLibrarySession mediaSession;'
);

const oldSession=`mediaSession = new MediaSession.Builder(this, systemPlayer)\n            .setSessionActivity(sessionActivity)\n            .build();`;
const newSession=`MediaLibrarySession.Callback libraryCallback = new MediaLibrarySession.Callback() {};\n        mediaSession = new MediaLibrarySession.Builder(this, systemPlayer, libraryCallback)\n            .setSessionActivity(sessionActivity)\n            .setBitmapLoader(new CacheBitmapLoader(\n                new DataSourceBitmapLoader.Builder(this)\n                    .setMakeShared(true)\n                    .build()\n            ))\n            .build();`;
if(!service.includes(oldSession)) throw new Error('Bloc MediaSession V68.1 introuvable pour migration MediaLibrary');
service=service.replace(oldSession,newSession);

service=service.replace(
  'public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {',
  'public MediaLibrarySession onGetSession(MediaSession.ControllerInfo controllerInfo) {'
);

// Forcer un vrai provider de notification Media3 et son canal système.
const createNeedle='        instance = this;\n        mainHandler = new Handler(Looper.getMainLooper());\n        NewPipe.init(new AudifyDownloader());';
const createReplacement=`        instance = this;\n        mainHandler = new Handler(Looper.getMainLooper());\n\n        DefaultMediaNotificationProvider mediaNotificationProvider =\n            new DefaultMediaNotificationProvider(this);\n        mediaNotificationProvider.setSmallIcon(R.drawable.audify_media_notification);\n        setMediaNotificationProvider(mediaNotificationProvider);\n        setShowNotificationForIdlePlayer(\n            androidx.media3.session.MediaSessionService.SHOW_NOTIFICATION_FOR_IDLE_PLAYER_ALWAYS\n        );\n\n        NewPipe.init(new AudifyDownloader());`;
if(!service.includes(createNeedle)) throw new Error('onCreate AudifyPlaybackService introuvable');
service=service.replace(createNeedle,createReplacement);

// Demander au système une mise à jour immédiate lorsque l'état ou le titre change.
service=service.replace(
  'public void onIsPlayingChanged(boolean isPlaying) {\n                updateSnapshot();\n            }',
  'public void onIsPlayingChanged(boolean isPlaying) {\n                updateSnapshot();\n                try { triggerNotificationUpdate(); } catch (Throwable ignored) {}\n            }'
);
service=service.replace(
  'snapshotError = "";\n                updateSnapshot();\n            }\n\n            @Override\n            public void onPlayerError',
  'snapshotError = "";\n                updateSnapshot();\n                try { triggerNotificationUpdate(); } catch (Throwable ignored) {}\n            }\n\n            @Override\n            public void onPlayerError'
);

await writeFile(servicePath,service,'utf8');

// Icône blanche simple exigée par Android pour une notification foreground.
const drawableDir=path.join(android,'app','src','main','res','drawable');
await mkdir(drawableDir,{recursive:true});
await writeFile(path.join(drawableDir,'audify_media_notification.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="24dp"\n    android:height="24dp"\n    android:viewportWidth="24"\n    android:viewportHeight="24">\n    <path\n        android:fillColor="#FFFFFFFF"\n        android:pathData="M8,5 L19,12 L8,19 Z" />\n</vector>\n`,'utf8');

// Le système et les anciens contrôleurs doivent reconnaître un MediaLibraryService.
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
manifest=manifest.replace(/androidx\.media3\.session\.MediaSessionService/g,'androidx.media3.session.MediaLibraryService');
if(!manifest.includes('android:appCategory="audio"')){
  manifest=manifest.replace('<application', '<application\n        android:appCategory="audio"');
}
await writeFile(manifestPath,manifest,'utf8');

// On conserve Media3 1.6.1 pour ce test : cette version est compatible avec
// compileSdk 35. Le point à valider ici est l'architecture MediaLibrary et la
// notification système, pas une migration simultanée du toolchain Android.
console.log('Audify Android V68.2 : MediaLibraryService + notification Media3 explicite appliqués sur Media3 compatible.');
