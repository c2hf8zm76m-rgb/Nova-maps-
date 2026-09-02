import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
const servicePath = path.join(pkgDir, 'AudifyPlaybackService.java');
let service = await readFile(servicePath, 'utf8');

function requiredReplace(from, to, label) {
  if (!service.includes(from)) throw new Error(`V68.12.44 ${label} introuvable`);
  service = service.replace(from, to);
}

// 1) Architecture Umihi : le MediaLibraryService possède directement ExoPlayer.
service = service.replace('import androidx.media3.common.ForwardingPlayer;\n', '');
service = service.replace('    private Player systemPlayer;\n', '');
service = service.replace('        systemPlayer = null;\n', '');

const forwardingStart = service.indexOf('        systemPlayer = new ForwardingPlayer(player) {');
if (forwardingStart >= 0) {
  const callbackStart = service.indexOf('        MediaLibrarySession.Callback libraryCallback', forwardingStart);
  if (callbackStart < 0) throw new Error('V68.12.44 fin ForwardingPlayer introuvable');
  service = service.slice(0, forwardingStart) + service.slice(callbackStart);
}

service = service.replace(
  'mediaSession = new MediaLibrarySession.Builder(this, systemPlayer, libraryCallback)',
  'mediaSession = new MediaLibrarySession.Builder(this, player, libraryCallback)'
);

// 2) SessionActivity vers le vrai Home natif, pas l\'ancienne MainActivity WebView.
if (!service.includes('import android.app.PendingIntent;')) {
  service = service.replace('import android.content.Intent;', 'import android.app.PendingIntent;\nimport android.content.Intent;');
}

const oldPending = /Intent openAudify[\s\S]*?PendingIntent sessionActivity=PendingIntent\.getActivity\([\s\S]*?\);/;
if (oldPending.test(service)) {
  service = service.replace(oldPending, `Intent openAudify = new Intent(this, NativeHomeActivity.class)\n            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);\n        PendingIntent sessionActivity = PendingIntent.getActivity(\n            this, 681244, openAudify, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE\n        );`);
}

// 3) ExoPlayer réglé exactement comme lecteur musique de fond.
if (!service.includes('import androidx.media3.common.AudioAttributes;')) {
  service = service.replace('import androidx.media3.common.C;', 'import androidx.media3.common.AudioAttributes;\nimport androidx.media3.common.C;');
}

const playerBuilderRegex = /player\s*=\s*new ExoPlayer\.Builder\(this\)[\s\S]*?\.build\(\);/;
if (!playerBuilderRegex.test(service)) throw new Error('V68.12.44 ExoPlayer.Builder introuvable');
service = service.replace(playerBuilderRegex, `AudioAttributes audioAttributes = new AudioAttributes.Builder()\n            .setUsage(C.USAGE_MEDIA)\n            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)\n            .build();\n\n        player = new ExoPlayer.Builder(this)\n            .setAudioAttributes(audioAttributes, true)\n            .setWakeMode(C.WAKE_MODE_NETWORK)\n            .setHandleAudioBecomingNoisy(true)\n            .build();`);

// 4) Métadonnées complètes pour SystemUI / lock screen.
service = service.replace(
  '.setArtist(track.artist);',
  '.setArtist(track.artist)\n            .setAlbumTitle("Audify")\n            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC);'
);

// 5) Ne jamais tuer la lecture quand l\'Activity quitte la tâche.
const onTaskRemovedRegex = /@Override\s+public void onTaskRemoved\(Intent rootIntent\)\s*\{[\s\S]*?\n    \}/;
if (onTaskRemovedRegex.test(service)) {
  service = service.replace(onTaskRemovedRegex, `@Override\n    public void onTaskRemoved(Intent rootIntent) {\n        if (player == null || player.getMediaItemCount() == 0) {\n            pauseAllPlayersAndStopSelf();\n        }\n    }`);
}

// 6) Notification : laisser Media3 gérer le foreground automatiquement.
// Supprimer uniquement un provider Audify personnalisé s\'il existe encore.
service = service.replace(/\s*DefaultMediaNotificationProvider mediaNotificationProvider[\s\S]*?setMediaNotificationProvider\(mediaNotificationProvider\);/g, '');

await writeFile(servicePath, service, 'utf8');

// Manifest aligné avec Umihi.
const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
for (const permission of [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS'
]) {
  if (!manifest.includes(permission)) {
    manifest = manifest.replace(/<manifest([^>]*)>/, m => `${m}\n    <uses-permission android:name="${permission}" />`);
  }
}
manifest = manifest.replace(/androidx\.media3\.session\.MediaSessionService/g, 'androidx.media3.session.MediaLibraryService');
if (manifest.includes('android:name=".AudifyPlaybackService"') && !/AudifyPlaybackService[\s\S]{0,360}android:stopWithTask="false"/.test(manifest)) {
  manifest = manifest.replace('android:name=".AudifyPlaybackService"', 'android:name=".AudifyPlaybackService"\n            android:stopWithTask="false"');
}
await writeFile(manifestPath, manifest, 'utf8');

console.log('Audify V68.12.44 : Media3 core aligné sur Umihi (service propriétaire du player, WAKE_MODE_NETWORK, MediaLibrarySession directe, foreground système).');
