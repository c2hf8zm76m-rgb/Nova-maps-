import { cp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
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
await cp(path.join(root, 'native-search-v6711.js'), path.join(www, 'native-search-v6711.js'));

// Android natif uniquement : aucun ancien Service Worker PWA ne doit pouvoir reprendre la main.
const neutralizeServiceWorkers = async () => {
  const names = await readdir(www);
  const offenders = [];
  for (const name of names) {
    if (!/^v\d+.*\.js$/i.test(name)) continue;
    const p = path.join(www, name);
    let src = await readFile(p, 'utf8');
    const original = src;
    src = src.replace(
      /function registerSW\(\)\{[\s\S]*?\}\s*(?=function boot\(\)\{)/g,
      'function registerSW(){}\n  '
    );
    if (/serviceWorker\.register\(/.test(src) && /(?:^|[-_.])register(?:[-_.]|\.js$)/i.test(name)) {
      src = "(()=>{'use strict';/* Android native: Service Worker intentionally disabled. */})();\n";
    }
    if (src !== original) await writeFile(p, src, 'utf8');
    if (src.includes('serviceWorker.register(')) offenders.push(name);
  }
  for (const name of names) {
    if (/^sw-v.*\.js$/i.test(name)) await rm(path.join(www, name), { force: true });
  }
  if (offenders.length) throw new Error('Service Worker encore actif dans APK: ' + offenders.join(', '));
};
await neutralizeServiceWorkers();

const cssPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,38,39,40,45,46,47,48,49,50,51,53,54,55,56,57,58,65,66
];
const jsPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,44,45,46,47,48,49,50,51,53,54,55,56,57,58,59,65
];

const source = path.join(audify, 'index-v21.html');
let html = await readFile(source, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Audify Android V67.1.1 • Native YouTube Search</title>');
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#070a0f">'
);

const runtimeGuard = `<script id="audify-android-runtime-guard-v6711">
(()=>{
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){
      navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister().catch(()=>false)))).catch(()=>{});
    }
    if(window.caches&&caches.keys){
      caches.keys().then(keys=>Promise.all(keys.filter(k=>/^audify-/i.test(k)).map(k=>caches.delete(k)))).catch(()=>{});
    }
  }catch{}
})();
<\/script>`;
html = html.replace('<head>', '<head>' + runtimeGuard);

const androidSearchCss = `
<style id="audify-search-reboot-v6711">
html,body{margin:0;background:#070a0f!important;color:#fff}
body{min-height:100%}
.search-wrap{display:none!important;visibility:hidden!important;pointer-events:none!important}
</style>`;

const css = [
  ...cssPatches.map(v => `<link rel="stylesheet" href="./v${v}-patch.css?v=android-v6711">`),
  androidSearchCss
].join('');
html = html.replace('</head>', css + '</head>');

const scripts = [
  ...jsPatches.map(v => `<script src="./v${v}-patch.js?v=android-v6711"><\/script>`),
  '<script src="./native-android-bridge.js?v=android-v6711-native"><\/script>',
  '<script src="./manual-queue-ui-fix.js?v=android-v6711-manual-queue"><\/script>',
  '<script src="./remove-browser-install-ui.js?v=android-v6711-no-browser-install"><\/script>',
  '<script src="./google-sync-config.js?v=android-v6711"><\/script>',
  '<script src="./v66-patch.js?v=android-v6711"><\/script>',
  '<script src="./native-search-v6711.js?v=android-v6711-search"><\/script>'
].join('');
html = html.replace('</body>', scripts + '</body>');

await writeFile(path.join(www, 'index.html'), html, 'utf8');
console.log('Audify Android V67.1.1 : barre native + fonction YouTube dédiée AudifyNativeSearch.');
