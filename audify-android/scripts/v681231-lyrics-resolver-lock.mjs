import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const karaokePath=path.join(root,'android','app','src','main','java','com','nova','audify','NativeKaraokeActivity.java');
let src=await readFile(karaokePath,'utf8');

function replaceMethod(source,signature,replacement,label){
  const start=source.indexOf(signature);
  if(start<0) throw new Error(`V68.12.31 : méthode introuvable ${label}`);
  const brace=source.indexOf('{',start);
  if(brace<0) throw new Error(`V68.12.31 : accolade introuvable ${label}`);
  let depth=0,end=-1;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{') depth++;
    else if(source[i]==='}'){
      depth--;
      if(depth===0){ end=i+1; break; }
    }
  }
  if(end<0) throw new Error(`V68.12.31 : fin méthode introuvable ${label}`);
  return source.slice(0,start)+replacement+source.slice(end);
}

// Nouveau namespace de cache : on ne réutilise pas les éventuels faux positifs de l'ancien moteur.
src=src.replace('private static final String CACHE_PREFS="audify_lyrics_cache_v68101";',
  'private static final String CACHE_PREFS="audify_lyrics_cache_v681231";');
src=src.replace(/private static final String CLIENT="[^"]*";/,
  'private static final String CLIENT="AudifyAndroid/68.12.31 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)";');
if(!src.includes('private static final int LYRICS_ENGINE_VERSION=681231;')){
  src=src.replace('private static final String CLIENT="AudifyAndroid/68.12.31 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)";',
    'private static final String CLIENT="AudifyAndroid/68.12.31 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)";\n    private static final int LYRICS_ENGINE_VERSION=681231;');
}

src=replaceMethod(src,'    private Meta resolveMetadata(String title,String artist){',String.raw`    private Meta resolveMetadata(String title,String artist){
        String cleanedArtist=cleanArtist(artist);
        String cleanedTitle=cleanTitle(title);
        String[] split=splitArtistTitle(cleanedTitle);
        if(split!=null){
            String left=cleanArtist(split[0]);
            String right=cleanTitle(split[1]);
            double leftMatch=textSimilarity(cleanedArtist,left);
            double rightMatch=textSimilarity(cleanedArtist,right);
            if(!left.isEmpty()&&!right.isEmpty()){
                if(cleanedArtist.isEmpty()||looksGenericArtist(cleanedArtist)||leftMatch>=0.52){
                    cleanedArtist=left;
                    cleanedTitle=right;
                }else if(rightMatch>=0.72){
                    cleanedArtist=cleanArtist(right);
                    cleanedTitle=cleanTitle(split[0]);
                }
            }
        }
        if(cleanedTitle.isEmpty()) cleanedTitle=safe(title).trim();
        if(cleanedArtist.isEmpty()) cleanedArtist=safe(artist).trim();
        return new Meta(cleanedTitle,cleanedArtist);
    }`,'resolveMetadata');

src=replaceMethod(src,'    private String cleanTitle(String value){',String.raw`    private String cleanTitle(String value){
        String s=safe(value).replace("’","'").replace('–','-').replace('—','-');
        s=s.replaceAll("(?i)\\s*[\\[(][^\\])]*(?:official|officiel|clip|music\\s*video|video|audio|visualizer|lyrics?|paroles|4k|hd|mv)[^\\])]*[\\])]\\s*"," ");
        s=s.replaceAll("(?i)\\b(official\\s+(music\\s+)?video|clip\\s+officiel|official\\s+audio|audio\\s+officiel|official\\s+visualizer|visualizer|lyrics?\\s+video|paroles)\\b"," ");
        s=s.replaceAll("(?i)\\s*\\|\\s*(official|officiel|video|audio|visualizer|lyrics?).*$"," ");
        s=s.replaceAll("(?i)\\s*#(?:music|lyrics?|official|video)\\b"," ");
        s=s.replaceAll("\\s+"," ").trim();
        s=s.replaceAll("^[\\-–—|:]+|[\\-–—|:]+$","").trim();
        return s;
    }`,'cleanTitle');

src=replaceMethod(src,'    private String cleanArtist(String value){',String.raw`    private String cleanArtist(String value){
        String s=safe(value).replace("’","'").replace('–','-').replace('—','-');
        s=s.replaceAll("(?i)\\s*-\\s*topic\\s*$","");
        s=s.replaceAll("(?i)\\b(officiel|official|vevo)\\b"," ");
        s=s.replaceAll("(?i)\\s+(?:music|channel)\\s*$","");
        s=s.replaceAll("\\s+"," ").trim();
        s=s.replaceAll("^[\\-–—|:]+|[\\-–—|:]+$","").trim();
        return s;
    }`,'cleanArtist');

const lrclibSig='    private LyricsResult resolveFromLrclib(Meta meta,double trackDuration) throws Exception {';
const helperBlock=String.raw`    private String[] splitArtistTitle(String value){
        String s=safe(value);
        String[] seps=new String[]{" - "," | "," : "};
        for(String sep:seps){
            int p=s.indexOf(sep);
            if(p>1&&p<s.length()-sep.length()-1){
                return new String[]{s.substring(0,p).trim(),s.substring(p+sep.length()).trim()};
            }
        }
        return null;
    }

    private boolean looksGenericArtist(String value){
        String n=norm(value);
        return n.isEmpty()||n.equals("unknown")||n.equals("unknown artist")||n.equals("various artists")||n.equals("music")||n.equals("youtube");
    }

    private String coreTitle(String value){
        String s=cleanTitle(value);
        s=s.replaceAll("(?i)\\s*[\\[(](?:feat\\.?|ft\\.?|featuring)[^\\])]*[\\])]\\s*"," ");
        s=s.replaceAll("(?i)\\s+(?:feat\\.?|ft\\.?|featuring)\\s+.+$","");
        s=s.replaceAll("(?i)\\s*[\\[(](?:remaster(?:ed)?.*|live.*|acoustic.*|radio\\s+edit|single\\s+version|album\\s+version|original\\s+mix|sped\\s+up|slowed(?:\\s+down)?|nightcore)[\\])]\\s*$","");
        s=s.replaceAll("\\s+"," ").trim();
        return s.isEmpty()?cleanTitle(value):s;
    }

    private String coreArtist(String value){
        String s=cleanArtist(value);
        s=s.replaceAll("(?i)\\s+(?:feat\\.?|ft\\.?|featuring)\\s+.+$","");
        s=s.replaceAll("\\s+"," ").trim();
        return s.isEmpty()?cleanArtist(value):s;
    }

    private String firstArtist(String value){
        String s=coreArtist(value);
        String[] seps=new String[]{" & "," x "," X ",", ","; "};
        for(String sep:seps){
            int p=s.indexOf(sep);
            if(p>1){
                String first=s.substring(0,p).trim();
                if(first.length()>=2) return first;
            }
        }
        return s;
    }

    private List<Meta> buildMetaVariants(Meta primary){
        ArrayList<Meta> out=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        addMetaVariant(out,seen,primary.title,primary.artist);
        addMetaVariant(out,seen,coreTitle(primary.title),primary.artist);
        addMetaVariant(out,seen,primary.title,coreArtist(primary.artist));
        addMetaVariant(out,seen,coreTitle(primary.title),coreArtist(primary.artist));
        addMetaVariant(out,seen,coreTitle(primary.title),firstArtist(primary.artist));

        String rawClean=cleanTitle(rawTitle);
        String[] split=splitArtistTitle(rawClean);
        if(split!=null){
            String left=cleanArtist(split[0]);
            String right=cleanTitle(split[1]);
            addMetaVariant(out,seen,right,left);
            addMetaVariant(out,seen,coreTitle(right),firstArtist(left));
            if(textSimilarity(rawArtist,right)>=0.55){
                addMetaVariant(out,seen,cleanTitle(split[0]),cleanArtist(right));
            }
        }
        return out;
    }

    private void addMetaVariant(List<Meta> out,Set<String> seen,String title,String artist){
        String t=cleanTitle(title);
        String a=cleanArtist(artist);
        if(t.isEmpty()) return;
        String key=norm(t)+"|"+norm(a);
        if(key.equals("|")||seen.contains(key)) return;
        seen.add(key);
        out.add(new Meta(t,a));
    }

    private double textSimilarity(String a,String b){
        String x=norm(a),y=norm(b);
        if(x.isEmpty()||y.isEmpty()) return 0.0;
        if(x.equals(y)) return 1.0;
        if((x.contains(y)||y.contains(x))&&Math.min(x.length(),y.length())>=4) return 0.90;
        String[] xa=x.split(" "),ya=y.split(" ");
        Set<String> xs=new HashSet<>(),ys=new HashSet<>();
        for(String v:xa) if(v.length()>1) xs.add(v);
        for(String v:ya) if(v.length()>1) ys.add(v);
        if(xs.isEmpty()||ys.isEmpty()) return 0.0;
        int common=0;
        for(String v:xs) if(ys.contains(v)) common++;
        int union=xs.size()+ys.size()-common;
        double jaccard=union<=0?0.0:(double)common/(double)union;
        double containment=(double)common/(double)Math.min(xs.size(),ys.size());
        return Math.max(jaccard,containment*0.92);
    }

    private void politeDelay(){
        try{Thread.sleep(260L);}catch(InterruptedException e){Thread.currentThread().interrupt();}
    }

`;
if(!src.includes('private List<Meta> buildMetaVariants(Meta primary)')){
  const p=src.indexOf(lrclibSig);
  if(p<0) throw new Error('V68.12.31 : insertion helpers LRCLIB impossible');
  src=src.slice(0,p)+helperBlock+src.slice(p);
}

src=replaceMethod(src,lrclibSig,String.raw`    private LyricsResult resolveFromLrclib(Meta meta,double trackDuration) throws Exception {
        ArrayList<JSONObject> candidates=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        List<Meta> variants=buildMetaVariants(meta);
        int maxVariants=Math.min(5,variants.size());

        if(!variants.isEmpty()){
            Meta first=variants.get(0);
            if(!first.artist.isEmpty()){
                String exact="https://lrclib.net/api/get?track_name="+q(first.title)+"&artist_name="+q(first.artist);
                if(trackDuration>=1&&trackDuration<=3600) exact+="&duration="+Math.round(trackDuration);
                JSONObject direct=parseObject(httpGet(exact));
                addCandidate(candidates,seen,direct);
                if(direct==null&&trackDuration>0){
                    politeDelay();
                    direct=parseObject(httpGet("https://lrclib.net/api/get?track_name="+q(first.title)+"&artist_name="+q(first.artist)));
                    addCandidate(candidates,seen,direct);
                }
            }
        }

        for(int i=0;i<maxVariants;i++){
            Meta v=variants.get(i);
            politeDelay();
            String endpoint="https://lrclib.net/api/search?track_name="+q(v.title);
            if(!v.artist.isEmpty()) endpoint+="&artist_name="+q(v.artist);
            addCandidates(candidates,seen,parseArray(httpGet(endpoint)));
            if(candidates.size()>=18) break;
        }

        String broadTitle=coreTitle(meta.title);
        if(!broadTitle.isEmpty()){
            politeDelay();
            addCandidates(candidates,seen,parseArray(httpGet("https://lrclib.net/api/search?track_name="+q(broadTitle)));
        }

        String broadArtist=firstArtist(meta.artist);
        String broadQuery=(broadTitle+" "+broadArtist).trim();
        if(!broadQuery.isEmpty()){
            politeDelay();
            addCandidates(candidates,seen,parseArray(httpGet("https://lrclib.net/api/search?q="+q(broadQuery)));
        }

        JSONObject best=null;
        int bestScore=Integer.MIN_VALUE;
        for(JSONObject item:candidates){
            if(item==null) continue;
            String synced=item.optString("syncedLyrics","");
            String plain=item.optString("plainLyrics","");
            if(synced.trim().isEmpty()&&plain.trim().isEmpty()) continue;
            int score=scoreCandidate(item,meta,trackDuration);
            if(score>bestScore){ bestScore=score; best=item; }
        }
        if(best==null||bestScore<62) return null;
        return new LyricsResult(
            best.optString("syncedLyrics",""),
            best.optString("plainLyrics",""),
            "LRCLIB",
            best.optLong("id",0L)
        );
    }`,'resolveFromLrclib');

src=replaceMethod(src,'    private LyricsResult resolveFromLyricsOvh(Meta meta) throws Exception {',String.raw`    private LyricsResult resolveFromLyricsOvh(Meta meta) throws Exception {
        List<Meta> variants=buildMetaVariants(meta);
        Set<String> attempted=new HashSet<>();
        int limit=Math.min(6,variants.size());
        for(int i=0;i<limit;i++){
            Meta v=variants.get(i);
            if(v.artist.isEmpty()||v.title.isEmpty()) continue;
            String key=norm(v.artist)+"|"+norm(v.title);
            if(attempted.contains(key)) continue;
            attempted.add(key);
            if(i>0) politeDelay();
            JSONObject json=parseObject(httpGet("https://api.lyrics.ovh/v1/"+pathPart(v.artist)+"/"+pathPart(v.title)));
            if(json==null) continue;
            String plain=json.optString("lyrics","");
            if(!plain.trim().isEmpty()) return new LyricsResult("",plain,"lyrics.ovh",0L);
        }
        return null;
    }`,'resolveFromLyricsOvh');

src=replaceMethod(src,'    private int scoreCandidate(JSONObject item,Meta meta,double trackDuration){',String.raw`    private int scoreCandidate(JSONObject item,Meta meta,double trackDuration){
        String gotTitle=item.optString("trackName",item.optString("name",""));
        String gotArtist=item.optString("artistName","");
        int best=Integer.MIN_VALUE;
        List<Meta> variants=buildMetaVariants(meta);
        for(Meta v:variants){
            double titleSim=textSimilarity(v.title,gotTitle);
            double artistSim=v.artist.isEmpty()?0.0:textSimilarity(v.artist,gotArtist);
            int score=(int)Math.round(titleSim*72.0);
            if(!v.artist.isEmpty()) score+=(int)Math.round(artistSim*34.0);
            if(norm(v.title).equals(norm(gotTitle))) score+=8;
            if(!v.artist.isEmpty()&&norm(v.artist).equals(norm(gotArtist))) score+=7;
            if(!item.optString("syncedLyrics","").trim().isEmpty()) score+=6;

            double candidateDuration=item.optDouble("duration",0.0);
            if(trackDuration>0&&candidateDuration>0){
                double diff=Math.abs(trackDuration-candidateDuration);
                if(diff<=2.2) score+=18;
                else if(diff<=5.5) score+=12;
                else if(diff<=12.0) score+=6;
                else if(diff>=45.0) score-=10;
            }
            if(titleSim<0.58) score-=34;
            if(!v.artist.isEmpty()&&!looksGenericArtist(v.artist)&&artistSim<0.20&&titleSim<0.96) score-=24;
            if(score>best) best=score;
        }
        return best;
    }`,'scoreCandidate');

src=replaceMethod(src,'    private LyricsResult readCache(){',String.raw`    private LyricsResult readCache(){
        try{
            String raw=getSharedPreferences(CACHE_PREFS,MODE_PRIVATE).getString(cacheKey(),"");
            if(raw==null||raw.isEmpty()) return null;
            JSONObject o=new JSONObject(raw);
            if(!o.optBoolean("locked",false)) return null;
            if(o.optInt("engineVersion",0)!=LYRICS_ENGINE_VERSION) return null;
            LyricsResult result=new LyricsResult(o.optString("synced",""),o.optString("plain",""),o.optString("source","cache"),o.optLong("lrclibId",0L));
            return result.hasLyrics()?result:null;
        }catch(Throwable ignored){return null;}
    }`,'readCache');

src=replaceMethod(src,'    private void writeCache(LyricsResult result){',String.raw`    private void writeCache(LyricsResult result){
        if(result==null||!result.hasLyrics()) return;
        try{
            SharedPreferences prefs=getSharedPreferences(CACHE_PREFS,MODE_PRIVATE);
            String existing=prefs.getString(cacheKey(),"");
            if(existing!=null&&!existing.isEmpty()){
                try{
                    JSONObject old=new JSONObject(existing);
                    if(old.optBoolean("locked",false)&&old.optInt("engineVersion",0)==LYRICS_ENGINE_VERSION){
                        String oldSynced=old.optString("synced","");
                        String oldPlain=old.optString("plain","");
                        if(!oldSynced.trim().isEmpty()||!oldPlain.trim().isEmpty()) return;
                    }
                }catch(Throwable ignored){}
            }
            JSONObject o=new JSONObject();
            o.put("synced",result.synced);
            o.put("plain",result.plain);
            o.put("source",result.source);
            o.put("lrclibId",result.lrclibId);
            o.put("title",resolvedMeta.title);
            o.put("artist",resolvedMeta.artist);
            o.put("videoId",videoId);
            o.put("savedAt",System.currentTimeMillis());
            o.put("engineVersion",LYRICS_ENGINE_VERSION);
            o.put("locked",true);
            prefs.edit().putString(cacheKey(),o.toString()).apply();
        }catch(Throwable ignored){}
    }`,'writeCache');

if(!src.includes('LYRICS_ENGINE_VERSION=681231')) throw new Error('V68.12.31 : marqueur moteur absent');
if(!src.includes('o.put("locked",true)')) throw new Error('V68.12.31 : verrou cache absent');
if(!src.includes('api/search?track_name=')) throw new Error('V68.12.31 : recherche LRCLIB structurée absente');
if(!src.includes('api.lyrics.ovh/v1/')) throw new Error('V68.12.31 : fallback lyrics.ovh absent');

await writeFile(karaokePath,src,'utf8');
console.log('Audify Android V68.12.31 : Lyrics Resolver v2 multi-variantes + cache positif verrouillé.');
