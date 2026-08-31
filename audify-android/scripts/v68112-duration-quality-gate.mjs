import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const mainPath=path.join(pkgDir,'MainActivity.java');
const discoveryPath=path.join(pkgDir,'AudifyDiscoveryAgent.java');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.11.2 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) RECHERCHE MANUELLE : vraie durée YouTube, uniquement 1:00 -> 6:00.
// =============================================================================
let main=await readFile(mainPath,'utf8');

if(!main.includes('private long audifyParseIsoDurationV68112(')){
  const marker='    private void runAudifyNativeSearchV672(String rawQuery) {';
  if(!main.includes(marker)) throw new Error('V68.11.2 marker recherche introuvable');
  const helpers=String.raw`    private long audifyParseIsoDurationV68112(String raw){
        if(raw==null||raw.trim().isEmpty()) return -1L;
        try{
            String s=raw.trim().toUpperCase(java.util.Locale.ROOT);
            if(!s.startsWith("P")) return -1L;
            long days=0,hours=0,minutes=0,seconds=0;
            java.util.regex.Matcher d=java.util.regex.Pattern.compile("(\\d+)D").matcher(s);
            if(d.find()) days=Long.parseLong(d.group(1));
            java.util.regex.Matcher h=java.util.regex.Pattern.compile("(\\d+)H").matcher(s);
            if(h.find()) hours=Long.parseLong(h.group(1));
            java.util.regex.Matcher m=java.util.regex.Pattern.compile("(\\d+)M").matcher(s);
            if(m.find()) minutes=Long.parseLong(m.group(1));
            java.util.regex.Matcher sec=java.util.regex.Pattern.compile("(\\d+)S").matcher(s);
            if(sec.find()) seconds=Long.parseLong(sec.group(1));
            return days*86400L+hours*3600L+minutes*60L+seconds;
        }catch(Throwable ignored){return -1L;}
    }

    private java.util.HashMap<String,Long> audifyFetchDurationsV68112(java.util.List<String> ids) throws Exception{
        java.util.HashMap<String,Long> out=new java.util.HashMap<>();
        if(ids==null||ids.isEmpty()) return out;
        StringBuilder joined=new StringBuilder();
        for(String id:ids){
            if(id==null||id.isEmpty()) continue;
            if(joined.length()>0) joined.append(',');
            joined.append(id);
        }
        if(joined.length()==0) return out;
        java.net.HttpURLConnection c=null;
        try{
            String endpoint="https://www.googleapis.com/youtube/v3/videos"
                +"?part=contentDetails"
                +"&id="+joined
                +"&key="+java.net.URLEncoder.encode(AUDIFY_YOUTUBE_DATA_KEY_V673,"UTF-8");
            c=(java.net.HttpURLConnection)new java.net.URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Accept","application/json");
            c.setConnectTimeout(10000);
            c.setReadTimeout(13000);
            c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) return out; // fail closed : durée inconnue = résultat refusé.
            org.json.JSONObject root=new org.json.JSONObject(audifyReadHttpV673(c,code));
            org.json.JSONArray arr=root.optJSONArray("items");
            if(arr==null) return out;
            for(int i=0;i<arr.length();i++){
                org.json.JSONObject item=arr.optJSONObject(i); if(item==null) continue;
                String id=item.optString("id","");
                org.json.JSONObject details=item.optJSONObject("contentDetails");
                if(id.isEmpty()||details==null) continue;
                long duration=audifyParseIsoDurationV68112(details.optString("duration",""));
                if(duration>=0) out.put(id,duration);
            }
        }finally{if(c!=null)c.disconnect();}
        return out;
    }

`;
  main=main.replace(marker,helpers+marker);
}

main=replaceMethod(main,
  ['    private void runAudifyNativeSearchV672(String rawQuery) {','    private void runAudifyNativeSearchV672(String rawQuery){'],
String.raw`    private void runAudifyNativeSearchV672(String rawQuery) {
        final String query=rawQuery==null?"":rawQuery.trim();
        if(query.isEmpty()) return;
        final int generation=++audifySearchGenerationV672;
        showAudifySearchStatusV672("Recherche musicale de « "+query+" »…",false);

        audifySearchExecutorV672.execute(()->{
            java.net.HttpURLConnection connection=null;
            try{
                String encoded=java.net.URLEncoder.encode(query,"UTF-8");
                // On demande davantage de candidats, car le filtre 1-6 min va volontairement en éliminer beaucoup.
                String endpoint="https://www.googleapis.com/youtube/v3/search"
                    +"?part=snippet"
                    +"&type=video"
                    +"&videoEmbeddable=true"
                    +"&maxResults=40"
                    +"&q="+encoded
                    +"&key="+java.net.URLEncoder.encode(AUDIFY_YOUTUBE_DATA_KEY_V673,"UTF-8");

                connection=(java.net.HttpURLConnection)new java.net.URL(endpoint).openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept","application/json");
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(16000);
                connection.setUseCaches(false);

                int code=connection.getResponseCode();
                String body=audifyReadHttpV673(connection,code);
                org.json.JSONObject root=body.isEmpty()?new org.json.JSONObject():new org.json.JSONObject(body);
                if(code<200||code>=300){
                    String message="YouTube API HTTP "+code;
                    org.json.JSONObject error=root.optJSONObject("error");
                    if(error!=null&&!error.optString("message","").isEmpty()) message=error.optString("message");
                    throw new IllegalStateException(message);
                }

                java.util.ArrayList<AudifySearchItemV673> candidates=new java.util.ArrayList<>();
                java.util.ArrayList<String> ids=new java.util.ArrayList<>();
                org.json.JSONArray arr=root.optJSONArray("items");
                if(arr!=null){
                    for(int i=0;i<arr.length()&&candidates.size()<40;i++){
                        org.json.JSONObject entry=arr.optJSONObject(i); if(entry==null) continue;
                        org.json.JSONObject idObj=entry.optJSONObject("id");
                        org.json.JSONObject snippet=entry.optJSONObject("snippet");
                        if(idObj==null||snippet==null) continue;
                        String videoId=idObj.optString("videoId",""); if(videoId.isEmpty()) continue;
                        String title=audifyHtmlTextV673(snippet.optString("title","Sans titre"));
                        String artist=audifyHtmlTextV673(snippet.optString("channelTitle","YouTube"));
                        String thumbnail="https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg";
                        org.json.JSONObject thumbs=snippet.optJSONObject("thumbnails");
                        if(thumbs!=null){
                            org.json.JSONObject chosen=thumbs.optJSONObject("high");
                            if(chosen==null) chosen=thumbs.optJSONObject("medium");
                            if(chosen==null) chosen=thumbs.optJSONObject("default");
                            if(chosen!=null&&!chosen.optString("url","").isEmpty()) thumbnail=chosen.optString("url");
                        }
                        candidates.add(new AudifySearchItemV673(videoId,title,artist,thumbnail));
                        ids.add(videoId);
                    }
                }

                java.util.HashMap<String,Long> durations=audifyFetchDurationsV68112(ids);
                java.util.ArrayList<AudifySearchItemV673> results=new java.util.ArrayList<>();
                for(AudifySearchItemV673 item:candidates){
                    Long seconds=durations.get(item.id);
                    // Règle Audify V68.11.2 : 1:00 à 6:00 inclus. Durée inconnue = rejet.
                    if(seconds==null||seconds<60L||seconds>360L) continue;
                    results.add(item);
                    if(results.size()>=20) break;
                }

                final java.util.ArrayList<AudifySearchItemV673> finalResults=results;
                runOnUiThread(()->renderAudifyNativeResultsV672(finalResults,query,generation));
            }catch(Throwable error){
                String message=error.getMessage();
                if(message==null||message.trim().isEmpty()) message=error.getClass().getSimpleName();
                final String finalMessage=message;
                runOnUiThread(()->{
                    if(generation!=audifySearchGenerationV672) return;
                    showAudifySearchStatusV672("Erreur recherche YouTube :\n"+finalMessage,true);
                });
            }finally{if(connection!=null) connection.disconnect();}
        });
    }`,'runAudifyNativeSearchV672');

await writeFile(mainPath,main,'utf8');

// =============================================================================
// 2) DISCOVERY AGENT : même barrière 1:00 -> 6:00, y compris le seed artist.
// =============================================================================
let discovery=await readFile(discoveryPath,'utf8');
// Invalide l'ancien cache pour que les recommandations déjà stockées sans durée ne survivent pas à la mise à jour.
discovery=discovery.replace('private static final String PREFS="audify_discovery_v68110";','private static final String PREFS="audify_discovery_v68112";');

if(!discovery.includes('private long parseIsoDurationV68112(')){
  const marker='    private boolean containsArtist(Set<String> known,String candidate){';
  if(!discovery.includes(marker)) throw new Error('V68.11.2 marker helpers discovery introuvable');
  const helpers=String.raw`    private long parseIsoDurationV68112(String raw){
        if(raw==null||raw.trim().isEmpty()) return -1L;
        try{
            String s=raw.trim().toUpperCase(Locale.ROOT);
            if(!s.startsWith("P")) return -1L;
            long days=0,hours=0,minutes=0,seconds=0;
            java.util.regex.Matcher d=java.util.regex.Pattern.compile("(\\d+)D").matcher(s); if(d.find()) days=Long.parseLong(d.group(1));
            java.util.regex.Matcher h=java.util.regex.Pattern.compile("(\\d+)H").matcher(s); if(h.find()) hours=Long.parseLong(h.group(1));
            java.util.regex.Matcher m=java.util.regex.Pattern.compile("(\\d+)M").matcher(s); if(m.find()) minutes=Long.parseLong(m.group(1));
            java.util.regex.Matcher sec=java.util.regex.Pattern.compile("(\\d+)S").matcher(s); if(sec.find()) seconds=Long.parseLong(sec.group(1));
            return days*86400L+hours*3600L+minutes*60L+seconds;
        }catch(Throwable ignored){return -1L;}
    }

    private java.util.HashMap<String,Long> fetchDurationsV68112(java.util.List<String> ids) throws Exception{
        java.util.HashMap<String,Long> out=new java.util.HashMap<>();
        if(ids==null||ids.isEmpty()) return out;
        StringBuilder joined=new StringBuilder();
        for(String id:ids){if(id==null||id.isEmpty()) continue; if(joined.length()>0) joined.append(','); joined.append(id);}
        if(joined.length()==0) return out;
        HttpURLConnection c=null;
        try{
            String endpoint="https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id="+joined+"&key="+enc(YOUTUBE_KEY);
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET"); c.setRequestProperty("Accept","application/json");
            c.setConnectTimeout(9000); c.setReadTimeout(12000); c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) return out; // fail closed
            JSONObject root=new JSONObject(read(c.getInputStream()));
            JSONArray arr=root.optJSONArray("items"); if(arr==null) return out;
            for(int i=0;i<arr.length();i++){
                JSONObject item=arr.optJSONObject(i); if(item==null) continue;
                String id=item.optString("id",""); JSONObject details=item.optJSONObject("contentDetails");
                if(id.isEmpty()||details==null) continue;
                long duration=parseIsoDurationV68112(details.optString("duration",""));
                if(duration>=0) out.put(id,duration);
            }
        }finally{if(c!=null)c.disconnect();}
        return out;
    }

`;
  discovery=discovery.replace(marker,helpers+marker);
}

discovery=replaceMethod(discovery,
  ['    private void collectEndpoint(String endpoint,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,'],
String.raw`    private void collectEndpoint(String endpoint,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                                 LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Accept","application/json");
            c.setConnectTimeout(9000); c.setReadTimeout(12000); c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) return;
            JSONObject root=new JSONObject(read(c.getInputStream()));
            JSONArray arr=root.optJSONArray("items"); if(arr==null) return;

            // Deuxième passe obligatoire : récupérer la vraie durée de chaque candidat YouTube.
            ArrayList<String> ids=new ArrayList<>();
            for(int i=0;i<arr.length();i++){
                JSONObject entry=arr.optJSONObject(i); if(entry==null) continue;
                JSONObject idObj=entry.optJSONObject("id"); if(idObj==null) continue;
                String id=idObj.optString("videoId",""); if(!id.isEmpty()) ids.add(id);
            }
            java.util.HashMap<String,Long> durations=fetchDurationsV68112(ids);

            String seedArtist=canonicalArtist(seed.title,seed.artist);
            for(int i=0;i<arr.length()&&(sameOut.size()+others.size())<22;i++){
                JSONObject entry=arr.optJSONObject(i); if(entry==null) continue;
                JSONObject idObj=entry.optJSONObject("id");
                JSONObject sn=entry.optJSONObject("snippet");
                if(idObj==null||sn==null) continue;
                String id=idObj.optString("videoId","");
                if(id.isEmpty()||id.equals(seed.id)||sameOut.containsKey(id)||others.containsKey(id)) continue;

                Long duration=durations.get(id);
                // Strictement les morceaux de 1:00 à 6:00 inclus. Shorts, extraits et longues vidéos disparaissent.
                if(duration==null||duration<60L||duration>360L) continue;

                String title=html(sn.optString("title","Sans titre"));
                String channel=html(sn.optString("channelTitle","YouTube"));
                if(!looksLikeMusic(title)||isBadVariant(title,channel)) continue;

                String work=songKey(title);
                if(work.isEmpty()||selectedSongs.contains(work)) continue;

                String candidateArtist=canonicalArtist(title,channel);
                if(candidateArtist.isEmpty()||looksGenericArtist(candidateArtist)) continue;
                boolean sameSeed=sameArtist(candidateArtist,seedArtist);
                if(mode==MODE_SEED_ONLY&&!sameSeed) continue;
                if(mode==MODE_OTHERS_ONLY&&sameSeed) continue;

                String thumb="https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";
                JSONObject thumbs=sn.optJSONObject("thumbnails");
                if(thumbs!=null){
                    JSONObject chosen=thumbs.optJSONObject("high");
                    if(chosen==null) chosen=thumbs.optJSONObject("medium");
                    if(chosen==null) chosen=thumbs.optJSONObject("default");
                    if(chosen!=null&&!chosen.optString("url","").isEmpty()) thumb=chosen.optString("url");
                }
                AudifyLibraryStore.Track track=new AudifyLibraryStore.Track(id,title,channel,thumb);

                if(sameSeed){
                    if(sameOut.size()>=2) continue;
                    sameOut.put(id,track);
                    selectedSongs.add(work);
                    continue;
                }

                if(containsArtist(known,candidateArtist)) continue;
                String compact=compactArtist(candidateArtist);
                if(otherArtists.contains(compact)) continue;
                otherArtists.add(compact);
                others.put(id,track);
                selectedSongs.add(work);
            }
        }finally{if(c!=null)c.disconnect();}
    }`,'collectEndpoint discovery');

await writeFile(discoveryPath,discovery,'utf8');
console.log('Audify V68.11.2 : filtre durée strict 1:00-6:00 appliqué à la recherche et au Discovery Agent.');
