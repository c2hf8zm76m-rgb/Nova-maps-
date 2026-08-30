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

// Le patch V58 contient encore un Service Worker PWA. Il n'a rien à faire dans l'APK.
const v58Source = await readFile(path.join(audify, 'v58-patch.js'), 'utf8');
const swRegistration = "function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v58.js',{scope:'./'}).catch(()=>{})}";
if (!v58Source.includes(swRegistration)) throw new Error('Enregistrement Service Worker V58 introuvable');
await writeFile(
  path.join(www, 'v58-android-patch.js'),
  v58Source.replace(swRegistration, 'function registerSW(){}'),
  'utf8'
);

const cssPatches = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,38,39,40,45,46,47,48,49,50,51,53,54,55,56,57,58,65,66
];
const jsBeforeV58 = [
  22,23,24,25,26,27,28,29,30,31,32,33,34,35,44,45,46,47,48,49,50,51,53,54,55,56,57
];
const jsAfterV58 = [59,65];

const source = path.join(audify, 'index-v21.html');
let html = await readFile(source, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Audify Android V66.4 • Native Touch Tracer</title>');
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#070a0f">'
);

const nativeRuntimeCleanup = `<script id="audify-android-runtime-clean-v664">
(()=>{
  const KEY='audify_android_runtime_clean_v664';
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

const androidSearchCss = `
<style id="audify-android-search-root-v664">
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
  ...cssPatches.map(v => `<link rel="stylesheet" href="./v${v}-patch.css?v=android-v664">`),
  androidSearchCss
].join('');
html = html.replace('</head>', css + '</head>');

// Traceur HTML : troisième étage après ACTIVITY et WEBVIEW.
// Il envoie aussi un hit-test automatique au centre de #q au démarrage, sans attendre le toucher.
const htmlTouchTracer = `<script id="audify-html-touch-tracer-v664">
(()=>{
  const desc=el=>{
    if(!el)return 'null';
    let s=(el.tagName||'').toLowerCase();
    if(el.id)s+='#'+el.id;
    if(el.classList&&el.classList.length)s+='.'+[...el.classList].slice(0,3).join('.');
    return s||String(el.nodeName||'node');
  };
  const send=(type,x=null,y=null)=>{
    try{
      const q=document.querySelector('#q');
      const r=q?q.getBoundingClientRect():null;
      let px=Number.isFinite(x)?x:(r?r.left+r.width/2:0);
      let py=Number.isFinite(y)?y:(r?r.top+r.height/2:0);
      const hit=document.elementFromPoint(px,py);
      const active=document.activeElement;
      const payload={
        type,
        xy:Math.round(px)+','+Math.round(py),
        hit:desc(hit),
        active:desc(active),
        qFocused:active===q,
        qRect:r?[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)].join(','):'none'
      };
      if(window.AudifyNative&&typeof window.AudifyNative.traceHtml==='function'){
        window.AudifyNative.traceHtml(JSON.stringify(payload));
      }
    }catch(e){
      try{window.AudifyNative&&window.AudifyNative.traceHtml('trace-error:'+e.message)}catch{}
    }
  };
  document.addEventListener('pointerdown',e=>send('pointerdown',e.clientX,e.clientY),true);
  document.addEventListener('touchstart',e=>{
    const t=e.touches&&e.touches[0];if(t)send('touchstart',t.clientX,t.clientY);
  },{capture:true,passive:true});
  document.addEventListener('click',e=>send('click',e.clientX,e.clientY),true);
  document.addEventListener('focusin',()=>send('focusin'),true);
  document.addEventListener('focusout',()=>send('focusout'),true);
  setTimeout(()=>send('boot-q-center'),500);
  setTimeout(()=>send('boot-q-center-2'),1600);
})();
<\/script>`;

const scripts = [
  ...jsBeforeV58.map(v => `<script src="./v${v}-patch.js?v=android-v664"><\/script>`),
  '<script src="./v58-android-patch.js?v=android-v664"><\/script>',
  ...jsAfterV58.map(v => `<script src="./v${v}-patch.js?v=android-v664"><\/script>`),
  '<script src="./native-android-bridge.js?v=android-v664-native"><\/script>',
  '<script src="./manual-queue-ui-fix.js?v=android-v664-manual-queue"><\/script>',
  '<script src="./remove-browser-install-ui.js?v=android-v664-no-browser-install"><\/script>',
  '<script src="./google-sync-config.js?v=android-v664"><\/script>',
  '<script src="./v66-patch.js?v=android-v664"><\/script>',
  htmlTouchTracer
].join('');
html = html.replace('</body>', scripts + '</body>');

await writeFile(path.join(www, 'index.html'), html, 'utf8');
console.log('Audify Android V66.4 : traceur natif ACTIVITY/WEBVIEW + hit-test HTML assemblé.');
