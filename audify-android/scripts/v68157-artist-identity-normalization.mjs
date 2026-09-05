import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const metaPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyInstantAlbumMetadata.java');
let src=await readFile(metaPath,'utf8');

function replaceRequired(from,to,label){
  if(!src.includes(from)) throw new Error('V68.15.7 artist identity normalization: missing '+label);
  src=src.replace(from,to);
}

const marker='static final String DESCRIPTION_ALBUM_MARKER="AUDIFY_V68156_DESCRIPTION_ALBUM_PROOF";';
replaceRequired(
  marker,
  marker+'\n    static final String RAW_ARTIST_MARKER="AUDIFY_V68157_RAW_ARTIST_CANONICALIZATION";\n    static final String STRUCTURED_IDENTITY_MARKER="AUDIFY_V68157_STRUCTURED_DESCRIPTION_TRUST";',
  'V68.15.6 description marker'
);

replaceRequired(
'        boolean topic=false;',
'        boolean topic=false,structuredIdentity=false;',
'YoutubeEvidence flags'
);

replaceRequired(
`        String artist=cleanArtist(rawArtist);
        // V68.15.6: for official/auto-generated uploads, embedded recording metadata outranks
        // a descriptive channel display name such as "le rappeur ..." or "... - Topic".
        if(yt.topic&&!TextUtils.isEmpty(yt.artist))artist=cleanArtist(yt.artist);
        else if((TextUtils.isEmpty(artist)||looksGenericArtist(artist))&&!TextUtils.isEmpty(yt.artist))artist=cleanArtist(yt.artist);`,
`        String artist=cleanArtist(rawArtist);

        // V68.15.7 — canonicalize the raw player/channel label BEFORE every catalogue lookup.
        // This is generic metadata cleanup; no song, artist or album mapping exists here.
        String rawCanonical=canonicalArtistFromDescriptor(artist);
        if(!TextUtils.isEmpty(rawCanonical))artist=cleanArtist(rawCanonical);

        if(!TextUtils.isEmpty(yt.artist)){
            String evidenceArtist=cleanArtist(yt.artist);
            String evidenceCanonical=canonicalArtistFromDescriptor(evidenceArtist);
            if(!TextUtils.isEmpty(evidenceCanonical))evidenceArtist=cleanArtist(evidenceCanonical);

            // A structured title·artist block is direct recording metadata. It can outrank
            // a public channel label even when YouTube did not classify the upload as Topic.
            if(yt.structuredIdentity||yt.topic||TextUtils.isEmpty(artist)||looksGenericArtist(artist)||artistMatch(evidenceArtist,artist)){
                artist=evidenceArtist;
            }
        }`,
'pre-catalogue canonical artist selection'
);

replaceRequired(
`        String embeddedArtist=parseOfficialDescriptionArtist(y.description,cleanTitle(y.title));
        if(y.topic&&!TextUtils.isEmpty(embeddedArtist))y.artist=cleanArtist(embeddedArtist);
        else if(y.topic){
            String descriptorArtist=canonicalArtistFromDescriptor(y.artist);
            if(!TextUtils.isEmpty(descriptorArtist))y.artist=cleanArtist(descriptorArtist);
        }`,
`        String embeddedArtist=parseOfficialDescriptionArtist(y.description,cleanTitle(y.title));
        if(!TextUtils.isEmpty(embeddedArtist)){
            // The parser already requires the title side of "title · artist" to match the
            // current recording, therefore the artist identity is usable on Topic and non-Topic uploads.
            y.artist=cleanArtist(embeddedArtist);
            y.structuredIdentity=true;
        }else{
            String descriptorArtist=canonicalArtistFromDescriptor(y.artist);
            if(!TextUtils.isEmpty(descriptorArtist))y.artist=cleanArtist(descriptorArtist);
        }`,
'structured description artist trust'
);

await writeFile(metaPath,src,'utf8');
console.log('Audify V68.15.7: raw artist labels are canonicalized before catalogue lookup and structured title·artist metadata is trusted on Topic and non-Topic music uploads; no song/artist/album hard-coding.');
