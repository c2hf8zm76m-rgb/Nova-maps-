import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const metaPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyInstantAlbumMetadata.java');
let src=await readFile(metaPath,'utf8');

function replaceRequired(from,to,label){
  if(!src.includes(from)) throw new Error('V68.15.9 Artist Identity Fusion: missing '+label);
  src=src.replace(from,to);
}

const marker='static final String FRENCH_CHANNEL_MARKER="AUDIFY_V68158_FRENCH_OFFICIAL_CHANNEL_NORMALIZATION";';
replaceRequired(
  marker,
  marker+'\n    static final String ARTIST_FUSION_MARKER="AUDIFY_V68159_ARTIST_IDENTITY_FUSION";\n    static final String STRUCTURED_TITLE_MARKER="AUDIFY_V68159_STRUCTURED_VIDEO_TITLE_PROOF";\n    static final String CHANNEL_ALIAS_MARKER="AUDIFY_V68159_CHANNEL_ALIAS_INDEPENDENCE";',
  'V68.15.8 marker'
);

const artistAnchor=`        String rawCanonical=canonicalArtistFromDescriptor(artist);\n        if(!TextUtils.isEmpty(rawCanonical))artist=cleanArtist(rawCanonical);`;
replaceRequired(
  artistAnchor,
  artistAnchor+String.raw`

        // V68.15.9 — the YouTube channel display name is NOT the canonical artist identity.
        // A strong "ARTIST - TRACK" video title is direct recording metadata and may reveal
        // the real artist when the official channel uses an alias, brand, abbreviation or legacy name.
        String[] structuredTitle=structuredVideoIdentity(rawTitle);
        if(structuredTitle==null&&!TextUtils.isEmpty(yt.title))structuredTitle=structuredVideoIdentity(yt.title);
        if(structuredTitle!=null&&!TextUtils.isEmpty(structuredTitle[0])){
            String titleArtist=cleanArtist(structuredTitle[0]);
            String channelArtist=cleanArtist(rawArtist);
            String ytArtist=cleanArtist(yt.artist);
            boolean agreesWithKnown=artistMatch(titleArtist,artist)||artistMatch(titleArtist,ytArtist);
            boolean channelAliasMismatch=!TextUtils.isEmpty(channelArtist)&&!artistMatch(titleArtist,channelArtist);
            // Structured title evidence outranks the public channel label on a mismatch.
            // Catalogue/description evidence still gets a chance to confirm or replace it below.
            if(agreesWithKnown||channelAliasMismatch||TextUtils.isEmpty(artist)||looksGenericArtist(artist)){
                artist=titleArtist;
            }
        }`,
  'pre-catalogue artist fusion anchor'
);

const titleAnchor=`        if(TextUtils.isEmpty(title)&&!TextUtils.isEmpty(ytTitle))title=ytTitle;\n        else if(!TextUtils.isEmpty(ytTitle)&&similarity(title,ytTitle)>=2)title=shorterUseful(title,ytTitle);\n        if(TextUtils.isEmpty(title))return null;`;
replaceRequired(
  titleAnchor,
  `        if(TextUtils.isEmpty(title)&&!TextUtils.isEmpty(ytTitle))title=ytTitle;\n        else if(!TextUtils.isEmpty(ytTitle)&&similarity(title,ytTitle)>=2)title=shorterUseful(title,ytTitle);\n        if(structuredTitle!=null&&!TextUtils.isEmpty(structuredTitle[1])){\n            String structuredSong=cleanTitle(structuredTitle[1]);\n            if(!TextUtils.isEmpty(structuredSong))title=structuredSong;\n        }\n        if(TextUtils.isEmpty(title))return null;`,
  'canonical title fusion anchor'
);

const helperAnchor='    private static String parseOfficialDescriptionArtist(';
if(!src.includes(helperAnchor))throw new Error('V68.15.9 Artist Identity Fusion: helper anchor missing');

const helpers=String.raw`    private static String[] structuredVideoIdentity(String raw){
        if(TextUtils.isEmpty(raw))return null;
        String s=raw.replace('\r',' ').replace('\n',' ').replaceAll("\\s+"," ").trim();
        if(s.length()<5||s.length()>260)return null;
        String[] separators=new String[]{" - "," – "," — "};
        int best=-1;String chosen="";
        for(String sep:separators){
            int p=s.indexOf(sep);
            if(p>0&&(best<0||p<best)){best=p;chosen=sep;}
        }
        if(best<=0||TextUtils.isEmpty(chosen))return null;
        String left=cleanArtist(s.substring(0,best).trim());
        String right=cleanTitle(s.substring(best+chosen.length()).trim());
        if(TextUtils.isEmpty(left)||TextUtils.isEmpty(right))return null;
        if(left.length()>60||right.length()>180)return null;
        if(left.split("\\s+").length>7)return null;
        String ln=norm(left),rn=norm(right);
        if(ln.length()<2||rn.length()<2)return null;
        if(structuredArtistNoise(ln)||structuredTrackNoise(rn))return null;
        return new String[]{left,right};
    }

    private static boolean structuredArtistNoise(String n){
        if(TextUtils.isEmpty(n))return true;
        return n.equals("official")||n.equals("officiel")||n.equals("officielle")||
               n.equals("music")||n.equals("audio")||n.equals("video")||n.equals("clip")||
               n.equals("lyrics")||n.equals("lyric")||n.equals("topic")||n.equals("vevo")||
               n.startsWith("official video")||n.startsWith("clip officiel");
    }

    private static boolean structuredTrackNoise(String n){
        if(TextUtils.isEmpty(n))return true;
        return n.equals("official")||n.equals("officiel")||n.equals("audio")||n.equals("video")||
               n.equals("lyrics")||n.equals("lyric")||n.equals("topic");
    }

`;
src=src.replace(helperAnchor,helpers+helperAnchor);

await writeFile(metaPath,src,'utf8');
console.log('Audify V68.15.9: Artist Identity Fusion enabled — structured ARTIST - TRACK metadata can override channel aliases before YouTube Music/Deezer/MusicBrainz/Apple lookup; no artist-specific mapping.');
