package com.nova.audify;
import android.content.Context;
import org.json.*;
import java.util.*;

/** Public native library API backed by the current user's durable Firebase cache. */
public final class AudifyLibraryStore {
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

    private final AudifyFirebaseSync sync;
    private final String owner;
    public AudifyLibraryStore(Context context) { sync=AudifyFirebaseSync.get(context);owner=sync.uid(); }
    public boolean isLiked(String id) { return sync.readFor(owner,(s,c)->AudifyLibraryModel.active(s.get("like",id)),false); }
    public boolean toggleLike(Track t) {
        if(t==null||t.id.isEmpty())return false;
        return sync.editFor(owner,(s,c)-> {boolean liked=!AudifyLibraryModel.active(s.get("like",t.id));s.change("like",t.id,t.toJson(),!liked,c);return liked;},false);
    }
    public List<Track> getLikes() {return tracks("like",10000);}
    public void addRecent(Track t) {if(t!=null&&!t.id.isEmpty())sync.editFor(owner,(s,c)->{s.change("recent",t.id,t.toJson(),false,c);return true;},false);}
    public List<Track> getRecents(){return tracks("recent",100);}
    private List<Track> tracks(String kind,int limit){return sync.readFor(owner,(s,c)->convert(AudifyLibraryModel.tracks(s,kind,limit)),new ArrayList<>());}
    public List<String> getPlaylistNames(){return sync.readFor(owner,(s,c)->new ArrayList<>(AudifyLibraryModel.playlists(s).keySet()),new ArrayList<>());}
    public void createPlaylist(String name){sync.editFor(owner,(s,c)->AudifyLibraryModel.create(s,name,c),"");}
    public void addToPlaylist(String name,Track t){if(t!=null&&!t.id.isEmpty())sync.editFor(owner,(s,c)->{AudifyLibraryModel.add(s,name,t.toJson(),c);return true;},false);}
    public List<Track> getPlaylist(String name){return sync.readFor(owner,(s,c)->convert(AudifyLibraryModel.playlistTracks(s,name)),new ArrayList<>());}
    public void removeFromPlaylist(String name,String id){sync.editFor(owner,(s,c)->{AudifyLibraryModel.remove(s,name,id,c);return true;},false);}
    public void deletePlaylist(String name){sync.editFor(owner,(s,c)->{AudifyLibraryModel.delete(s,name,c);return true;},false);}
    private List<Track> convert(List<JSONObject> rows){List<Track> out=new ArrayList<>();for(JSONObject row:rows){Track t=Track.fromJson(row);if(t!=null)out.add(t);}return out;}
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
