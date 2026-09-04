import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const albumPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'AudifyInstantAlbums.java');

let album = await readFile(albumPath, 'utf8');

const oldTicker = `boolean ready=displayState.get(i)!=null;
                String label=ready?"Prêt":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));
                stateView.setText(label);
                stateView.setTextColor(ready?Color.rgb(194,255,126):Color.rgb(148,159,175));`;

const newTicker = `boolean ready=displayState.get(i)!=null;
                if("audify-track-pending".equals(String.valueOf(stateView.getTag()))&&!ready){
                    stateView.setText("Préparation…");
                    stateView.setTextColor(Color.rgb(194,255,126));
                    continue;
                }
                if(ready)stateView.setTag(null);
                String label=ready?"▶  Lire":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));
                stateView.setText(label);
                stateView.setTextColor(ready?Color.rgb(194,255,126):Color.rgb(148,159,175));`;

if (album.includes(oldTicker)) {
  album = album.replace(oldTicker, newTicker);
  await writeFile(albumPath, album, 'utf8');
} else if (!album.includes('String label=ready?"▶  Lire"')) {
  throw new Error('V68.13.1 album state ticker not found');
}

console.log('Audify V68.13.1: clickable album rows keep Lire/Préparation state visible.');
