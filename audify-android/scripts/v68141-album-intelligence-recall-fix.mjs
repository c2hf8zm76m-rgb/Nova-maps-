import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const file=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyInstantAlbumMetadata.java');
let s=await readFile(file,'utf8');

function req(a,b,label){
  if(!s.includes(a)) throw new Error('V68.14.1 recall fix: missing '+label);
  s=s.replace(a,b);
}

req(
  'static final String MARKER="AUDIFY_V6814_ALBUM_INTELLIGENCE_2";',
  'static final String MARKER="AUDIFY_V6814_ALBUM_INTELLIGENCE_2";\n    static final String RECALL_MARKER="AUDIFY_V68141_ALBUM_RECALL_FIX";',
  'marker'
);

// V68.14 was over-conservative: valid single-source catalogue matches were commonly
// scored 66-77 then rejected. Keep the evidence engine, lower only the acceptance gates.
req('a!=null&&a.tracks.size()>1&&a.confidence>=72?a:null','a!=null&&a.tracks.size()>1&&a.confidence>=64?a:null','cache read threshold');
req('if(c==null||a==null||a.confidence<72)return;','if(c==null||a==null||a.confidence<64)return;','cache write threshold');
req('if(chosen==null||chosen.tracks.size()<2||chosen.confidence<72)return null;','if(chosen==null||chosen.tracks.size()<2||chosen.confidence<64)return null;','final threshold');
req('if(single.confidence<78)return null;','if(single.confidence<66)return null;','single-source threshold');

// MusicBrainz: retain stronger V68.14 scoring, but restore realistic recall.
req('if(best==null||best.score<205)return null;','if(best==null||best.score<165)return null;','MusicBrainz gate');
req('best.album.confidence=clamp(68+(best.score-205)/7,68,98);','best.album.confidence=clamp(64+(best.score-165)/6,64,98);','MusicBrainz confidence');

// Apple/iTunes: the old 155 gate + 78 single-source gate effectively killed many
// legitimate albums. 125 was historically reliable in Audify, while V68.14 adds
// duration, Art Track hints and stronger penalties on singles/compilations.
req('if(best==null||bestScore<155)return null;','if(best==null||bestScore<125)return null;','Apple gate');
req('a.confidence=clamp(66+(bestScore-170)/5,66,96);','a.confidence=clamp(64+(bestScore-125)/4,64,96);','Apple confidence');

const oldDisagreement=`            int delta=ma.confidence-aa.confidence;\n            // Disagreement is intentionally conservative: only a clearly stronger catalogue may win.\n            if(delta>=12&&ma.confidence>=88){ma.source="MusicBrainz (Apple disagreement)";return ma;}\n            if(delta<=-12&&aa.confidence>=88){aa.source="Apple/iTunes (MusicBrainz disagreement)";return aa;}\n            return null;`;
const newDisagreement=`            int delta=ma.confidence-aa.confidence;\n            // V68.14.1: catalogue disagreement must not erase a strong legitimate album.\n            // Prefer a clearly stronger confidence first, then the underlying evidence score.\n            if(delta>=6&&ma.confidence>=72){ma.source="MusicBrainz (consensus rescue)";return ma;}\n            if(delta<=-6&&aa.confidence>=72){aa.source="Apple/iTunes (consensus rescue)";return aa;}\n            if(mb.score>=apple.score+18&&ma.confidence>=68){ma.source="MusicBrainz (evidence rescue)";return ma;}\n            if(apple.score>=mb.score+18&&aa.confidence>=68){aa.source="Apple/iTunes (evidence rescue)";return aa;}\n            Album rescue=ma.confidence>=aa.confidence?ma:aa;\n            if(rescue.confidence>=70){\n                rescue.source=(rescue==ma?"MusicBrainz":"Apple/iTunes")+" (edition disagreement)";\n                return rescue;\n            }\n            return null;`;
req(oldDisagreement,newDisagreement,'catalogue disagreement block');

await writeFile(file,s,'utf8');
console.log('Audify V68.14.1: album recall restored while keeping Album Intelligence 2.0 evidence and no synthetic albums.');
