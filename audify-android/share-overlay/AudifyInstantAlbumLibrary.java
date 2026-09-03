package com.nova.audify;
import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
final class AudifyInstantAlbumLibrary {
    private static final String STORE="com.nova.audify.AudifyLibraryStore", TRACK="com.nova.audify.AudifyLibraryStore$Track", PLAYLIST="com.nova.audify.NativePlaylistActivity";
    static String find(Context c,AudifyInstantAlbumMetadata.Album a){try{Class<?> k=Class.forName(STORE);Constructor<?> x=k.getDeclaredConstructor(Context.class);x.setAccessible(true);Object s=x.newInstance(c);Method m=k.getDeclaredMethod("findSavedAlbum",String.class);m.setAccessible(true);Object v=m.invoke(s,AudifyInstantAlbumMetadata.savedKey(a));return v==null?"":String.valueOf(v);}catch(Throwable e){return "";}}
    static String save(Context c,AudifyInstantAlbumMetadata.Album a,List<AudifyInstantAlbumResolver.Playable> q)throws Exception{Class<?> k=Class.forName(STORE);Constructor<?> sx=k.getDeclaredConstructor(Context.class);sx.setAccessible(true);Object store=sx.newInstance(c);Class<?> tk=Class.forName(TRACK);Constructor<?> tc=tk.getDeclaredConstructor(String.class,String.class,String.class,String.class);tc.setAccessible(true);ArrayList<Object> tracks=new ArrayList<>();JSONArray order=new JSONArray();for(AudifyInstantAlbumResolver.Playable p:q){tracks.add(tc.newInstance(p.id,p.title,p.artist,p.thumbnail));order.put(p.id);}JSONObject meta=new JSONObject();meta.put("albumKey",AudifyInstantAlbumMetadata.savedKey(a));meta.put("title",a.title);meta.put("artist",a.artist);meta.put("date",a.date);meta.put("releaseId",a.releaseId);meta.put("releaseGroupId",a.groupId);meta.put("totalCount",a.tracks.size());meta.put("savedCount",q.size());meta.put("cover",AudifyInstantAlbumMetadata.cover(a));meta.put("order",order);Method m=k.getDeclaredMethod("saveAlbumPlaylist",JSONObject.class,List.class);m.setAccessible(true);Object out=m.invoke(store,meta,tracks);return out==null?a.title:String.valueOf(out);}
    static void open(Activity a,String name,Dialog d){try{Class<?> c=Class.forName(PLAYLIST);Intent i=new Intent(a,c);i.putExtra("playlist",name);a.startActivity(i);d.dismiss();}catch(Throwable e){try{d.dismiss();}catch(Throwable ignored){}}}
}
