import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const iosRoot = path.resolve(here, '..');
const repoRoot = path.resolve(iosRoot, '..');
const audify = path.join(repoRoot, 'audify');
const www = path.join(iosRoot, 'www');

await mkdir(www, { recursive: true });

const candidates = ['index-v15.html', 'index-v14.html', 'index.html'];
let sourceIndex = null;
for (const name of candidates) {
  try {
    await access(path.join(audify, name));
    sourceIndex = path.join(audify, name);
    break;
  } catch {}
}
if (!sourceIndex) throw new Error('Aucun index Audify trouvé dans /audify');

let html = await readFile(sourceIndex, 'utf8');
html = html
  .replace(/\.\/style(?:-v\d+)?\.css(?:\?[^"']*)?/g, './style.css')
  .replace(/\.\/app\.js(?:\?[^"']*)?/g, './app.js')
  .replace(/\.\/waves\.js(?:\?[^"']*)?/g, './waves.js');

await writeFile(path.join(www, 'index.html'), html, 'utf8');
await cp(path.join(audify, 'style.css'), path.join(www, 'style.css'));
await cp(path.join(audify, 'app.js'), path.join(www, 'app.js'));

try {
  await access(path.join(audify, 'waves.js'));
  await cp(path.join(audify, 'waves.js'), path.join(www, 'waves.js'));
} catch {}

console.log(`Audify Web copié vers ${www}`);
console.log(`Source HTML: ${path.basename(sourceIndex)}`);
