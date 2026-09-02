package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Locale;
import java.util.Map;

/** Audify V68.10.0 — affinités privées, synchronisées par composante appareil. */
public final class AudifyAffinityStore {
    private static final String PREFS="audify_affinity_v68100";
    private static final String ARTIST_PREFIX="artist:";
    private static final String GENRE_PREFIX="genre:";
    private final AudifyFirebaseSync sync;
    private final String owner;

    public AudifyAffinityStore(Context context){
        sync=AudifyFirebaseSync.get(context);owner=sync.uid();
    }

    public void recordPlay(AudifyLibraryStore.Track t){ add(t,3); }
    public void recordReplay(AudifyLibraryStore.Track t){ add(t,5); }
    public void recordLike(AudifyLibraryStore.Track t,boolean liked){ add(t,liked?14:-10); }
    public void recordPlaylist(AudifyLibraryStore.Track t){ add(t,16); }
    public void recordRepeat(AudifyLibraryStore.Track t){ add(t,12); }
    public void recordSkip(AudifyLibraryStore.Track t){ add(t,-4); }

    private void add(AudifyLibraryStore.Track t,int delta){
        if(t==null||t.id.isEmpty()) return;
        String artist=normalize(t.artist);
        if(!artist.isEmpty()) increment(ARTIST_PREFIX+artist,delta);
        String genre=inferGenre(t);
        if(!genre.isEmpty()) increment(GENRE_PREFIX+genre,delta);
    }

    private void increment(String key,int delta){
        sync.editFor(owner,(state,cloud)->{
            String component=key+":"+sync.deviceId();
            org.json.JSONObject record=state.get("affinity",component);
            long current=record==null?0:record.getJSONObject("payload").optLong("value");
            state.change("affinity",component,new org.json.JSONObject().put("bucket",key).put("value",Math.max(-1000000L,Math.min(1000000L,current+delta))),false,cloud);
            return true;
        },false);
    }
    private Map<String,Integer> scores(){
        return sync.readFor(owner,(state,cloud)->{
            java.util.HashMap<String,Integer> out=new java.util.HashMap<>();
            for(org.json.JSONObject record:state.active("affinity")){
                org.json.JSONObject payload=record.getJSONObject("payload");String key=payload.getString("bucket");
                out.put(key,(int)Math.max(-1000000L,Math.min(1000000L,(long)out.getOrDefault(key,0)+payload.optLong("value"))));
            }
            return out;
        },new java.util.HashMap<>());
    }

    public int artistScore(String artist){
        String key=normalize(artist);
        return key.isEmpty()?0:scores().getOrDefault(ARTIST_PREFIX+key,0);
    }

    public boolean isKnownArtist(String artist){
        String target=normalizeArtist(artist);
        if(target.isEmpty()) return false;
        for(Map.Entry<String,?> e:scores().entrySet()){
            if(!e.getKey().startsWith(ARTIST_PREFIX) || !(e.getValue() instanceof Integer)) continue;
            if(((Integer)e.getValue())<=0) continue;
            if(normalizeArtist(e.getKey().substring(ARTIST_PREFIX.length())).equals(target)) return true;
        }
        return false;
    }

    public String normalizeArtist(String raw){
        if(raw==null) return "";
        String s=raw.toLowerCase(Locale.ROOT).trim();
        s=s.replace("–","-").replace("—","-");
        s=s.replaceAll("\\s+-\\s+topic$","");
        s=s.replaceAll("\\s+official$","");
        s=s.replaceAll("\\s+officiel$","");
        s=s.replaceAll("\\s+vevo$","");
        s=s.replaceAll("[^\\p{L}\\p{N}]+"," ").trim();
        return s.replaceAll("\\s+"," ");
    }

    public int scoreFor(AudifyLibraryStore.Track t){
        if(t==null) return 0;
        int score=artistScore(t.artist);
        String genre=inferGenre(t);
        if(!genre.isEmpty()) score+=Math.max(0,scores().getOrDefault(GENRE_PREFIX+genre,0))/3;
        return score;
    }

    public String topGenre(){
        String best=""; int bestScore=0;
        for(Map.Entry<String,?> e:scores().entrySet()){
            String k=e.getKey();
            if(!k.startsWith(GENRE_PREFIX)||!(e.getValue() instanceof Integer)) continue;
            int score=(Integer)e.getValue();
            if(score>bestScore){ bestScore=score; best=k.substring(GENRE_PREFIX.length()); }
        }
        return bestScore>0?pretty(best):"";
    }

    private String inferGenre(AudifyLibraryStore.Track t){
        String text=((t.title==null?"":t.title)+" "+(t.artist==null?"":t.artist)).toLowerCase(Locale.ROOT);
        if(text.contains("drill")) return "drill";
        if(text.contains("rap")||text.contains("freestyle")||text.contains("hip hop")||text.contains("hip-hop")) return "hip-hop / rap";
        if(text.contains("afro")||text.contains("amapiano")) return "afro / amapiano";
        if(text.contains("r&b")||text.contains("rnb")) return "r&b";
        if(text.contains("pop")) return "pop";
        if(text.contains("rock")||text.contains("metal")) return "rock";
        if(text.contains("electro")||text.contains("techno")||text.contains("house")) return "électro";
        return "";
    }

    private String normalize(String s){ return s==null?"":s.trim().toLowerCase(Locale.ROOT); }
    private String pretty(String s){
        if(s==null||s.isEmpty()) return "";
        if(s.equals("hip-hop / rap")) return "Hip-Hop / Rap";
        if(s.equals("r&b")) return "R&B";
        if(s.equals("afro / amapiano")) return "Afro / Amapiano";
        if(s.equals("électro")) return "Électro";
        return Character.toUpperCase(s.charAt(0))+s.substring(1);
    }
}
