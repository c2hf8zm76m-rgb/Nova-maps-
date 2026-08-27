(()=>{
  'use strict';
  const LOOP_KEY='audify_loop_v1';
  const repeatSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9.2l-2.1-2.1L15.5 3.5 20 8l-4.5 4.5-1.4-1.4L16.2 9H7a4 4 0 0 0-4 4v1H1v-1a6 6 0 0 1 6-6Zm10 10H7.8l2.1 2.1-1.4 1.4L4 16l4.5-4.5 1.4 1.4L7.8 15H17a4 4 0 0 0 4-4v-1h2v1a6 6 0 0 1-6 6Z" fill="currentColor"/></svg>';
  let mini=null,play=null,progress=null,loop=null,scrubbing=false;

  const current=()=>{try{return (typeof S!=='undefined'&&S)?S.current:null}catch{return null}};
  const player=()=>{try{return (typeof S!=='undefined'&&S.ready&&S.p)?S.p:null}catch{return null}};
  const loopOn=()=>{try{return sessionStorage.getItem(LOOP_KEY)==='1'}catch{return false}};

  function ensure(){
    if(mini&&mini.isConnected)return true;
    mini=document.querySelector('#v45MiniPlayer');
    if(!mini){
      mini=document.createElement('div');
      mini.id='v45MiniPlayer';
      mini.setAttribute('role','region');
      mini.setAttribute('aria-label','Mini lecteur Audify');
      mini.innerHTML='<button id="v45MiniPlay" class="v45-mini-btn" type="button" aria-label="Lecture ou pause">▶</button><div class="v45-mini-track"><input id="v45MiniProgress" type="range" min="0" max="1000" value="0" aria-label="Progression du morceau"></div><button id="v45MiniLoop" class="v45-mini-btn" type="button" aria-label="Lecture en boucle">'+repeatSvg+'</button>';
      document.body.appendChild(mini);
    }
    play=mini.querySelector('#v45MiniPlay');
    progress=mini.querySelector('#v45MiniProgress');
    loop=mini.querySelector('#v45MiniLoop');
    if(mini.dataset.v45Bound!=='1'){
      mini.dataset.v45Bound='1';
      play.addEventListener('click',e=>{e.stopPropagation();const p=player();if(!p)return;try{p.getPlayerState()===1?p.pauseVideo():p.playVideo()}catch{}});
      loop.addEventListener('click',e=>{e.stopPropagation();const main=document.querySelector('#repeatBtn');if(main){main.click()}else{try{sessionStorage.setItem(LOOP_KEY,loopOn()?'0':'1')}catch{}}syncLoop()});
      progress.addEventListener('pointerdown',e=>{e.stopPropagation();scrubbing=true});
      progress.addEventListener('pointerup',e=>{e.stopPropagation();scrubbing=false});
      progress.addEventListener('pointercancel',()=>{scrubbing=false});
      progress.addEventListener('change',()=>{scrubbing=false});
      progress.addEventListener('click',e=>e.stopPropagation());
      progress.addEventListener('input',e=>{e.stopPropagation();const p=player();if(!p)return;try{const d=p.getDuration()||0;if(d)p.seekTo(d*(Number(progress.value)/1000),true)}catch{}});
      mini.addEventListener('click',e=>{
        if(e.target.closest('button,input'))return;
        openFullPlayer();
      });
    }
    return true;
  }

  function isHome(){
    const rv=document.querySelector('#resultsView'),pv=document.querySelector('#playerView'),r=document.querySelector('#results');
    return !!(rv&&!rv.hidden&&pv&&pv.hidden&&r&&r.classList.contains('home-view'));
  }

  function openFullPlayer(){
    if(!current())return;
    const rv=document.querySelector('#resultsView'),pv=document.querySelector('#playerView');
    if(!rv||!pv)return;
    rv.hidden=true;pv.hidden=false;
    document.body.classList.remove('v45-mini-visible');
    mini?.classList.remove('v45-show');
    setTimeout(()=>{try{window.dispatchEvent(new Event('resize'))}catch{}},40);
  }

  function syncLoop(){
    if(!loop)return;
    const on=loopOn();
    loop.classList.toggle('active',on);
    loop.setAttribute('aria-pressed',on?'true':'false');
    loop.setAttribute('aria-label',on?'Désactiver la lecture en boucle':'Activer la lecture en boucle');
  }

  function sync(){
    if(!ensure())return;
    const show=!!current()&&isHome();
    mini.classList.toggle('v45-show',show);
    document.body.classList.toggle('v45-mini-visible',show);
    if(!show)return;
    const p=player();
    if(p){
      try{
        const state=p.getPlayerState();
        play.textContent=state===1?'❚❚':'▶';
        play.setAttribute('aria-label',state===1?'Mettre en pause':'Reprendre la lecture');
        if(!scrubbing){const d=p.getDuration()||0,c=p.getCurrentTime()||0;progress.value=d?String(Math.max(0,Math.min(1000,Math.round(c/d*1000)))):'0'}
      }catch{}
    }
    syncLoop();
  }

  function boot(){ensure();sync();setInterval(sync,250)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
