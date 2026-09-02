package com.nova.audify;

import org.json.*;
import java.util.*;

/** Entity-level merge model. A deleted playlist's identity is never reused. */
public final class AudifyLibraryModel {
    public static boolean active(JSONObject record){return record!=null&&!record.optBoolean("deleted");}
    public static List<JSONObject> tracks(AudifySyncState state,String kind,int limit) throws Exception {
        List<JSONObject> records=state.active(kind);
        records.sort((a,b)->Long.compare(time(b),time(a)));
        List<JSONObject> out=new ArrayList<>();for(JSONObject r:records){if(out.size()>=limit)break;out.add(r.getJSONObject("payload"));}return out;
    }
    private static long time(JSONObject record){return record.optLong("serverTime",record.optLong("clientTime"));}
    public static SortedMap<String,String> playlists(AudifySyncState state)throws Exception {
        List<JSONObject> records=state.active("playlist");Map<String,Integer> counts=new HashMap<>();
        for(JSONObject r:records){String name=r.getJSONObject("payload").getString("name");counts.put(name,counts.getOrDefault(name,0)+1);}
        SortedMap<String,String> out=new TreeMap<>();
        for(JSONObject r:records){String name=r.getJSONObject("payload").getString("name"),id=r.getString("key");
            if(counts.get(name)>1)name+=" ["+id+"]";out.put(name,id);}
        return out;
    }
    public static String create(AudifySyncState state,String raw,boolean cloud)throws Exception {
        String name=raw==null?"":raw.trim();if(name.isEmpty())name="Ma playlist";if(name.length()>140)name=name.substring(0,140);
        String old=playlists(state).get(name);if(old!=null)return old;
        String id=UUID.randomUUID().toString();state.change("playlist",id,new JSONObject().put("name",name),false,cloud);return id;
    }
    public static void add(AudifySyncState state,String name,JSONObject track,boolean cloud)throws Exception {
        String playlist=create(state,name,cloud);String key=playlist+":"+track.getString("id");
        if(active(state.get("playlistItem",key)))return;
        JSONObject payload=new JSONObject(track.toString()).put("playlistId",playlist);
        state.change("playlistItem",key,payload,false,cloud);
    }
    public static List<JSONObject> playlistTracks(AudifySyncState state,String name)throws Exception {
        String id=playlists(state).get(name);List<JSONObject> out=new ArrayList<>();if(id==null)return out;
        List<JSONObject> records=state.active("playlistItem");records.sort((a,b)->{int time=Long.compare(time(a),time(b));return time!=0?time:a.optString("key").compareTo(b.optString("key"));});
        for(JSONObject r:records){JSONObject p=r.getJSONObject("payload");if(id.equals(p.optString("playlistId")))out.add(p);}return out;
    }
    public static void remove(AudifySyncState state,String name,String track,boolean cloud)throws Exception {
        String id=playlists(state).get(name);if(id==null)return;JSONObject old=state.get("playlistItem",id+":"+track);
        if(old!=null)state.change("playlistItem",id+":"+track,old.getJSONObject("payload"),true,cloud);
    }
    public static void delete(AudifySyncState state,String name,boolean cloud)throws Exception {
        String id=playlists(state).get(name);if(id==null)return;JSONObject old=state.get("playlist",id);
        state.change("playlist",id,old.getJSONObject("payload"),true,cloud);
    }
}
