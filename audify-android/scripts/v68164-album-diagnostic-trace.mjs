import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const applePath=path.join(pkgDir,'AudifyAppleReleaseGraphResolver.java');
const deezerPath=path.join(pkgDir,'AudifyReleasePreferenceResolver.java');
const albumsPath=path.join(pkgDir,'AudifyInstantAlbums.java');

function req(src,from,to,label){
  if(!src.includes(from))throw new Error('V68.16.4 diagnostic: missing '+label);
  return src.replace(from,to);
}

// ---------------- metadata trace ----------------
let meta=await readFile(metaPath,'utf8');
const traceAnchor='    private static long lastMb;';
const traceCode=String.raw`    static final String DIAGNOSTIC_MARKER="AUDIFY_V68164_ALBUM_DIAGNOSTIC_TRACE";
    static final String VISIBLE_DIAGNOSTIC_MARKER="AUDIFY_V68164_VISIBLE_FAILURE_DIAGNOSTIC";
    private static volatile String LAST_DIAGNOSTIC="";

    static synchronized void debugReset(String rawTitle,String rawArtist,String videoId){
        LAST_DIAGNOSTIC="INPUT\nvideoId="+diagSafe(videoId)+"\ntitle="+diagSafe(rawTitle)+"\nartist="+diagSafe(rawArtist);
    }
    static synchronized void debug(String step){
        if(TextUtils.isEmpty(step))return;
        String next=(TextUtils.isEmpty(LAST_DIAGNOSTIC)?"":LAST_DIAGNOSTIC+"\n")+step;
        if(next.length()>5200)next=next.substring(next.length()-5200);
        LAST_DIAGNOSTIC=next;
        try{android.util.Log.e("AUDIFY_ALBUM_TRACE",step);}catch(Throwable ignored){}
    }
    static String diagnostic(){return LAST_DIAGNOSTIC==null?"":LAST_DIAGNOSTIC;}
    private static String diagSafe(String s){
        if(s==null)return "";
        String x=s.replace('\r',' ').replace('\n',' ').replaceAll("\\s+"," ").trim();
        return x.length()>220?x.substring(0,220)+"…":x;
    }

`;
meta=req(meta,traceAnchor,traceAnchor+'\n'+traceCode,'metadata trace anchor');

const identifyAnchor='    static Album identify(String rawTitle,String rawArtist,String videoId)throws Exception{\n        YoutubeEvidence yt=new YoutubeEvidence();';
meta=req(meta,identifyAnchor,'    static Album identify(String rawTitle,String rawArtist,String videoId)throws Exception{\n        debugReset(rawTitle,rawArtist,videoId);\n        YoutubeEvidence yt=new YoutubeEvidence();','identify entry');

const ytTry='        try{if(!TextUtils.isEmpty(videoId))yt=youtubeEvidence(videoId);}catch(Throwable ignored){}';
const ytTrace=String.raw`        try{
            if(!TextUtils.isEmpty(videoId))yt=youtubeEvidence(videoId);
            debug("YT_EVIDENCE title="+diagSafe(yt.title)+" | artist="+diagSafe(yt.artist)+" | descLen="+(yt.description==null?0:yt.description.length())+" | rawHint="+diagSafe(yt.albumHint)+" | durationMs="+yt.durationMs);
        }catch(Throwable e){
            debug("YT_EVIDENCE_ERROR "+e.getClass().getSimpleName()+": "+diagSafe(e.getMessage()));
        }`;
meta=req(meta,ytTry,ytTrace,'YouTube evidence try');

const hintLine='        String hint=cleanAlbumHint(yt.albumHint,title,artist);';
meta=req(meta,hintLine,hintLine+'\n        debug("NORMALIZED title="+diagSafe(title)+" | artist="+diagSafe(artist)+" | hint="+diagSafe(hint)+" | durationMs="+durationMs);','normalized identity');

const appleOuter=String.raw`        try{
            Album appleGraph=AudifyAppleReleaseGraphResolver.identify(title,artist,durationMs,hint);
            if(appleGraph!=null&&appleGraph.tracks.size()>=4&&appleGraph.confidence>=90)return appleGraph;
        }catch(Throwable ignored){}
`;
const appleOuterTrace=String.raw`        try{
            debug("APPLE_GRAPH_START");
            Album appleGraph=AudifyAppleReleaseGraphResolver.identify(title,artist,durationMs,hint);
            if(appleGraph!=null&&appleGraph.tracks.size()>=4&&appleGraph.confidence>=90){debug("APPLE_GRAPH_ACCEPT "+diagSafe(appleGraph.title)+" tracks="+appleGraph.tracks.size()+" conf="+appleGraph.confidence);return appleGraph;}
            debug("APPLE_GRAPH_RETURNED_NULL_OR_WEAK");
        }catch(Throwable e){debug("APPLE_GRAPH_ERROR "+e.getClass().getSimpleName()+": "+diagSafe(e.getMessage()));}
`;
meta=req(meta,appleOuter,appleOuterTrace,'Apple graph outer call');

const deezerOuter=String.raw`        try{
            Album promoted=AudifyReleasePreferenceResolver.identify(title,artist,durationMs,hint);
            if(promoted!=null&&promoted.tracks.size()>=4&&promoted.confidence>=90)return promoted;
        }catch(Throwable ignored){}
        return null;`;
const deezerOuterTrace=String.raw`        try{
            debug("DEEZER_DISCOGRAPHY_START");
            Album promoted=AudifyReleasePreferenceResolver.identify(title,artist,durationMs,hint);
            if(promoted!=null&&promoted.tracks.size()>=4&&promoted.confidence>=90){debug("DEEZER_DISCOGRAPHY_ACCEPT "+diagSafe(promoted.title)+" tracks="+promoted.tracks.size()+" conf="+promoted.confidence);return promoted;}
            debug("DEEZER_DISCOGRAPHY_RETURNED_NULL_OR_WEAK");
        }catch(Throwable e){debug("DEEZER_DISCOGRAPHY_ERROR "+e.getClass().getSimpleName()+": "+diagSafe(e.getMessage()));}
        debug("FINAL_REJECT no reliable multi-track canonical album");
        return null;`;
meta=req(meta,deezerOuter,deezerOuterTrace,'Deezer discography outer call');
await writeFile(metaPath,meta,'utf8');

// ---------------- Apple release graph reject reasons ----------------
let apple=await readFile(applePath,'utf8');
const appleMarker='    static final String HINT_COLLECTION_MARKER="AUDIFY_V68162_HINT_TO_COLLECTION_LOOKUP";';
apple=req(apple,appleMarker,appleMarker+'\n    static final String DIAGNOSTIC_MARKER="AUDIFY_V68164_APPLE_REJECT_REASONS";','Apple diagnostic marker');

const appleInput='        String title=clean(rawTitle),artist=clean(rawArtist),hint=clean(albumHint);\n        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist))return null;';
apple=req(apple,appleInput,'        String title=clean(rawTitle),artist=clean(rawArtist),hint=clean(albumHint);\n        AudifyInstantAlbumMetadata.debug("APPLE_INPUT title="+title+" | artist="+artist+" | hint="+hint+" | durationMs="+durationMs);\n        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist)){AudifyInstantAlbumMetadata.debug("APPLE_REJECT empty title/artist");return null;}','Apple input');

const uniqueEmpty='        if(unique.isEmpty())return null;';
apple=req(apple,uniqueEmpty,'        if(unique.isEmpty()){AudifyInstantAlbumMetadata.debug("APPLE_REJECT no collection seeds");return null;}\n        AudifyInstantAlbumMetadata.debug("APPLE_SEED_COUNT "+unique.size());','Apple seed empty');

const appleCatch='            try{r=loadCollection(seed,title,baseTitle,artist,durationMs,hint);}catch(Throwable ignored){continue;}\n            if(r==null||r.album==null)continue;';
apple=req(apple,appleCatch,'            try{r=loadCollection(seed,title,baseTitle,artist,durationMs,hint);}catch(Throwable e){AudifyInstantAlbumMetadata.debug("APPLE_COLLECTION_ERROR "+seed.collectionName+" :: "+e.getClass().getSimpleName()+" "+String.valueOf(e.getMessage()));continue;}\n            if(r==null||r.album==null){AudifyInstantAlbumMetadata.debug("APPLE_COLLECTION_REJECT "+seed.collectionName+" count="+seed.trackCount+" seedScore="+seed.score);continue;}','Apple collection probe');

const appleFinal='        return best!=null&&best.album.confidence>=90?best.album:null;';
apple=req(apple,appleFinal,'        if(best!=null&&best.album!=null&&best.album.confidence>=90){AudifyInstantAlbumMetadata.debug("APPLE_BEST "+best.album.title+" conf="+best.album.confidence+" tracks="+best.album.tracks.size());return best.album;}\n        AudifyInstantAlbumMetadata.debug("APPLE_REJECT no verified album after probes");\n        return null;','Apple final');

apple=req(apple,'        JSONArray rows=root.optJSONArray("results");if(rows==null||rows.length()<5)return null;','        JSONArray rows=root.optJSONArray("results");if(rows==null||rows.length()<5){AudifyInstantAlbumMetadata.debug("APPLE_LOAD_REJECT "+seed.collectionName+" lookup rows<5");return null;}','Apple rows reject');
apple=req(apple,'        if(declared<4||declared>60)return null;','        if(declared<4||declared>60){AudifyInstantAlbumMetadata.debug("APPLE_LOAD_REJECT "+albumTitle+" declaredTracks="+declared);return null;}','Apple declared count reject');
apple=req(apple,'        if(genericCompilationArtist(albumArtist)||!artistMatch(artist,albumArtist))return null;','        if(genericCompilationArtist(albumArtist)||!artistMatch(artist,albumArtist)){AudifyInstantAlbumMetadata.debug("APPLE_LOAD_REJECT artist mismatch wanted="+artist+" got="+albumArtist+" album="+albumTitle);return null;}','Apple album artist reject');
apple=req(apple,'        if(album.tracks.size()<4||bestIndex<0||bestMatch<200)return null;','        if(album.tracks.size()<4||bestIndex<0||bestMatch<200){AudifyInstantAlbumMetadata.debug("APPLE_LOAD_REJECT track proof album="+album.title+" tracks="+album.tracks.size()+" bestMatch="+bestMatch);return null;}','Apple track proof reject');
apple=req(apple,'        if(artistRows>=4&&artistHits*100/artistRows<35)return null;','        if(artistRows>=4&&artistHits*100/artistRows<35){AudifyInstantAlbumMetadata.debug("APPLE_LOAD_REJECT artist affinity album="+album.title+" hits="+artistHits+"/"+artistRows);return null;}','Apple affinity reject');
await writeFile(applePath,apple,'utf8');

// ---------------- Deezer discography reject reasons ----------------
let deezer=await readFile(deezerPath,'utf8');
const deezerMarker='    static final String DISCOGRAPHY_MARKER="AUDIFY_V68160_ARTIST_DISCOGRAPHY_PROOF";';
deezer=req(deezer,deezerMarker,deezerMarker+'\n    static final String DIAGNOSTIC_MARKER="AUDIFY_V68164_DEEZER_REJECT_REASONS";','Deezer diagnostic marker');

const deezerInput='        String title=clean(rawTitle),artist=clean(rawArtist),hint=clean(albumHint);\n        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist))return null;';
deezer=req(deezer,deezerInput,'        String title=clean(rawTitle),artist=clean(rawArtist),hint=clean(albumHint);\n        AudifyInstantAlbumMetadata.debug("DEEZER_INPUT title="+title+" | artist="+artist+" | hint="+hint+" | durationMs="+durationMs);\n        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist)){AudifyInstantAlbumMetadata.debug("DEEZER_REJECT empty title/artist");return null;}','Deezer input');

deezer=req(deezer,'        if(artists.isEmpty())return null;','        if(artists.isEmpty()){AudifyInstantAlbumMetadata.debug("DEEZER_REJECT no artist seed from track search");return null;}\n        AudifyInstantAlbumMetadata.debug("DEEZER_ARTIST_SEEDS "+artists.size());','Deezer artist seeds');
deezer=req(deezer,'        return best!=null&&best.confidence>=90?best:null;','        if(best!=null&&best.confidence>=90){AudifyInstantAlbumMetadata.debug("DEEZER_BEST "+best.title+" conf="+best.confidence+" tracks="+best.tracks.size());return best;}\n        AudifyInstantAlbumMetadata.debug("DEEZER_REJECT no verified album in artist discography");\n        return null;','Deezer final');
deezer=req(deezer,'        if(typeNorm.equals("single")||typeNorm.equals("compilation")||count<4||count>40)return null;','        if(typeNorm.equals("single")||typeNorm.equals("compilation")||count<4||count>40){AudifyInstantAlbumMetadata.debug("DEEZER_ALBUM_REJECT "+seed.title+" type="+recordType+" count="+count);return null;}','Deezer type reject');
deezer=req(deezer,'        if(genericCompilationArtist(albumArtist))return null;\n        if(!TextUtils.isEmpty(albumArtist)&&!artistMatch(wantedArtist,albumArtist))return null;','        if(genericCompilationArtist(albumArtist)){AudifyInstantAlbumMetadata.debug("DEEZER_ALBUM_REJECT compilation artist "+seed.title);return null;}\n        if(!TextUtils.isEmpty(albumArtist)&&!artistMatch(wantedArtist,albumArtist)){AudifyInstantAlbumMetadata.debug("DEEZER_ALBUM_REJECT artist mismatch wanted="+wantedArtist+" got="+albumArtist+" album="+seed.title);return null;}','Deezer artist reject');
deezer=req(deezer,'        if(album.tracks.size()<4||bestIndex<0||bestTrackScore<185)return null;','        if(album.tracks.size()<4||bestIndex<0||bestTrackScore<185){AudifyInstantAlbumMetadata.debug("DEEZER_ALBUM_REJECT track proof album="+album.title+" tracks="+album.tracks.size()+" best="+bestTrackScore);return null;}','Deezer track reject');
await writeFile(deezerPath,deezer,'utf8');

// ---------------- visible diagnostic on real runtime failure ----------------
let albums=await readFile(albumsPath,'utf8');
const observed='    private static volatile String observed="",albumFor="";';
albums=req(albums,observed,'    private static volatile String observed="",albumFor="",diagnosticShownFor="";','album state anchor');

const failure='                }else if(manual)Toast.makeText(x,"Aucun album fiable trouvé pour ce morceau.",Toast.LENGTH_SHORT).show();';
const visible=String.raw`                }else{
                    String trace=AudifyInstantAlbumMetadata.diagnostic();
                    try{android.util.Log.e("AUDIFY_ALBUM_TRACE","FINAL UI FAILURE\n"+trace);}catch(Throwable ignored){}
                    if(manual)Toast.makeText(x,"Aucun album fiable trouvé pour ce morceau.",Toast.LENGTH_SHORT).show();
                    if(!TextUtils.isEmpty(trace)&&!k.equals(diagnosticShownFor)){
                        diagnosticShownFor=k;
                        String shown=trace.length()>3600?trace.substring(trace.length()-3600):trace;
                        new AlertDialog.Builder(x)
                            .setTitle("Diagnostic album V68.16.4")
                            .setMessage(shown)
                            .setPositiveButton("Fermer",null)
                            .setNeutralButton("Copier",(dd,which)->{
                                try{
                                    android.content.ClipboardManager cm=(android.content.ClipboardManager)x.getSystemService(android.content.Context.CLIPBOARD_SERVICE);
                                    if(cm!=null)cm.setPrimaryClip(android.content.ClipData.newPlainText("Audify album diagnostic",shown));
                                    Toast.makeText(x,"Diagnostic copié",Toast.LENGTH_SHORT).show();
                                }catch(Throwable ignored){}
                            })
                            .show();
                    }
                }`;
albums=req(albums,failure,visible,'visible failure diagnostic');
await writeFile(albumsPath,albums,'utf8');

console.log('Audify V68.16.4: runtime album diagnostic trace enabled — exact input, YouTube evidence, normalized identity, Apple graph reject reasons, Deezer discography reject reasons, and visible copyable failure dialog.');
