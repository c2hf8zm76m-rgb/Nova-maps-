import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// V68.13.3 — Fix album -> playlist persistence.
// The historical bridge used reflection against saveAlbumPlaylist/findSavedAlbum,
// methods that are no longer part of the final AudifyLibraryStore. That compiled
// successfully but failed at runtime when the user tapped the album save button.
// This late patch deliberately uses the current public playlist API directly.
const source=String.raw`package com.nova.audify;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.text.TextUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Audify V68.13.3 — reliable album-to-playlist persistence without reflection. */
final class AudifyInstantAlbumLibrary {
    static final String MARKER="AUDIFY_V68133_ALBUM_PLAYLIST_SAVE_FIX";
    private static final String PREFS="audify_album_playlist_map_v68133";
    private static final String PREFIX="album_";

    private static String mappingKey(AudifyInstantAlbumMetadata.Album album){
        String raw=album==null?"":AudifyInstantAlbumMetadata.savedKey(album);
        return PREFIX+Integer.toHexString(raw.hashCode());
    }

    private static String clean(String value,String fallback){
        String out=value==null?"":value.trim();
        return out.isEmpty()?fallback:out;
    }

    private static Set<String> playlistNames(AudifyLibraryStore store){
        HashSet<String> out=new HashSet<>();
        if(store!=null){
            try{out.addAll(store.getPlaylistNames());}catch(Throwable ignored){}
        }
        return out;
    }

    static String find(Context context,AudifyInstantAlbumMetadata.Album album){
        if(context==null||album==null)return "";
        SharedPreferences prefs=context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        String key=mappingKey(album);
        String mapped=prefs.getString(key,"");
        if(TextUtils.isEmpty(mapped))return "";
        try{
            AudifyLibraryStore store=new AudifyLibraryStore(context);
            if(playlistNames(store).contains(mapped))return mapped;
        }catch(Throwable ignored){}
        // The playlist was deleted manually: do not leave the album in a false saved state.
        prefs.edit().remove(key).commit();
        return "";
    }

    static String save(Context context,AudifyInstantAlbumMetadata.Album album,List<AudifyInstantAlbumResolver.Playable> queue)throws Exception{
        if(context==null)throw new IllegalArgumentException("context missing");
        if(album==null)throw new IllegalArgumentException("album missing");
        if(queue==null||queue.isEmpty())throw new IllegalArgumentException("album queue empty");

        Context app=context.getApplicationContext();
        AudifyLibraryStore store=new AudifyLibraryStore(app);
        SharedPreferences prefs=app.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        String mapKey=mappingKey(album);

        String name=find(app,album);
        if(TextUtils.isEmpty(name)){
            Set<String> existing=playlistNames(store);
            String base=clean(album.title,"Album");
            name=base;
            if(existing.contains(name)){
                String artist=clean(album.artist,"");
                if(!artist.isEmpty())name=base+" · "+artist;
            }
            if(existing.contains(name)){
                String year="";
                if(album.date!=null&&album.date.length()>=4)year=album.date.substring(0,4);
                if(!year.isEmpty())name=name+" · "+year;
            }
            if(existing.contains(name)){
                String stem=name+" · Album";
                name=stem;
                int n=2;
                while(existing.contains(name))name=stem+" "+(n++);
            }
        }

        int stored=0;
        for(AudifyInstantAlbumResolver.Playable playable:queue){
            if(playable==null||TextUtils.isEmpty(playable.id))continue;
            store.addToPlaylist(name,new AudifyLibraryStore.Track(
                playable.id,
                clean(playable.title,"Sans titre"),
                clean(playable.artist,clean(album.artist,"YouTube")),
                clean(playable.thumbnail,"")
            ));
            stored++;
        }
        if(stored==0)throw new IllegalStateException("no playable album tracks");

        if(!prefs.edit().putString(mapKey,name).commit())
            throw new IllegalStateException("album mapping persistence failed");
        return name;
    }

    static void open(Activity activity,String name,Dialog dialog){
        if(activity==null)return;
        try{
            Intent intent=new Intent(activity,NativePlaylistActivity.class);
            intent.putExtra("playlist",clean(name,"Ma playlist"));
            activity.startActivity(intent);
            if(dialog!=null)dialog.dismiss();
        }catch(Throwable ignored){
            try{if(dialog!=null)dialog.dismiss();}catch(Throwable ignored2){}
        }
    }
}
`;

await writeFile(path.join(pkgDir,'AudifyInstantAlbumLibrary.java'),source,'utf8');
console.log('Audify V68.13.3: album playlist save bridge replaced with direct persistent playlist API.');
