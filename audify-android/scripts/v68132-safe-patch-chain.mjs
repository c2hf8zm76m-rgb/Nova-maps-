import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const raw=String(pkg?.scripts?.['android:patch']||'');
if(!raw.trim()) throw new Error('Audify safe patch chain: package android:patch missing');

const commands=raw.split('&&').map(x=>x.trim()).filter(Boolean);
const forbidden='v681218-pulse-splash.mjs';
const filtered=commands.filter(cmd=>!cmd.includes(forbidden));
if(filtered.length===commands.length){
  console.log('Audify safe patch chain: legacy Pulse Splash was already absent.');
}else{
  console.log('Audify safe patch chain: permanently SKIPPING '+forbidden);
}

for(const cmd of filtered){
  execSync(cmd,{cwd:root,stdio:'inherit',shell:true});
}

// Required late patches. They run after every historical patch and therefore own the final output.
for(const script of [
  'scripts/v68131-clickable-album-tracks.mjs',
  'scripts/v681311-album-track-state-fix.mjs',
  'scripts/v68133-album-playlist-save-fix.mjs',
  'scripts/v68140-album-intelligence2.mjs',
  'scripts/v68141-album-intelligence-recall-fix.mjs',
  'scripts/v68150-youtube-music-album-resolver.mjs',
  'scripts/v68151-ytmusic-coherence-guard.mjs',
  'scripts/v68152-ytmusic-session-stability.mjs',
  'scripts/v68132-restore-exact-gradient-a-splash.mjs',
  'scripts/v681322-android12-splash-theme-fix.mjs',
  'scripts/v681321-splash-safety-lock.mjs'
]){
  execSync(`node ${script}`,{cwd:root,stdio:'inherit',shell:true});
}

console.log('Audify V68.15.2 safe patch chain complete: YouTube Music primary resolver + coherence guard + session stability + Album Intelligence fallback + no persistent album cache + Gradient-A splash lock.');
