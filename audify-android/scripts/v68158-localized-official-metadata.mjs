import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const metaPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyInstantAlbumMetadata.java');
let src=await readFile(metaPath,'utf8');

function insertMarker(){
  if(src.includes('AUDIFY_V68158_LOCALIZED_OFFICIAL_METADATA'))return;
  const marker='static final String STRUCTURED_IDENTITY_MARKER="AUDIFY_V68157_STRUCTURED_DESCRIPTION_TRUST";';
  if(!src.includes(marker))throw new Error('V68.15.8 localized official metadata: V68.15.7 marker missing');
  src=src.replace(marker,marker+'\n    static final String LOCALIZED_OFFICIAL_MARKER="AUDIFY_V68158_LOCALIZED_OFFICIAL_METADATA";\n    static final String FRENCH_CHANNEL_MARKER="AUDIFY_V68158_FRENCH_OFFICIAL_CHANNEL_NORMALIZATION";');
}

function replaceBetween(startToken,endToken,replacement,label){
  const start=src.indexOf(startToken);
  if(start<0)throw new Error('V68.15.8 localized official metadata: missing '+label+' start');
  const end=src.indexOf(endToken,start+startToken.length);
  if(end<0)throw new Error('V68.15.8 localized official metadata: missing '+label+' end');
  src=src.slice(0,start)+replacement+src.slice(end);
}

insertMarker();

// Replace the complete helpers by method boundaries instead of matching their historical
// formatting. This keeps V68.15.8 resilient if an earlier patch changes whitespace/escaping.
const cleanArtist=String.raw`    static String cleanArtist(String s){
        if(s==null)return "";
        String x=s.replaceAll("(?i)\\s*-\\s*Topic$","").replaceAll("(?i)\\s+Topic$","")
            .replaceAll("(?i)VEVO$","").trim();
        // Platform/channel decorations are metadata, not part of the canonical artist name.
        // Handle common localized variants generically; there is no artist-specific mapping.
        x=x.replaceAll("(?i)\\s*(?:[-|·•]\\s*)?(?:official|officiel(?:le)?|oficial|ufficiale|offiziell)(?:\\s+(?:music|artist|channel|chaine|chaîne))?$","").trim();
        return x.replaceAll("\\s+"," ").trim();
    }
`;
replaceBetween(
  '    static String cleanArtist(String s){',
  '    static String cleanTitle(String s){',
  cleanArtist,
  'cleanArtist'
);

const cleanTitle=String.raw`    static String cleanTitle(String s){
        if(s==null)return "";
        String x=s.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio|clip officiel|vid[eé]o officielle?|video oficial|clip oficial|video ufficiale|offizielles video)[\\])]","");
        x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er|clip officiel|vid[eé]o officielle?|video oficial|clip oficial|video ufficiale|offizielles video).*$","");
        return x.replaceAll("\\s+"," ").trim();
    }
`;
replaceBetween(
  '    static String cleanTitle(String s){',
  '    private static String stripArtistPrefix(',
  cleanTitle,
  'cleanTitle'
);

const descriptor=String.raw`    private static String canonicalArtistFromDescriptor(String value){
        if(TextUtils.isEmpty(value))return "";
        String v=value.trim().replaceAll("\\s+"," ");
        String stripped=v;
        stripped=stripped.replaceFirst("(?i)^(?:(?:le|la|l'|the)\\s+)?(?:rappeur|rappeuse|rapper|chanteur|chanteuse|singer|artiste|artist|groupe|band)\\s+"," ").trim();
        stripped=stripped.replaceFirst("(?i)^(?:chaine|chaîne|channel)\\s+(?:officielle?|official)\\s+(?:de|of)\\s+"," ").trim();
        stripped=stripped.replaceFirst("(?i)\\s*-\\s*(?:topic|official(?:\\s+(?:music|artist|channel))?)$","").trim();
        stripped=stripped.replaceFirst("(?i)\\s+(?:official|officiel(?:le)?|oficial|ufficiale|offiziell)(?:\\s+(?:music|artist|channel|chaine|chaîne))?$","").trim();
        return stripped.length()>=2&&!norm(stripped).equals(norm(v))?stripped:"";
    }

`;
replaceBetween(
  '    private static String canonicalArtistFromDescriptor(String value){',
  '    private static boolean officialMetadataBoundary(',
  descriptor,
  'canonicalArtistFromDescriptor'
);

// Source-level safety proof: the final generated Java must contain the localized patterns.
for(const required of ['AUDIFY_V68158_LOCALIZED_OFFICIAL_METADATA','AUDIFY_V68158_FRENCH_OFFICIAL_CHANNEL_NORMALIZATION','officiel(?:le)?','video oficial','video ufficiale']){
  if(!src.includes(required))throw new Error('V68.15.8 localized official metadata proof missing: '+required);
}

await writeFile(metaPath,src,'utf8');
console.log('Audify V68.15.8: localized official/channel metadata normalization applied before album lookup; French/English/Spanish/Italian/German variants supported without song/artist/album hard-coding.');
