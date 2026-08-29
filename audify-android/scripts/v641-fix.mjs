import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
main=main.replace(
  '@JavascriptInterface public void pause(){send(AudifyPlaybackService.ACTION_PAUSE);}',
  '@JavascriptInterface public void toggle(){send(AudifyPlaybackService.ACTION_TOGGLE);}\n        @JavascriptInterface public void pause(){send(AudifyPlaybackService.ACTION_PAUSE);}'
);
await writeFile(mainPath,main,'utf8');

const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
service=service.replace(
  'public static final String ACTION_PAUSE="com.nova.audify.PAUSE";',
  'public static final String ACTION_PAUSE="com.nova.audify.PAUSE";\n    public static final String ACTION_TOGGLE="com.nova.audify.TOGGLE";'
);
service=service.replace(
  'private static volatile boolean repeatOne=false;',
  'private static volatile boolean repeatOne=false;\n    private static volatile boolean snapshotPlaying=false;\n    private static volatile double snapshotPosition=0;\n    private static volatile double snapshotDuration=0;\n    private static volatile double snapshotVolume=1.0;'
);
service=service.replace(
  'private int queueIndex=-1;',
  `private int queueIndex=-1;

    private final Runnable stateTicker=new Runnable(){
        @Override public void run(){
            updateSnapshot();
            if(mainHandler!=null)mainHandler.postDelayed(this,200);
        }
    };

    private void updateSnapshot(){
        if(player==null){
            snapshotPlaying=false;snapshotPosition=0;snapshotDuration=0;snapshotVolume=1.0;return;
        }
        snapshotPlaying=player.isPlaying();
        snapshotPosition=Math.max(0L,player.getCurrentPosition())/1000.0;
        long d=player.getDuration();
        snapshotDuration=d>0?d/1000.0:0;
        snapshotVolume=player.getVolume();
    }`
);
service=service.replace(
  'if(state==Player.STATE_READY)loading=false;',
  'if(state==Player.STATE_READY)loading=false;\n                updateSnapshot();'
);
service=service.replace(
  '@Override public void onPlayerError(PlaybackException ex){\n                loading=false;',
  '@Override public void onIsPlayingChanged(boolean isPlaying){updateSnapshot();}\n            @Override public void onPlayerError(PlaybackException ex){\n                loading=false;'
);
service=service.replace(
  'mediaSession=new MediaSession.Builder(this,player).build();',
  'mediaSession=new MediaSession.Builder(this,player).build();\n        updateSnapshot();\n        mainHandler.post(stateTicker);'
);
service=service.replace(
  '}else if(ACTION_PLAY.equals(action)){\n                if(player!=null)player.play();\n            }else if(ACTION_PAUSE.equals(action)){\n                if(player!=null)player.pause();',
  '}else if(ACTION_TOGGLE.equals(action)){\n                if(player!=null){if(player.isPlaying())player.pause();else player.play();updateSnapshot();}\n            }else if(ACTION_PLAY.equals(action)){\n                if(player!=null){player.play();updateSnapshot();}\n            }else if(ACTION_PAUSE.equals(action)){\n                if(player!=null){player.pause();updateSnapshot();}'
);
service=service.replace(
  'if(player!=null)player.seekTo(Math.max(0L,(long)(seconds*1000.0)));',
  'if(player!=null){player.seekTo(Math.max(0L,(long)(seconds*1000.0)));updateSnapshot();}'
);
service=service.replace(
  'if(player!=null)player.setRepeatMode(repeatOne?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);',
  'if(player!=null){player.setRepeatMode(repeatOne?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);updateSnapshot();}'
);
service=service.replace(
  'if(player!=null)player.setVolume((float)Math.max(0.0,Math.min(1.0,v)));',
  'if(player!=null){player.setVolume((float)Math.max(0.0,Math.min(1.0,v)));updateSnapshot();}'
);

const methodStart=service.indexOf('    public static String getStateJson(){');
const methodEnd=service.indexOf('\n    @Nullable @Override',methodStart);
if(methodStart<0||methodEnd<0)throw new Error('getStateJson introuvable');
const safeMethod=`    public static String getStateJson(){
        JSONObject o=new JSONObject();
        AudifyPlaybackService s=instance;
        try{
            o.put("videoId",currentVideoId);
            o.put("loading",loading);
            o.put("error",error);
            o.put("repeatOne",repeatOne);
            o.put("playing",snapshotPlaying);
            o.put("position",snapshotPosition);
            o.put("duration",snapshotDuration);
            o.put("volume",snapshotVolume);
            if(s!=null){
                synchronized(s){
                    o.put("queueIndex",s.queueIndex);
                    o.put("queueSize",s.queue.size());
                }
            }else{
                o.put("queueIndex",-1);o.put("queueSize",0);
            }
        }catch(Exception ignored){}
        return o.toString();
    }
`;
service=service.slice(0,methodStart)+safeMethod+service.slice(methodEnd);
service=service.replace(
  'generation.incrementAndGet();\n        instance=null;',
  'generation.incrementAndGet();\n        if(mainHandler!=null)mainHandler.removeCallbacks(stateTicker);\n        snapshotPlaying=false;snapshotPosition=0;snapshotDuration=0;snapshotVolume=1.0;\n        instance=null;'
);
await writeFile(servicePath,service,'utf8');
console.log('Audify Android V64.1: état ExoPlayer thread-safe + toggle natif appliqués.');
