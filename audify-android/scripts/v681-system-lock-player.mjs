import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');

if(!service.includes('import androidx.media3.common.ForwardingPlayer;')){
  service=service.replace('import androidx.media3.common.MediaItem;', 'import androidx.media3.common.ForwardingPlayer;\nimport androidx.media3.common.MediaItem;');
}

if(!service.includes('private Player systemPlayer;')){
  service=service.replace('private ExoPlayer player;\n    private MediaSession mediaSession;', 'private ExoPlayer player;\n    private Player systemPlayer;\n    private MediaSession mediaSession;');
}

const oldSession=`mediaSession = new MediaSession.Builder(this, player)\n            .setSessionActivity(sessionActivity)\n            .build();`;
const newSession=`systemPlayer = new ForwardingPlayer(player) {\n            @Override\n            public Commands getAvailableCommands() {\n                return super.getAvailableCommands().buildUpon()\n                    .add(COMMAND_PLAY_PAUSE)\n                    .add(COMMAND_SEEK_TO_NEXT)\n                    .add(COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)\n                    .add(COMMAND_SEEK_TO_PREVIOUS)\n                    .add(COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)\n                    .build();\n            }\n\n            @Override\n            public boolean isCommandAvailable(int command) {\n                if (command == COMMAND_PLAY_PAUSE\n                    || command == COMMAND_SEEK_TO_NEXT\n                    || command == COMMAND_SEEK_TO_NEXT_MEDIA_ITEM\n                    || command == COMMAND_SEEK_TO_PREVIOUS\n                    || command == COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {\n                    return true;\n                }\n                return super.isCommandAvailable(command);\n            }\n\n            @Override public void seekToNext() { goNext(); }\n            @Override public void seekToNextMediaItem() { goNext(); }\n            @Override public void seekToPrevious() { goPrevious(); }\n            @Override public void seekToPreviousMediaItem() { goPrevious(); }\n        };\n\n        mediaSession = new MediaSession.Builder(this, systemPlayer)\n            .setSessionActivity(sessionActivity)\n            .build();`;

if(!service.includes(oldSession)) throw new Error('Bloc MediaSession V67.5 introuvable pour V68.1');
service=service.replace(oldSession,newSession);

if(!service.includes('systemPlayer = null;')){
  service=service.replace('mediaSession = null;\n        player = null;', 'mediaSession = null;\n        systemPlayer = null;\n        player = null;');
}

await writeFile(servicePath,service,'utf8');

const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(manifest.includes('android:name=".AudifyPlaybackService"') && !/AudifyPlaybackService[\s\S]{0,260}android:stopWithTask="false"/.test(manifest)){
  manifest=manifest.replace('android:name=".AudifyPlaybackService"', 'android:name=".AudifyPlaybackService"\n            android:stopWithTask="false"');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V68.1 : MediaSession système + lock screen + commandes externes activées.');
