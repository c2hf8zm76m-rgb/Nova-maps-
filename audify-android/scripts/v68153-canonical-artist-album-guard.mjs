import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const ytmPath=path.join(pkgDir,'AudifyYoutubeMusicAlbumResolver.java');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');

function replaceRequired(source,a,b,label){
  if(!source.includes(a)) throw new Error('V68.15.3 canonical album guard: missing '+label);
  return source.replace(a,b);
}

// -----------------------------------------------------------------------------
// YouTube Music: an exact video is not sufficient proof of the canonical album.
// Compilations can legitimately contain the song and therefore expose a real MPRE.
// Require artist ownership/tracklist affinity before allowing the early return.
// -----------------------------------------------------------------------------
let ytm=await readFile(ytmPath,'utf8');

ytm=replaceRequired(
  ytm,
  'static final String STABILITY_MARKER="AUDIFY_V68152_YTMUSIC_SESSION_STABILITY";',
  'static final String STABILITY_MARKER="AUDIFY_V68152_YTMUSIC_SESSION_STABILITY";\n    static final String CANONICAL_MARKER="AUDIFY_V68153_CANONICAL_ARTIST_ALBUM_GUARD";',
  'YTMusic marker'
);

ytm=replaceRequired(
  ytm,
`            if(album==null||album.tracks.size()<3)continue;\n\n            // Strong structural proof: do not keep opening unrelated album candidates.\n            // This dramatically reduces YouTube Music request bursts during normal playback.\n            boolean exactVideo=!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(c.videoId);\n            if(exactVideo&&album.confidence>=94)return album;\n            if(c.score>=265&&album.confidence>=94)return album;\n\n            int quality=album.tracks.size()>=6?36:album.tracks.size()>=4?22:10;`,
`            if(album==null||album.tracks.size()<3)continue;\n            // V68.15.3: a compilation can contain the exact song and still be the wrong album.\n            // Validate that the album tracklist actually belongs to the requested artist.\n            if(!canonicalArtistAlbum(album,wantedArtist))continue;\n\n            // Strong structural proof may return early only AFTER canonical-artist validation.\n            boolean exactVideo=!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(c.videoId);\n            if(exactVideo&&album.confidence>=94)return album;\n            if(c.score>=265&&album.confidence>=94)return album;\n\n            int trackCount=album.tracks.size();\n            int quality=(trackCount>=6&&trackCount<=24)?36:(trackCount>=4&&trackCount<=5)?22:(trackCount<=35?8:-55);`,
  'YTMusic canonical early-return guard'
);

const ytmArtistAnchor=`    private static int artistScore(String wanted,String got){`;
if(!ytm.includes(ytmArtistAnchor))throw new Error('V68.15.3 canonical album guard: missing YTMusic artistScore anchor');
const ytmHelpers=String.raw`    private static boolean genericCompilationArtist(String value){
        if(TextUtils.isEmpty(value))return false;
        String n=AudifyInstantAlbumMetadata.norm(value);
        return n.equals("various artists")||n.equals("various artist")||n.equals("artistes varies")||
               n.equals("artistes divers")||n.equals("multi interpretes")||n.equals("multiple artists");
    }

    private static boolean canonicalArtistAlbum(AudifyInstantAlbumMetadata.Album album,String wantedArtist){
        if(album==null)return false;
        if(genericCompilationArtist(album.artist))return false;
        if(TextUtils.isEmpty(wantedArtist))return album.tracks.size()<=40;
        if(!TextUtils.isEmpty(album.artist)&&artistScore(wantedArtist,album.artist)<=0)return false;

        int known=0,matched=0;
        for(AudifyInstantAlbumMetadata.Track t:album.tracks){
            if(t==null||TextUtils.isEmpty(t.artist))continue;
            known++;
            if(artistScore(wantedArtist,t.artist)>0)matched++;
        }
        // Artist affinity blocks playlists/compilations even when they contain the exact video.
        if(known>=3){
            int pct=(matched*100)/known;
            if(album.tracks.size()>35&&pct<70)return false;
            if(album.tracks.size()>24&&pct<55)return false;
            if(pct<35)return false;
        }
        return true;
    }

`;
ytm=ytm.replace(ytmArtistAnchor,ytmHelpers+ytmArtistAnchor);
await writeFile(ytmPath,ytm,'utf8');

// -----------------------------------------------------------------------------
// MusicBrainz + Apple fallback: prefer releases OWNED by the requested artist.
// A track credited to Ninho inside a Various Artists compilation is not enough.
// -----------------------------------------------------------------------------
let meta=await readFile(metaPath,'utf8');

const marker='static final String NO_ALBUM_CACHE_MARKER="AUDIFY_V6815_NO_PERSISTENT_ALBUM_CACHE";';
meta=replaceRequired(
  meta,
  marker,
  marker+'\n    static final String CANONICAL_ALBUM_MARKER="AUDIFY_V68153_CANONICAL_ARTIST_ALBUM_GUARD";',
  'metadata marker'
);

meta=replaceRequired(
  meta,
`        int n=trackCount(rel);\n        if(n>=7&&n<=30)s+=31;else if(n>=4&&n<=40)s+=17;else if(n>0&&n<=2)s-=38;\n        String rt=rel.optString("title","");`,
`        int n=trackCount(rel);\n        if(n>=7&&n<=24)s+=31;else if(n>=4&&n<=35)s+=17;else if(n>35)s-=68;else if(n>0&&n<=2)s-=38;\n        String rt=rel.optString("title","");`,
  'MusicBrainz track-count compilation penalty'
);

meta=replaceRequired(
  meta,
`        if(!TextUtils.isEmpty(artist)&&artistMatch(credit(rel.optJSONArray("artist-credit")),artist))s+=18;\n        String low=rt.toLowerCase(Locale.ROOT);`,
`        String releaseArtist=credit(rel.optJSONArray("artist-credit"));\n        if(!TextUtils.isEmpty(artist)){\n            if(genericCompilationArtist(releaseArtist))s-=125;\n            else if(artistMatch(releaseArtist,artist))s+=55;\n            else if(!TextUtils.isEmpty(releaseArtist))s-=82;\n        }\n        String low=rt.toLowerCase(Locale.ROOT);`,
  'MusicBrainz release-artist ownership'
);

meta=replaceRequired(
  meta,
`        Album a=parseMb(full,title,artist);if(a==null)return null;\n        return new Resolution(a,bestScore);`,
`        Album a=parseMb(full,title,artist);if(a==null||!canonicalCatalogAlbum(a,artist))return null;\n        return new Resolution(a,bestScore);`,
  'MusicBrainz final canonical gate'
);

meta=replaceRequired(
  meta,
`            String tn=x.optString("trackName",""),an=x.optString("artistName",""),cn=x.optString("collectionName","");\n            if(TextUtils.isEmpty(cn)||x.optLong("collectionId",0L)<=0)continue;\n            int sim=similarity(title,tn);if(sim==0)continue;\n            int s=sim*48;\n            if(artistMatch(an,artist))s+=54;else if(!TextUtils.isEmpty(artist))s-=32;\n            s+=durationScore(durationMs,x.optLong("trackTimeMillis",-1L));\n            int count=x.optInt("trackCount",0);\n            if(count>=7&&count<=35)s+=38;else if(count>=4)s+=22;else if(count<=2)s-=52;`,
`            String tn=x.optString("trackName",""),an=x.optString("artistName",""),cn=x.optString("collectionName","");\n            String collectionArtist=x.optString("collectionArtistName","");\n            if(TextUtils.isEmpty(cn)||x.optLong("collectionId",0L)<=0)continue;\n            // Never let a Various Artists compilation become the canonical album of a known artist.\n            if(!TextUtils.isEmpty(artist)&&genericCompilationArtist(collectionArtist))continue;\n            int sim=similarity(title,tn);if(sim==0)continue;\n            int s=sim*48;\n            if(artistMatch(an,artist))s+=54;else if(!TextUtils.isEmpty(artist))s-=32;\n            if(!TextUtils.isEmpty(artist)){\n                if(!TextUtils.isEmpty(collectionArtist)&&artistMatch(collectionArtist,artist))s+=72;\n                else if(!TextUtils.isEmpty(collectionArtist))s-=98;\n            }\n            s+=durationScore(durationMs,x.optLong("trackTimeMillis",-1L));\n            int count=x.optInt("trackCount",0);\n            if(count>=7&&count<=24)s+=42;else if(count>=4&&count<=35)s+=18;else if(count>35)s-=78;else if(count<=2)s-=52;`,
  'Apple canonical collection-artist scoring'
);

meta=replaceRequired(
  meta,
`        Album a=parseAppleAlbum(lookup,collectionId,title,artist,best);if(a==null)return null;\n        a.confidence=clamp(64+(bestScore-125)/4,64,96);`,
`        Album a=parseAppleAlbum(lookup,collectionId,title,artist,best);if(a==null||!canonicalCatalogAlbum(a,artist))return null;\n        a.confidence=clamp(64+(bestScore-125)/4,64,96);`,
  'Apple final canonical gate'
);

const durationAnchor=`    private static int durationScore(long expected,long actual){`;
if(!meta.includes(durationAnchor))throw new Error('V68.15.3 canonical album guard: missing metadata durationScore anchor');
const metaHelpers=String.raw`    private static boolean genericCompilationArtist(String value){
        if(TextUtils.isEmpty(value))return false;
        String n=norm(value);
        return n.equals("various artists")||n.equals("various artist")||n.equals("artistes varies")||
               n.equals("artistes divers")||n.equals("multi interpretes")||n.equals("multiple artists");
    }

    private static boolean canonicalCatalogAlbum(Album album,String wantedArtist){
        if(album==null)return false;
        if(genericCompilationArtist(album.artist))return false;
        if(TextUtils.isEmpty(wantedArtist))return true;
        if(!TextUtils.isEmpty(album.artist)&&!artistMatch(album.artist,wantedArtist))return false;

        int known=0,matched=0;
        for(Track t:album.tracks){
            if(t==null||TextUtils.isEmpty(t.artist))continue;
            known++;
            if(artistMatch(t.artist,wantedArtist))matched++;
        }
        if(known>=3){
            int pct=(matched*100)/known;
            if(album.tracks.size()>35&&pct<70)return false;
            if(album.tracks.size()>24&&pct<55)return false;
            if(pct<35)return false;
        }
        return true;
    }

`;
meta=meta.replace(durationAnchor,metaHelpers+durationAnchor);
await writeFile(metaPath,meta,'utf8');

console.log('Audify V68.15.3: canonical artist album guard applied — rejects Various Artists compilations, validates tracklist artist affinity, and boosts artist-owned Apple releases.');
