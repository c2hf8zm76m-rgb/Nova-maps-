package com.nova.audify;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.ref.WeakReference;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

final class AudifyInstantAlbums {
    private static final String SERVICE="com.nova.audify.AudifyPlaybackService";
    private static final String TAG="AUDIFY_INSTANT_ALBUMS_V681256";
    private static final String TILE=TAG+"_TILE";
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final ExecutorService DETECT=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"AudifyAlbumDetect");t.setDaemon(true);return t;});
    private static final AtomicInteger GEN=new AtomicInteger();
    private static WeakReference<Activity> active=new WeakReference<>(null),scheduled=new WeakReference<>(null);
    private static volatile String observed="",albumFor="";
    private static volatile AudifyInstantAlbumMetadata.Album current;

    static final class Snap {String id="",title="",artist="",thumb="";}

    static void attach(Activity a){
        if(a==null)return;
        active=new WeakReference<>(a);
        install(a);
        poll(a);
        if(scheduled.get()!=a){scheduled=new WeakReference<>(a);schedule(a);}
    }

    private static void install(Activity a){
        View c=a.findViewById(android.R.id.content);
        if(!(c instanceof ViewGroup))return;
        ViewGroup root=(ViewGroup)c;
        if(root.findViewWithTag(TILE)!=null)return;
        FrameLayout host;
        if(root instanceof FrameLayout)host=(FrameLayout)root;
        else{host=new FrameLayout(a);root.addView(host,new ViewGroup.LayoutParams(-1,-1));}

        ImageView tile=new ImageView(a);
        tile.setTag(TILE);
        tile.setContentDescription("Ouvrir cet album");
        tile.setScaleType(ImageView.ScaleType.CENTER_CROP);
        tile.setVisibility(View.GONE);
        tile.setAlpha(0f);
        tile.setElevation(dp(a,10));
        GradientDrawable placeholder=new GradientDrawable();
        placeholder.setColor(Color.rgb(24,29,37));
        placeholder.setCornerRadius(dp(a,15));
        tile.setBackground(placeholder);
        if(Build.VERSION.SDK_INT>=21)tile.setClipToOutline(true);

        tile.setOnHoverListener((v,e)->{
            if(e.getAction()==MotionEvent.ACTION_HOVER_ENTER){
                v.animate().scaleX(1.045f).scaleY(1.045f).translationY(-dp(a,2)).setDuration(135).start();
                if(Build.VERSION.SDK_INT>=21)v.setElevation(dp(a,17));
            }else if(e.getAction()==MotionEvent.ACTION_HOVER_EXIT){
                v.animate().scaleX(1f).scaleY(1f).translationY(0).setDuration(145).start();
                if(Build.VERSION.SDK_INT>=21)v.setElevation(dp(a,10));
            }
            return false;
        });
        tile.setOnClickListener(v->{
            Snap s=snap();
            if(current!=null&&key(s).equals(albumFor))showAlbum(a,current,s,true);
            else if(!TextUtils.isEmpty(s.title))detect(a,s,true);
        });

        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(dp(a,84),dp(a,84),Gravity.BOTTOM|Gravity.START);
        lp.leftMargin=dp(a,20);
        lp.bottomMargin=dp(a,174);
        host.addView(tile,lp);
    }

    private static void schedule(Activity a){
        WeakReference<Activity> ref=new WeakReference<>(a);
        MAIN.postDelayed(new Runnable(){public void run(){
            Activity x=ref.get();
            if(x==null||x.isFinishing()||(Build.VERSION.SDK_INT>=17&&x.isDestroyed())||active.get()!=x)return;
            poll(x);
            MAIN.postDelayed(this,1300);
        }},900);
    }

    private static void poll(Activity a){
        Snap s=snap();String k=key(s);
        if(TextUtils.isEmpty(k)){observed="";albumFor="";current=null;hide(a);return;}
        if(!k.equals(observed)){
            observed=k;albumFor="";current=null;hide(a);
            int g=GEN.incrementAndGet();
            MAIN.postDelayed(()->{Snap n=snap();if(g==GEN.get()&&k.equals(key(n)))detect(a,n,false);},550);
        }else if(current!=null&&k.equals(albumFor))showCard(a,current,s);
    }

    private static void detect(Activity a,Snap s,boolean manual){
        String k=key(s);if(TextUtils.isEmpty(k))return;
        int g=GEN.incrementAndGet();
        DETECT.execute(()->{
            AudifyInstantAlbumMetadata.Album album=null;
            try{
                album=AudifyInstantAlbumMetadata.cached(a.getApplicationContext(),k);
                if(album==null){album=AudifyInstantAlbumMetadata.identify(s.title,s.artist);if(album!=null)AudifyInstantAlbumMetadata.cache(a.getApplicationContext(),k,album);}
            }catch(Throwable ignored){}
            AudifyInstantAlbumMetadata.Album out=album;
            MAIN.post(()->{
                Activity x=active.get();
                if(x==null||x.isFinishing()||!k.equals(key(snap())))return;
                if(!manual&&g!=GEN.get())return;
                if(out!=null&&out.tracks.size()>1){
                    current=out;albumFor=k;Snap now=snap();
                    showCard(x,out,now);
                    AudifyInstantAlbumResolver.ensure(x.getApplicationContext(),out,now.id,now.title,now.artist,now.thumb);
                    if(manual)showAlbum(x,out,now,true);
                }else if(manual)Toast.makeText(x,"Aucun album fiable trouvé pour ce morceau.",Toast.LENGTH_SHORT).show();
            });
        });
    }

    private static void showCard(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s){
        View c=a.findViewById(android.R.id.content);if(!(c instanceof ViewGroup))return;
        View v=((ViewGroup)c).findViewWithTag(TILE);if(!(v instanceof ImageView))return;
        ImageView tile=(ImageView)v;
        AudifyInstantAlbumArtwork.load(a,album,tile,s.thumb);
        if(tile.getVisibility()!=View.VISIBLE){
            tile.setVisibility(View.VISIBLE);tile.setAlpha(0f);tile.setScaleX(.92f);tile.setScaleY(.92f);
            tile.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(210).start();
        }
    }

    private static void hide(Activity a){
        View c=a.findViewById(android.R.id.content);if(!(c instanceof ViewGroup))return;
        View v=((ViewGroup)c).findViewWithTag(TILE);
        if(v!=null&&v.getVisibility()==View.VISIBLE)v.animate().alpha(0f).scaleX(.96f).scaleY(.96f).setDuration(130).withEndAction(()->v.setVisibility(View.GONE)).start();
    }

    private static void showAlbum(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s,boolean autoStart){
        Dialog d=new Dialog(a);
        d.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout panel=new LinearLayout(a);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(a,18),dp(a,16),dp(a,18),dp(a,17));
        GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{Color.rgb(16,21,29),Color.rgb(8,11,16)});
        bg.setCornerRadius(dp(a,28));
        bg.setStroke(dp(a,1),Color.argb(38,255,255,255));
        panel.setBackground(bg);

        LinearLayout top=new LinearLayout(a);top.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge=text(a,"ALBUM",10.5f,Color.rgb(202,255,148),true);badge.setGravity(Gravity.CENTER);badge.setPadding(dp(a,9),dp(a,5),dp(a,9),dp(a,5));
        GradientDrawable bb=new GradientDrawable();bb.setColor(Color.argb(32,168,255,63));bb.setCornerRadius(dp(a,20));badge.setBackground(bb);
        top.addView(badge,new LinearLayout.LayoutParams(-2,-2));
        View spacer=new View(a);top.addView(spacer,new LinearLayout.LayoutParams(0,1,1));
        TextView close=text(a,"×",22,Color.rgb(220,226,235),false);close.setGravity(Gravity.CENTER);close.setPadding(0,0,0,dp(a,2));
        GradientDrawable cb=new GradientDrawable();cb.setColor(Color.argb(24,255,255,255));cb.setCornerRadius(dp(a,14));close.setBackground(cb);
        top.addView(close,new LinearLayout.LayoutParams(dp(a,42),dp(a,42)));close.setOnClickListener(v->d.dismiss());
        panel.addView(top,full());

        LinearLayout hero=new LinearLayout(a);hero.setGravity(Gravity.CENTER_VERTICAL);hero.setPadding(0,dp(a,12),0,0);
        ImageView art=new ImageView(a);art.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable ab=new GradientDrawable();ab.setColor(Color.rgb(27,34,44));ab.setCornerRadius(dp(a,18));art.setBackground(ab);if(Build.VERSION.SDK_INT>=21)art.setClipToOutline(true);
        hero.addView(art,new LinearLayout.LayoutParams(dp(a,118),dp(a,118)));AudifyInstantAlbumArtwork.load(a,album,art,s.thumb);
        LinearLayout ht=new LinearLayout(a);ht.setOrientation(LinearLayout.VERTICAL);
        TextView title=text(a,album.title,29,Color.WHITE,true);title.setMaxLines(2);ht.addView(title,full());
        TextView artist=text(a,TextUtils.isEmpty(album.artist)?"Artiste inconnu":album.artist,15,Color.rgb(190,199,212),false);LinearLayout.LayoutParams ar=full();ar.topMargin=dp(a,5);ht.addView(artist,ar);
        String meta="";if(!TextUtils.isEmpty(album.date)&&album.date.length()>=4)meta=album.date.substring(0,4)+" · ";meta+=album.tracks.size()+" titres";
        TextView metaView=text(a,meta,12.5f,Color.rgb(138,149,165),false);LinearLayout.LayoutParams mp=full();mp.topMargin=dp(a,5);ht.addView(metaView,mp);
        LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(0,-2,1);hp.leftMargin=dp(a,16);hero.addView(ht,hp);panel.addView(hero,full());

        LinearLayout actions=new LinearLayout(a);actions.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams acp=full();acp.topMargin=dp(a,16);panel.addView(actions,acp);
        TextView play=text(a,"▶  Lire maintenant",14.5f,Color.rgb(7,14,8),true);play.setGravity(Gravity.CENTER);play.setPadding(dp(a,12),dp(a,13),dp(a,12),dp(a,13));GradientDrawable pb=new GradientDrawable();pb.setColor(Color.rgb(168,255,63));pb.setCornerRadius(dp(a,18));play.setBackground(pb);actions.addView(play,new LinearLayout.LayoutParams(0,-2,1));
        String saved=AudifyInstantAlbumLibrary.find(a,album);
        TextView save=text(a,TextUtils.isEmpty(saved)?"＋  Playlist":"✓  Enregistré",13.5f,Color.rgb(235,239,245),true);save.setGravity(Gravity.CENTER);save.setPadding(dp(a,10),dp(a,13),dp(a,10),dp(a,13));GradientDrawable sb=new GradientDrawable();sb.setColor(Color.argb(25,255,255,255));sb.setCornerRadius(dp(a,18));sb.setStroke(dp(a,1),Color.argb(34,255,255,255));save.setBackground(sb);LinearLayout.LayoutParams svp=new LinearLayout.LayoutParams(0,-2,1);svp.leftMargin=dp(a,10);actions.addView(save,svp);

        TextView status=text(a,"",11.5f,Color.rgb(151,162,178),false);LinearLayout.LayoutParams stp=full();stp.topMargin=dp(a,8);panel.addView(status,stp);

        TextView trackHead=text(a,"TRACKLIST",11.5f,Color.rgb(154,166,182),true);LinearLayout.LayoutParams thp=full();thp.topMargin=dp(a,16);panel.addView(trackHead,thp);
        ScrollView sc=new ScrollView(a);sc.setFillViewport(false);LinearLayout list=new LinearLayout(a);list.setOrientation(LinearLayout.VERTICAL);list.setPadding(0,dp(a,6),0,0);
        for(int i=0;i<album.tracks.size();i++){
            AudifyInstantAlbumMetadata.Track t=album.tracks.get(i);
            boolean now=i==album.current||AudifyInstantAlbumMetadata.similarity(s.title,t.title)>=2;
            LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(a,12),dp(a,10),dp(a,12),dp(a,10));
            GradientDrawable rb=new GradientDrawable();rb.setColor(now?Color.argb(34,168,255,63):Color.argb(18,255,255,255));rb.setCornerRadius(dp(a,13));row.setBackground(rb);
            TextView num=text(a,String.valueOf(t.position),12.5f,now?Color.rgb(191,255,122):Color.rgb(152,163,178),true);num.setGravity(Gravity.CENTER_VERTICAL);row.addView(num,new LinearLayout.LayoutParams(dp(a,38),-2));
            LinearLayout tm=new LinearLayout(a);tm.setOrientation(LinearLayout.VERTICAL);TextView tn=text(a,t.title,14,now?Color.rgb(205,255,158):Color.rgb(238,241,246),now);tn.setSingleLine(true);tn.setEllipsize(TextUtils.TruncateAt.END);tm.addView(tn,full());if(!TextUtils.isEmpty(t.artist)&&!AudifyInstantAlbumMetadata.norm(t.artist).equals(AudifyInstantAlbumMetadata.norm(album.artist))){TextView ta=text(a,t.artist,11.5f,Color.rgb(137,148,164),false);tm.addView(ta,full());}row.addView(tm,new LinearLayout.LayoutParams(0,-2,1));
            LinearLayout.LayoutParams rp=full();rp.topMargin=dp(a,5);list.addView(row,rp);
        }
        sc.addView(list,new ScrollView.LayoutParams(-1,-2));LinearLayout.LayoutParams sl=new LinearLayout.LayoutParams(-1,dp(a,300));sl.topMargin=dp(a,3);panel.addView(sc,sl);

        play.setOnClickListener(v->play(a,album,s,play,status,d));
        save.setOnClickListener(v->{String n=AudifyInstantAlbumLibrary.find(a,album);if(!TextUtils.isEmpty(n))AudifyInstantAlbumLibrary.open(a,n,d);else save(a,album,s,save,d);});

        d.setContentView(panel);
        d.show();
        Window w=d.getWindow();
        if(w!=null){
            w.setBackgroundDrawableResource(android.R.color.transparent);w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams p=new WindowManager.LayoutParams();p.copyFrom(w.getAttributes());
            p.width=Math.min(a.getResources().getDisplayMetrics().widthPixels-dp(a,20),dp(a,520));p.height=-2;p.gravity=Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL;p.dimAmount=.68f;p.y=dp(a,10);w.setAttributes(p);
        }
        if(autoStart)MAIN.postDelayed(()->{if(d.isShowing())play(a,album,s,play,status,d);},90);
    }

    private static void play(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s,TextView b,TextView status,Dialog d){
        if(!b.isEnabled())return;
        b.setEnabled(false);b.setAlpha(.86f);b.setText("Préparation…");status.setText("Le premier titre arrive en priorité. Le reste de la file se construit en arrière-plan.");
        AudifyInstantAlbumResolver.State st=AudifyInstantAlbumResolver.ensure(a,album,s.id,s.title,s.artist,s.thumb);
        long start=android.os.SystemClock.elapsedRealtime();
        MAIN.post(new Runnable(){public void run(){
            if(a.isFinishing()||!d.isShowing())return;
            AudifyInstantAlbumResolver.Playable first=st.get(0);
            if(first!=null){
                try{
                    ArrayList<AudifyInstantAlbumResolver.Playable> q=st.ready();
                    AudifyInstantAlbumResolver.launch(a,q);st.markPlaying();
                    b.setEnabled(true);b.setAlpha(1f);b.setText("▶  Lecture en cours");
                    status.setText(q.size()+" titre"+(q.size()>1?"s":"")+" prêt"+(q.size()>1?"s":"")+" · la file continue de se compléter.");
                }catch(Throwable e){b.setEnabled(true);b.setAlpha(1f);b.setText("▶  Réessayer");status.setText("Impossible de lancer ce titre.");}
                return;
            }
            if(st.complete||android.os.SystemClock.elapsedRealtime()-start>15000){
                b.setEnabled(true);b.setAlpha(1f);b.setText("▶  Réessayer");status.setText("Le premier titre n’a pas pu être préparé.");return;
            }
            MAIN.postDelayed(this,90);
        }});
    }

    private static void save(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s,TextView b,Dialog d){
        b.setEnabled(false);b.setText("Préparation…");
        AudifyInstantAlbumResolver.State st=AudifyInstantAlbumResolver.ensure(a,album,s.id,s.title,s.artist,s.thumb);
        long start=android.os.SystemClock.elapsedRealtime();
        MAIN.post(new Runnable(){public void run(){
            if(a.isFinishing()||!d.isShowing())return;
            if(st.complete||android.os.SystemClock.elapsedRealtime()-start>22000){
                ArrayList<AudifyInstantAlbumResolver.Playable> q=st.ready();
                if(q.isEmpty()){b.setEnabled(true);b.setText("＋  Playlist");return;}
                Runnable go=()->{try{AudifyInstantAlbumLibrary.save(a,album,q);b.setEnabled(true);b.setText("✓  Enregistré");Toast.makeText(a,"Album enregistré",Toast.LENGTH_SHORT).show();}catch(Throwable e){b.setEnabled(true);b.setText("＋  Playlist");Toast.makeText(a,"Impossible d’enregistrer l’album.",Toast.LENGTH_SHORT).show();}};
                if(q.size()<album.tracks.size())new AlertDialog.Builder(a).setTitle("Album partiellement retrouvé").setMessage(q.size()+" titres sur "+album.tracks.size()+" ont été retrouvés. Enregistrer ces titres dans leur ordre d’origine ?").setPositiveButton("Enregistrer",(x,y)->go.run()).setNegativeButton("Annuler",(x,y)->{b.setEnabled(true);b.setText("＋  Playlist");}).show();else go.run();return;
            }
            MAIN.postDelayed(this,180);
        }});
    }

    private static Snap snap(){Snap s=new Snap();try{Class<?> c=Class.forName(SERVICE);s.id=stat(c,"snapshotVideoId");s.title=stat(c,"snapshotTitle");s.artist=stat(c,"snapshotArtist");s.thumb=stat(c,"snapshotThumbnail");}catch(Throwable ignored){}return s;}
    private static String stat(Class<?> c,String n){try{Field f=c.getDeclaredField(n);f.setAccessible(true);Object v=f.get(null);return v==null?"":String.valueOf(v);}catch(Throwable e){return "";}}
    private static String key(Snap s){if(s==null||TextUtils.isEmpty(s.title))return "";return (TextUtils.isEmpty(s.id)?"":s.id+"|")+AudifyInstantAlbumMetadata.norm(s.title)+"|"+AudifyInstantAlbumMetadata.norm(s.artist);}
    private static TextView text(Activity a,String s,float z,int c,boolean bold){TextView v=new TextView(a);v.setText(s);v.setTextSize(z);v.setTextColor(c);if(bold)v.setTypeface(Typeface.DEFAULT_BOLD);return v;}
    private static LinearLayout.LayoutParams full(){return new LinearLayout.LayoutParams(-1,-2);}
    private static int dp(Context c,int x){return Math.round(x*c.getResources().getDisplayMetrics().density);}
}
