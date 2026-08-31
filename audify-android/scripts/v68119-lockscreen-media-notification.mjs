import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');

function addImport(anchor, line){
  if(!service.includes(line)){
    if(!service.includes(anchor)) throw new Error(`V68.11.9 import anchor introuvable: ${anchor}`);
    service=service.replace(anchor,anchor+'\n'+line);
  }
}

addImport('import android.app.PendingIntent;','import android.app.Notification;');
addImport('import android.app.Notification;','import android.app.NotificationChannel;');
addImport('import android.app.NotificationChannel;','import android.app.NotificationManager;');
addImport('import android.os.Handler;','import android.os.Build;');
addImport('import androidx.media3.common.ForwardingPlayer;','import androidx.media3.common.AudioAttributes;');
addImport('import androidx.media3.common.AudioAttributes;','import androidx.media3.common.C;');

const oldProvider=`        DefaultMediaNotificationProvider mediaNotificationProvider =
            new DefaultMediaNotificationProvider(this);
        mediaNotificationProvider.setSmallIcon(R.drawable.audify_media_notification);
        setMediaNotificationProvider(mediaNotificationProvider);`;

const newProvider=`        // V68.11.9 : canal média Audify explicite et public sur l'écran verrouillé.
        final String audifyMediaChannelId = "audify_media_playback";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                NotificationChannel channel = new NotificationChannel(
                    audifyMediaChannelId,
                    getString(R.string.audify_media_channel_name),
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription(getString(R.string.audify_media_channel_description));
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setShowBadge(false);
                channel.enableVibration(false);
                channel.setSound(null, null);
                notificationManager.createNotificationChannel(channel);
            }
        }

        DefaultMediaNotificationProvider mediaNotificationProvider =
            new DefaultMediaNotificationProvider(
                this,
                session -> 68119,
                audifyMediaChannelId,
                R.string.audify_media_channel_name
            );
        mediaNotificationProvider.setSmallIcon(R.drawable.audify_media_notification);
        setMediaNotificationProvider(mediaNotificationProvider);`;

if(!service.includes(oldProvider)) throw new Error('V68.11.9 bloc DefaultMediaNotificationProvider introuvable');
service=service.replace(oldProvider,newProvider);

const oldPlayer='        player = new ExoPlayer.Builder(this).build();';
const newPlayer=`        player = new ExoPlayer.Builder(this).build();
        // Déclarer explicitement Audify comme lecteur musical système.
        player.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(),
            true
        );
        player.setHandleAudioBecomingNoisy(true);
        // Garde le moteur audio vivant lorsque l'écran s'éteint/verrouille.
        player.setWakeMode(C.WAKE_MODE_LOCAL);`;
if(!service.includes(oldPlayer)) throw new Error('V68.11.9 création ExoPlayer introuvable');
service=service.replace(oldPlayer,newPlayer);

// Enrichir les métadonnées afin que SystemUI traite le contenu comme de la musique.
const oldMetadata=`                        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                            .setTitle(title == null || title.isEmpty() ? "Audify" : title)
                            .setArtist(artist == null ? "" : artist);`;
const newMetadata=`                        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                            .setTitle(title == null || title.isEmpty() ? "Audify" : title)
                            .setArtist(artist == null ? "" : artist)
                            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC);`;
if(!service.includes(oldMetadata)) throw new Error('V68.11.9 métadonnées média introuvables');
service=service.replace(oldMetadata,newMetadata);

await writeFile(servicePath,service,'utf8');

// Ressources du canal de notification.
const stringsPath=path.join(android,'app','src','main','res','values','strings.xml');
let strings=await readFile(stringsPath,'utf8');
if(!strings.includes('name="audify_media_channel_name"')){
  strings=strings.replace('</resources>',`    <string name="audify_media_channel_name">Audify · Lecture</string>\n    <string name="audify_media_channel_description">Contrôles de lecture Audify sur les notifications et l’écran verrouillé</string>\n</resources>`);
  await writeFile(stringsPath,strings,'utf8');
}

// Renforcer le service mediaPlayback dans le manifeste sans dépendre de l'activité.
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(manifest.includes('android:name=".AudifyPlaybackService"') && !/AudifyPlaybackService[\s\S]{0,320}android:stopWithTask="false"/.test(manifest)){
  manifest=manifest.replace('android:name=".AudifyPlaybackService"','android:name=".AudifyPlaybackService"\n            android:stopWithTask="false"');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.11.9 : notification média lockscreen publique + canal dédié + audio/wakelock système.');
