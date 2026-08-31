import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const repoRoot=path.resolve(root,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const webBasePath=path.join(repoRoot,'audify','index-v21.html');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.11.0 méthode introuvable: ${label}`);
}

const webBase=await readFile(webBasePath,'utf8');
const keyMatch=webBase.match(/const KEY='([^']+)'/);
if(!keyMatch) throw new Error('V68.11.0 clé YouTube historique introuvable');
const youtubeKey=keyMatch[1];

// =============================================================================
// 1) Discovery Agent 2.0 : empreinte d'œuvre + 2 titres max du même artiste.
// =============================================================================
const discovery=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.text.Html;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Audify V68.11.0 — Discovery Agent 2.0 : deux titres max du seed + anti-réupload par empreinte. */
public final class AudifyDiscoveryAgent {
    private static final String PREFS="audify_discovery_v68110";
    private static final String KEY_SEED="seed_id";
    private static final String KEY_RESULTS="results_json";
    private static final String KEY_UPDATED="updated_at";
    private static final String YOUTUBE_KEY="${youtubeKey}";
    private static final long CACHE_MS=6L*60L*60L*1000L;
    private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
    private static final AtomicBoolean IN_FLIGHT=new AtomicBoolean(false);

    private static final int MODE_ANY=0;
    private static final int MODE_SEED_ONLY=1;
    private static final int MODE_OTHERS_ONLY=2;

    public interface Callback { void onFinished(boolean changed); }

    private final Context app;
    private final SharedPreferences prefs;
    private final AudifyAffinityStore affinity;
    private final AudifyLibraryStore library;

    public AudifyDiscoveryAgent(Context context){
        app=context.getApplicationContext();
        prefs=app.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        affinity=new AudifyAffinityStore(app);
        library=new AudifyLibraryStore(app);
    }

    public List<AudifyLibraryStore.Track> getCached(String seedId){
        ArrayList<AudifyLibraryStore.Track> out=new ArrayList<>();
        if(seedId==null||seedId.isEmpty()) return out;
        if(!seedId.equals(prefs.getString(KEY_SEED,""))) return out;
        try{
            JSONArray arr=new JSONArray(prefs.getString(KEY_RESULTS,"[]"));
            for(int i=0;i<arr.length();i++){
                AudifyLibraryStore.Track t=AudifyLibraryStore.Track.fromJson(arr.optJSONObject(i));
                if(t!=null&&!t.id.isEmpty()) out.add(t);
            }
        }catch(Throwable ignored){}
        return out;
    }

    public boolean cacheIsFresh(String seedId){
        if(seedId==null||seedId.isEmpty()) return false;
        if(!seedId.equals(prefs.getString(KEY_SEED,""))) return false;
        if(getCached(seedId).isEmpty()) return false;
        return System.currentTimeMillis()-prefs.getLong(KEY_UPDATED,0L)<CACHE_MS;
    }

    public boolean isSameArtist(AudifyLibraryStore.Track a,AudifyLibraryStore.Track b){
        if(a==null||b==null) return false;
        return sameArtist(canonicalArtist(a.title,a.artist),canonicalArtist(b.title,b.artist));
    }

    public void ensureRecommendations(AudifyLibraryStore.Track seed,Set<String> knownArtists,String genre,Callback callback){
        if(seed==null||seed.id.isEmpty()){
            if(callback!=null) callback.onFinished(false);
            return;
        }
        if(cacheIsFresh(seed.id)){
            if(callback!=null) callback.onFinished(false);
            return;
        }
        if(!IN_FLIGHT.compareAndSet(false,true)) return;

        final LinkedHashSet<String> known=new LinkedHashSet<>();
        if(knownArtists!=null){
            for(String raw:knownArtists){
                String n=normalizeArtist(raw);
                if(!n.isEmpty()) known.add(n);
            }
        }

        final LinkedHashSet<String> knownSongs=new LinkedHashSet<>();
        for(AudifyLibraryStore.Track t:library.getRecents()){
            if(t==null) continue;
            String a=canonicalArtist(t.title,t.artist); if(!a.isEmpty()) known.add(a);
            String s=songKey(t.title); if(!s.isEmpty()) knownSongs.add(s);
        }
        for(AudifyLibraryStore.Track t:library.getLikes()){
            if(t==null) continue;
            String a=canonicalArtist(t.title,t.artist); if(!a.isEmpty()) known.add(a);
            String s=songKey(t.title); if(!s.isEmpty()) knownSongs.add(s);
        }
        String seedSong=songKey(seed.title); if(!seedSong.isEmpty()) knownSongs.add(seedSong);
        final String safeGenre=genre==null?"":genre.trim();

        EXECUTOR.execute(()->{
            boolean changed=false;
            try{
                LinkedHashMap<String,AudifyLibraryStore.Track> sameArtistTracks=new LinkedHashMap<>();
                LinkedHashMap<String,AudifyLibraryStore.Track> otherTracks=new LinkedHashMap<>();
                LinkedHashSet<String> otherArtists=new LinkedHashSet<>();
                LinkedHashSet<String> selectedSongs=new LinkedHashSet<>(knownSongs);

                String seedArtistDisplay=seedArtistDisplay(seed);

                // Priorité absolue : jusqu'à deux AUTRES titres du même artiste.
                if(!seedArtistDisplay.isEmpty()){
                    collectSearch(seedArtistDisplay+" official audio",seed,known,selectedSongs,otherArtists,sameArtistTracks,otherTracks,MODE_SEED_ONLY);
                    if(sameArtistTracks.size()<2)
                        collectSearch(seedArtistDisplay+" topic",seed,known,selectedSongs,otherArtists,sameArtistTracks,otherTracks,MODE_SEED_ONLY);
                }

                // Radio liée au morceau : peut compléter le seed puis fournit les artistes voisins.
                collectRelated(seed,known,selectedSongs,otherArtists,sameArtistTracks,otherTracks,MODE_ANY);

                // Découverte d'artistes similaires, un seul titre par artiste.
                if(otherTracks.size()<10&&!seedArtistDisplay.isEmpty())
                    collectSearch("music similar to "+seedArtistDisplay,seed,known,selectedSongs,otherArtists,sameArtistTracks,otherTracks,MODE_OTHERS_ONLY);

                if(otherTracks.size()<10&&!safeGenre.isEmpty())
                    collectSearch(safeGenre+" music artists",seed,known,selectedSongs,otherArtists,sameArtistTracks,otherTracks,MODE_OTHERS_ONLY);

                if(otherTracks.size()<8&&!seedArtistDisplay.isEmpty())
                    collectSearch(seedArtistDisplay+" radio music",seed,known,selectedSongs,otherArtists,sameArtistTracks,otherTracks,MODE_OTHERS_ONLY);

                JSONArray saved=new JSONArray();
                int sameCount=0;
                for(AudifyLibraryStore.Track t:sameArtistTracks.values()){
                    if(sameCount++>=2) break;
                    saved.put(t.toJson());
                }
                int total=saved.length();
                for(AudifyLibraryStore.Track t:otherTracks.values()){
                    if(total++>=12) break;
                    saved.put(t.toJson());
                }

                if(saved.length()>0){
                    prefs.edit()
                        .putString(KEY_SEED,seed.id)
                        .putString(KEY_RESULTS,saved.toString())
                        .putLong(KEY_UPDATED,System.currentTimeMillis())
                        .commit();
                    changed=true;
                }
            }catch(Throwable ignored){}
            finally{
                IN_FLIGHT.set(false);
                if(callback!=null) callback.onFinished(changed);
            }
        });
    }

    private void collectRelated(AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                                LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        String endpoint="https://www.googleapis.com/youtube/v3/search"
            +"?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=30"
            +"&relatedToVideoId="+enc(seed.id)
            +"&key="+enc(YOUTUBE_KEY);
        collectEndpoint(endpoint,seed,known,selectedSongs,otherArtists,sameOut,others,mode);
    }

    private void collectSearch(String query,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                               LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        if(query==null||query.trim().isEmpty()) return;
        String endpoint="https://www.googleapis.com/youtube/v3/search"
            +"?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=30&order=relevance"
            +"&q="+enc(query)
            +"&key="+enc(YOUTUBE_KEY);
        collectEndpoint(endpoint,seed,known,selectedSongs,otherArtists,sameOut,others,mode);
    }

    private void collectEndpoint(String endpoint,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                                 LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Accept","application/json");
            c.setConnectTimeout(9000); c.setReadTimeout(12000); c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) return;
            JSONObject root=new JSONObject(read(c.getInputStream()));
            JSONArray arr=root.optJSONArray("items"); if(arr==null) return;

            String seedArtist=canonicalArtist(seed.title,seed.artist);
            for(int i=0;i<arr.length()&&(sameOut.size()+others.size())<22;i++){
                JSONObject entry=arr.optJSONObject(i); if(entry==null) continue;
                JSONObject idObj=entry.optJSONObject("id");
                JSONObject sn=entry.optJSONObject("snippet");
                if(idObj==null||sn==null) continue;
                String id=idObj.optString("videoId","");
                if(id.isEmpty()||id.equals(seed.id)||sameOut.containsKey(id)||others.containsKey(id)) continue;

                String title=html(sn.optString("title","Sans titre"));
                String channel=html(sn.optString("channelTitle","YouTube"));
                if(!looksLikeMusic(title)||isBadVariant(title,channel)) continue;

                String work=songKey(title);
                if(work.isEmpty()||selectedSongs.contains(work)) continue; // anti même œuvre / reupload

                String candidateArtist=canonicalArtist(title,channel);
                if(candidateArtist.isEmpty()||looksGenericArtist(candidateArtist)) continue;
                boolean sameSeed=sameArtist(candidateArtist,seedArtist);
                if(mode==MODE_SEED_ONLY&&!sameSeed) continue;
                if(mode==MODE_OTHERS_ONLY&&sameSeed) continue;

                String thumb="https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";
                JSONObject thumbs=sn.optJSONObject("thumbnails");
                if(thumbs!=null){
                    JSONObject chosen=thumbs.optJSONObject("high");
                    if(chosen==null) chosen=thumbs.optJSONObject("medium");
                    if(chosen==null) chosen=thumbs.optJSONObject("default");
                    if(chosen!=null&&!chosen.optString("url","").isEmpty()) thumb=chosen.optString("url");
                }
                AudifyLibraryStore.Track track=new AudifyLibraryStore.Track(id,title,channel,thumb);

                if(sameSeed){
                    if(sameOut.size()>=2) continue;
                    sameOut.put(id,track);
                    selectedSongs.add(work);
                    continue;
                }

                // Les autres recommandations restent de la découverte : pas d'artiste déjà connu,
                // et un seul morceau par artiste similaire.
                if(containsArtist(known,candidateArtist)) continue;
                String compact=compactArtist(candidateArtist);
                if(otherArtists.contains(compact)) continue;
                otherArtists.add(compact);
                others.put(id,track);
                selectedSongs.add(work);
            }
        }finally{if(c!=null)c.disconnect();}
    }

    private boolean containsArtist(Set<String> known,String candidate){
        String c=compactArtist(candidate);
        if(c.isEmpty()) return false;
        for(String k:known) if(c.equals(compactArtist(k))) return true;
        return false;
    }

    private boolean sameArtist(String a,String b){
        String aa=compactArtist(a),bb=compactArtist(b);
        return !aa.isEmpty()&&aa.equals(bb);
    }

    private String compactArtist(String raw){return normalizeArtist(raw).replace(" ","");}

    private String canonicalArtist(String title,String channel){
        String fromTitle=artistFromTitle(title);
        if(!fromTitle.isEmpty()&&!looksGenericArtist(fromTitle)) return fromTitle;
        return normalizeArtist(channel);
    }

    private String artistFromTitle(String title){
        if(title==null) return "";
        String s=html(title).replace('–','-').replace('—','-').trim();
        int cut=s.indexOf(" - ");
        if(cut<=0) return "";
        String left=s.substring(0,cut).trim();
        if(left.length()>60) return "";
        return normalizeArtist(left);
    }

    private String seedArtistDisplay(AudifyLibraryStore.Track seed){
        if(seed==null) return "";
        String raw=seed.title==null?"":seed.title.replace('–','-').replace('—','-');
        int cut=raw.indexOf(" - ");
        if(cut>0&&cut<60) return raw.substring(0,cut).trim();
        return cleanArtistDisplay(seed.artist);
    }

    private String cleanArtistDisplay(String raw){
        if(raw==null) return "";
        String s=raw.trim();
        s=s.replaceAll("(?i)\\s+-\\s+topic$","");
        s=s.replaceAll("(?i)\\s+official$","");
        s=s.replaceAll("(?i)\\s+officiel$","");
        s=s.replaceAll("(?i)\\s+vevo$","");
        return s.trim();
    }

    private String normalizeArtist(String raw){
        if(raw==null) return "";
        String s=cleanArtistDisplay(raw).toLowerCase(Locale.ROOT).replace('–','-').replace('—','-');
        s=s.replaceAll("(?i)\\b(official|officiel|music|musique)\\b$","");
        s=s.replaceAll("[^\\p{L}\\p{N}]+"," ").trim();
        return s.replaceAll("\\s+"," ");
    }

    /** Empreinte de l'œuvre : supprime artiste, metadata vidéo et variantes de réupload. */
    private String songKey(String rawTitle){
        if(rawTitle==null) return "";
        String s=html(rawTitle).toLowerCase(Locale.ROOT).replace('–','-').replace('—','-');
        s=s.replaceAll("\\([^)]*\\)"," ");
        s=s.replaceAll("\\[[^]]*\\]"," ");
        int cut=s.indexOf(" - ");
        if(cut>=0&&cut+3<s.length()) s=s.substring(cut+3);
        s=s.replaceAll("(?i)\\b(official|officiel|video|vidéo|audio|lyrics?|lyric|paroles?|clip|visualizer|visualiser|music video|mv|hd|4k|topic|version|remix|live|acoustic|slowed|reverb|sped up|speed up|nightcore|karaoke)\\b"," ");
        s=s.replaceAll("(?i)\\b(feat|ft)\\.?\\s+.*$"," ");
        s=s.replaceAll("[^\\p{L}\\p{N}]+"," ").trim();
        return s.replaceAll("\\s+"," ");
    }

    private boolean isBadVariant(String title,String channel){
        String s=((title==null?"":title)+" "+(channel==null?"":channel)).toLowerCase(Locale.ROOT);
        return s.contains("lyrics")||s.contains("lyric video")||s.contains("paroles")
            ||s.contains("slowed")||s.contains("reverb")||s.contains("sped up")||s.contains("speed up")
            ||s.contains("nightcore")||s.contains("karaoke")||s.contains("reaction")||s.contains("cover version")
            ||s.contains("8d audio")||s.contains("1 hour")||s.contains("1h version");
    }

    private boolean looksLikeMusic(String title){
        String s=title==null?"":title.toLowerCase(Locale.ROOT);
        return !(s.contains("interview")||s.contains("podcast")||s.contains("documentary")||s.contains("documentaire")
            ||s.contains("review")||s.contains("reaction")||s.contains("making of")||s.contains("behind the scenes"));
    }

    private boolean looksGenericArtist(String raw){
        String s=normalizeArtist(raw);
        return s.isEmpty()||s.equals("youtube")||s.equals("music")||s.equals("musique")||s.equals("lyrics")||s.equals("paroles")
            ||s.contains("lyrics channel")||s.contains("paroles france")||s.contains("music channel")||s.contains("playlist channel");
    }

    private String html(String value){
        if(value==null) return "";
        try{
            if(Build.VERSION.SDK_INT>=24) return Html.fromHtml(value,Html.FROM_HTML_MODE_LEGACY).toString();
            return Html.fromHtml(value).toString();
        }catch(Throwable ignored){return value;}
    }
    private String enc(String value) throws Exception{return URLEncoder.encode(value==null?"":value,"UTF-8");}
    private String read(InputStream input) throws Exception{
        BufferedReader br=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder(); String line;
        while((line=br.readLine())!=null) out.append(line);
        br.close(); return out.toString();
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyDiscoveryAgent.java'),discovery,'utf8');

// =============================================================================
// 2) Pour toi : 2 titres max du seed en tête, puis artistes similaires.
// =============================================================================
let home=await readFile(homePath,'utf8');
home=replaceMethod(home,['    private void addForYouSection(){','    private void addForYouSection() {'],String.raw`    private void addForYouSection(){
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(18),dp(14),dp(18));
        AudifyAffinityStore affinity=new AudifyAffinityStore(this);
        AudifyDiscoveryAgent discovery=new AudifyDiscoveryAgent(this);

        TextView eyebrow=text("AUDIFY DISCOVERY AGENT 2.0",12f,true);
        eyebrow.setTextColor(ACCENT); eyebrow.setLetterSpacing(0.13f);
        panel.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));
        TextView title=text("Pour toi",32f,true);
        panel.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(49)));

        java.util.List<AudifyLibraryStore.Track> recents=store.getRecents();
        java.util.List<AudifyLibraryStore.Track> likes=store.getLikes();
        AudifyLibraryStore.Track seed=!recents.isEmpty()?recents.get(0):(!likes.isEmpty()?likes.get(0):null);
        if(seed==null){
            TextView sub=text("Écoute ton premier morceau : les recommandations apparaîtront immédiatement ici.",15f,false);
            sub.setTextColor(Color.rgb(181,191,204)); panel.addView(sub);
            addPanel(panel,dp(18));
            return;
        }

        String genre=affinity.topGenre();
        TextView sub=text("Jusqu’à 2 autres titres de ton artiste en priorité, puis des artistes similaires. Les doublons et réuploads sont filtrés.",14.5f,false);
        sub.setTextColor(Color.rgb(178,188,201)); sub.setPadding(0,0,0,dp(12)); panel.addView(sub);

        java.util.LinkedHashSet<String> known=new java.util.LinkedHashSet<>();
        for(AudifyLibraryStore.Track t:recents) if(t!=null&&!t.artist.isEmpty()) known.add(t.artist);
        for(AudifyLibraryStore.Track t:likes) if(t!=null&&!t.artist.isEmpty()) known.add(t.artist);

        java.util.List<AudifyLibraryStore.Track> cached=discovery.getCached(seed.id);
        if(cached.isEmpty()){
            TextView loading=text("Recherche de nouvelles recommandations…",15f,true);
            loading.setTextColor(ACCENT); loading.setGravity(Gravity.CENTER_VERTICAL); loading.setPadding(dp(14),0,dp(14),0);
            loading.setBackground(round(Color.rgb(15,27,21),dp(1),Color.rgb(62,99,45),dp(19)));
            panel.addView(loading,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false); hsv.setOverScrollMode(View.OVER_SCROLL_NEVER);
            LinearLayout rail=new LinearLayout(this); rail.setOrientation(LinearLayout.HORIZONTAL);
            int limit=Math.min(12,cached.size());
            for(int i=0;i<limit;i++){
                AudifyLibraryStore.Track t=cached.get(i);
                boolean sameSeed=discovery.isSameArtist(t,seed);
                LinearLayout card=new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL);
                card.setPadding(dp(9),dp(8),dp(10),dp(8));
                card.setBackground(round(sameSeed?Color.rgb(18,29,23):Color.rgb(14,21,28),dp(1),sameSeed?Color.rgb(83,122,55):Color.rgb(45,56,67),dp(22)));
                card.setOnClickListener(v->playTrack(t));
                ImageView art=artworkView(); loadImage(art,t.thumbnail); card.addView(art,new LinearLayout.LayoutParams(dp(70),dp(70)));
                LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setPadding(dp(11),0,dp(5),0);
                TextView tt=text(t.title,15.5f,true); tt.setMaxLines(1); tt.setEllipsize(TextUtils.TruncateAt.END);
                TextView aa=text(t.artist,12.8f,false); aa.setTextColor(Color.rgb(172,181,194)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
                TextView why=text(sameSeed?"Même artiste · autre morceau":"Artiste similaire · découverte",11.5f,true); why.setTextColor(sameSeed?ACCENT:Color.rgb(185,207,173));
                info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27)));
                info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
                info.addView(why,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(20)));
                card.addView(info,new LinearLayout.LayoutParams(0,dp(72),1f));
                TextView arrow=text("›",27f,true); arrow.setTextColor(Color.rgb(184,194,204)); arrow.setGravity(Gravity.CENTER);
                card.addView(arrow,new LinearLayout.LayoutParams(dp(30),dp(70)));
                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(310),dp(92)); cp.rightMargin=dp(11); rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(96)));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(102)));
        }

        discovery.ensureRecommendations(seed,known,genre,changed->{
            if(changed&&!isFinishing()) runOnUiThread(this::rebuildLibrary);
        });
        addPanel(panel,dp(18));
    }`,'addForYouSection');

// =============================================================================
// 3) Picker playlist natif moderne partagé.
// =============================================================================
const picker=String.raw`package com.nova.audify;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

/** Audify V68.11.0 — feuille playlist 100% native, sombre et sans AlertDialog Android blanc. */
public final class AudifyPlaylistPicker {
    private static final int ACCENT=Color.rgb(157,255,50);
    private AudifyPlaylistPicker(){}

    public static void show(Activity a,AudifyLibraryStore store,AudifyLibraryStore.Track track,Runnable changed){
        if(a==null||store==null||track==null||track.id.isEmpty()) return;
        Dialog dialog=baseDialog(a);

        LinearLayout card=card(a);
        TextView eyebrow=text(a,"AUDIFY PLAYLISTS",11.5f,true,ACCENT); eyebrow.setLetterSpacing(.14f);
        card.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,26)));
        TextView title=text(a,"Ajouter à une playlist",24f,true,Color.WHITE);
        card.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,42)));
        TextView song=text(a,track.title,13.5f,false,Color.rgb(168,179,192));
        song.setMaxLines(1); song.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams slp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,31)); slp.bottomMargin=dp(a,10); card.addView(song,slp);

        LinearLayout create=row(a,"＋","Nouvelle playlist","Créer une nouvelle collection",true);
        create.setOnClickListener(v->showCreate(a,store,track,dialog,changed));
        LinearLayout.LayoutParams createLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,72)); createLp.bottomMargin=dp(a,10); card.addView(create,createLp);

        List<String> names=store.getPlaylistNames();
        if(names.isEmpty()){
            TextView empty=text(a,"Aucune playlist pour l’instant",14f,false,Color.rgb(143,154,168));
            empty.setGravity(Gravity.CENTER_VERTICAL); empty.setPadding(dp(a,12),0,0,0);
            card.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,54)));
        }else{
            ScrollView scroll=new ScrollView(a); scroll.setVerticalScrollBarEnabled(false); scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
            LinearLayout list=new LinearLayout(a); list.setOrientation(LinearLayout.VERTICAL);
            for(String name:names){
                int count=store.getPlaylist(name).size();
                LinearLayout r=row(a,"♫",name,count+(count>1?" titres":" titre"),false);
                r.setOnClickListener(v->{
                    store.addToPlaylist(name,track);
                    Toast.makeText(a,"Ajouté à « "+name+" »",Toast.LENGTH_SHORT).show();
                    dialog.dismiss(); if(changed!=null) changed.run();
                });
                LinearLayout.LayoutParams rlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,70)); rlp.bottomMargin=dp(a,7); list.addView(r,rlp);
            }
            scroll.addView(list,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
            int h=Math.min(dp(a,330),dp(a,77*Math.max(1,names.size())));
            card.addView(scroll,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,h));
        }

        TextView cancel=text(a,"Fermer",14f,true,Color.rgb(202,211,220)); cancel.setGravity(Gravity.CENTER);
        cancel.setBackground(bg(Color.rgb(22,29,37),1,Color.rgb(50,60,72),18,a)); cancel.setOnClickListener(v->dialog.dismiss());
        LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,50)); clp.topMargin=dp(a,12); card.addView(cancel,clp);

        setContent(dialog,a,card);
    }

    private static void showCreate(Activity a,AudifyLibraryStore store,AudifyLibraryStore.Track track,Dialog parent,Runnable changed){
        Dialog dialog=baseDialog(a);
        LinearLayout card=card(a);
        TextView eyebrow=text(a,"NOUVELLE PLAYLIST",11.5f,true,ACCENT); eyebrow.setLetterSpacing(.13f); card.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,28)));
        TextView title=text(a,"Créer une playlist",24f,true,Color.WHITE); card.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,44)));
        TextView sub=text(a,"Donne-lui un nom puis Audify ajoutera ce morceau immédiatement.",13.5f,false,Color.rgb(164,175,188));
        LinearLayout.LayoutParams subLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,52)); subLp.bottomMargin=dp(a,8); card.addView(sub,subLp);

        EditText input=new EditText(a); input.setHint("Nom de la playlist"); input.setHintTextColor(Color.rgb(116,129,143)); input.setTextColor(Color.WHITE); input.setTextSize(16f); input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); input.setPadding(dp(a,17),0,dp(a,17),0);
        input.setBackground(bg(Color.rgb(12,18,25),1,Color.rgb(57,69,82),18,a));
        card.addView(input,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,58)));

        LinearLayout actions=new LinearLayout(a); actions.setGravity(Gravity.CENTER_VERTICAL); actions.setPadding(0,dp(a,13),0,0);
        TextView back=text(a,"Annuler",14f,true,Color.rgb(196,205,215)); back.setGravity(Gravity.CENTER); back.setBackground(bg(Color.rgb(22,29,37),1,Color.rgb(51,61,72),18,a)); back.setOnClickListener(v->dialog.dismiss());
        LinearLayout.LayoutParams blp=new LinearLayout.LayoutParams(0,dp(a,52),1f); blp.rightMargin=dp(a,8); actions.addView(back,blp);
        TextView create=text(a,"Créer  ＋",14f,true,Color.rgb(8,17,8)); create.setGravity(Gravity.CENTER); create.setBackground(bg(ACCENT,0,Color.TRANSPARENT,18,a));
        create.setOnClickListener(v->{
            String name=input.getText()==null?"":input.getText().toString().trim(); if(name.isEmpty()) name="Ma playlist";
            store.createPlaylist(name); store.addToPlaylist(name,track);
            Toast.makeText(a,"Ajouté à « "+name+" »",Toast.LENGTH_SHORT).show();
            dialog.dismiss(); parent.dismiss(); if(changed!=null) changed.run();
        });
        LinearLayout.LayoutParams crlp=new LinearLayout.LayoutParams(0,dp(a,52),1.25f); actions.addView(create,crlp);
        card.addView(actions,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,67)));
        setContent(dialog,a,card);
        input.requestFocus();
        Window w=dialog.getWindow(); if(w!=null) w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
    }

    private static Dialog baseDialog(Activity a){
        Dialog d=new Dialog(a); d.requestWindowFeature(Window.FEATURE_NO_TITLE); d.setCancelable(true); return d;
    }
    private static void setContent(Dialog d,Activity a,View content){
        LinearLayout shell=new LinearLayout(a); shell.setGravity(Gravity.CENTER); shell.setPadding(dp(a,18),dp(a,26),dp(a,18),dp(a,26)); shell.addView(content,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        d.setContentView(shell); d.show(); Window w=d.getWindow(); if(w!=null){
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT)); w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams attrs=w.getAttributes(); attrs.dimAmount=.72f; w.setAttributes(attrs);
        }
    }
    private static LinearLayout card(Activity a){
        LinearLayout v=new LinearLayout(a); v.setOrientation(LinearLayout.VERTICAL); v.setPadding(dp(a,18),dp(a,18),dp(a,18),dp(a,17)); v.setBackground(bg(Color.rgb(9,14,20),1,Color.rgb(45,55,66),28,a)); v.setElevation(dp(a,18)); return v;
    }
    private static LinearLayout row(Activity a,String icon,String title,String sub,boolean accent){
        LinearLayout r=new LinearLayout(a); r.setGravity(Gravity.CENTER_VERTICAL); r.setPadding(dp(a,10),dp(a,7),dp(a,10),dp(a,7)); r.setBackground(bg(accent?Color.rgb(18,31,21):Color.rgb(14,20,27),1,accent?Color.rgb(73,113,49):Color.rgb(42,52,63),20,a));
        TextView i=text(a,icon,21f,true,accent?ACCENT:Color.rgb(205,214,224)); i.setGravity(Gravity.CENTER); r.addView(i,new LinearLayout.LayoutParams(dp(a,50),dp(a,54)));
        LinearLayout info=new LinearLayout(a); info.setOrientation(LinearLayout.VERTICAL); info.setGravity(Gravity.CENTER_VERTICAL);
        TextView t=text(a,title,15f,true,Color.WHITE); t.setMaxLines(1); t.setEllipsize(android.text.TextUtils.TruncateAt.END); info.addView(t,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,29)));
        TextView s=text(a,sub,12f,false,Color.rgb(151,163,176)); info.addView(s,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,22)));
        r.addView(info,new LinearLayout.LayoutParams(0,dp(a,55),1f)); TextView arrow=text(a,"›",27f,true,Color.rgb(155,167,179)); arrow.setGravity(Gravity.CENTER); r.addView(arrow,new LinearLayout.LayoutParams(dp(a,28),dp(a,54))); return r;
    }
    private static TextView text(Activity a,String value,float sp,boolean bold,int color){TextView t=new TextView(a); t.setText(value); t.setTextSize(sp); t.setTextColor(color); if(bold)t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD); return t;}
    private static GradientDrawable bg(int fill,int strokeDp,int stroke,int radiusDp,Activity a){GradientDrawable g=new GradientDrawable(); g.setColor(fill); g.setCornerRadius(dp(a,radiusDp)); if(strokeDp>0)g.setStroke(dp(a,strokeDp),stroke); return g;}
    private static int dp(Activity a,int v){return Math.round(v*a.getResources().getDisplayMetrics().density);}
}
`;
await writeFile(path.join(pkgDir,'AudifyPlaylistPicker.java'),picker,'utf8');

let player=await readFile(playerPath,'utf8');
player=replaceMethod(player,['    private void showPlaylistPicker() {','    private void showPlaylistPicker(){'],String.raw`    private void showPlaylistPicker() {
        if(currentTrack==null||currentTrack.id.isEmpty()){
            Toast.makeText(this,"Titre indisponible",Toast.LENGTH_SHORT).show();
            return;
        }
        AudifyPlaylistPicker.show(this,store,currentTrack,null);
    }`,'NativePlayerActivity.showPlaylistPicker');
await writeFile(playerPath,player,'utf8');

home=replaceMethod(home,['    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track){','    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track) {'],String.raw`    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track){
        if(track==null||track.id.isEmpty()) return;
        AudifyPlaylistPicker.show(this,store,track,this::rebuildLibrary);
    }`,'NativeHomeActivity.showPlaylistPickerForTrack');
await writeFile(homePath,home,'utf8');

console.log('Audify V68.11.0 : Discovery Agent 2.0 + empreinte anti-réupload + picker playlist moderne.');
