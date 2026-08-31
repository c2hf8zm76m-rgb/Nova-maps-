import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// -----------------------------------------------------------------------------
// 1) Bibliothèque persistante enrichie : likes, playlists + récents.
// -----------------------------------------------------------------------------
const store=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Audify V68.9 — bibliothèque locale + historique récent. */
public final class AudifyLibraryStore {
    private static final String PREFS = "audify_native_library_v679";
    private static final String KEY_LIKES = "likes_json";
    private static final String KEY_PLAYLISTS = "playlists_json";
    private static final String KEY_RECENTS = "recents_json";
    private static final int MAX_RECENTS = 24;

    public static final class Track {
        public final String id;
        public final String title;
        public final String artist;
        public final String thumbnail;

        public Track(String id,String title,String artist,String thumbnail){
            this.id=id==null?"":id;
            this.title=title==null||title.isEmpty()?"Sans titre":title;
            this.artist=artist==null||artist.isEmpty()?"YouTube":artist;
            this.thumbnail=thumbnail==null?"":thumbnail;
        }

        JSONObject toJson(){
            JSONObject o=new JSONObject();
            try{
                o.put("id",id); o.put("title",title); o.put("artist",artist); o.put("thumbnail",thumbnail);
            }catch(Exception ignored){}
            return o;
        }

        static Track fromJson(JSONObject o){
            if(o==null) return null;
            String id=o.optString("id","");
            if(id.isEmpty()) return null;
            return new Track(id,o.optString("title","Sans titre"),o.optString("artist","YouTube"),o.optString("thumbnail",""));
        }
    }

    private final SharedPreferences prefs;
    public AudifyLibraryStore(Context context){ prefs=context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE); }

    private JSONArray readArray(String key){
        try{return new JSONArray(prefs.getString(key,"[]"));}catch(Exception ignored){return new JSONArray();}
    }
    private JSONObject readPlaylistsObject(){
        try{return new JSONObject(prefs.getString(KEY_PLAYLISTS,"{}"));}catch(Exception ignored){return new JSONObject();}
    }
    private void saveArray(String key,JSONArray arr){ prefs.edit().putString(key,arr.toString()).apply(); }
    private void savePlaylists(JSONObject obj){ prefs.edit().putString(KEY_PLAYLISTS,obj.toString()).apply(); }

    public boolean isLiked(String id){
        if(id==null||id.isEmpty()) return false;
        JSONArray arr=readArray(KEY_LIKES);
        for(int i=0;i<arr.length();i++){
            JSONObject o=arr.optJSONObject(i);
            if(o!=null&&id.equals(o.optString("id",""))) return true;
        }
        return false;
    }

    public boolean toggleLike(Track track){
        if(track==null||track.id.isEmpty()) return false;
        JSONArray old=readArray(KEY_LIKES),next=new JSONArray();
        boolean found=false;
        for(int i=0;i<old.length();i++){
            JSONObject o=old.optJSONObject(i); if(o==null) continue;
            if(track.id.equals(o.optString("id",""))){found=true;continue;}
            next.put(o);
        }
        if(!found) next.put(track.toJson());
        saveArray(KEY_LIKES,next);
        return !found;
    }

    public List<Track> getLikes(){ return readTracks(readArray(KEY_LIKES)); }

    public void addRecent(Track track){
        if(track==null||track.id.isEmpty()) return;
        JSONArray old=readArray(KEY_RECENTS),next=new JSONArray();
        next.put(track.toJson());
        int kept=1;
        for(int i=0;i<old.length()&&kept<MAX_RECENTS;i++){
            JSONObject o=old.optJSONObject(i); if(o==null) continue;
            if(track.id.equals(o.optString("id",""))) continue;
            next.put(o); kept++;
        }
        saveArray(KEY_RECENTS,next);
    }

    public List<Track> getRecents(){ return readTracks(readArray(KEY_RECENTS)); }

    private List<Track> readTracks(JSONArray arr){
        ArrayList<Track> out=new ArrayList<>();
        for(int i=0;i<arr.length();i++){
            Track t=Track.fromJson(arr.optJSONObject(i)); if(t!=null) out.add(t);
        }
        return out;
    }

    public List<String> getPlaylistNames(){
        ArrayList<String> out=new ArrayList<>();
        JSONObject root=readPlaylistsObject();
        java.util.Iterator<String> it=root.keys(); while(it.hasNext()) out.add(it.next());
        Collections.sort(out,String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    public void createPlaylist(String rawName){
        String name=rawName==null?"":rawName.trim(); if(name.isEmpty()) name="Ma playlist";
        JSONObject root=readPlaylistsObject();
        if(root.optJSONArray(name)==null){
            try{root.put(name,new JSONArray());}catch(Exception ignored){}
            savePlaylists(root);
        }
    }

    public void addToPlaylist(String rawName,Track track){
        if(track==null||track.id.isEmpty()) return;
        String name=rawName==null?"":rawName.trim(); if(name.isEmpty()) name="Ma playlist";
        JSONObject root=readPlaylistsObject(); JSONArray arr=root.optJSONArray(name); if(arr==null) arr=new JSONArray();
        boolean exists=false;
        for(int i=0;i<arr.length();i++){
            JSONObject o=arr.optJSONObject(i); if(o!=null&&track.id.equals(o.optString("id",""))){exists=true;break;}
        }
        if(!exists) arr.put(track.toJson());
        try{root.put(name,arr);}catch(Exception ignored){}
        savePlaylists(root);
    }

    public List<Track> getPlaylist(String name){
        JSONObject root=readPlaylistsObject(); JSONArray arr=root.optJSONArray(name==null?"":name);
        return arr==null?new ArrayList<>():readTracks(arr);
    }

    public String queueJson(List<Track> tracks,int index){
        JSONObject root=new JSONObject(); JSONArray arr=new JSONArray();
        if(tracks!=null) for(Track t:tracks) if(t!=null&&!t.id.isEmpty()) arr.put(t.toJson());
        try{
            root.put("items",arr);
            root.put("index",Math.max(0,Math.min(Math.max(0,arr.length()-1),index)));
        }catch(Exception ignored){}
        return root.toString();
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyLibraryStore.java'),store,'utf8');

// -----------------------------------------------------------------------------
// 2) Historique automatique au niveau du service ExoPlayer.
// -----------------------------------------------------------------------------
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
if(!service.includes('private String lastRecentVideoId = "";')) {
  service=service.replace(
    'private static volatile String snapshotThumbnail = "";',
    'private static volatile String snapshotThumbnail = "";\n    private String lastRecentVideoId = "";'
  );
}
const recentNeedle='            snapshotThumbnail = current.mediaMetadata.artworkUri == null ? "" : current.mediaMetadata.artworkUri.toString();';
if(!service.includes(recentNeedle)) throw new Error('Métadonnées snapshot service introuvables V68.9');
service=service.replace(recentNeedle,recentNeedle+String.raw`
            if (!snapshotVideoId.isEmpty() && !snapshotVideoId.equals(lastRecentVideoId)) {
                lastRecentVideoId = snapshotVideoId;
                try {
                    new AudifyLibraryStore(this).addRecent(
                        new AudifyLibraryStore.Track(snapshotVideoId,snapshotTitle,snapshotArtist,snapshotThumbnail)
                    );
                } catch (Throwable ignored) {}
            }`);
await writeFile(servicePath,service,'utf8');

// -----------------------------------------------------------------------------
// 3) Home natif totalement refondu d'après Audify Web.
// -----------------------------------------------------------------------------
const home=String.raw`package com.nova.audify;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Audify V68.9 — Home natif inspiré du Home Web : récents, favoris, playlists. */
public class NativeHomeActivity extends AppCompatActivity {
    private static final int ACCENT=Color.rgb(157,255,50);
    private AudifyLibraryStore store;
    private LinearLayout libraryContent;
    private LinearLayout miniPlayer;
    private TextView miniTitle;
    private TextView miniArtist;
    private Button miniToggle;
    private SeekBar miniTimeline;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService images=Executors.newFixedThreadPool(4);
    private boolean userSeeking=false;
    private double durationSeconds=0.0;
    private AudifyLibraryStore.Track snapshotTrack;
    private String lastHomeTrackId="";

    private final Runnable ticker=new Runnable(){
        @Override public void run(){ refreshMiniPlayer(); handler.postDelayed(this,300); }
    };

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        if(getSupportActionBar()!=null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(4,7,11));
        store=new AudifyLibraryStore(this);

        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5,8,12));

        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        libraryContent=new LinearLayout(this);
        libraryContent.setOrientation(LinearLayout.VERTICAL);
        libraryContent.setPadding(dp(12),dp(14),dp(12),dp(155));
        scroll.addView(libraryContent,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        miniPlayer=buildMiniPlayer();
        FrameLayout.LayoutParams miniLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(130),Gravity.BOTTOM);
        miniLp.setMargins(dp(10),0,dp(10),dp(8));
        root.addView(miniPlayer,miniLp);

        setContentView(root);
        rebuildLibrary();
        refreshMiniPlayer();
    }

    private void rebuildLibrary(){
        libraryContent.removeAllViews();
        addSearchHeader();
        addRecentSection();
        addFavoritesIntro();
        addLikesSection();
        addPlaylistsSection();
    }

    private void addSearchHeader(){
        LinearLayout row=new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(14),dp(6),dp(8),dp(6));
        row.setBackground(round(Color.rgb(27,32,40),dp(1),Color.rgb(75,82,94),dp(30)));
        TextView hint=text("⌕  Rechercher un artiste ou un titre…",16f,false);
        hint.setTextColor(Color.rgb(160,168,181));
        hint.setMaxLines(1); hint.setEllipsize(TextUtils.TruncateAt.END);
        hint.setOnClickListener(v->openSearch());
        row.addView(hint,new LinearLayout.LayoutParams(0,dp(58),1f));
        Button search=greenButton("Rechercher");
        search.setOnClickListener(v->openSearch());
        row.addView(search,new LinearLayout.LayoutParams(dp(138),dp(52)));
        libraryContent.addView(row,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(68)));
    }

    private void addRecentSection(){
        List<AudifyLibraryStore.Track> recents=store.getRecents();
        LinearLayout panel=sectionPanel();
        LinearLayout head=new LinearLayout(this); head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Écoutés récemment",23f,true);
        head.addView(title,new LinearLayout.LayoutParams(0,dp(56),1f));
        Button all=pillButton("Tout voir");
        all.setOnClickListener(v->showTrackPicker("Écoutés récemment",recents));
        head.addView(all,new LinearLayout.LayoutParams(dp(105),dp(48)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        if(recents.isEmpty()){
            TextView empty=text("Tes prochains morceaux écoutés apparaîtront ici.",15f,false);
            empty.setTextColor(Color.rgb(160,169,182)); empty.setPadding(0,dp(12),0,dp(18));
            panel.addView(empty);
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false); hsv.setFillViewport(false);
            LinearLayout rail=new LinearLayout(this); rail.setOrientation(LinearLayout.HORIZONTAL);
            int screenW=getResources().getDisplayMetrics().widthPixels;
            int cardW=Math.min(dp(330),Math.max(dp(250),(int)(screenW*0.72f)));
            int cover=cardW-dp(22);
            for(int i=0;i<Math.min(12,recents.size());i++){
                AudifyLibraryStore.Track t=recents.get(i);
                LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(10),dp(10),dp(10),dp(10));
                card.setBackground(round(Color.rgb(14,19,26),dp(1),Color.rgb(49,58,70),dp(22)));
                card.setOnClickListener(v->playTrack(t));
                ImageView art=artworkView(); loadImage(art,t.thumbnail);
                card.addView(art,new LinearLayout.LayoutParams(cover,cover));
                TextView tt=text(t.title,18f,true); tt.setMaxLines(2); tt.setEllipsize(TextUtils.TruncateAt.END); tt.setPadding(dp(2),dp(10),0,0);
                card.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));
                TextView aa=text(t.artist,14f,false); aa.setTextColor(Color.rgb(166,176,190)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
                card.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));
                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(cardW,cover+dp(104)); cp.rightMargin=dp(12);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        addPanel(panel,dp(16));
    }

    private void addFavoritesIntro(){
        LinearLayout intro=sectionPanel();
        TextView h=text("Mes favoris",28f,true); intro.addView(h);
        TextView sub=text("Tous les titres que tu likes apparaissent ici automatiquement.",16f,false);
        sub.setTextColor(Color.rgb(178,187,201)); sub.setPadding(0,dp(7),0,dp(2));
        intro.addView(sub);
        addPanel(intro,dp(16));
    }

    private void addLikesSection(){
        List<AudifyLibraryStore.Track> likes=store.getLikes();
        LinearLayout panel=sectionPanel();
        LinearLayout head=new LinearLayout(this); head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Titres likés",23f,true); head.addView(title);
        TextView count=text("  "+likes.size()+" favoris",14f,false); count.setTextColor(Color.rgb(173,183,197));
        head.addView(count,new LinearLayout.LayoutParams(0,dp(54),1f));
        Button all=pillButton("Voir tous les favoris"); all.setTextSize(13f); all.setOnClickListener(v->showTrackPicker("Titres likés",likes));
        head.addView(all,new LinearLayout.LayoutParams(dp(170),dp(48)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        if(likes.isEmpty()){
            TextView empty=text("Aucun favori pour l’instant.",15f,false); empty.setTextColor(Color.rgb(155,165,178));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));
        }else{
            int shown=Math.min(6,likes.size());
            for(int i=0;i<shown;i+=2){
                LinearLayout row=new LinearLayout(this); row.setGravity(Gravity.CENTER_VERTICAL);
                row.addView(likeCard(likes.get(i)),new LinearLayout.LayoutParams(0,dp(108),1f));
                if(i+1<shown){
                    LinearLayout.LayoutParams second=new LinearLayout.LayoutParams(0,dp(108),1f); second.leftMargin=dp(8);
                    row.addView(likeCard(likes.get(i+1)),second);
                }else{
                    View blank=new View(this); LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(0,dp(108),1f); bp.leftMargin=dp(8); row.addView(blank,bp);
                }
                LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(114)); rp.topMargin=dp(5); panel.addView(row,rp);
            }
        }
        addPanel(panel,dp(16));
    }

    private View likeCard(AudifyLibraryStore.Track t){
        LinearLayout card=new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(8),dp(8),dp(7),dp(8));
        card.setBackground(round(Color.rgb(13,18,25),dp(1),Color.rgb(47,56,69),dp(18)));
        ImageView art=artworkView(); loadImage(art,t.thumbnail); card.addView(art,new LinearLayout.LayoutParams(dp(72),dp(72)));
        LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setPadding(dp(9),0,dp(4),0); info.setOnClickListener(v->playTrack(t));
        TextView tt=text(t.title,15f,true); tt.setMaxLines(2); tt.setEllipsize(TextUtils.TruncateAt.END);
        TextView aa=text(t.artist,12f,false); aa.setTextColor(Color.rgb(166,175,188)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48))); info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(24)));
        card.addView(info,new LinearLayout.LayoutParams(0,dp(76),1f));
        LinearLayout actions=new LinearLayout(this); actions.setOrientation(LinearLayout.VERTICAL); actions.setGravity(Gravity.CENTER);
        Button queue=smallSquare("≡+"); queue.setContentDescription("Ajouter à la file"); queue.setOnClickListener(v->enqueueTrack(t));
        Button heart=smallSquare("♥"); heart.setTextColor(Color.rgb(255,79,119)); heart.setContentDescription("Retirer des favoris");
        heart.setOnClickListener(v->{store.toggleLike(t);rebuildLibrary();});
        actions.addView(queue,new LinearLayout.LayoutParams(dp(44),dp(40))); actions.addView(heart,new LinearLayout.LayoutParams(dp(44),dp(40)));
        card.addView(actions,new LinearLayout.LayoutParams(dp(48),dp(84)));
        return card;
    }

    private void addPlaylistsSection(){
        List<String> names=store.getPlaylistNames();
        LinearLayout panel=sectionPanel();
        LinearLayout head=new LinearLayout(this); head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Playlists",24f,true); head.addView(title,new LinearLayout.LayoutParams(0,dp(62),1f));
        Button create=greenButton("＋ Créer une playlist"); create.setTextSize(14f); create.setOnClickListener(v->promptCreatePlaylist());
        head.addView(create,new LinearLayout.LayoutParams(dp(190),dp(54)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(68)));

        if(names.isEmpty()){
            TextView empty=text("Crée ta première playlist pour la retrouver ici.",15f,false); empty.setTextColor(Color.rgb(155,165,178));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(64)));
        }else{
            int screenW=getResources().getDisplayMetrics().widthPixels;
            int artH=Math.min(dp(260),Math.max(dp(190),(int)(screenW*0.44f)));
            for(String name:names){
                List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
                LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(12),dp(12),dp(12),dp(12));
                card.setBackground(round(Color.rgb(13,18,25),dp(1),Color.rgb(48,57,69),dp(24)));
                ImageView art=artworkView();
                if(!tracks.isEmpty()) loadImage(art,tracks.get(0).thumbnail);
                else art.setBackgroundColor(Color.rgb(31,37,47));
                card.addView(art,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artH));
                TextView nameView=text(name,20f,true); nameView.setPadding(dp(4),dp(10),0,0); card.addView(nameView,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));
                TextView meta=text(tracks.size()+" titre"+(tracks.size()>1?"s":""),15f,false); meta.setTextColor(Color.rgb(177,186,199)); meta.setPadding(dp(4),0,0,0);
                card.addView(meta,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(32)));
                Button open=pillButton("Ouvrir"); open.setTextSize(17f); open.setOnClickListener(v->showPlaylist(name));
                LinearLayout.LayoutParams op=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)); op.topMargin=dp(8); card.addView(open,op);
                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artH+dp(174)); cp.topMargin=dp(12); panel.addView(card,cp);
            }
        }
        addPanel(panel,dp(16));
    }

    private LinearLayout buildMiniPlayer(){
        LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(14),dp(8),dp(14),dp(7));
        card.setBackground(round(Color.rgb(27,32,40),dp(1),Color.rgb(74,83,96),dp(24))); card.setVisibility(View.GONE);
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setPadding(0,0,dp(8),0); info.setOnClickListener(v->openCurrentPlayer());
        miniTitle=text("",16f,true); miniTitle.setMaxLines(1); miniTitle.setEllipsize(TextUtils.TruncateAt.END);
        miniArtist=text("",13f,false); miniArtist.setTextColor(Color.rgb(174,183,196)); miniArtist.setMaxLines(1); miniArtist.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(miniTitle); info.addView(miniArtist); top.addView(info,new LinearLayout.LayoutParams(0,dp(58),1f));
        miniToggle=greenButton("Pause"); miniToggle.setTextSize(14f); miniToggle.setOnClickListener(v->{
            try{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));}catch(Exception ignored){}
            handler.postDelayed(this::refreshMiniPlayer,70);
        });
        top.addView(miniToggle,new LinearLayout.LayoutParams(dp(100),dp(50))); card.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));
        miniTimeline=new SeekBar(this); miniTimeline.setMax(1000); miniTimeline.setPadding(0,0,0,0);
        miniTimeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){userSeeking=true;}
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,durationSeconds)*(s.getProgress()/1000.0);
                try{startService(new Intent(NativeHomeActivity.this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SEEK).putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));}catch(Exception ignored){}
                userSeeking=false; handler.postDelayed(NativeHomeActivity.this::refreshMiniPlayer,80);
            }
        });
        card.addView(miniTimeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));
        return card;
    }

    private void refreshMiniPlayer(){
        try{
            JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());
            String id=state.optString("videoId","");
            if(id.isEmpty()){miniPlayer.setVisibility(View.GONE);snapshotTrack=null;return;}
            String title=state.optString("title","Sans titre"),artist=state.optString("artist","YouTube"),thumbnail=state.optString("thumbnail","");
            snapshotTrack=new AudifyLibraryStore.Track(id,title,artist,thumbnail);
            miniPlayer.setVisibility(View.VISIBLE); miniTitle.setText(title); miniArtist.setText(artist);
            boolean playing=state.optBoolean("playing",false); miniToggle.setText(playing?"Pause":"Lecture");
            double position=Math.max(0.0,state.optDouble("position",0.0)); durationSeconds=Math.max(0.0,state.optDouble("duration",0.0));
            if(!userSeeking){int p=durationSeconds>0?(int)Math.max(0,Math.min(1000,Math.round(position/durationSeconds*1000.0))):0; miniTimeline.setProgress(p);}
            if(!id.equals(lastHomeTrackId)){
                lastHomeTrackId=id; store.addRecent(snapshotTrack); handler.postDelayed(this::rebuildLibrary,40);
            }
        }catch(Exception ignored){}
    }

    private void openSearch(){
        Intent i=new Intent(this,MainActivity.class); i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP); startActivity(i);
    }

    private void openCurrentPlayer(){
        if(snapshotTrack==null||snapshotTrack.id.isEmpty()) return;
        startActivity(new Intent(this,NativePlayerActivity.class).putExtra("videoId",snapshotTrack.id).putExtra("title",snapshotTrack.title).putExtra("artist",snapshotTrack.artist).putExtra("thumbnail",snapshotTrack.thumbnail));
    }

    private void playTrack(AudifyLibraryStore.Track chosen){
        if(chosen==null||chosen.id.isEmpty()) return;
        try{
            ArrayList<AudifyLibraryStore.Track> single=new ArrayList<>(); single.add(chosen);
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SET_QUEUE).putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(single,0)));
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,chosen.id).putExtra(AudifyPlaybackService.EXTRA_TITLE,chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,chosen.artist).putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,chosen.thumbnail));
        }catch(Exception ignored){}
        store.addRecent(chosen); snapshotTrack=chosen; openCurrentPlayer();
    }

    private void enqueueTrack(AudifyLibraryStore.Track t){
        if(t==null||t.id.isEmpty()) return;
        try{
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_ENQUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,t.id).putExtra(AudifyPlaybackService.EXTRA_TITLE,t.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,t.artist).putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,t.thumbnail));
            Toast.makeText(this,"Ajouté à la file : "+t.title,Toast.LENGTH_SHORT).show();
        }catch(Exception ignored){}
    }

    private void showPlaylist(String name){
        List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
        if(tracks.isEmpty()){Toast.makeText(this,"Cette playlist est vide",Toast.LENGTH_SHORT).show();return;}
        showTrackPicker(name,tracks);
    }

    private void showTrackPicker(String title,List<AudifyLibraryStore.Track> tracks){
        if(tracks==null||tracks.isEmpty()) return;
        String[] labels=new String[tracks.size()]; for(int i=0;i<tracks.size();i++) labels[i]=tracks.get(i).title+"\n"+tracks.get(i).artist;
        new AlertDialog.Builder(this).setTitle(title).setItems(labels,(d,which)->playTrack(tracks.get(which))).setNegativeButton("Fermer",null).show();
    }

    private void promptCreatePlaylist(){
        EditText input=new EditText(this); input.setHint("Nom de la playlist"); input.setSingleLine(true); input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); input.setPadding(dp(20),dp(16),dp(20),dp(16));
        new AlertDialog.Builder(this).setTitle("Créer une playlist").setView(input).setPositiveButton("Créer",(d,w)->{
            String name=input.getText()==null?"":input.getText().toString().trim(); if(name.isEmpty()) name="Ma playlist";
            store.createPlaylist(name); rebuildLibrary();
        }).setNegativeButton("Annuler",null).show();
    }

    private LinearLayout sectionPanel(){
        LinearLayout p=new LinearLayout(this); p.setOrientation(LinearLayout.VERTICAL); p.setPadding(dp(14),dp(12),dp(14),dp(14));
        p.setBackground(round(Color.rgb(11,16,22),dp(1),Color.rgb(48,56,67),dp(24))); return p;
    }
    private void addPanel(View panel,int top){ LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); lp.topMargin=top; libraryContent.addView(panel,lp); }

    private GradientDrawable round(int fill,int strokeWidth,int stroke,int radius){
        GradientDrawable d=new GradientDrawable(); d.setColor(fill); d.setCornerRadius(radius); if(strokeWidth>0)d.setStroke(strokeWidth,stroke); return d;
    }

    private ImageView artworkView(){
        ImageView i=new ImageView(this); i.setScaleType(ImageView.ScaleType.CENTER_CROP); i.setBackgroundColor(Color.rgb(25,31,40)); i.setClipToOutline(true);
        i.setOutlineProvider(new ViewOutlineProvider(){@Override public void getOutline(View v,Outline o){o.setRoundRect(0,0,v.getWidth(),v.getHeight(),dp(18));}}); return i;
    }

    private void loadImage(ImageView view,String url){
        if(url==null||url.isEmpty()) return;
        images.execute(()->{
            Bitmap bitmap=null; HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(url).openConnection(); connection.setConnectTimeout(8000); connection.setReadTimeout(8000); connection.setRequestProperty("User-Agent","Audify/68.9"); connection.connect();
                try(InputStream in=connection.getInputStream()){bitmap=BitmapFactory.decodeStream(in);}
            }catch(Exception ignored){} finally{if(connection!=null) connection.disconnect();}
            Bitmap ready=bitmap;
            if(ready!=null) runOnUiThread(()->{if(!isFinishing()&&!isDestroyed()) view.setImageBitmap(ready);});
        });
    }

    private Button greenButton(String label){
        Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextSize(15f); b.setTextColor(Color.rgb(7,13,8)); b.setTypeface(b.getTypeface(),android.graphics.Typeface.BOLD); b.setPadding(dp(8),0,dp(8),0); b.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(28))); return b;
    }
    private Button pillButton(String label){
        Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextSize(14f); b.setTextColor(Color.WHITE); b.setTypeface(b.getTypeface(),android.graphics.Typeface.BOLD); b.setPadding(dp(8),0,dp(8),0); b.setBackground(round(Color.rgb(29,34,42),dp(1),Color.rgb(69,76,87),dp(24))); return b;
    }
    private Button smallSquare(String label){
        Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextSize(14f); b.setTextColor(Color.WHITE); b.setPadding(0,0,0,0); b.setBackground(round(Color.rgb(28,34,43),dp(1),Color.rgb(62,71,83),dp(13))); return b;
    }
    private TextView text(String value,float size,boolean bold){
        TextView t=new TextView(this); t.setText(value); t.setTextColor(Color.WHITE); t.setTextSize(size); if(bold)t.setTypeface(t.getTypeface(),android.graphics.Typeface.BOLD); t.setGravity(Gravity.CENTER_VERTICAL); return t;
    }

    @Override protected void onResume(){super.onResume();rebuildLibrary();handler.removeCallbacks(ticker);handler.post(ticker);}
    @Override protected void onPause(){handler.removeCallbacks(ticker);super.onPause();}
    @Override protected void onDestroy(){images.shutdownNow();super.onDestroy();}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
`;
await writeFile(path.join(pkgDir,'NativeHomeActivity.java'),home,'utf8');

console.log('Audify Android V68.9 : Home Web-style natif, récents carrousel, likes grille, grandes playlists.');
