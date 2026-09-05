import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const applePath=path.join(pkgDir,'AudifyAppleReleaseGraphResolver.java');
const deezerPath=path.join(pkgDir,'AudifyReleasePreferenceResolver.java');

function mustReplace(src,from,to,label){
  if(!src.includes(from)) throw new Error('V68.16.5: missing '+label);
  return src.replace(from,to);
}

// -----------------------------------------------------------------------------
// Apple/iTunes: when official YouTube metadata already supplied a reliable album
// hint, do not require a song-search seed first. Search albums directly, then keep
// the existing mandatory collection tracklist proof before accepting anything.
// -----------------------------------------------------------------------------
let apple=await readFile(applePath,'utf8');

const appleDiag='    static final String DIAGNOSTIC_MARKER="AUDIFY_V68164_APPLE_REJECT_REASONS";';
if(apple.includes(appleDiag)&&!apple.includes('AUDIFY_V68165_APPLE_HINT_FIRST_LOOKUP')){
  apple=apple.replace(
    appleDiag,
    appleDiag+'\n    static final String HINT_FIRST_MARKER="AUDIFY_V68165_APPLE_HINT_FIRST_LOOKUP";\n    static final String HINT_TRACKLIST_PROOF_MARKER="AUDIFY_V68165_HINT_TRACKLIST_PROOF";'
  );
}

const appleEmpty='        if(unique.isEmpty()){AudifyInstantAlbumMetadata.debug("APPLE_REJECT no collection seeds");return null;}';
const appleFallback=`        if(unique.isEmpty()&&!TextUtils.isEmpty(hint)){
            AudifyInstantAlbumMetadata.debug("APPLE_HINT_FIRST_START hint="+hint+" | artist="+artist);
            try{collectHintAlbumSeeds(unique,hint,artist);}catch(Throwable e){AudifyInstantAlbumMetadata.debug("APPLE_HINT_FIRST_ERROR "+e.getClass().getSimpleName()+": "+String.valueOf(e.getMessage()));}
            AudifyInstantAlbumMetadata.debug("APPLE_HINT_FIRST_SEEDS "+unique.size());
        }
        if(unique.isEmpty()){AudifyInstantAlbumMetadata.debug("APPLE_REJECT no collection seeds");return null;}`;
apple=mustReplace(apple,appleEmpty,appleFallback,'Apple empty-seed fallback');

const appleMethodAnchor='    private static boolean hasStrongAlbumSeed(Map<Long,Seed> seeds){';
const appleHintMethod=`    private static void collectHintAlbumSeeds(Map<Long,Seed> unique,String hint,String artist)throws Exception{
        if(TextUtils.isEmpty(hint)||TextUtils.isEmpty(artist))return;
        Set<String> queries=new HashSet<>();
        queries.add(hint+" "+artist);
        queries.add(artist+" "+hint);
        queries.add(hint);
        for(String country:new String[]{"FR","US"}){
            for(String query:queries){
                JSONObject root=get(API+"/search?term="+enc(query)+"&country="+country+"&media=music&entity=album&limit=80");
                JSONArray rows=root.optJSONArray("results");if(rows==null)continue;
                for(int i=0;i<rows.length();i++){
                    JSONObject x=rows.optJSONObject(i);if(x==null)continue;
                    if(!"collection".equalsIgnoreCase(x.optString("wrapperType","")))continue;
                    long cid=x.optLong("collectionId",0L);if(cid<=0)continue;
                    String collection=clean(x.optString("collectionName",""));
                    String gotArtist=clean(x.optString("artistName",""));
                    int count=x.optInt("trackCount",0);
                    if(count<4||count>60||TextUtils.isEmpty(collection))continue;
                    if(genericCompilationArtist(gotArtist)||!artistMatch(artist,gotArtist))continue;
                    String low=norm(collection);
                    if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))continue;
                    int hs=AudifyInstantAlbumMetadata.similarity(hint,collection);
                    if(hs<2)continue;
                    int s=230;
                    if(hs>=3)s+=145;else s+=92;
                    if(count>=7&&count<=30)s+=75;else s+=42;
                    if(artistMatch(artist,gotArtist))s+=85;
                    if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary")||low.contains("collector"))s-=15;
                    Seed old=unique.get(cid);
                    if(old==null||s>old.score){
                        Seed seed=new Seed();seed.collectionId=cid;seed.collectionName=collection;seed.artist=gotArtist;
                        seed.country=country;seed.trackCount=count;seed.score=s;unique.put(cid,seed);
                        AudifyInstantAlbumMetadata.debug("APPLE_HINT_SEED "+collection+" | artist="+gotArtist+" | tracks="+count+" | score="+s);
                    }
                }
            }
            if(!unique.isEmpty())break;
        }
    }

`;
apple=mustReplace(apple,appleMethodAnchor,appleHintMethod+appleMethodAnchor,'Apple hint method anchor');
await writeFile(applePath,apple,'utf8');

// -----------------------------------------------------------------------------
// Deezer: if track search cannot recover an artist seed, resolve the artist by
// name directly, then use the existing discography + album tracklist proof.
// -----------------------------------------------------------------------------
let deezer=await readFile(deezerPath,'utf8');

const deezerDiag='    static final String DIAGNOSTIC_MARKER="AUDIFY_V68164_DEEZER_REJECT_REASONS";';
if(deezer.includes(deezerDiag)&&!deezer.includes('AUDIFY_V68165_DEEZER_ARTIST_NAME_FALLBACK')){
  deezer=deezer.replace(
    deezerDiag,
    deezerDiag+'\n    static final String ARTIST_NAME_FALLBACK_MARKER="AUDIFY_V68165_DEEZER_ARTIST_NAME_FALLBACK";\n    static final String HINT_DISCOGRAPHY_MARKER="AUDIFY_V68165_HINT_DISCOGRAPHY_PROOF";'
  );
}

const deezerEmpty='        if(artists.isEmpty()){AudifyInstantAlbumMetadata.debug("DEEZER_REJECT no artist seed from track search");return null;}';
const deezerFallback=`        if(artists.isEmpty()){
            AudifyInstantAlbumMetadata.debug("DEEZER_ARTIST_NAME_FALLBACK_START "+artist);
            try{artists=findArtistSeedsByName(artist);}catch(Throwable e){AudifyInstantAlbumMetadata.debug("DEEZER_ARTIST_NAME_FALLBACK_ERROR "+e.getClass().getSimpleName()+": "+String.valueOf(e.getMessage()));}
            AudifyInstantAlbumMetadata.debug("DEEZER_ARTIST_NAME_FALLBACK_SEEDS "+artists.size());
        }
        if(artists.isEmpty()){AudifyInstantAlbumMetadata.debug("DEEZER_REJECT no artist seed from track or artist search");return null;}`;
deezer=mustReplace(deezer,deezerEmpty,deezerFallback,'Deezer empty artist fallback');

const deezerMethodAnchor='    private static AlbumResult scanDiscography(long artistId,String title,String artist,long durationMs,String hint)throws Exception{';
const deezerArtistMethod=`    private static ArrayList<ArtistSeed> findArtistSeedsByName(String artist)throws Exception{
        ArrayList<ArtistSeed> out=new ArrayList<>();
        Set<Long> seen=new HashSet<>();
        for(String query:new String[]{artist,"artist:\""+artist+"\""}){
            JSONObject root=get(API+"/search/artist?q="+enc(query)+"&limit=30");
            JSONArray data=root.optJSONArray("data");if(data==null)continue;
            for(int i=0;i<data.length();i++){
                JSONObject row=data.optJSONObject(i);if(row==null)continue;
                long id=row.optLong("id",0L);if(id<=0||!seen.add(id))continue;
                String got=clean(row.optString("name",""));if(TextUtils.isEmpty(got))continue;
                int s;
                String a=norm(artist),b=norm(got);
                if(a.equals(b))s=310;
                else if(a.length()>=4&&b.length()>=4&&(a.contains(b)||b.contains(a)))s=255;
                else {int sim=AudifyInstantAlbumMetadata.similarity(artist,got);s=sim>=3?235:sim==2?190:0;}
                if(s<175)continue;
                ArtistSeed seed=new ArtistSeed();seed.id=id;seed.name=got;seed.score=s;out.add(seed);
                AudifyInstantAlbumMetadata.debug("DEEZER_ARTIST_NAME_SEED "+got+" id="+id+" score="+s);
            }
            if(!out.isEmpty())break;
        }
        return out;
    }

`;
deezer=mustReplace(deezer,deezerMethodAnchor,deezerArtistMethod+deezerMethodAnchor,'Deezer artist method anchor');
await writeFile(deezerPath,deezer,'utf8');

console.log('Audify V68.16.5: hint-first Apple album discovery + Deezer artist-name fallback enabled; all candidates still require canonical artist ownership and real album tracklist proof.');
