import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const repoRoot=path.resolve(root,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
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
  throw new Error(`V68.10.9 méthode introuvable: ${label}`);
}

const webBase=await readFile(webBasePath,'utf8');
const keyMatch=webBase.match(/const KEY='([^']+)'/);
if(!keyMatch) throw new Error('V68.10.9 clé YouTube historique introuvable');
const youtubeKey=keyMatch[1];

// =============================================================================
// 1) VRAI DISCOVERY AGENT — candidats externes dès la première écoute.
//    Source principale : YouTube relatedToVideoId + catégorie Music.
//    Fallbacks : recherches contextuelles autour de l'artiste/genre.
// =============================================================================
const agent=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;
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

/** Audify V68.10.9 — moteur de découverte instantané basé sur la première écoute. */
public final class AudifyDiscoveryAgent {
    private static final String PREFS="audify_discovery_v68109";
    private static final String KEY_SEED="seed_id";
    private static final String KEY_RESULTS="results_json";
    private static final String KEY_UPDATED="updated_at";
    private static final String YOUTUBE_KEY="${youtubeKey}";
    private static final long CACHE_MS=6L*60L*60L*1000L;
    private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
    private static final AtomicBoolean IN_FLIGHT=new AtomicBoolean(false);

    public interface Callback { void onFinished(boolean changed); }

    private final Context app;
    private final SharedPreferences prefs;
    private final AudifyAffinityStore affinity;

    public AudifyDiscoveryAgent(Context context){
        app=context.getApplicationContext();
        prefs=app.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        affinity=new AudifyAffinityStore(app);
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
        if(knownArtists!=null) for(String s:knownArtists){String n=normalize(s);if(!n.isEmpty())known.add(n);}
        addKnownAliases(known,seed);
        final String safeGenre=genre==null?"":genre.trim();

        EXECUTOR.execute(()->{
            boolean changed=false;
            try{
                LinkedHashMap<String,AudifyLibraryStore.Track> uniqueVideos=new LinkedHashMap<>();
                LinkedHashSet<String> uniqueArtists=new LinkedHashSet<>();

                // 1. Le signal le plus fort : recommandations YouTube directement liées au morceau.
                collectRelated(seed,known,uniqueArtists,uniqueVideos);

                // 2. Si le related ne suffit pas, recherche de musique similaire à l'artiste.
                if(uniqueVideos.size()<8){
                    String artist=cleanArtist(seed.artist);
                    if(!artist.isEmpty()) collectSearch("music similar to "+artist,known,uniqueArtists,uniqueVideos);
                }

                // 3. Le genre dominant renforce le profil après quelques écoutes.
                if(uniqueVideos.size()<8&&!safeGenre.isEmpty()){
                    collectSearch(safeGenre+" music new artists",known,uniqueArtists,uniqueVideos);
                }

                // 4. Dernier filet de sécurité : titre + radio, toujours filtré anti-artiste connu.
                if(uniqueVideos.size()<6){
                    String compactTitle=cleanTitle(seed.title);
                    if(!compactTitle.isEmpty()) collectSearch(compactTitle+" radio music",known,uniqueArtists,uniqueVideos);
                }

                JSONArray saved=new JSONArray();
                int count=0;
                for(AudifyLibraryStore.Track t:uniqueVideos.values()){
                    if(count++>=12) break;
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

    private void collectRelated(AudifyLibraryStore.Track seed,Set<String> known,Set<String> artists,LinkedHashMap<String,AudifyLibraryStore.Track> out) throws Exception{
        String endpoint="https://www.googleapis.com/youtube/v3/search"
            +"?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=25"
            +"&relatedToVideoId="+enc(seed.id)
            +"&key="+enc(YOUTUBE_KEY);
        collectEndpoint(endpoint,seed.id,known,artists,out);
    }

    private void collectSearch(String query,Set<String> known,Set<String> artists,LinkedHashMap<String,AudifyLibraryStore.Track> out) throws Exception{
        if(query==null||query.trim().isEmpty()) return;
        String endpoint="https://www.googleapis.com/youtube/v3/search"
            +"?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=25&order=relevance"
            +"&q="+enc(query)
            +"&key="+enc(YOUTUBE_KEY);
        collectEndpoint(endpoint,"",known,artists,out);
    }

    private void collectEndpoint(String endpoint,String excludedVideoId,Set<String> known,Set<String> artists,LinkedHashMap<String,AudifyLibraryStore.Track> out) throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET"); c.setRequestProperty("Accept","application/json");
            c.setConnectTimeout(9000); c.setReadTimeout(12000); c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) return;
            String body=read(c.getInputStream());
            JSONObject root=new JSONObject(body);
            JSONArray arr=root.optJSONArray("items"); if(arr==null) return;
            for(int i=0;i<arr.length()&&out.size()<16;i++){
                JSONObject entry=arr.optJSONObject(i); if(entry==null) continue;
                JSONObject idObj=entry.optJSONObject("id"); JSONObject sn=entry.optJSONObject("snippet");
                if(idObj==null||sn==null) continue;
                String id=idObj.optString("videoId",""); if(id.isEmpty()||id.equals(excludedVideoId)||out.containsKey(id)) continue;
                String title=html(sn.optString("title","Sans titre"));
                String artist=html(sn.optString("channelTitle","YouTube"));
                if(!looksLikeMusic(title)) continue;
                String normalized=normalize(artist);
                String titleArtist=artistFromTitle(title);
                if(normalized.isEmpty()) continue;
                if(known.contains(normalized)||(!titleArtist.isEmpty()&&known.contains(titleArtist))) continue;
                // Une carte par nouvel artiste : évite qu'un seul artiste monopolise Pour toi.
                String artistKey=!titleArtist.isEmpty()?titleArtist:normalized;
                if(artists.contains(artistKey)) continue;
                artists.add(artistKey);
                String thumb="https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";
                JSONObject thumbs=sn.optJSONObject("thumbnails");
                if(thumbs!=null){
                    JSONObject chosen=thumbs.optJSONObject("high"); if(chosen==null) chosen=thumbs.optJSONObject("medium"); if(chosen==null) chosen=thumbs.optJSONObject("default");
                    if(chosen!=null&&!chosen.optString("url","").isEmpty()) thumb=chosen.optString("url");
                }
                out.put(id,new AudifyLibraryStore.Track(id,title,artist,thumb));
            }
        }finally{if(c!=null)c.disconnect();}
    }

    private boolean looksLikeMusic(String title){
        String s=title==null?"":title.toLowerCase(Locale.ROOT);
        if(s.contains("interview")||s.contains("reaction")||s.contains("podcast")||s.contains("documentary")||s.contains("documentaire")||s.contains("review")) return false;
        return true;
    }

    public void addKnownAliases(Set<String> target,AudifyLibraryStore.Track t){
        if(target==null||t==null) return;
        String channel=normalize(t.artist); if(!channel.isEmpty()) target.add(channel);
        String fromTitle=artistFromTitle(t.title); if(!fromTitle.isEmpty()) target.add(fromTitle);
    }

    private String artistFromTitle(String title){
        if(title==null) return "";
        String s=title.replace('–','-').replace('—','-').trim();
        int cut=s.indexOf(" - ");
        if(cut<=0) return "";
        return normalize(s.substring(0,cut));
    }

    private String cleanArtist(String raw){
        String s=raw==null?"":raw.trim();
        return s.replaceAll("(?i)\\s+-\\s+topic$","").replaceAll("(?i)\\s+official$","").replaceAll("(?i)\\s+officiel$","").replaceAll("(?i)\\s+vevo$","").trim();
    }

    private String cleanTitle(String raw){
        String s=raw==null?"":raw;
        s=s.replaceAll("(?i)\\([^)]*(official|officiel|clip|video|audio|lyrics|visualizer)[^)]*\\)"," ");
        s=s.replaceAll("(?i)\\[[^]]*(official|officiel|clip|video|audio|lyrics|visualizer)[^]]*\\]"," ");
        return s.replaceAll("\\s+"," ").trim();
    }

    private String normalize(String raw){
        if(raw==null) return "";
        String s=cleanArtist(raw).toLowerCase(Locale.ROOT).replace('–','-').replace('—','-');
        s=s.replaceAll("[^\\p{L}\\p{N}]+"," ").trim();
        return s.replaceAll("\\s+"," ");
    }

    private String html(String value){
        if(value==null) return "";
        try{return Html.fromHtml(value,Html.FROM_HTML_MODE_LEGACY).toString();}catch(Throwable ignored){return value;}
    }
    private String enc(String value) throws Exception{return URLEncoder.encode(value==null?"":value,"UTF-8");}
    private String read(InputStream input) throws Exception{
        BufferedReader br=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder(); String line; while((line=br.readLine())!=null) out.append(line); br.close(); return out.toString();
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyDiscoveryAgent.java'),agent,'utf8');

// =============================================================================
// 2) HOME : Pour toi devient la PREMIÈRE section et se remplit après 1 écoute.
// =============================================================================
let home=await readFile(homePath,'utf8');

home=replaceMethod(home,['    private void rebuildLibrary(){','    private void rebuildLibrary() {'],String.raw`    private void rebuildLibrary(){
        libraryContent.removeAllViews();
        // V68.10.9 : Pour toi est la section principale du Home.
        addForYouSection();
        addRecentSection();
        addFavoritesIntro();
        addLikesSection();
        addPlaylistsSection();
    }`,'rebuildLibrary order');

home=replaceMethod(home,['    private void addForYouSection(){','    private void addForYouSection() {'],String.raw`    private void addForYouSection(){
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(18),dp(14),dp(18));
        AudifyAffinityStore affinity=new AudifyAffinityStore(this);
        AudifyDiscoveryAgent discovery=new AudifyDiscoveryAgent(this);

        TextView eyebrow=text("AUDIFY DISCOVERY AGENT",12f,true);
        eyebrow.setTextColor(ACCENT); eyebrow.setLetterSpacing(0.14f);
        panel.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));

        TextView title=text("Pour toi",32f,true);
        panel.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(49)));

        java.util.List<AudifyLibraryStore.Track> recents=store.getRecents();
        java.util.List<AudifyLibraryStore.Track> likes=store.getLikes();
        AudifyLibraryStore.Track seed=!recents.isEmpty()?recents.get(0):(!likes.isEmpty()?likes.get(0):null);

        if(seed==null){
            TextView sub=text("Écoute ton premier morceau : Audify créera immédiatement tes premières recommandations.",15f,false);
            sub.setTextColor(Color.rgb(181,191,204)); sub.setPadding(0,0,0,dp(10)); panel.addView(sub);
            TextView empty=text("1 écoute suffit pour démarrer",16f,true);
            empty.setTextColor(ACCENT); empty.setGravity(Gravity.CENTER_VERTICAL);
            empty.setPadding(dp(15),0,dp(15),0);
            empty.setBackground(round(Color.rgb(18,29,22),dp(1),Color.rgb(74,111,48),dp(20)));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));
            addPanel(panel,dp(18));
            return;
        }

        String genre=affinity.topGenre();
        TextView sub=text(genre.isEmpty()
            ?"À partir de « "+seed.title+" », Audify cherche déjà de nouveaux artistes pour toi."
            :"Profil "+genre+" · nouveaux artistes proches de tes goûts, sans doublons de ceux que tu connais déjà.",15f,false);
        sub.setTextColor(Color.rgb(178,187,201)); sub.setPadding(0,0,0,dp(12)); panel.addView(sub);

        java.util.LinkedHashSet<String> known=new java.util.LinkedHashSet<>();
        for(AudifyLibraryStore.Track t:recents) discovery.addKnownAliases(known,t);
        for(AudifyLibraryStore.Track t:likes) discovery.addKnownAliases(known,t);

        java.util.List<AudifyLibraryStore.Track> candidates=discovery.getCached(seed.id);
        if(candidates.isEmpty()){
            LinearLayout loading=new LinearLayout(this); loading.setGravity(Gravity.CENTER_VERTICAL); loading.setPadding(dp(14),dp(10),dp(14),dp(10));
            loading.setBackground(round(Color.rgb(13,20,27),dp(1),Color.rgb(47,61,70),dp(20)));
            TextView pulse=text("◉",22f,true); pulse.setTextColor(ACCENT); pulse.setGravity(Gravity.CENTER);
            loading.addView(pulse,new LinearLayout.LayoutParams(dp(46),dp(52)));
            LinearLayout copy=new LinearLayout(this); copy.setOrientation(LinearLayout.VERTICAL); copy.setGravity(Gravity.CENTER_VERTICAL);
            TextView a=text("Recherche de nouvelles découvertes…",15f,true); TextView b=text("Le premier résultat arrive dès cette écoute.",12.5f,false); b.setTextColor(Color.rgb(159,171,185));
            copy.addView(a,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27))); copy.addView(b,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(23)));
            loading.addView(copy,new LinearLayout.LayoutParams(0,dp(56),1f));
            panel.addView(loading,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(72)));

            final String seedId=seed.id;
            discovery.ensureRecommendations(seed,known,genre,changed->{
                if(!changed) return;
                runOnUiThread(()->{
                    java.util.List<AudifyLibraryStore.Track> latest=new AudifyDiscoveryAgent(this).getCached(seedId);
                    if(!latest.isEmpty()) rebuildLibrary();
                });
            });
            addPanel(panel,dp(18));
            return;
        }

        HorizontalScrollView hsv=new HorizontalScrollView(this);
        hsv.setHorizontalScrollBarEnabled(false); hsv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        LinearLayout rail=new LinearLayout(this); rail.setOrientation(LinearLayout.HORIZONTAL);
        int shown=Math.min(10,candidates.size());
        for(int i=0;i<shown;i++){
            AudifyLibraryStore.Track t=candidates.get(i);
            LinearLayout card=new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(9),dp(8),dp(10),dp(8));
            card.setBackground(round(Color.rgb(14,21,28),dp(1),i==0?Color.rgb(91,137,55):Color.rgb(45,56,67),dp(22)));
            card.setElevation(i==0?dp(7):dp(3)); card.setOnClickListener(v->playTrack(t));

            ImageView art=artworkView(); loadImage(art,t.thumbnail); card.addView(art,new LinearLayout.LayoutParams(dp(74),dp(74)));
            LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setGravity(Gravity.CENTER_VERTICAL); info.setPadding(dp(11),0,dp(5),0);
            TextView tt=text(t.title,15.5f,true); tt.setMaxLines(1); tt.setEllipsize(TextUtils.TruncateAt.END);
            TextView aa=text(t.artist,13f,false); aa.setTextColor(Color.rgb(177,187,201)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
            TextView why=text(i==0?"Meilleure découverte":"Nouvel artiste · recommandé",11.5f,true); why.setTextColor(ACCENT);
            info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27)));
            info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
            info.addView(why,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(20)));
            card.addView(info,new LinearLayout.LayoutParams(0,dp(74),1f));
            TextView arrow=text("›",27f,true); arrow.setTextColor(Color.rgb(183,193,205)); arrow.setGravity(Gravity.CENTER); card.addView(arrow,new LinearLayout.LayoutParams(dp(30),dp(70)));
            LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(316),dp(94)); cp.rightMargin=dp(12); rail.addView(card,cp);
        }
        hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(98)));
        panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(102)));

        // Rafraîchit discrètement en arrière-plan si le cache vieillit.
        discovery.ensureRecommendations(seed,known,genre,changed->{
            if(changed) runOnUiThread(this::rebuildLibrary);
        });
        addPanel(panel,dp(18));
    }`,'instant addForYouSection');

// Quand on revient au Home après une écoute, le nouvel historique doit être pris en compte immédiatement.
home=replaceMethod(home,['    @Override protected void onResume(){','    @Override protected void onResume() {'],String.raw`    @Override protected void onResume(){
        super.onResume();
        rebuildLibrary();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }`,'home onResume refresh');

await writeFile(homePath,home,'utf8');
console.log('Audify V68.10.9 : Pour toi en premier + recommandations externes dès la première écoute.');
