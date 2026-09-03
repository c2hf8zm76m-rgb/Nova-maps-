package com.nova.audify;

import org.json.*;
import java.util.*;

public final class AudifyAlbumPlaylistModelTest {
    private static int checks;
    private static void check(boolean ok,String message){checks++;if(!ok)throw new AssertionError(message);}
    private static JSONObject album(String key,String title)throws Exception{
        return new JSONObject().put("albumKey",key).put("title",title).put("artist","Werenoi")
            .put("date","2025-04-11").put("totalCount",3).put("cover","https://example.com/cover.jpg");
    }
    private static JSONObject track(String id)throws Exception{
        return new JSONObject().put("id",id).put("title","Titre "+id).put("artist","Werenoi").put("thumbnail","");
    }
    private static List<JSONObject> tracks()throws Exception{return Arrays.asList(track("z-last-alphabetically"),track("a-first"),track("m-middle"));}
    private static String ids(List<JSONObject> rows){StringJoiner out=new StringJoiner(",");for(JSONObject r:rows)out.add(r.optString("id"));return out.toString();}

    public static void main(String[] args)throws Exception{
        AudifySyncState state=new AudifySyncState("");
        String name=AudifyAlbumPlaylistModel.save(state,album("release:one","Mon album"),tracks(),true);
        check(name.equals("Album — Mon album"),"automatic album name");
        check(AudifyLibraryModel.playlists(state).size()==1,"album is a normal playlist");
        check(AudifyAlbumPlaylistModel.metadata(state,name).optString("artist").equals("Werenoi"),"artist metadata");
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(state,name)).equals("z-last-alphabetically,a-first,m-middle"),"official order, not lexical order");
        check(state.pendingCount()==4,"only playlist + 3 tracks queued for cloud");
        JSONObject pending=state.pendingCopy();
        for(Iterator<String> it=pending.keys();it.hasNext();){
            JSONObject r=pending.getJSONObject(it.next()),payload=r.getJSONObject("payload");
            check(Arrays.asList("playlist","playlistItem").contains(r.getString("kind")),"no new remote kind");
            check(payload.length()==(r.getString("kind").equals("playlist")?1:5),"existing strict cloud schema unchanged");
        }
        String before=state.save();
        check(AudifyAlbumPlaylistModel.save(state,album("release:one","Renamed source"),tracks(),true).equals(name),"repeat save opens existing playlist");
        check(state.save().equals(before),"repeat save is a no-op");
        AudifySyncState restored=new AudifySyncState(state.save());
        check(AudifyAlbumPlaylistModel.find(restored,"release:one").equals(name),"dedup survives restart");
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(restored,name)).equals("z-last-alphabetically,a-first,m-middle"),"order survives restart");

        // Server acknowledgement times may arrive in a different order; album order remains explicit.
        int stamp=500;
        JSONObject ack=restored.pendingCopy();
        for(Iterator<String> it=ack.keys();it.hasNext();){String doc=it.next();JSONObject r=ack.getJSONObject(doc);
            restored.acknowledge(doc,r.getString("opId"));r.put("serverTime",stamp--);restored.acceptRemote(doc,r);}
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(restored,name)).equals("z-last-alphabetically,a-first,m-middle"),"cloud echoes cannot shuffle album");
        AudifyLibraryModel.remove(restored,name,"a-first",true);
        AudifyLibraryModel.add(restored,name,track("bonus"),true);
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(restored,name)).equals("z-last-alphabetically,m-middle,bonus"),"remove tracks and append bonus tracks");
        AudifyAlbumPlaylistModel.save(restored,album("release:one","Mon album"),tracks(),true);
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(restored,name)).equals("z-last-alphabetically,m-middle,bonus"),"repeat save never overwrites user edits");

        String oldId=AudifyLibraryModel.playlists(restored).get(name);
        AudifyLibraryModel.delete(restored,name,true);
        check(AudifyAlbumPlaylistModel.find(restored,"release:one").isEmpty(),"deleted album is not treated as saved");
        String again=AudifyAlbumPlaylistModel.save(restored,album("release:one","Mon album"),tracks(),true);
        check(!oldId.equals(AudifyLibraryModel.playlists(restored).get(again)),"deleted playlist identity never reused");
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(restored,again)).equals("z-last-alphabetically,a-first,m-middle"),"re-save has only new album tracks");

        AudifySyncState ordinary=new AudifySyncState("");
        AudifyLibraryModel.add(ordinary,"Album — Mon album",track("personal"),false);
        String unique=AudifyAlbumPlaylistModel.save(ordinary,album("release:two","Mon album"),tracks(),false);
        check(unique.equals("Album — Mon album (2)"),"same-named existing playlist preserved");
        check(ids(AudifyLibraryModel.playlistTracks(ordinary,"Album — Mon album")).equals("personal"),"never overwrites an ordinary playlist");
        check(AudifyAlbumPlaylistModel.metadata(ordinary,"Album — Mon album")==null,"ordinary playlist has no album card");
        check(ids(AudifyAlbumPlaylistModel.orderedTracks(ordinary,"Album — Mon album")).equals(ids(AudifyLibraryModel.playlistTracks(ordinary,"Album — Mon album"))),"ordinary sorting unchanged");
        check(ordinary.pendingCount()==0,"guest save stays local");
        check(AudifyAlbumPlaylistModel.find(new AudifySyncState(""),"release:two").isEmpty(),"separate account state has no album data");

        AudifySyncState colliding=new AudifySyncState("");
        colliding.change("playlist","first-cloud-id",new JSONObject().put("name","Album — Shared name"),false,false);
        colliding.change("playlist","second-cloud-id",new JSONObject().put("name","Album — Shared name"),false,false);
        String collision=AudifyAlbumPlaylistModel.save(colliding,album("release:collision","Shared name"),tracks(),false);
        check(collision.equals("Album — Shared name (2)"),"reserve raw names hidden by cloud disambiguation");
        check(AudifyAlbumPlaylistModel.orderedTracks(colliding,collision).size()==3,"returned name opens the saved playlist after cloud name collisions");

        AudifySyncState validation=new AudifySyncState("");String empty=validation.save();
        try{AudifyAlbumPlaylistModel.save(validation,album("release:empty","Empty"),Collections.emptyList(),true);throw new AssertionError("empty accepted");}catch(IllegalArgumentException expected){}
        check(validation.save().equals(empty),"empty album creates nothing");
        try{AudifyAlbumPlaylistModel.save(validation,album("release:bad","Bad"),Arrays.asList(track("")),true);throw new AssertionError("invalid accepted");}catch(IllegalArgumentException expected){}
        check(validation.save().equals(empty),"invalid IDs create nothing");
        String partial=AudifyAlbumPlaylistModel.save(validation,album("release:partial","Partial"),Arrays.asList(track("same"),track("same")),true);
        check(AudifyLibraryModel.playlistTracks(validation,partial).size()==1,"duplicate video references excluded");
        check(AudifyAlbumPlaylistModel.metadata(validation,partial).getInt("savedCount")==1,"actual imported count");
        check(AudifyAlbumPlaylistModel.metadata(validation,partial).getInt("totalCount")==3,"original total retained for partial label");
        StringBuilder longName=new StringBuilder();for(int i=0;i<200;i++)longName.append("🎵");
        String bounded=AudifyAlbumPlaylistModel.save(validation,album("release:long",longName.toString()),tracks(),true);
        check(bounded.length()<=140&&!Character.isHighSurrogate(bounded.charAt(bounded.length()-1)),"long Unicode name fits existing schema");
        System.out.println("Audify album playlists: "+checks+" model checks passed");
    }
}
