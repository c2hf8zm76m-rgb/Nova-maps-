import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '..');
const audify = path.join(repo, 'audify');
const www = path.join(root, 'www');

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });
await cp(audify, www, { recursive: true });
await cp(path.join(root, 'native-android-bridge.js'), path.join(www, 'native-android-bridge.js'));
await cp(path.join(root, 'manual-queue-ui-fix.js'), path.join(www, 'manual-queue-ui-fix.js'));

// V59 conserve toute l'interface Audify sans le patch V60 Media Session/WebView,
// car la lecture de fond est maintenant entièrement native côté Android.
const source = path.join(audify, 'index-v59.html');
let html = await readFile(source, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Audify Android V64.2 Native</title>');
const marker = 'document.open();document.write(s);document.close()';
if (!html.includes(marker)) throw new Error('Point d’injection V59 introuvable');
html = html.replace(
  marker,
  "s=s.replace('</body>','<script src=\"./native-android-bridge.js?v=android-v642-native\"><\\/script><script src=\"./manual-queue-ui-fix.js?v=android-v642-manual-queue\"><\\/script></body>');" + marker
);
await writeFile(path.join(www, 'index.html'), html, 'utf8');
console.log('Audify Android V64.2 préparé dans', www);
