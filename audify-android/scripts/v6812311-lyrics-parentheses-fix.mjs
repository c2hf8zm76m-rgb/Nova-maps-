import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const file=path.join(root,'android','app','src','main','java','com','nova','audify','NativeKaraokeActivity.java');
let src=await readFile(file,'utf8');

const badTrack='addCandidates(candidates,seen,parseArray(httpGet("https://lrclib.net/api/search?track_name="+q(broadTitle)));';
const goodTrack='addCandidates(candidates,seen,parseArray(httpGet("https://lrclib.net/api/search?track_name="+q(broadTitle))));';
const badBroad='addCandidates(candidates,seen,parseArray(httpGet("https://lrclib.net/api/search?q="+q(broadQuery)));';
const goodBroad='addCandidates(candidates,seen,parseArray(httpGet("https://lrclib.net/api/search?q="+q(broadQuery))));';

if(!src.includes(badTrack)) throw new Error('V68.12.31.1 : ligne LRCLIB track_name à corriger introuvable');
if(!src.includes(badBroad)) throw new Error('V68.12.31.1 : ligne LRCLIB broad q à corriger introuvable');

src=src.replace(badTrack,goodTrack).replace(badBroad,goodBroad);
await writeFile(file,src,'utf8');
console.log('Audify V68.12.31.1 : parenthèses du Lyrics Resolver corrigées avant compilation.');
