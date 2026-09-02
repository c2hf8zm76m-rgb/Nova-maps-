package com.nova.audify;
import android.content.*;
import org.json.*;
import java.util.*;
import java.nio.charset.StandardCharsets;

/** Explicit, one-owner migration. Legacy credentials are never accepted or uploaded. */
public final class AudifyLegacyImport {
    public static String importLibrary(Context context,boolean guest){
        AudifyFirebaseSync sync=AudifyFirebaseSync.get(context);
        synchronized(sync){
            if(!sync.readyForImport())return "Attends la première connexion au cloud avant d’importer.";
            String uid=sync.uid(),source=guest?"guest":"legacy";
            SharedPreferences claims=context.getSharedPreferences("audify_firebase_migration",Context.MODE_PRIVATE);
            String owner=claims.getString(source+"_owner","");
            if(!owner.isEmpty()&&!owner.equals(uid))return "Ces données locales ont déjà été attribuées à un autre compte.";
            if(claims.getBoolean(source+"_done",false))return "Ces données ont déjà été importées.";
            // Claim first: a failed import may resume for this UID, never for a different account.
            if(!claims.edit().putString(source+"_owner",uid).commit())return "Impossible de préparer l’import.";
            try{
                final List<JSONObject> records=new ArrayList<>();
                if(guest){
                    AudifySyncState saved=new AudifySyncState(context.getSharedPreferences("audify_firebase_guest",Context.MODE_PRIVATE).getString("state",""));
                    for(String kind:Arrays.asList("like","recent","playlist","playlistItem","affinity"))records.addAll(saved.active(kind));
                }else{
                    SharedPreferences old=context.getSharedPreferences("audify_native_library_v679",Context.MODE_PRIVATE);
                    AudifySyncState imported=new AudifySyncState("");
                    for(String kind:Arrays.asList("like","recent")){
                        String key=kind.equals("like")?"likes_json":"recents_json";
                        JSONArray tracks=new JSONArray(old.getString(key,old.getString(key+"_backup","[]")));
                        for(int i=tracks.length()-1;i>=0;i--){JSONObject track=tracks.getJSONObject(i);imported.change(kind,track.getString("id"),track,false,false);}
                    }
                    JSONObject playlists=new JSONObject(old.getString("playlists_json",old.getString("playlists_json_backup","{}")));
                    Iterator<String> names=playlists.keys();
                    while(names.hasNext()){
                        String name=names.next(),id=UUID.nameUUIDFromBytes(("legacy:"+name).getBytes(StandardCharsets.UTF_8)).toString();
                        imported.change("playlist",id,new JSONObject().put("name",name.length()>140?name.substring(0,140):name),false,false);
                        JSONArray tracks=playlists.getJSONArray(name);
                        for(int i=0;i<tracks.length();i++){JSONObject track=tracks.getJSONObject(i);imported.change("playlistItem",id+":"+track.getString("id"),new JSONObject(track.toString()).put("playlistId",id),false,false);}
                    }
                    for(Map.Entry<String,?> entry:context.getSharedPreferences("audify_affinity_v68100",Context.MODE_PRIVATE).getAll().entrySet()){
                        String key=entry.getKey();if((key.startsWith("artist:")||key.startsWith("genre:"))&&entry.getValue() instanceof Integer)
                            imported.change("affinity",key+":legacy",new JSONObject().put("bucket",key).put("value",entry.getValue()),false,false);
                    }
                    for(String kind:Arrays.asList("like","recent","playlist","playlistItem","affinity"))records.addAll(imported.active(kind));
                }
                boolean ok=sync.edit((state,cloud)->{
                    for(JSONObject r:records){String kind=r.getString("kind"),key=r.getString("key");
                        if(!state.contains(kind,key))state.change(kind,key,r.getJSONObject("payload"),false,cloud);}
                    return true;
                },false);
                if(!ok)return "Import non enregistré. Les originaux sont conservés.";
                if(!claims.edit().putBoolean(source+"_done",true).commit())return "Données importées ; confirmation locale en attente. Les originaux sont conservés.";
                return "Données importées. Envoi au cloud en cours ; les originaux sont conservés.";
            }catch(Exception e){return "Import impossible : données locales illisibles. Les originaux sont conservés.";}
        }
    }
}
