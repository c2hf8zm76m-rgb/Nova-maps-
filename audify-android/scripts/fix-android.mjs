import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const javaRoot = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');

const mainPath = path.join(javaRoot, 'MainActivity.java');
let main = await readFile(mainPath, 'utf8');
main = main.replace('protected void onDestroy() {', 'public void onDestroy() {');
await writeFile(mainPath, main, 'utf8');

const servicePath = path.join(javaRoot, 'AudifyPlaybackService.java');
let service = await readFile(servicePath, 'utf8');
service = service
  .replace('import androidx.media.session.MediaSessionCompat;', 'import android.support.v4.media.session.MediaSessionCompat;')
  .replace('import androidx.media.session.PlaybackStateCompat;', 'import android.support.v4.media.session.PlaybackStateCompat;');
await writeFile(servicePath, service, 'utf8');

console.log('Correctifs de compatibilité AndroidX/Capacitor appliqués.');
