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
await cp(path.join(root, 'search-focus-fix.js'), path.join(www, 'search-focus-fix.js'));

// Android ne passe plus par index-v59 -> fetch(index-v21) -> document.write().
// On assemble la page finale au build : démarrage local, déterministe et sans écran blanc.
const cssPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,38,39,40,45,46,47,48,49,50,51,53,54,55,56,57,58
];
const jsPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,44,45,46,47,48,49,50,51,53,54,55,56,57,58,59
];

const source = path.join(audify, 'index-v21.html');
let html = await readFile(source, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Audify Android V64.5</title>');
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#070a0f">'
);

const css = [
  '<style>html,body{margin:0;background:#070a0f!important;color:#fff}body{min-height:100%;}.search-wrap,.search,#q{pointer-events:auto!important}#q{touch-action:manipulation!important;-webkit-user-select:text!important;user-select:text!important}</style>',
  ...cssPatches.map(v => `<link rel="stylesheet" href="./v${v}-patch.css?v=android-v645">`)
].join('');
html = html.replace('</head>', css + '</head>');

const scripts = [
  ...jsPatches.map(v => `<script src="./v${v}-patch.js?v=android-v645"><\/script>`),
  '<script src="./native-android-bridge.js?v=android-v645-native"><\/script>',
  '<script src="./manual-queue-ui-fix.js?v=android-v645-manual-queue"><\/script>',
  '<script src="./search-focus-fix.js?v=android-v645-search"><\/script>'
].join('');
html = html.replace('</body>', scripts + '</body>');

await writeFile(path.join(www, 'index.html'), html, 'utf8');
console.log('Audify Android V64.5 assemblé directement depuis V21 dans', www);
