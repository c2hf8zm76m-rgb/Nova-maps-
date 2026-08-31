import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');

function addImport(anchor,line){
  if(!service.includes(line)){
    if(!service.includes(anchor)) throw new Error(`V68.11.9 import anchor introuvable: ${anchor}`);
    service=service.replace(anchor,anchor+'\n'+line);
  }
}

addImport('import android.app.PendingIntent;','import android.app.Notification;');
addImport('import android.app.Notification;','import android.app.NotificationChannel;');
addImport('import android.app.NotificationChannel;','import android.app.NotificationManager;');
addImport('import android.os.Handler;','import android.os.Build;');

// Le moteur V67.5 possède déjà USAGE_MEDIA, AUDIO_CONTENT_TYPE_MUSIC,
// WAKE_MODE_NETWORK et handleAudioBecomingNoisy. V68.11.9 ne les réécrit pas :
// il complète uniquement la partie notification/écran verrouillé qui manquait.
const oldProvider=`        DefaultMediaNotificationProvider mediaNotificationProvider =
            new DefaultMediaNotificationProvider(this);
        mediaNotificationProvider.setSmallIcon(R.drawable.audify_media_notification);
        setMediaNotificationProvider(mediaNotificationProvider);`;

const newProvider=`        // V68.11.9 : vrai canal média Audify, silencieux et PUBLIC sur le lockscreen.
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
                channel.setSound(null,null);
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
await writeFile(servicePath,service,'utf8');

// Nom/description du canal visible dans les réglages Android.
const stringsPath=path.join(android,'app','src','main','res','values','strings.xml');
let strings=await readFile(stringsPath,'utf8');
if(!strings.includes('name="audify_media_channel_name"')){
  if(!strings.includes('</resources>')) throw new Error('V68.11.9 strings.xml invalide');
  strings=strings.replace('</resources>',`    <string name="audify_media_channel_name">Audify · Lecture</string>\n    <string name="audify_media_channel_description">Contrôles de lecture Audify sur les notifications et l’écran verrouillé</string>\n</resources>`);
  await writeFile(stringsPath,strings,'utf8');
}

// Le service de lecture ne doit pas mourir quand l'activité/le task est fermé.
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(manifest.includes('android:name=".AudifyPlaybackService"') && !/AudifyPlaybackService[\s\S]{0,320}android:stopWithTask="false"/.test(manifest)){
  manifest=manifest.replace('android:name=".AudifyPlaybackService"','android:name=".AudifyPlaybackService"\n            android:stopWithTask="false"');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.11.9 : canal Media3 public lockscreen + notification média dédiée appliqués.');
