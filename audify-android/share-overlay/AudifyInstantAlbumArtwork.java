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

    private static boolean isPlayerAlbumTile(ImageView v){
        CharSequence d=v.getContentDescription();
        return d!=null&&"Ouvrir cet album".contentEquals(d);
    }

    private static void cleanPlayerAlbumTile(ImageView v){
        v.setBackground(null);
        v.setElevation(0f);
        v.setClipToOutline(false);
        v.setImageDrawable(null);
    }

    static void load(Context c,AudifyInstantAlbumMetadata.Album a,ImageView v,String fallback){
        final boolean playerTile=isPlayerAlbumTile(v);
        if(playerTile)cleanPlayerAlbumTile(v);

        String k=AudifyInstantAlbumMetadata.key(a)+(playerTile?"|real-cover":"|artwork");
        Bitmap b=CACHE.get(k);
        if(b!=null){v.setImageBitmap(b);return;}
        if(MISS.contains(k))return;

        IO.execute(()->{
            Bitmap x=fetch(AudifyInstantAlbumMetadata.cover(a));
            // On the player tile, never replace a missing album cover with a video/song thumbnail.
            // If there is no real album artwork, the tile stays visually absent instead of showing a grey rectangle.
            if(x==null&&!playerTile)x=fetch(fallback);
            final Bitmap out=x;
            if(out!=null)CACHE.put(k,out);else MISS.add(k);
            v.post(()->{
                if(playerTile)cleanPlayerAlbumTile(v);
                if(out!=null)v.setImageBitmap(out);
            });
        });
    }

    private static Bitmap fetch(String u){if(u==null||u.length()==0)return null;HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(u).openConnection();c.setConnectTimeout(4500);c.setReadTimeout(6500);c.setInstanceFollowRedirects(true);c.setRequestProperty("User-Agent","Audify/68.12.56");int code=c.getResponseCode();return code>=200&&code<300?BitmapFactory.decodeStream(c.getInputStream()):null;}catch(Throwable e){return null;}finally{if(c!=null)c.disconnect();}}
}
