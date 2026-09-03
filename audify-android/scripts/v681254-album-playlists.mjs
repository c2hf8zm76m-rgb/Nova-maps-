import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const java=path.join(root,'android/app/src/main/java/com/nova/audify');
const read=name=>readFile(path.join(java,`${name}.java`),'utf8');
const write=(name,source)=>writeFile(path.join(java,`${name}.java`),source);
// Snapshot the V53 output immediately before applying this feature. Some legacy
// generators are stateful on repeated runs, so compare the actual input/output,
// not stale files left over in a previous local build directory.
const protectedNames=['AudifyPlaybackService','AudifyYoutubeDataSourceFactory','AudifyYoutubeSearchEngine',
    'NativePlayerActivity','NativeKaraokeActivity','AudifyFirebaseSync','AudifySyncState','AudifyLibraryModel',
    'AudifyDiscoveryAgent','AudifyNetworkGuard'];
const protectedHashes={};
for(const name of protectedNames)protectedHashes[name]=createHash('sha256').update(await read(name)).digest('hex');
function replaceOnce(source,before,after){
    if(!source.includes(before)||source.indexOf(before)!==source.lastIndexOf(before))throw new Error(`Album integration anchor missing or ambiguous: ${before.slice(0,90)}`);
    return source.replace(before,after);
}
for(const name of ['AudifyAlbumPlaylistModel','AudifyAlbumPlaylistCard'])
    await copyFile(path.join(root,'album-playlists/src/com/nova/audify',`${name}.java`),path.join(java,`${name}.java`));

let store=await read('AudifyLibraryStore');
if(!store.includes('saveAlbumPlaylist(')){
    store=replaceOnce(store,'    public void createPlaylist(String name)',`    // Album UI metadata and order are saved locally inside the existing owner-bound transaction.
    public JSONObject getAlbumMetadata(String name){return sync.readFor(owner,(s,c)->AudifyAlbumPlaylistModel.metadata(s,name),null);}
    public String findSavedAlbum(String key){return sync.readFor(owner,(s,c)->AudifyAlbumPlaylistModel.find(s,key),"");}
    public String saveAlbumPlaylist(JSONObject album,List<Track> items){
        if(album==null||items==null||items.isEmpty())return "";
        return sync.editFor(owner,(s,c)->{
            List<JSONObject> rows=new ArrayList<>();for(Track t:items)if(t!=null)rows.add(t.toJson());
            return AudifyAlbumPlaylistModel.save(s,album,rows,c);
        },"");
    }
    public void createPlaylist(String name)`);
    store=replaceOnce(store,'convert(AudifyLibraryModel.playlistTracks(s,name))','convert(AudifyAlbumPlaylistModel.orderedTracks(s,name))');
    await write('AudifyLibraryStore',store);
}

let home=await read('NativeHomeActivity');
if(!home.includes('AudifyAlbumPlaylistCard.create')){
    home=replaceOnce(home,`                List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
                LinearLayout card=new LinearLayout(this);`,`                List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
                org.json.JSONObject albumMeta=store.getAlbumMetadata(name);
                if(albumMeta!=null){
                    View albumCard=AudifyAlbumPlaylistCard.create(this,name,albumMeta,tracks.size(),this::loadImage,
                        ()->startActivity(new Intent(this,NativePlaylistActivity.class).putExtra("playlist",name)));
                    LinearLayout.LayoutParams albumLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
                    albumLp.topMargin=dp(12);panel.addView(albumCard,albumLp);continue;
                }
                LinearLayout card=new LinearLayout(this);`);
    await write('NativeHomeActivity',home);
}

let library=await read('NativeLibraryActivity');
if(!library.includes('AudifyAlbumPlaylistCard.create')){
    library=replaceOnce(library,'    private AudifyLibraryStore store;',`    private AudifyLibraryStore store;
    private final java.util.concurrent.ExecutorService albumImages=java.util.concurrent.Executors.newFixedThreadPool(2);
    private final AudifyArtworkLoader albumArtwork=new AudifyArtworkLoader(albumImages);
    @Override protected void onDestroy(){albumArtwork.close();albumImages.shutdownNow();super.onDestroy();}`);
    library=replaceOnce(library,`            List<AudifyLibraryStore.Track> tracks = store.getPlaylist(name);
            TextView row`, `            List<AudifyLibraryStore.Track> tracks = store.getPlaylist(name);
            org.json.JSONObject albumMeta=store.getAlbumMetadata(name);
            if(albumMeta!=null){
                android.view.View albumCard=AudifyAlbumPlaylistCard.create(this,name,albumMeta,tracks.size(),(view,url)->albumArtwork.load(view,url,ok->{}),
                    ()->startActivity(new Intent(this,NativePlaylistActivity.class).putExtra("playlist",name)));
                LinearLayout.LayoutParams albumLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
                albumLp.bottomMargin=dp(12);root.addView(albumCard,albumLp);continue;
            }
            TextView row`);
    await write('NativeLibraryActivity',library);
}

let playlist=await read('NativePlaylistActivity');
if(!playlist.includes('AudifyAlbumPlaylistCard.create')){
    playlist=replaceOnce(playlist,'    private final ExecutorService images=Executors.newFixedThreadPool(3);',`    private final ExecutorService images=Executors.newFixedThreadPool(3);
    private final AudifyArtworkLoader albumArtwork=new AudifyArtworkLoader(images);`);
    playlist=replaceOnce(playlist,'        List<AudifyLibraryStore.Track> tracks=store.getPlaylist(playlistName);',`        List<AudifyLibraryStore.Track> tracks=store.getPlaylist(playlistName);
        org.json.JSONObject albumMeta=store.getAlbumMetadata(playlistName);`);
    playlist=replaceOnce(playlist,'text("AUDIFY PLAYLIST",11f','text(albumMeta==null?"AUDIFY PLAYLIST":"AUDIFY ALBUM",11f');
    const begin='        LinearLayout hero=new LinearLayout(this);';
    const end='        TextView section=text("Titres",22f';
    const start=playlist.indexOf(begin),stop=playlist.indexOf(end,start);
    if(start<0||stop<0)throw new Error('Playlist hero anchors missing');
    const originalHero=playlist.slice(start,stop);
    playlist=playlist.slice(0,start)+`        if(albumMeta!=null){
            View albumCard=AudifyAlbumPlaylistCard.create(this,playlistName,albumMeta,tracks.size(),(view,url)->albumArtwork.load(view,url,ok->{}),
                ()->playCollection(tracks,0),tracks.isEmpty()?"Aucun titre":"▶  Tout lire");
            LinearLayout.LayoutParams albumLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
            albumLp.topMargin=dp(8);content.addView(albumCard,albumLp);
            Button removeAlbum=button("Supprimer la playlist",false);removeAlbum.setTextColor(Color.rgb(255,126,139));
            removeAlbum.setOnClickListener(v->confirmDelete());
            LinearLayout.LayoutParams removeLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48));
            removeLp.topMargin=dp(12);content.addView(removeAlbum,removeLp);
        }else{
`+originalHero+`        }

`+playlist.slice(stop);
    playlist=replaceOnce(playlist,'@Override protected void onDestroy(){images.shutdownNow();','@Override protected void onDestroy(){albumArtwork.close();images.shutdownNow();');
    await write('NativePlaylistActivity',playlist);
}

const tests=path.join(root,'android/app/src/test/java/com/nova/audify');
await mkdir(tests,{recursive:true});
await copyFile(path.join(root,'album-playlists/tests/AudifyAlbumPlaylistModelTest.java'),path.join(tests,'AudifyAlbumPlaylistModelTest.java'));
await writeFile(path.join(tests,'AlbumPlaylistTest.java'),'package com.nova.audify; public class AlbumPlaylistTest { @org.junit.Test public void albumSaveOrderAndIsolation() throws Exception { AudifyAlbumPlaylistModelTest.main(new String[0]); } }');
const gradlePath=path.join(root,'android/app/build.gradle');
let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode\s+\d+/,'versionCode 681254').replace(/versionName\s+["'][^"']+["']/,'versionName "68.12.54"');
await writeFile(gradlePath,gradle);
for(const name of protectedNames){
    const after=createHash('sha256').update(await read(name)).digest('hex');
    if(after!==protectedHashes[name])throw new Error(`Album patch changed protected source: ${name}`);
}
await writeFile(path.join(root,'android/album-playlists-input-hashes.json'),JSON.stringify(protectedHashes,null,2));
console.log('Audify V68.12.54: albums saved in Playlists, distinct cards; extractor and playback untouched.');
