import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const file=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyYoutubeMusicAlbumResolver.java');
let s=await readFile(file,'utf8');
const old='if(!canonicalArtistAlbum(album,wantedArtist))continue;';
const fixed='if(!canonicalArtistAlbum(album,artist))continue;';
if(!s.includes(old))throw new Error('V68.15.3.1 compile fix: canonical guard variable anchor missing');
s=s.replace(old,fixed);
await writeFile(file,s,'utf8');
console.log('Audify V68.15.3.1: canonical album guard compile variable fixed.');
