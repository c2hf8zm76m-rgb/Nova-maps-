import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
if(!main.includes('import android.graphics.Color;')){
  main=main.replace('import android.content.pm.PackageManager;','import android.content.pm.PackageManager;\nimport android.graphics.Color;');
}
main=main.replace(
  'WebView webView=getBridge().getWebView();',
  'WebView webView=getBridge().getWebView();\n        getWindow().setStatusBarColor(Color.rgb(7,10,15));\n        getWindow().setNavigationBarColor(Color.rgb(7,10,15));\n        webView.setBackgroundColor(Color.rgb(7,10,15));'
);
await writeFile(mainPath,main,'utf8');

const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
if(!service.includes('import android.app.PendingIntent;')){
  service=service.replace('import android.content.Intent;','import android.app.PendingIntent;\nimport android.content.Intent;');
}
if(!service.includes('import androidx.media3.common.ForwardingPlayer;')){
  service=service.replace('import androidx.media3.common.MediaItem;','import androidx.media3.common.ForwardingPlayer;\nimport androidx.media3.common.MediaItem;');
}
service=service.replace(
  'private MediaSession mediaSession;',
  'private MediaSession mediaSession;\n    private Player systemPlayer;'
);

const oldSession='mediaSession=new MediaSession.Builder(this,player).build();';
const newSession=`Intent openAudify=new Intent(this,MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent sessionActivity=PendingIntent.getActivity(
            this,6404,openAudify,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);

        systemPlayer=new ForwardingPlayer(player){
            @Override public Commands getAvailableCommands(){
                return super.getAvailableCommands().buildUpon()
                    .add(COMMAND_SEEK_TO_NEXT)
                    .add(COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(COMMAND_SEEK_TO_PREVIOUS)
                    .add(COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .build();
            }
            @Override public boolean isCommandAvailable(int command){
                if(command==COMMAND_SEEK_TO_NEXT||command==COMMAND_SEEK_TO_NEXT_MEDIA_ITEM
                    ||command==COMMAND_SEEK_TO_PREVIOUS||command==COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)return true;
                return super.isCommandAvailable(command);
            }
            @Override public void seekToNext(){advance(1);}
            @Override public void seekToNextMediaItem(){advance(1);}
            @Override public void seekToPrevious(){advance(-1);}
            @Override public void seekToPreviousMediaItem(){advance(-1);}
        };
        mediaSession=new MediaSession.Builder(this,systemPlayer)
            .setSessionActivity(sessionActivity)
            .build();`;
if(!service.includes(oldSession))throw new Error('Point MediaSession V64.4 introuvable');
service=service.replace(oldSession,newSession);
service=service.replace(
  'mediaSession=null;player=null;',
  'mediaSession=null;systemPlayer=null;player=null;'
);
await writeFile(servicePath,service,'utf8');
console.log('Audify Android V64.4: démarrage sombre + lecteur système MediaSession complet appliqués.');
