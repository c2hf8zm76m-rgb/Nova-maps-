import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const metaPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyInstantAlbumMetadata.java');
let src=await readFile(metaPath,'utf8');

function replaceRequired(from,to,label){
  if(!src.includes(from)) throw new Error('V68.15.8 localized official metadata: missing '+label);
  src=src.replace(from,to);
}

const marker='static final String STRUCTURED_IDENTITY_MARKER="AUDIFY_V68157_STRUCTURED_DESCRIPTION_TRUST";';
replaceRequired(
  marker,
  marker+'\n    static final String LOCALIZED_OFFICIAL_MARKER="AUDIFY_V68158_LOCALIZED_OFFICIAL_METADATA";\n    static final String FRENCH_CHANNEL_MARKER="AUDIFY_V68158_FRENCH_OFFICIAL_CHANNEL_NORMALIZATION";',
  'V68.15.7 marker'
);

replaceRequired(
`    static String cleanArtist(String s){
        return s==null?"":s.replaceAll("(?i)\\s*-\\s*Topic$","").replaceAll("(?i)\\s+Topic$","")
            .replaceAll("(?i)VEVO$","").replaceAll("(?i)\\s*Official$","").trim();
    }`,
`    static String cleanArtist(String s){
        if(s==null)return "";
        String x=s.replaceAll("(?i)\\s*-\\s*Topic$","").replaceAll("(?i)\\s+Topic$","")
            .replaceAll("(?i)VEVO$","").trim();
        // Localized platform/channel decorations are metadata, not part of the artist name.
        x=x.replaceAll("(?i)\\s*(?:[-|·•]\\s*)?(?:official|officiel(?:le)?|oficial|ufficiale|offiziell)(?:\\s+(?:music|artist|channel|chaine|chaîne))?$","").trim();
        return x;
    }`,
  'cleanArtist localized suffix normalization'
);

replaceRequired(
`        stripped=stripped.replaceFirst("(?i)\\s+official$","").trim();`,
`        stripped=stripped.replaceFirst("(?i)\\s+official$","").trim();
        stripped=stripped.replaceFirst("(?i)\\s+(?:officiel(?:le)?|oficial|ufficiale|offiziell)(?:\\s+(?:music|artist|channel|chaine|chaîne))?$","").trim();`,
  'descriptor localized official suffix'
);

// Keep video/clip decorations out of catalogue queries in several common locales.
replaceRequired(
`        String x=s.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio|clip officiel)[\\])]","");
        x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er|clip officiel).*$","");`,
`        String x=s.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio|clip officiel|vid[eé]o officielle?|video oficial|clip oficial|video ufficiale|offizielles video)[\\])]","");
        x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er|clip officiel|vid[eé]o officielle?|video oficial|clip oficial|video ufficiale|offizielles video).*$","");`,
  'localized title decoration cleanup'
);

await writeFile(metaPath,src,'utf8');
console.log('Audify V68.15.8: localized official/channel metadata is normalized before album lookup (French/English/Spanish/Italian/German variants); no artist/song/album hard-coding.');
