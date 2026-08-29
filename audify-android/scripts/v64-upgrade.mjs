import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

const main=String.raw`package com.nova.audify;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView=getBridge().getWebView();
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.addJavascriptInterface(new AudifyJsBridge(),"AudifyNative");

        if(Build.VERSION.SDK_INT>=33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.POST_NOTIFICATIONS},6401);
        }
    }

    private void send(String action){
        try{startService(new Intent(this,AudifyPlaybackService.class).setAction(action));}catch(Exception ignored){}
    }

    private final class AudifyJsBridge {
        @JavascriptInterface
        public void loadTrack(String json){
            try{
                JSONObject o=new JSONObject(json);
                Intent i=new Intent(MainActivity.this,AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_LOAD)
                    .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,o.optString("videoId",""))
                    .putExtra(AudifyPlaybackService.EXTRA_TITLE,o.optString("title","Audify"))
                    .putExtra(AudifyPlaybackService.EXTRA_ARTIST,o.optString("artist",""))
                    .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,o.optString("thumbnail",""));
                startService(i);
            }catch(Exception ignored){}
        }

        @JavascriptInterface
        public void setQueue(String json){
            try{
                startService(new Intent(MainActivity.this,AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                    .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,json));
            }catch(Exception ignored){}
        }

        @JavascriptInterface public void pause(){send(AudifyPlaybackService.ACTION_PAUSE);}
        @JavascriptInterface public void resume(){send(AudifyPlaybackService.ACTION_PLAY);}
        @JavascriptInterface public void next(){send(AudifyPlaybackService.ACTION_NEXT);}
        @JavascriptInterface public void previous(){send(AudifyPlaybackService.ACTION_PREVIOUS);}

        @JavascriptInterface
        public void seekTo(double seconds){
            try{startService(new Intent(MainActivity.this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SEEK)
                .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));}catch(Exception ignored){}
        }

        @JavascriptInterface
        public void setRepeat(boolean enabled){
            try{startService(new Intent(MainActivity.this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_REPEAT)
                .putExtra(AudifyPlaybackService.EXTRA_REPEAT,enabled));}catch(Exception ignored){}
        }

        @JavascriptInterface
        public void setVolume(double volume){
            try{startService(new Intent(MainActivity.this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_VOLUME)
                .putExtra(AudifyPlaybackService.EXTRA_VOLUME,volume));}catch(Exception ignored){}
        }

        @JavascriptInterface public String getState(){return AudifyPlaybackService.getStateJson();}
    }

    @Override public void onDestroy(){super.onDestroy();}
}
`;

const service=String.raw`package com.nova.audify;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import org.json.JSONArray;
import org.json.JSONObject;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamExtractor;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class AudifyPlaybackService extends MediaSessionService {
    public static final String ACTION_LOAD="com.nova.audify.LOAD";
    public static final String ACTION_PLAY="com.nova.audify.PLAY";
    public static final String ACTION_PAUSE="com.nova.audify.PAUSE";
    public static final String ACTION_SEEK="com.nova.audify.SEEK";
    public static final String ACTION_SET_QUEUE="com.nova.audify.SET_QUEUE";
    public static final String ACTION_NEXT="com.nova.audify.NEXT";
    public static final String ACTION_PREVIOUS="com.nova.audify.PREVIOUS";
    public static final String ACTION_REPEAT="com.nova.audify.REPEAT";
    public static final String ACTION_VOLUME="com.nova.audify.VOLUME";

    public static final String EXTRA_VIDEO_ID="videoId";
    public static final String EXTRA_TITLE="title";
    public static final String EXTRA_ARTIST="artist";
    public static final String EXTRA_THUMBNAIL="thumbnail";
    public static final String EXTRA_SEEK_SECONDS="seekSeconds";
    public static final String EXTRA_QUEUE_JSON="queueJson";
    public static final String EXTRA_REPEAT="repeat";
    public static final String EXTRA_VOLUME="volume";

    private static volatile AudifyPlaybackService instance;
    private static volatile boolean loading=false;
    private static volatile String error="";
    private static volatile String currentVideoId="";
    private static volatile boolean repeatOne=false;

    private ExoPlayer player;
    private MediaSession mediaSession;
    private ExecutorService resolver;
    private Handler mainHandler;
    private final AtomicInteger generation=new AtomicInteger();

    private final ArrayList<Track> queue=new ArrayList<>();
    private int queueIndex=-1;

    private static final class Track {
        final String id,title,artist,thumbnail;
        Track(String id,String title,String artist,String thumbnail){
            this.id=id;this.title=title;this.artist=artist;this.thumbnail=thumbnail;
        }
    }

    @Override
    public void onCreate(){
        super.onCreate();
        instance=this;
        mainHandler=new Handler(Looper.getMainLooper());
        resolver=Executors.newSingleThreadExecutor();
        NewPipe.init(new AudifyDownloader());

        player=new ExoPlayer.Builder(this).build();
        player.setRepeatMode(repeatOne?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);
        player.addListener(new Player.Listener(){
            @Override public void onPlaybackStateChanged(int state){
                if(state==Player.STATE_READY)loading=false;
                if(state==Player.STATE_ENDED && !repeatOne)advance(1);
            }
            @Override public void onPlayerError(PlaybackException ex){
                loading=false;
                error=ex.getMessage()==null?"Playback error":ex.getMessage();
            }
        });
        mediaSession=new MediaSession.Builder(this,player).build();
    }

    @Override
    public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null){
            String action=intent.getAction();
            if(ACTION_LOAD.equals(action)){
                String videoId=intent.getStringExtra(EXTRA_VIDEO_ID);
                String title=intent.getStringExtra(EXTRA_TITLE);
                String artist=intent.getStringExtra(EXTRA_ARTIST);
                String thumbnail=intent.getStringExtra(EXTRA_THUMBNAIL);
                if(videoId!=null&&!videoId.isEmpty()){
                    int idx=findQueueIndex(videoId);
                    if(idx>=0)queueIndex=idx;
                    resolveAndPlay(new Track(videoId,title,artist,thumbnail));
                }
            }else if(ACTION_SET_QUEUE.equals(action)){
                setQueue(intent.getStringExtra(EXTRA_QUEUE_JSON));
            }else if(ACTION_PLAY.equals(action)){
                if(player!=null)player.play();
            }else if(ACTION_PAUSE.equals(action)){
                if(player!=null)player.pause();
            }else if(ACTION_NEXT.equals(action)){
                advance(1);
            }else if(ACTION_PREVIOUS.equals(action)){
                advance(-1);
            }else if(ACTION_SEEK.equals(action)){
                double seconds=intent.getDoubleExtra(EXTRA_SEEK_SECONDS,0);
                if(player!=null)player.seekTo(Math.max(0L,(long)(seconds*1000.0)));
            }else if(ACTION_REPEAT.equals(action)){
                repeatOne=intent.getBooleanExtra(EXTRA_REPEAT,false);
                if(player!=null)player.setRepeatMode(repeatOne?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);
            }else if(ACTION_VOLUME.equals(action)){
                double v=intent.getDoubleExtra(EXTRA_VOLUME,1.0);
                if(player!=null)player.setVolume((float)Math.max(0.0,Math.min(1.0,v)));
            }
        }
        return super.onStartCommand(intent,flags,startId);
    }

    private synchronized void setQueue(String json){
        if(json==null||json.isEmpty())return;
        try{
            JSONObject root=new JSONObject(json);
            JSONArray arr=root.optJSONArray("items");
            int wanted=root.optInt("index",-1);
            ArrayList<Track> next=new ArrayList<>();
            if(arr!=null){
                for(int i=0;i<arr.length();i++){
                    JSONObject o=arr.optJSONObject(i);if(o==null)continue;
                    String id=o.optString("id","");
                    if(id.isEmpty())continue;
                    next.add(new Track(id,o.optString("title","Sans titre"),o.optString("artist","YouTube"),o.optString("thumbnail","")));
                }
            }
            queue.clear();queue.addAll(next);
            int byId=findQueueIndex(currentVideoId);
            if(byId>=0)queueIndex=byId;
            else if(wanted>=0&&wanted<queue.size())queueIndex=wanted;
            else queueIndex=queue.isEmpty()?-1:0;
        }catch(Exception ignored){}
    }

    private synchronized int findQueueIndex(String id){
        if(id==null)return -1;
        for(int i=0;i<queue.size();i++)if(id.equals(queue.get(i).id))return i;
        return -1;
    }

    private void advance(int delta){
        Track target=null;
        synchronized(this){
            if(queue.isEmpty()){
                if(delta<0&&player!=null)player.seekTo(0);
                return;
            }
            int base=findQueueIndex(currentVideoId);
            if(base<0)base=queueIndex>=0?queueIndex:0;
            int size=queue.size();
            queueIndex=(base+delta)%size;if(queueIndex<0)queueIndex+=size;
            target=queue.get(queueIndex);
        }
        if(target!=null)resolveAndPlay(target);
    }

    private void resolveAndPlay(Track t){
        final int ticket=generation.incrementAndGet();
        currentVideoId=t.id;
        loading=true;error="";
        if(player!=null)player.pause();

        resolver.execute(()->{
            try{
                String pageUrl="https://www.youtube.com/watch?v="+t.id;
                StreamExtractor extractor=ServiceList.YouTube.getStreamExtractor(pageUrl);
                extractor.fetchPage();
                List<AudioStream> streams=extractor.getAudioStreams();
                AudioStream best=null;
                for(AudioStream stream:streams){
                    String content=stream.getContent();
                    if(content==null||content.isEmpty())continue;
                    if(best==null||stream.getAverageBitrate()>best.getAverageBitrate())best=stream;
                }
                if(best==null)throw new IllegalStateException("Aucun flux audio YouTube trouvé");
                String streamUrl=best.getContent();
                if(ticket!=generation.get())return;

                mainHandler.post(()->{
                    if(ticket!=generation.get()||player==null)return;
                    try{
                        MediaMetadata.Builder metadata=new MediaMetadata.Builder()
                            .setTitle(t.title==null||t.title.isEmpty()?"Audify":t.title)
                            .setArtist(t.artist==null?"":t.artist);
                        if(t.thumbnail!=null&&!t.thumbnail.isEmpty())metadata.setArtworkUri(Uri.parse(t.thumbnail));
                        MediaItem item=new MediaItem.Builder()
                            .setMediaId(t.id)
                            .setUri(streamUrl)
                            .setMediaMetadata(metadata.build())
                            .build();
                        player.setMediaItem(item);
                        player.setRepeatMode(repeatOne?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);
                        player.prepare();
                        player.play();
                    }catch(Exception ex){
                        loading=false;
                        error=ex.getMessage()==null?"Erreur lecteur natif":ex.getMessage();
                    }
                });
            }catch(Throwable ex){
                if(ticket!=generation.get())return;
                loading=false;
                error=ex.getMessage()==null?ex.getClass().getSimpleName():ex.getMessage();
            }
        });
    }

    public static String getStateJson(){
        JSONObject o=new JSONObject();
        AudifyPlaybackService s=instance;
        try{
            o.put("videoId",currentVideoId);
            o.put("loading",loading);
            o.put("error",error);
            o.put("repeatOne",repeatOne);
            if(s!=null&&s.player!=null){
                o.put("playing",s.player.isPlaying());
                o.put("position",s.player.getCurrentPosition()/1000.0);
                long duration=s.player.getDuration();
                o.put("duration",duration>0?duration/1000.0:0);
                o.put("volume",s.player.getVolume());
                synchronized(s){
                    o.put("queueIndex",s.queueIndex);
                    o.put("queueSize",s.queue.size());
                }
            }else{
                o.put("playing",false);o.put("position",0);o.put("duration",0);o.put("volume",1.0);
                o.put("queueIndex",-1);o.put("queueSize",0);
            }
        }catch(Exception ignored){}
        return o.toString();
    }

    @Nullable @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo){return mediaSession;}

    @Override
    public void onDestroy(){
        generation.incrementAndGet();
        instance=null;
        if(resolver!=null)resolver.shutdownNow();
        if(mediaSession!=null)mediaSession.release();
        if(player!=null)player.release();
        mediaSession=null;player=null;
        super.onDestroy();
    }
}
`;

await writeFile(path.join(pkgDir,'MainActivity.java'),main,'utf8');
await writeFile(path.join(pkgDir,'AudifyPlaybackService.java'),service,'utf8');
console.log('Audify Android V64: commandes natives, file d attente et boucle migrées vers ExoPlayer.');
