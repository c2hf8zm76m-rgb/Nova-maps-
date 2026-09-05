import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const enginePath=path.join(pkgDir,'AudifyYoutubeSearchEngine.java');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const albumsPath=path.join(pkgDir,'AudifyInstantAlbums.java');

function replaceRequired(source,from,to,label){
  if(!source.includes(from)) throw new Error('V68.16.3: missing '+label);
  return source.replace(from,to);
}

let engine=await readFile(enginePath,'utf8');
const engineAnchor='    private static final Object CONFIG_LOCK=new Object();';
if(!engine.includes(engineAnchor)) throw new Error('V68.16.3: YouTube engine config anchor missing');
const engineBridge=String.raw`    static final String VIDEO_DETAILS_MARKER="AUDIFY_V68163_INNERTUBE_VIDEO_DETAILS";
    static final String VIDEO_DESCRIPTION_MARKER="AUDIFY_V68163_VIDEO_DESCRIPTION_EVIDENCE";

    static final class VideoDetails {
        final String title,artist,description;
        final long durationMs;
        VideoDetails(String t,String a,String d,long ms){title=t==null?"":t;artist=a==null?"":a;description=d==null?"":d;durationMs=ms;}
    }

    static VideoDetails videoDetails(String rawVideoId) throws Exception{
        String videoId=rawVideoId==null?"":rawVideoId.trim();
        if(videoId.isEmpty()) return null;

        // Do not depend on a watch-page fetch here. Search already has a public Web Innertube
        // fallback key/version, so album evidence can still be recovered when YouTube serves a
        // consent/challenge HTML page to Android HttpURLConnection.
        String key=apiKey.isEmpty()?"AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8":apiKey;
        String version=clientVersion.isEmpty()?"2.20260831.00.00":clientVersion;

        JSONObject client=new JSONObject();
        client.put("clientName","WEB");
        client.put("clientVersion",version);
        client.put("hl","fr");
        client.put("gl","FR");
        if(!visitorData.isEmpty()) client.put("visitorData",visitorData);
        JSONObject context=new JSONObject();context.put("client",client);
        JSONObject body=new JSONObject();
        body.put("context",context);
        body.put("videoId",videoId);
        body.put("contentCheckOk",true);
        body.put("racyCheckOk",true);

        String endpoint="https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key="+URLEncoder.encode(key,"UTF-8");
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("POST");c.setDoOutput(true);applyHeaders(c);
            c.setRequestProperty("Content-Type","application/json; charset=UTF-8");
            c.setRequestProperty("Origin","https://www.youtube.com");
            c.setRequestProperty("Referer","https://www.youtube.com/");
            c.setRequestProperty("X-YouTube-Client-Name","1");
            c.setRequestProperty("X-YouTube-Client-Version",version);
            c.setConnectTimeout(12000);c.setReadTimeout(18000);
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(bytes.length);
            OutputStream out=c.getOutputStream();out.write(bytes);out.flush();out.close();
            int code=c.getResponseCode();
            InputStream stream=(code>=200&&code<300)?c.getInputStream():c.getErrorStream();
            String response=stream==null?"":read(stream);
            if(code<200||code>=300) throw new java.io.IOException("YouTubei player HTTP "+code);
            JSONObject root=new JSONObject(response);
            JSONObject vd=root.optJSONObject("videoDetails");if(vd==null)return null;
            long ms=-1L;try{ms=Long.parseLong(vd.optString("lengthSeconds","-1"))*1000L;}catch(Throwable ignored){}
            return new VideoDetails(vd.optString("title",""),vd.optString("author",""),vd.optString("shortDescription",""),ms);
        }finally{if(c!=null)c.disconnect();}
    }

`;
engine=engine.replace(engineAnchor,engineBridge+engineAnchor);
await writeFile(enginePath,engine,'utf8');

let meta=await readFile(metaPath,'utf8');
const metaMarker='static final String DESCRIPTION_RELEASE_RELATION_MARKER="AUDIFY_V68162_DESCRIPTION_RELEASE_RELATION";';
meta=replaceRequired(meta,metaMarker,metaMarker+';\n    static final String INNERTUBE_VIDEO_EVIDENCE_MARKER="AUDIFY_V68163_INNERTUBE_VIDEO_EVIDENCE_BRIDGE";\n    static final String HTML_OPTIONAL_FALLBACK_MARKER="AUDIFY_V68163_HTML_OPTIONAL_FALLBACK";'.replace(';;',';'),'V68.16.2 metadata marker');

const evidenceStart=String.raw`    private static YoutubeEvidence youtubeEvidence(String videoId)throws Exception{
        YoutubeEvidence y=new YoutubeEvidence();
        if(TextUtils.isEmpty(videoId))return y;
        String page=httpText("https://www.youtube.com/watch?v="+enc(videoId)+"&hl=fr&persist_hl=1");`;
const evidenceReplacement=String.raw`    private static YoutubeEvidence youtubeEvidence(String videoId)throws Exception{
        YoutubeEvidence y=new YoutubeEvidence();
        if(TextUtils.isEmpty(videoId))return y;

        // V68.16.3 — primary runtime evidence comes from the same Innertube backend used by
        // Audify search. This avoids losing the official description when the raw watch page
        // is replaced by consent/challenge HTML on Android.
        try{
            AudifyYoutubeSearchEngine.VideoDetails d=AudifyYoutubeSearchEngine.videoDetails(videoId);
            if(d!=null){
                y.title=d.title;y.artist=d.artist;y.description=d.description;y.durationMs=d.durationMs;
            }
        }catch(Throwable ignored){}

        String page="";
        try{page=httpText("https://www.youtube.com/watch?v="+enc(videoId)+"&hl=fr&persist_hl=1");}catch(Throwable ignored){}
`;
meta=replaceRequired(meta,evidenceStart,evidenceReplacement,'youtubeEvidence watch-page entry');

const noPlayer='        if(player==null)return y;';
const noPlayerReplacement=String.raw`        if(player==null){
            String lowArtist=y.artist.toLowerCase(Locale.ROOT),lowDesc=y.description.toLowerCase(Locale.ROOT);
            y.topic=lowArtist.endsWith(" - topic")||lowArtist.endsWith(" topic")||lowDesc.contains("provided to youtube by")||lowDesc.contains("auto-generated by youtube");
            String embeddedArtist=parseOfficialDescriptionArtist(y.description,cleanTitle(y.title));
            if(y.topic&&!TextUtils.isEmpty(embeddedArtist))y.artist=cleanArtist(embeddedArtist);
            else if(y.topic){String descriptorArtist=canonicalArtistFromDescriptor(y.artist);if(!TextUtils.isEmpty(descriptorArtist))y.artist=cleanArtist(descriptorArtist);}
            String naturalAlbum=parseNaturalLanguageAlbumMention(y.description,cleanTitle(y.title),cleanArtist(y.artist));
            String embeddedAlbum=parseOfficialDescriptionAlbum(y.description,cleanTitle(y.title),cleanArtist(y.artist));
            String legacyHint=parseAlbumHint(y.description,cleanTitle(y.title),cleanArtist(y.artist));
            y.albumHint=!TextUtils.isEmpty(naturalAlbum)?naturalAlbum:(!TextUtils.isEmpty(embeddedAlbum)?embeddedAlbum:legacyHint);
            return y;
        }`;
meta=replaceRequired(meta,noPlayer,noPlayerReplacement,'youtubeEvidence null-player return');
await writeFile(metaPath,meta,'utf8');

let albums=await readFile(albumsPath,'utf8');
const videoCall='AudifyInstantAlbumMetadata.identify(s.title,s.artist,s.id)';
if(!albums.includes(videoCall)) throw new Error('V68.16.3: exact videoId is not reaching album metadata engine');
if(!albums.includes('AUDIFY_V68163_VIDEO_ID_TO_ALBUM_ENGINE')){
  const tagLine=/private static final String TAG="[^"]+";/;
  if(!tagLine.test(albums)) throw new Error('V68.16.3: album engine TAG anchor missing');
  albums=albums.replace(tagLine,m=>m+'\n    private static final String VIDEO_EVIDENCE_ROUTE="AUDIFY_V68163_VIDEO_ID_TO_ALBUM_ENGINE";');
}
await writeFile(albumsPath,albums,'utf8');

console.log('Audify V68.16.3: exact videoId -> Innertube player videoDetails -> official description -> album hint route enabled; raw watch HTML is now optional fallback only.');
