import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const applePath=path.join(pkgDir,'AudifyAppleReleaseGraphResolver.java');

let meta=await readFile(metaPath,'utf8');

function replaceRequired(source,from,to,label){
  if(!source.includes(from))throw new Error('V68.16.2: missing '+label);
  return source.replace(from,to);
}

const marker='static final String APPLE_TRACKLIST_PROOF_MARKER="AUDIFY_V68161_APPLE_TRACKLIST_RELATION_PROOF";';
meta=replaceRequired(meta,marker,marker+'\n    static final String OFFICIAL_ALBUM_MENTION_MARKER="AUDIFY_V68162_OFFICIAL_ALBUM_MENTION_INTELLIGENCE";\n    static final String NATURAL_ALBUM_HINT_MARKER="AUDIFY_V68162_NATURAL_LANGUAGE_ALBUM_HINT";\n    static final String DESCRIPTION_RELEASE_RELATION_MARKER="AUDIFY_V68162_DESCRIPTION_RELEASE_RELATION";','V68.16.1 marker');

const hintBlock=`        String embeddedAlbum=parseOfficialDescriptionAlbum(y.description,cleanTitle(y.title),cleanArtist(y.artist));\n        String legacyHint=parseAlbumHint(y.description,cleanTitle(y.title),cleanArtist(y.artist));\n        y.albumHint=!TextUtils.isEmpty(embeddedAlbum)?embeddedAlbum:legacyHint;`;
const newHintBlock=`        String naturalAlbum=parseNaturalLanguageAlbumMention(y.description,cleanTitle(y.title),cleanArtist(y.artist));\n        String embeddedAlbum=parseOfficialDescriptionAlbum(y.description,cleanTitle(y.title),cleanArtist(y.artist));\n        String legacyHint=parseAlbumHint(y.description,cleanTitle(y.title),cleanArtist(y.artist));\n        // A direct natural-language relation such as \"available on/from the album ...\" is a strong\n        // release hint, but every resolver must still prove the actual song inside the tracklist.\n        y.albumHint=!TextUtils.isEmpty(naturalAlbum)?naturalAlbum:(!TextUtils.isEmpty(embeddedAlbum)?embeddedAlbum:legacyHint);`;
meta=replaceRequired(meta,hintBlock,newHintBlock,'YouTube description album hint block');

const helperAnchor='    private static String parseOfficialDescriptionArtist(';
if(!meta.includes(helperAnchor))throw new Error('V68.16.2: description helper anchor missing');
const helper=String.raw`    private static String parseNaturalLanguageAlbumMention(String description,String wantedTitle,String canonicalArtist){
        if(TextUtils.isEmpty(description))return "";
        String[] markers=new String[]{
            "disponible dans l'album","disponible sur l'album","extrait de l'album","extrait du nouvel album",
            "issu de l'album","issue de l'album","tiré de l'album","tire de l'album",
            "présent sur l'album","presente sur l'album","présente sur l'album","present sur l'album",
            "from the album","taken from the album","available on the album","appears on the album","featured on the album"
        };
        String[] lines=description.replace('\r','\n').split("\\n+");
        for(String raw:lines){
            if(raw==null)continue;
            String line=raw.trim();
            if(line.length()<6||line.length()>420)continue;
            String normalizedLine=line.replace("’","'").replace("‘","'").replace("“","\"").replace("”","\"");
            String low=normalizedLine.toLowerCase(Locale.ROOT);
            for(String marker:markers){
                int p=low.indexOf(marker);
                if(p<0)continue;
                String tail=normalizedLine.substring(Math.min(normalizedLine.length(),p+marker.length())).trim();
                tail=tail.replaceFirst("^[\\s:;=\\-–—>]+","").trim();
                if(tail.startsWith("«")){
                    int end=tail.indexOf('»',1);
                    if(end>1)tail=tail.substring(1,end).trim();
                    else tail=tail.substring(1).trim();
                }else if(tail.startsWith("\"")){
                    int end=tail.indexOf('"',1);
                    if(end>1)tail=tail.substring(1,end).trim();
                    else tail=tail.substring(1).trim();
                }else{
                    int cut=tail.length();
                    String[] boundaries=new String[]{" → ","→"," http://"," https://"," www."," | "," • "," ; "};
                    for(String b:boundaries){int x=tail.indexOf(b);if(x>=0&&x<cut)cut=x;}
                    tail=tail.substring(0,cut).trim();
                    tail=tail.replaceFirst("[\\s\\.,;:!?)\\]»\"]+$","").trim();
                }
                if(tail.length()<2||tail.length()>120||officialMetadataNoise(tail))continue;
                String cleaned=cleanAlbumHint(tail,wantedTitle,canonicalArtist);
                if(TextUtils.isEmpty(cleaned))continue;
                if(!TextUtils.isEmpty(wantedTitle)&&similarity(cleaned,wantedTitle)>=3)continue;
                if(!TextUtils.isEmpty(canonicalArtist)&&norm(cleaned).equals(norm(canonicalArtist)))continue;
                return cleaned;
            }
        }
        return "";
    }

`;
meta=meta.replace(helperAnchor,helper+helperAnchor);
await writeFile(metaPath,meta,'utf8');

let apple=await readFile(applePath,'utf8');
const appleMarker='static final String SINGLE_GUARD_MARKER="AUDIFY_V68161_AUTONOMOUS_SINGLE_STAYS_SINGLE";';
apple=replaceRequired(apple,appleMarker,appleMarker+'\n    static final String HINT_COLLECTION_MARKER="AUDIFY_V68162_HINT_TO_COLLECTION_LOOKUP";','Apple graph marker');

const seedAnchor=`        for(String country:new String[]{"FR","US"}){\n            for(String q:new String[]{title+" "+artist,baseTitle+" "+artist}){\n                collectSeeds(unique,q,country,title,baseTitle,artist,durationMs,hint);\n            }\n            if(hasStrongAlbumSeed(unique))break;\n        }\n        if(unique.isEmpty())return null;`;
const seedReplacement=`        for(String country:new String[]{"FR","US"}){\n            for(String q:new String[]{title+" "+artist,baseTitle+" "+artist}){\n                collectSeeds(unique,q,country,title,baseTitle,artist,durationMs,hint);\n            }\n            if(hasStrongAlbumSeed(unique))break;\n        }\n\n        // V68.16.2: when the official video description explicitly names the source album,\n        // search that release directly. We still open the collection and verify the song,\n        // artist and duration before accepting it, so a promotional sentence cannot invent an album.\n        if(!TextUtils.isEmpty(hint)){\n            for(String country:new String[]{"FR","US"}){\n                collectHintAlbumSeeds(unique,hint,artist,country);\n                if(hasVeryStrongHintSeed(unique,hint))break;\n            }\n        }\n        if(unique.isEmpty())return null;`;
apple=replaceRequired(apple,seedAnchor,seedReplacement,'Apple seed collection block');

const methodAnchor='    private static boolean hasStrongAlbumSeed(Map<Long,Seed> seeds){';
if(!apple.includes(methodAnchor))throw new Error('V68.16.2: Apple helper anchor missing');
const methods=String.raw`    private static void collectHintAlbumSeeds(Map<Long,Seed> unique,String hint,String artist,String country)throws Exception{
        JSONObject root=get(API+"/search?term="+enc(hint+" "+artist)+"&country="+country+"&media=music&entity=album&limit=100");
        JSONArray rows=root.optJSONArray("results");if(rows==null)return;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null)continue;
            long cid=x.optLong("collectionId",0L);if(cid<=0)continue;
            String collection=clean(x.optString("collectionName",""));
            String gotArtist=clean(x.optString("artistName",""));
            int count=x.optInt("trackCount",0);
            if(count<4||count>60||TextUtils.isEmpty(collection))continue;
            if(!artistMatch(artist,gotArtist))continue;
            int hs=AudifyInstantAlbumMetadata.similarity(hint,collection);
            if(hs<2)continue;
            String low=norm(collection);
            if(low.contains("single")||low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))continue;
            int s=hs>=3?455:365;
            if(count>=7&&count<=30)s+=55;else s+=25;
            Seed old=unique.get(cid);
            if(old==null||s>old.score){
                Seed seed=new Seed();seed.collectionId=cid;seed.collectionName=collection;seed.artist=gotArtist;
                seed.country=country;seed.trackCount=count;seed.score=s;unique.put(cid,seed);
            }
        }
    }

    private static boolean hasVeryStrongHintSeed(Map<Long,Seed> seeds,String hint){
        if(TextUtils.isEmpty(hint))return false;
        for(Seed s:seeds.values()){
            if(s.trackCount>=4&&s.score>=420&&AudifyInstantAlbumMetadata.similarity(hint,s.collectionName)>=3)return true;
        }
        return false;
    }

`;
apple=apple.replace(methodAnchor,methods+methodAnchor);
await writeFile(applePath,apple,'utf8');

console.log('Audify V68.16.2: natural-language official album mentions enabled + direct hint-to-Apple-collection lookup with mandatory tracklist proof; no hard-coded artist/song mapping.');
