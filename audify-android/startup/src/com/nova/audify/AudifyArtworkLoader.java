package com.nova.audify;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.LruCache;
import android.widget.ImageView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;

/** Bounded downloads and decoding; every request reports success or failure. */
public final class AudifyArtworkLoader {
    public interface Callback { void complete(boolean ok); }
    private final ExecutorService executor;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final LruCache<String,Bitmap> cache=new LruCache<String,Bitmap>(6*1024*1024){
        @Override protected int sizeOf(String key,Bitmap b){return b.getAllocationByteCount();}
    };
    private final Map<String,List<Request>> pending=new HashMap<>();
    private boolean closed;
    private static final class Request {
        final ImageView view;final Callback callback;
        Request(ImageView view,Callback callback){this.view=view;this.callback=callback;}
    }
    public AudifyArtworkLoader(ExecutorService executor){this.executor=executor;}
    public void loadCached(ImageView view,String url,Callback callback){
        Bitmap bitmap=url==null?null:cache.get(url);
        if(bitmap!=null)view.setImageBitmap(bitmap);
        callback.complete(bitmap!=null||url==null||url.isEmpty());
    }
    public void load(ImageView view,String url,Callback callback){
        if(closed){callback.complete(false);return;}
        if(url==null||url.isEmpty()){callback.complete(true);return;}
        view.setTag(url);
        Bitmap cached=cache.get(url);if(cached!=null){view.setImageBitmap(cached);callback.complete(true);return;}
        List<Request> waiting=pending.get(url);
        if(waiting!=null){waiting.add(new Request(view,callback));return;}
        waiting=new ArrayList<>();waiting.add(new Request(view,callback));pending.put(url,waiting);
        executor.execute(()->{
            Bitmap result=download(url);
            main.post(()->{
                List<Request> requests=pending.remove(url);if(closed||requests==null)return;
                if(result!=null)cache.put(url,result);
                for(Request r:requests){
                    if(url.equals(r.view.getTag())&&result!=null)r.view.setImageBitmap(result);
                    r.callback.complete(result!=null);
                }
            });
        });
    }
    private Bitmap download(String source){
        HttpURLConnection connection=null;
        try{
            URL url=new URL(source);if(!"https".equalsIgnoreCase(url.getProtocol()))return null;
            connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(5000);connection.setReadTimeout(8000);
            connection.setRequestProperty("User-Agent","Audify/68.12.38");connection.connect();
            if(connection.getResponseCode()!=200||connection.getContentLength()>4*1024*1024)return null;
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];
            long start=SystemClock.elapsedRealtime();
            try(InputStream input=connection.getInputStream()){
                int count;while((count=input.read(buffer))!=-1){
                    if(Thread.currentThread().isInterrupted()||bytes.size()+count>4*1024*1024||SystemClock.elapsedRealtime()-start>10000)return null;
                    bytes.write(buffer,0,count);
                }
            }
            byte[] encoded=bytes.toByteArray();BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
            BitmapFactory.decodeByteArray(encoded,0,encoded.length,options);
            if(options.outWidth<=0||options.outHeight<=0)return null;
            options.inSampleSize=1;while(options.outWidth/options.inSampleSize>640||options.outHeight/options.inSampleSize>640)options.inSampleSize*=2;
            options.inJustDecodeBounds=false;return BitmapFactory.decodeByteArray(encoded,0,encoded.length,options);
        }catch(Exception failure){return null;}finally{if(connection!=null)connection.disconnect();}
    }
    public void close(){closed=true;pending.clear();cache.evictAll();main.removeCallbacksAndMessages(null);}
}
