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

for(const script of [
  'scripts/v68131-clickable-album-tracks.mjs',
  'scripts/v681311-album-track-state-fix.mjs',
  'scripts/v68133-album-playlist-save-fix.mjs',
  'scripts/v68140-album-intelligence2.mjs',
  'scripts/v68141-album-intelligence-recall-fix.mjs',
  'scripts/v68150-youtube-music-album-resolver.mjs',
  'scripts/v68151-ytmusic-coherence-guard.mjs',
  'scripts/v68152-ytmusic-session-stability.mjs',
  'scripts/v68153-canonical-artist-album-guard.mjs',
  'scripts/v681531-canonical-guard-compile-fix.mjs',
  'scripts/v68154-playback-continuity-timestamps.mjs',
  'scripts/v68155-deezer-canonical-album-crosscheck.mjs',
  'scripts/v68156-official-metadata-identity.mjs',
  'scripts/v68157-artist-identity-normalization.mjs',
  'scripts/v68158-localized-official-metadata.mjs',
  'scripts/v68159-artist-identity-fusion.mjs',
  'scripts/v68160-release-preference-intelligence.mjs',
  'scripts/v68161-apple-release-graph.mjs',
  'scripts/v68162-official-album-mention-intelligence.mjs',
  'scripts/v68163-innertube-video-evidence-bridge.mjs',
  'scripts/v681640-diagnostic-script-compat.mjs',
  'scripts/v68164-album-diagnostic-trace.mjs',
  'scripts/v681641-visible-album-diagnostic-ui.mjs',
  'scripts/v68165-hint-first-release-lookup.mjs',
  'scripts/v68166-fast-proof-pipeline.mjs',
  'scripts/v68132-restore-exact-gradient-a-splash.mjs',
  'scripts/v681322-android12-splash-theme-fix.mjs',
  'scripts/v681321-splash-safety-lock.mjs'
]){
  execSync(`node ${script}`,{cwd:root,stdio:'inherit',shell:true});
}

console.log('Audify V68.16.6 safe patch chain complete: fast parallel proof pipeline + hint-first canonical album lookup + runtime diagnostics + Innertube evidence + all album guards + Gradient-A splash lock.');
