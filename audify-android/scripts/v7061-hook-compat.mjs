import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.join(here,'v7061-auto-lyrics-background.mjs');
const tempPath=path.join(here,'.v7061-auto-lyrics-runtime-fixed.mjs');
let src=await readFile(sourcePath,'utf8');

const oldAnchor="const anchor='        player = new ExoPlayer.Builder(this).build();';";
const newAnchor="const anchor='mediaSession = new MediaLibrarySession.Builder(this, player, libraryCallback)';";
if(!src.includes(oldAnchor)) throw new Error('V70.6.1 compat: ancienne ancre introuvable');
src=src.replace(oldAnchor,newAnchor);
src=src.replace(
  "throw new Error('V70.6.1: ancre ExoPlayer introuvable dans AudifyPlaybackService')",
  "throw new Error('V70.6.1: ancre MediaLibrarySession introuvable dans AudifyPlaybackService')"
);
src=src.replace(
  'service=service.replace(anchor,anchor+hook);',
  "service=service.replace(anchor,hook+'\\n        '+anchor);"
);

await writeFile(tempPath,src,'utf8');
try{
  await import(pathToFileURL(tempPath).href+'?run='+Date.now());
}finally{
  try{await import('node:fs/promises').then(m=>m.unlink(tempPath));}catch{}
}

console.log('Audify V70.6.1 compat: hook automatique branché sur la MediaLibrarySession finale.');
