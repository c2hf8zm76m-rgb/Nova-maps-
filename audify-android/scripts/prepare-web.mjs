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
await cp(path.join(root, 'remove-browser-install-ui.js'), path.join(www, 'remove-browser-install-ui.js'));

// Android est assemblé localement au build : pas de fetch/document.write au démarrage.
const cssPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,38,39,40,45,46,47,48,49,50,51,53,54,55,56,57,58,65,66
];
const jsPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,44,45,46,47,48,49,50,51,53,54,55,56,57,58,59,65
];

const source = path.join(audify, 'index-v21.html');
let html = await readFile(source, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Audify Android V66.2 • System Insets Search Fix</title>');
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#070a0f">'
);

// V66.2 : ce CSS Android est volontairement injecté APRES tous les anciens patchs.
// Les patchs V31/V33/V34 remontaient la recherche à ~5px du viewport.
// Le viewport reçoit désormais aussi les vrais insets système via Capacitor.
const androidSearchCss = `
<style id="audify-android-search-root-v662">
html,body{margin:0;background:#070a0f!important;color:#fff}
body{min-height:100%}
.search-wrap{
  left:9px!important;
  right:9px!important;
  top:10px!important;
  width:auto!important;
  transform:none!important;
  z-index:2147483000!important;
  pointer-events:auto!important;
  will-change:auto!important;
  contain:none!important;
}
.search{
  pointer-events:auto!important;
  transform:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  will-change:auto!important;
  contain:none!important;
  isolation:isolate!important;
  background:rgba(19,25,34,.98)!important;
}
#q{
  position:relative!important;
  z-index:3!important;
  display:block!important;
  pointer-events:auto!important;
  touch-action:manipulation!important;
  -webkit-user-select:text!important;
  user-select:text!important;
  cursor:text!important;
  opacity:1!important;
  visibility:visible!important;
  transform:none!important;
  -webkit-transform:none!important;
}
#q:focus{outline:none!important;caret-color:#fff!important}
.search button{position:relative!important;z-index:4!important}
</style>`;

const css = [
  ...cssPatches.map(v => `<link rel="stylesheet" href="./v${v}-patch.css?v=android-v662">`),
  androidSearchCss
].join('');
html = html.replace('</head>', css + '</head>');

const scripts = [
  ...jsPatches.map(v => `<script src="./v${v}-patch.js?v=android-v662"><\/script>`),
  '<script src="./native-android-bridge.js?v=android-v662-native"><\/script>',
  '<script src="./manual-queue-ui-fix.js?v=android-v662-manual-queue"><\/script>',
  '<script src="./remove-browser-install-ui.js?v=android-v662-no-browser-install"><\/script>',
  '<script src="./google-sync-config.js?v=android-v662"><\/script>',
  '<script src="./v66-patch.js?v=android-v662"><\/script>'
].join('');
html = html.replace('</body>', scripts + '</body>');

await writeFile(path.join(www, 'index.html'), html, 'utf8');
console.log('Audify Android V66.2 : insets système + hit-test recherche corrigés à la racine.');
