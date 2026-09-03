package com.nova.audify;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.ImageView;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
final class AudifyInstantAlbumArtwork {
    private static final Map<String,Bitmap> CACHE=new ConcurrentHashMap<>();
    private static final Set<String> MISS=Collections.newSetFromMap(new ConcurrentHashMap<String,Boolean>());
    private static final ExecutorService IO=Executors.newFixedThreadPool(2,r->{Thread t=new Thread(r,"AudifyAlbumArtwork");t.setDaemon(true);return t;});
    static void load(Context c,AudifyInstantAlbumMetadata.Album a,ImageView v,String fallback){String k=AudifyInstantAlbumMetadata.key(a);Bitmap b=CACHE.get(k);if(b!=null){v.setImageBitmap(b);return;}if(MISS.contains(k))return;IO.execute(()->{Bitmap x=fetch(AudifyInstantAlbumMetadata.cover(a));if(x==null)x=fetch(fallback);final Bitmap out=x;if(out!=null)CACHE.put(k,out);else MISS.add(k);v.post(()->{if(out!=null)v.setImageBitmap(out);});});}
    private static Bitmap fetch(String u){if(u==null||u.length()==0)return null;HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(u).openConnection();c.setConnectTimeout(4500);c.setReadTimeout(6500);c.setInstanceFollowRedirects(true);c.setRequestProperty("User-Agent","Audify/68.12.55");int code=c.getResponseCode();return code>=200&&code<300?BitmapFactory.decodeStream(c.getInputStream()):null;}catch(Throwable e){return null;}finally{if(c!=null)c.disconnect();}}
}
