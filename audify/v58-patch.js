(()=>{
  'use strict';
  let miniScrub=false,lastSearchMode=false;
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const resultsView=()=>document.querySelector('#resultsView');
  const playerView=()=>document.querySelector('#playerView');
  const results=()=>document.querySelector('#results');
  const input=()=>document.querySelector('#q');

  function browsing(){
    const rv=resultsView(),pv=playerView();
    return !!(current()&&rv&&!rv.hidden&&pv&&pv.hidden);
  }
  function searchMode(){
    const rv=resultsView(),pv=playerView(),r=results();
    if(!rv||rv.hidden||!pv||!pv.hidden||!r)return false;
    if(r.classList.contains('home-view'))return false;
    return !!r.querySelector('[data-p],.v57-search-actions');
  }
  function ensureHomeButton(){
    const rv=resultsView(),r=results();if(!rv||!r)return null;
    let wrap=document.querySelector('#v58SearchHomeWrap');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='v58SearchHomeWrap';wrap.className='v58-search-home-wrap';
      wrap.innerHTML='<button id="v58SearchHome" class="v58-search-home" type="button" aria-label="Retour à Home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/><path d="M9 21v-6h6v6"/></svg><span>Home</span></button>';
      rv.insertBefore(wrap,r);
      wrap.querySelector('button').addEventListener('click',()=>goHomeFromSearch(true));
    }
    return wrap;
  }
  function goHomeFromSearch(clear=true){
    const q=input();if(clear&&q)q.value='';
    const floating=document.querySelector('#homeFloating');
    if(floating){floating.click();return}
    const home=document.querySelector('#homeBtn');
    if(home){home.click();return}
    try{if(typeof goHome==='function')goHome()}catch{}
  }
  function syncMini(){
    const show=browsing();
    document.body.classList.toggle('v58-mini-browse',show);
    if(!show)return;
    const s=state(),p=s?.ready&&s?.p?s.p:null;
    const play=document.querySelector('#v45MiniPlay');
    const prog=document.querySelector('#v45MiniProgress');
    const loop=document.querySelector('#v45MiniLoop');
    if(p){
      try{const st=p.getPlayerState();if(play)play.textContent=st===1?'❚❚':'▶';if(prog&&!miniScrub){const d=p.getDuration()||0,c=p.getCurrentTime()||0;prog.value=d?String(Math.max(0,Math.min(1000,Math.round(c/d*1000)))):'0'}}catch{}
    }
    if(loop){let on=false;try{on=sessionStorage.getItem('audify_loop_v1')==='1'}catch{}loop.classList.toggle('active',on);loop.setAttribute('aria-pressed',on?'true':'false')}
  }
  function syncSearchHome(){
    const wrap=ensureHomeButton();if(!wrap)return;
    const mode=searchMode();wrap.classList.toggle('show',mode);lastSearchMode=mode;
  }
  function sync(){syncMini();syncSearchHome()}
  function bindInput(){
    const q=input();if(!q||q.dataset.v58Bound==='1')return;
    q.dataset.v58Bound='1';
    q.addEventListener('input',()=>{
      if(q.value.trim()===''&&searchMode())goHomeFromSearch(false);
    });
  }
  function bindMiniScrub(){
    const prog=document.querySelector('#v45MiniProgress');if(!prog||prog.dataset.v58Bound==='1')return;
    prog.dataset.v58Bound='1';
    prog.addEventListener('pointerdown',()=>miniScrub=true);
    prog.addEventListener('pointerup',()=>miniScrub=false);
    prog.addEventListener('pointercancel',()=>miniScrub=false);
    prog.addEventListener('change',()=>miniScrub=false);
  }
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v58.js',{scope:'./'}).catch(()=>{})}
  function boot(){
    registerSW();bindInput();bindMiniScrub();ensureHomeButton();sync();
    const rv=resultsView(),pv=playerView();
    const mo=new MutationObserver(()=>sync());
    if(rv)mo.observe(rv,{attributes:true,attributeFilter:['hidden']});
    if(pv)mo.observe(pv,{attributes:true,attributeFilter:['hidden']});
    setInterval(()=>{bindInput();bindMiniScrub();sync()},180);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();