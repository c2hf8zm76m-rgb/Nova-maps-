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

// Le patch V58 contient encore un Service Worker PWA. Il n'a rien à faire dans l'APK :
// CacheStorage + ServiceWorker peuvent survivre aux mises à jour de l'application et mélanger
// des fichiers de plusieurs versions. On conserve les fonctions UI V58 mais sans registerSW().
const v58Source = await readFile(path.join(audify, 'v58-patch.js'), 'utf8');
const swRegistration = "function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v58.js',{scope:'./'}).catch(()=>{})}";
if (!v58Source.includes(swRegistration)) throw new Error('Enregistrement Service Worker V58 introuvable');
await writeFile(
  path.join(www, 'v58-android-patch.js'),
  v58Source.replace(swRegistration, 'function registerSW(){}'),
  'utf8'
);

// Android reste assemblé localement au build : pas de fetch/document.write au démarrage.
const cssPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,38,39,40,45,46,47,48,49,50,51,53,54,55,56,57,58,65,66
];
const jsBeforeV58 = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,44,45,46,47,48,49,50,51,53,54,55,56,57
];
const jsAfterV58 = [59,65];

const source = path.join(audify, 'index-v21.html');
let html = await readFile(source, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Audify Android V66.3 • Native Search Root Fix</title>');
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#070a0f">'
);

// IMPORTANT : ce nettoyage est inline et placé avant tous les anciens patchs.
// S'il reste un SW V58 qui contrôle la WebView, on le désenregistre, on efface seulement
// ses caches PWA (jamais localStorage/IndexedDB), puis on recharge UNE fois sans contrôleur.
const nativeRuntimeCleanup = `<script id="audify-android-runtime-clean-v663">
(()=>{
  const KEY='audify_android_runtime_clean_v663';
  const hadController=!!(navigator.serviceWorker&&navigator.serviceWorker.controller);
  const unregister=()=>navigator.serviceWorker&&navigator.serviceWorker.getRegistrations
    ? navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister().catch(()=>false))))
    : Promise.resolve();
  const clearCaches=()=>window.caches&&caches.keys
    ? caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('audify-v')).map(k=>caches.delete(k))))
    : Promise.resolve();
  Promise.resolve().then(unregister).then(clearCaches).then(()=>{
    if(hadController&&!sessionStorage.getItem(KEY)){
      sessionStorage.setItem(KEY,'1');
      location.reload();
    }
  }).catch(()=>{});
})();
<\/script>`;
html = html.replace('<head>', '<head>' + nativeRuntimeCleanup);

// Après correction native des WindowInsets, la recherche redevient un champ HTML normal.
// On garde seulement un style Android simple : aucun faux focus, aucun overlay, aucun hack IME.
const androidSearchCss = `
<style id="audify-android-search-root-v663">
html,body{margin:0;background:#070a0f!important;color:#fff}
body{min-height:100%}
.search-wrap{
  left:9px!important;
  right:9px!important;
  top:10px!important;
  width:auto!important;
  transform:none!important;
  z-index:50!important;
  pointer-events:auto!important;
}
.search{
  pointer-events:auto!important;
  transform:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  background:rgba(19,25,34,.98)!important;
}
#q{
  pointer-events:auto!important;
  touch-action:manipulation!important;
  -webkit-user-select:text!important;
  user-select:text!important;
  cursor:text!important;
  caret-color:#fff!important;
}
</style>`;

const css = [
  ...cssPatches.map(v => `<link rel="stylesheet" href="./v${v}-patch.css?v=android-v663">`),
  androidSearchCss
].join('');
html = html.replace('</head>', css + '</head>');

const scripts = [
  ...jsBeforeV58.map(v => `<script src="./v${v}-patch.js?v=android-v663"><\/script>`),
  '<script src="./v58-android-patch.js?v=android-v663"><\/script>',
  ...jsAfterV58.map(v => `<script src="./v${v}-patch.js?v=android-v663"><\/script>`),
  '<script src="./native-android-bridge.js?v=android-v663-native"><\/script>',
  '<script src="./manual-queue-ui-fix.js?v=android-v663-manual-queue"><\/script>',
  '<script src="./remove-browser-install-ui.js?v=android-v663-no-browser-install"><\/script>',
  '<script src="./google-sync-config.js?v=android-v663"><\/script>',
  '<script src="./v66-patch.js?v=android-v663"><\/script>'
].join('');
html = html.replace('</body>', scripts + '</body>');

await writeFile(path.join(www, 'index.html'), html, 'utf8');
console.log('Audify Android V66.3 : runtime PWA nettoyé + recherche remise sur hit-test natif.');
