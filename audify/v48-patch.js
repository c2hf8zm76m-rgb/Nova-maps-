(()=>{
  'use strict';
  const HISTORY_KEY='audify_recent_v48';
  const MAX_HISTORY=12;
  let installPrompt=null,lastSeenId='',lastRenderKey='';

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const current=()=>{try{return (typeof S!=='undefined'&&S)?S.current:null}catch{return null}};
  const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent||'');

  function readHistory(){try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
  function writeHistory(v){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(v.slice(0,MAX_HISTORY)))}catch{}}
  function addHistory(t){
    if(!t||!t.id)return;
    const item={id:t.id,title:t.title||'Sans titre',artist:t.artist||'YouTube',thumbnail:t.thumbnail||''};
    let h=readHistory().filter(x=>x&&x.id!==item.id);
    h.unshift(item);writeHistory(h);
    lastRenderKey='';
  }

  function ensureInstallSheet(){
    let sheet=document.querySelector('#v48InstallSheet');
    if(sheet)return sheet;
    sheet=document.createElement('div');
    sheet.id='v48InstallSheet';sheet.className='v48-install-sheet';
    sheet.innerHTML='<div class="v48-install-card"><h3>Installer Audify</h3><p id="v48InstallText"></p><ol class="v48-install-steps" id="v48InstallSteps"></ol><button class="v48-install-close" type="button">Fermer</button></div>';
    sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.classList.remove('show')});
    sheet.querySelector('.v48-install-close').addEventListener('click',()=>sheet.classList.remove('show'));
    document.body.appendChild(sheet);return sheet;
  }

  function showInstallHelp(){
    const sheet=ensureInstallSheet(),txt=sheet.querySelector('#v48InstallText'),steps=sheet.querySelector('#v48InstallSteps');
    if(isIOS()){
      txt.textContent='Sur iPhone/iPad, Safari installe Audify depuis le menu Partager.';
      steps.innerHTML='<li><span class="v48-step-no">1</span><span>Touche le bouton <b>Partager</b> de Safari.</span></li><li><span class="v48-step-no">2</span><span>Choisis <b>Sur l’écran d’accueil</b>.</span></li><li><span class="v48-step-no">3</span><span>Touche <b>Ajouter</b>. Audify s’ouvrira ensuite sans barre de navigateur.</span></li>';
    }else{
      txt.textContent='Ton navigateur ne propose pas encore la fenêtre automatique. Tu peux quand même installer Audify depuis son menu.';
      steps.innerHTML='<li><span class="v48-step-no">1</span><span>Ouvre le menu du navigateur.</span></li><li><span class="v48-step-no">2</span><span>Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</span></li>';
    }
    sheet.classList.add('show');
  }

  async function installAudify(){
    if(standalone())return;
    if(installPrompt){
      try{
        installPrompt.prompt();
        await installPrompt.userChoice;
      }catch{}
      installPrompt=null;syncInstallButton();return;
    }
    showInstallHelp();
  }

  function syncInstallButton(){
    const hero=document.querySelector('.home-hero');
    if(!hero)return;
    let btn=document.querySelector('#v48InstallBtn');
    if(standalone()){
      if(btn)btn.remove();return;
    }
    if(!btn){
      btn=document.createElement('button');btn.id='v48InstallBtn';btn.className='v48-install-btn';btn.type='button';
      btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg><span>Installer Audify</span>';
      btn.addEventListener('click',installAudify);hero.appendChild(btn);
    }
    btn.classList.toggle('v48-ready',!!installPrompt);
  }

  function playRecent(id){
    const h=readHistory(),i=h.findIndex(x=>x.id===id);if(i<0)return;
    try{if(typeof S!=='undefined')S.items=h;if(typeof playTrack==='function')playTrack(h[i],i);else if(typeof window.playTrack==='function')window.playTrack(h[i],i)}catch(e){console.error(e)}
  }

  function renderRecent(){
    const r=document.querySelector('#results');
    if(!r||!r.classList.contains('home-view'))return;
    const h=readHistory();
    const key=h.map(x=>x.id).join('|');
    let sec=document.querySelector('#v48Recent');
    if(sec&&lastRenderKey===key)return;
    if(!sec){sec=document.createElement('section');sec.id='v48Recent';sec.className='v48-recent';r.appendChild(sec)}
    sec.innerHTML='<div class="v48-recent-head"><div><h3>Écoutés récemment</h3></div><span>'+h.length+' titre'+(h.length>1?'s':'')+'</span></div>'+(h.length?'<div class="v48-recent-row">'+h.map(t=>'<button type="button" class="v48-recent-card" data-v48-play="'+esc(t.id)+'"><img src="'+esc(t.thumbnail)+'" alt=""><b>'+esc(t.title)+'</b><span>'+esc(t.artist)+'</span></button>').join('')+'</div>':'<div class="v48-recent-empty">Les morceaux que tu écoutes apparaîtront ici automatiquement.</div>');
    sec.querySelectorAll('[data-v48-play]').forEach(b=>b.addEventListener('click',()=>playRecent(b.dataset.v48Play)));
    lastRenderKey=key;
  }

  function sync(){
    const t=current();
    if(t&&t.id&&t.id!==lastSeenId){lastSeenId=t.id;addHistory(t)}
    syncInstallButton();renderRecent();
  }

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;syncInstallButton()});
  window.addEventListener('appinstalled',()=>{installPrompt=null;syncInstallButton();try{if(typeof toast==='function')toast('Audify installé')}catch{}});

  function registerSW(){
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.register('./sw-v48.js',{scope:'./'}).catch(()=>{});
  }
  function boot(){registerSW();sync();setInterval(sync,450)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
