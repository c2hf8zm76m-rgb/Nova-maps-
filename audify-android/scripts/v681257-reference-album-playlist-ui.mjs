import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// -----------------------------------------------------------------------------
// V68.12.57 — shared visual language for real native Album + Playlist pages.
// This is deliberately a late patch: playback, storage, search and sync stay intact.
// -----------------------------------------------------------------------------

const playlistDialog=String.raw`package com.nova.audify;

import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Audify V68.12.57 — page Playlist native inspirée de la page Album de référence.
 * Le stockage et la lecture restent ceux d'AudifyLibraryStore / AudifyPlaybackService.
 */
final class AudifyPlaylistReferenceDialog {
    private static final ExecutorService ART=Executors.newFixedThreadPool(2,r->{
        Thread t=new Thread(r,"AudifyPlaylistArtwork");t.setDaemon(true);return t;
    });
    private static final Map<String,Bitmap> CACHE=new ConcurrentHashMap<>();

    static void show(Activity a,String rawName,List<AudifyLibraryStore.Track> tracks){
        if(a==null)return;
        if(tracks==null||tracks.isEmpty()){
            Toast.makeText(a,"Playlist vide",Toast.LENGTH_SHORT).show();
            return;
        }
        final String name=TextUtils.isEmpty(rawName)?"Ma playlist":rawName;
        final boolean wide=a.getResources().getDisplayMetrics().widthPixels>a.getResources().getDisplayMetrics().heightPixels;

        Dialog d=new Dialog(a);
        d.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout panel=new LinearLayout(a);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(a,wide?22:18),dp(a,18),dp(a,wide?22:18),dp(a,18));
        GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{Color.rgb(15,20,29),Color.rgb(8,11,16)});
        bg.setCornerRadius(dp(a,28));
        bg.setStroke(dp(a,1),Color.argb(42,255,255,255));
        panel.setBackground(bg);

        LinearLayout top=new LinearLayout(a);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge=text(a,"PLAYLIST",10.5f,Color.rgb(202,255,148),true);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(a,9),dp(a,5),dp(a,9),dp(a,5));
        GradientDrawable bb=new GradientDrawable();
        bb.setColor(Color.argb(34,168,255,63));
        bb.setCornerRadius(dp(a,20));
        badge.setBackground(bb);
        top.addView(badge,new LinearLayout.LayoutParams(-2,-2));
        View spacer=new View(a);
        top.addView(spacer,new LinearLayout.LayoutParams(0,1,1));
        TextView close=text(a,"×",22,Color.rgb(220,226,235),false);
        close.setGravity(Gravity.CENTER);
        GradientDrawable cb=new GradientDrawable();
        cb.setColor(Color.argb(25,255,255,255));
        cb.setCornerRadius(dp(a,14));
        close.setBackground(cb);
        top.addView(close,new LinearLayout.LayoutParams(dp(a,42),dp(a,42)));
        close.setOnClickListener(v->d.dismiss());
        hover(close,1.045f);
        panel.addView(top,full());

        LinearLayout hero=new LinearLayout(a);
        hero.setGravity(Gravity.CENTER_VERTICAL);
        hero.setPadding(0,dp(a,12),0,0);
        int artSize=dp(a,wide?138:118);
        ImageView art=new ImageView(a);
        art.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable ab=new GradientDrawable();
        ab.setColor(Color.rgb(27,34,44));
        ab.setCornerRadius(dp(a,18));
        art.setBackground(ab);
        if(Build.VERSION.SDK_INT>=21)art.setClipToOutline(true);
        hero.addView(art,new LinearLayout.LayoutParams(artSize,artSize));
        loadArtwork(art,tracks.get(0).thumbnail);

        LinearLayout copy=new LinearLayout(a);
        copy.setOrientation(LinearLayout.VERTICAL);
        TextView title=text(a,name,wide?31:28,Color.WHITE,true);
        title.setMaxLines(2);
        title.setEllipsize(TextUtils.TruncateAt.END);
        copy.addView(title,full());
        TextView owner=text(a,"Playlist Audify",15,Color.rgb(190,199,212),false);
        LinearLayout.LayoutParams op=full();op.topMargin=dp(a,5);copy.addView(owner,op);
        TextView meta=text(a,tracks.size()+" titre"+(tracks.size()>1?"s":""),12.5f,Color.rgb(138,149,165),false);
        LinearLayout.LayoutParams mp=full();mp.topMargin=dp(a,5);copy.addView(meta,mp);
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,-2,1);cp.leftMargin=dp(a,16);hero.addView(copy,cp);
        panel.addView(hero,full());

        LinearLayout actions=new LinearLayout(a);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams acp=full();acp.topMargin=dp(a,16);panel.addView(actions,acp);

        TextView play=text(a,"▶  Lire maintenant",14.5f,Color.rgb(7,14,8),true);
        play.setGravity(Gravity.CENTER);
        play.setPadding(dp(a,12),dp(a,13),dp(a,12),dp(a,13));
        GradientDrawable pb=new GradientDrawable();pb.setColor(Color.rgb(168,255,63));pb.setCornerRadius(dp(a,18));play.setBackground(pb);
        actions.addView(play,new LinearLayout.LayoutParams(0,-2,1));
        hover(play,1.018f);

        TextView saved=text(a,"✓  Dans ta bibliothèque",13.2f,Color.rgb(224,230,239),true);
        saved.setGravity(Gravity.CENTER);
        saved.setPadding(dp(a,10),dp(a,13),dp(a,10),dp(a,13));
        GradientDrawable sb=new GradientDrawable();sb.setColor(Color.argb(24,255,255,255));sb.setCornerRadius(dp(a,18));sb.setStroke(dp(a,1),Color.argb(35,255,255,255));saved.setBackground(sb);
        LinearLayout.LayoutParams svp=new LinearLayout.LayoutParams(0,-2,1);svp.leftMargin=dp(a,10);actions.addView(saved,svp);

        TextView hint=text(a,"Tous les titres sont déjà prêts : la playlist démarre immédiatement.",11.5f,Color.rgb(151,162,178),false);
        LinearLayout.LayoutParams hp=full();hp.topMargin=dp(a,8);panel.addView(hint,hp);

        TextView trackHead=text(a,"TRACKLIST",11.5f,Color.rgb(154,166,182),true);
        LinearLayout.LayoutParams thp=full();thp.topMargin=dp(a,16);panel.addView(trackHead,thp);

        ScrollView sc=new ScrollView(a);
        sc.setFillViewport(false);
        LinearLayout list=new LinearLayout(a);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0,dp(a,6),0,0);
        for(int i=0;i<tracks.size();i++){
            final int index=i;
            AudifyLibraryStore.Track t=tracks.get(i);
            LinearLayout row=new LinearLayout(a);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(a,12),dp(a,10),dp(a,12),dp(a,10));
            GradientDrawable rb=new GradientDrawable();
            rb.setColor(i==0?Color.argb(32,168,255,63):Color.argb(18,255,255,255));
            rb.setCornerRadius(dp(a,13));
            row.setBackground(rb);
            TextView num=text(a,String.format(java.util.Locale.ROOT,"%02d",i+1),12.5f,i==0?Color.rgb(191,255,122):Color.rgb(152,163,178),true);
            row.addView(num,new LinearLayout.LayoutParams(dp(a,42),-2));
            LinearLayout tm=new LinearLayout(a);tm.setOrientation(LinearLayout.VERTICAL);
            TextView tn=text(a,t.title,14,i==0?Color.rgb(205,255,158):Color.rgb(238,241,246),i==0);
            tn.setSingleLine(true);tn.setEllipsize(TextUtils.TruncateAt.END);tm.addView(tn,full());
            TextView ta=text(a,t.artist,11.5f,Color.rgb(137,148,164),false);
            ta.setSingleLine(true);ta.setEllipsize(TextUtils.TruncateAt.END);tm.addView(ta,full());
            row.addView(tm,new LinearLayout.LayoutParams(0,-2,1));
            TextView state=text(a,"Prêt",11.5f,Color.rgb(194,255,126),false);
            state.setGravity(Gravity.END|Gravity.CENTER_VERTICAL);
            row.addView(state,new LinearLayout.LayoutParams(dp(a,wide?76:58),-2));
            row.setOnClickListener(v->play(a,tracks,index,d));
            hover(row,1.008f);
            LinearLayout.LayoutParams rp=full();rp.topMargin=dp(a,5);list.addView(row,rp);
        }
        sc.addView(list,new ScrollView.LayoutParams(-1,-2));
        LinearLayout.LayoutParams sl=new LinearLayout.LayoutParams(-1,dp(a,wide?300:360));sl.topMargin=dp(a,3);panel.addView(sc,sl);

        play.setOnClickListener(v->play(a,tracks,0,d));

        d.setContentView(panel);
        d.show();
        Window w=d.getWindow();
        if(w!=null){
            w.setBackgroundDrawableResource(android.R.color.transparent);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams p=new WindowManager.LayoutParams();p.copyFrom(w.getAttributes());
            int max=wide?dp(a,760):dp(a,520);
            p.width=Math.min(a.getResources().getDisplayMetrics().widthPixels-dp(a,20),max);
            p.height=-2;
            p.gravity=wide?Gravity.CENTER:(Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
            p.dimAmount=.68f;
            p.y=wide?0:dp(a,10);
            w.setAttributes(p);
        }
    }

    private static void play(Activity a,List<AudifyLibraryStore.Track> tracks,int index,Dialog d){
        if(index<0||index>=tracks.size())return;
        AudifyLibraryStore.Track t=tracks.get(index);
        try{
            AudifyLibraryStore store=new AudifyLibraryStore(a);
            a.startService(new Intent(a,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(tracks,index)));
            a.startService(new Intent(a,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,t.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,t.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,t.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,t.thumbnail));
            a.startActivity(new Intent(a,NativePlayerActivity.class)
                .putExtra("videoId",t.id)
                .putExtra("title",t.title)
                .putExtra("artist",t.artist)
                .putExtra("thumbnail",t.thumbnail));
            d.dismiss();
        }catch(Throwable e){
            Toast.makeText(a,"Impossible de lancer ce titre",Toast.LENGTH_SHORT).show();
        }
    }

    private static void loadArtwork(ImageView v,String url){
        if(TextUtils.isEmpty(url))return;
        Bitmap cached=CACHE.get(url);
        if(cached!=null){v.setImageBitmap(cached);return;}
        ART.execute(()->{
            Bitmap out=fetch(url);
            if(out!=null)CACHE.put(url,out);
            v.post(()->{if(out!=null)v.setImageBitmap(out);});
        });
    }

    private static Bitmap fetch(String url){
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();
            c.setConnectTimeout(4500);c.setReadTimeout(6500);c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent","Audify/68.12.57");
            int code=c.getResponseCode();
            return code>=200&&code<300?BitmapFactory.decodeStream(c.getInputStream()):null;
        }catch(Throwable ignored){return null;}
        finally{if(c!=null)c.disconnect();}
    }

    private static void hover(View v,float scale){
        v.setOnHoverListener((x,e)->{
            if(e.getAction()==MotionEvent.ACTION_HOVER_ENTER){x.animate().scaleX(scale).scaleY(scale).setDuration(120).start();}
            else if(e.getAction()==MotionEvent.ACTION_HOVER_EXIT){x.animate().scaleX(1f).scaleY(1f).setDuration(135).start();}
            return false;
        });
    }

    private static TextView text(Activity a,String value,float size,int color,boolean bold){
        TextView v=new TextView(a);v.setText(value);v.setTextSize(size);v.setTextColor(color);v.setGravity(Gravity.CENTER_VERTICAL);
        if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return v;
    }
    private static LinearLayout.LayoutParams full(){return new LinearLayout.LayoutParams(-1,-2);}
    private static int dp(Activity a,int n){return Math.round(n*a.getResources().getDisplayMetrics().density);}
}
`;
await writeFile(path.join(pkgDir,'AudifyPlaylistReferenceDialog.java'),playlistDialog,'utf8');

// Replace only the old stock AlertDialog playlist detail page. The store and playback
// methods are deliberately left untouched.
const libraryPath=path.join(pkgDir,'NativeLibraryActivity.java');
let library=await readFile(libraryPath,'utf8');
const playlistMethod=/    private void showPlaylist\(String name, List<AudifyLibraryStore\.Track> tracks\) \{[\s\S]*?\n    \}\n\n    private void addTrackRow/;
if(!playlistMethod.test(library))throw new Error('NativeLibraryActivity.showPlaylist signature not found');
library=library.replace(playlistMethod,`    private void showPlaylist(String name, List<AudifyLibraryStore.Track> tracks) {\n        AudifyPlaylistReferenceDialog.show(this, name, tracks);\n    }\n\n    private void addTrackRow`);
await writeFile(libraryPath,library,'utf8');

// Refine the real native Album dialog so it follows exactly the same visual
// architecture and scales like the reference on BlueStacks / landscape, while
// remaining a bottom sheet on portrait phones.
const albumPath=path.join(pkgDir,'AudifyInstantAlbums.java');
let album=await readFile(albumPath,'utf8');
const sig='private static void showAlbum(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s,boolean autoStart){';
if(!album.includes(sig))throw new Error('AudifyInstantAlbums.showAlbum signature not found');
if(!album.includes('final boolean wide=a.getResources().getDisplayMetrics().widthPixels>a.getResources().getDisplayMetrics().heightPixels;')){
    album=album.replace(sig,sig+'\n        final boolean wide=a.getResources().getDisplayMetrics().widthPixels>a.getResources().getDisplayMetrics().heightPixels;');
}
album=album.replace('hero.addView(art,new LinearLayout.LayoutParams(dp(a,118),dp(a,118)));AudifyInstantAlbumArtwork.load(a,album,art,s.thumb);',
    'hero.addView(art,new LinearLayout.LayoutParams(dp(a,wide?138:118),dp(a,wide?138:118)));AudifyInstantAlbumArtwork.load(a,album,art,s.thumb);');
album=album.replace('"＋  Playlist"','"＋  Enregistrer dans mes playlists"');

const listNeedle='ScrollView sc=new ScrollView(a);sc.setFillViewport(false);LinearLayout list=new LinearLayout(a);list.setOrientation(LinearLayout.VERTICAL);list.setPadding(0,dp(a,6),0,0);\n        for(int i=0;i<album.tracks.size();i++){';
if(album.includes(listNeedle)){
    album=album.replace(listNeedle,'ScrollView sc=new ScrollView(a);sc.setFillViewport(false);LinearLayout list=new LinearLayout(a);list.setOrientation(LinearLayout.VERTICAL);list.setPadding(0,dp(a,6),0,0);\n        final AudifyInstantAlbumResolver.State displayState=AudifyInstantAlbumResolver.ensure(a,album,s.id,s.title,s.artist,s.thumb);\n        final ArrayList<TextView> trackStates=new ArrayList<>();\n        for(int i=0;i<album.tracks.size();i++){');
}

const rowNeedle='row.addView(tm,new LinearLayout.LayoutParams(0,-2,1));';
if(album.includes(rowNeedle)&&!album.includes('trackStates.add(rowState);')){
    album=album.replace(rowNeedle,rowNeedle+'\n            String initialState=displayState.get(i)!=null?"Prêt":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));\n            TextView rowState=text(a,initialState,11.5f,"Prêt".equals(initialState)?Color.rgb(194,255,126):Color.rgb(148,159,175),false);\n            rowState.setGravity(Gravity.END|Gravity.CENTER_VERTICAL);\n            trackStates.add(rowState);\n            row.addView(rowState,new LinearLayout.LayoutParams(dp(a,wide?92:72),-2));');
}

const windowOld='p.width=Math.min(a.getResources().getDisplayMetrics().widthPixels-dp(a,20),dp(a,520));p.height=-2;p.gravity=Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL;p.dimAmount=.68f;p.y=dp(a,10);w.setAttributes(p);';
if(album.includes(windowOld)){
    album=album.replace(windowOld,'p.width=Math.min(a.getResources().getDisplayMetrics().widthPixels-dp(a,20),dp(a,wide?760:520));p.height=-2;p.gravity=wide?Gravity.CENTER:(Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);p.dimAmount=.68f;p.y=wide?0:dp(a,10);w.setAttributes(p);');
}

const autoNeedle='        if(autoStart)MAIN.postDelayed(()->{if(d.isShowing())play(a,album,s,play,status,d);},90);';
if(album.includes(autoNeedle)&&!album.includes('albumReferenceStateTicker')){
    album=album.replace(autoNeedle,`        final Runnable albumReferenceStateTicker=new Runnable(){public void run(){\n            if(!d.isShowing())return;\n            for(int i=0;i<trackStates.size();i++){\n                TextView stateView=trackStates.get(i);\n                boolean ready=displayState.get(i)!=null;\n                String label=ready?"Prêt":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));\n                stateView.setText(label);\n                stateView.setTextColor(ready?Color.rgb(194,255,126):Color.rgb(148,159,175));\n            }\n            if(!displayState.complete)MAIN.postDelayed(this,650);\n        }};\n        MAIN.post(albumReferenceStateTicker);\n        d.setOnDismissListener(x->MAIN.removeCallbacks(albumReferenceStateTicker));\n${autoNeedle}`);
}

await writeFile(albumPath,album,'utf8');
console.log('Audify V68.12.57: reference visual architecture applied to real native Album + Playlist pages.');
