(()=>{
  'use strict';
  let running=false,boundMini=null;
  const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const hasTrack=()=>{try{return !!(typeof S!=='undefined'&&S&&S.current)}catch{return false}};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  function switchToFull(mini){
    const rv=document.querySelector('#resultsView'),pv=document.querySelector('#playerView');
    if(!rv||!pv)return false;
    rv.hidden=true;pv.hidden=false;
    document.body.classList.remove('v45-mini-visible');
    mini?.classList.remove('v45-show');
    try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch{window.scrollTo(0,0)}
    try{window.dispatchEvent(new Event('resize'))}catch{}
    return true;
  }

  function directOpen(mini){switchToFull(mini)}

  function snapshotHTML(mini){
    const cover=mini.querySelector('#v46MiniCover');
    const title=mini.querySelector('#v46MiniTitle')?.textContent||'';
    const artist=mini.querySelector('#v46MiniArtist')?.textContent||'';
    const play=mini.querySelector('#v45MiniPlay')?.textContent||'▶';
    const loop=mini.querySelector('#v45MiniLoop');
    const prog=Number(mini.querySelector('#v45MiniProgress')?.value||0);
    const img=cover?getComputedStyle(cover).backgroundImage:'none';
    return '<div class="v53-mini-snapshot">'+
      '<div class="v53-snap-cover"></div>'+
      '<div class="v53-snap-meta"><div class="v53-snap-title"></div><div class="v53-snap-artist"></div></div>'+
      '<div class="v53-snap-play"></div>'+
      '<div class="v53-snap-loop'+(loop?.classList.contains('active')?' active':'')+'">'+(loop?.innerHTML||'')+'</div>'+
      '<div class="v53-snap-track"><div class="v53-snap-fill"></div></div>'+
    '</div>';
  }

  function hydrateSnapshot(shell,mini){
    const cover=mini.querySelector('#v46MiniCover');
    const snap=shell.querySelector('.v53-mini-snapshot');
    const sc=shell.querySelector('.v53-snap-cover');
    if(sc&&cover)sc.style.backgroundImage=getComputedStyle(cover).backgroundImage;
    const st=shell.querySelector('.v53-snap-title');if(st)st.textContent=mini.querySelector('#v46MiniTitle')?.textContent||'';
    const sa=shell.querySelector('.v53-snap-artist');if(sa)sa.textContent=mini.querySelector('#v46MiniArtist')?.textContent||'';
    const sp=shell.querySelector('.v53-snap-play');if(sp)sp.textContent=mini.querySelector('#v45MiniPlay')?.textContent||'▶';
    const value=Math.max(0,Math.min(1000,Number(mini.querySelector('#v45MiniProgress')?.value||0)));
    const fill=shell.querySelector('.v53-snap-fill');if(fill)fill.style.width=(value/10)+'%';
    return snap;
  }

  async function expandOpen(mini){
    if(running||!hasTrack())return;
    if(reduceMotion()){directOpen(mini);return}
    const from=mini?.getBoundingClientRect();
    if(!from||from.width<4||from.height<4){directOpen(mini);return}
    running=true;
    const body=document.body;
    const shade=document.createElement('div');shade.id='v53MorphShade';
    const shell=document.createElement('div');shell.id='v53MorphShell';shell.innerHTML=snapshotHTML(mini);
    shell.style.left=from.left+'px';shell.style.top=from.top+'px';shell.style.width=from.width+'px';shell.style.height=from.height+'px';shell.style.borderRadius=getComputedStyle(mini).borderRadius||'22px';
    body.appendChild(shade);body.appendChild(shell);hydrateSnapshot(shell,mini);
    body.classList.add('v53-transitioning');
    requestAnimationFrame(()=>shade.classList.add('v53-on'));
    await nextFrame();

    const vw=Math.max(document.documentElement.clientWidth,window.innerWidth||0);
    const vh=Math.max(document.documentElement.clientHeight,window.innerHeight||0);
    const midTop=Math.max(42,from.top*.46);
    const midLeft=Math.max(7,from.left*.34);
    const midWidth=from.width+(vw-from.width)*.72;
    const midHeight=Math.max(from.height,(vh-midTop)*.72);
    let anim;
    try{
      anim=shell.animate([
        {left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',borderRadius:getComputedStyle(mini).borderRadius||'22px',opacity:1,boxShadow:'0 22px 70px rgba(0,0,0,.44)'},
        {offset:.42,left:midLeft+'px',top:midTop+'px',width:midWidth+'px',height:midHeight+'px',borderRadius:'28px',opacity:.94,boxShadow:'0 26px 90px rgba(0,0,0,.5)'},
        {offset:.78,left:'3px',top:'12px',width:(vw-6)+'px',height:(vh-18)+'px',borderRadius:'18px',opacity:.68,boxShadow:'0 30px 100px rgba(0,0,0,.46)'},
        {left:'0px',top:'0px',width:vw+'px',height:vh+'px',borderRadius:'0px',opacity:.28,boxShadow:'0 0 0 rgba(0,0,0,0)'}
      ],{duration:640,easing:'cubic-bezier(.18,.84,.18,1)',fill:'forwards'});
    }catch{
      directOpen(mini);shell.remove();shade.remove();body.classList.remove('v53-transitioning');running=false;return;
    }

    setTimeout(()=>shell.querySelector('.v53-mini-snapshot')?.classList.add('v53-fade'),180);
    setTimeout(()=>{
      if(switchToFull(mini))requestAnimationFrame(()=>body.classList.add('v53-reveal'));
    },245);

    try{await anim.finished}catch{}
    body.classList.add('v53-reveal');
    shell.classList.add('v53-release');shade.classList.add('v53-release');
    await wait(180);
    shell.remove();shade.remove();body.classList.remove('v53-transitioning','v53-reveal');
    running=false;
  }

  function bind(){
    const mini=document.querySelector('#v45MiniPlayer');
    if(!mini)return false;
    if(mini===boundMini&&mini.dataset.v53Bound==='1')return true;
    boundMini=mini;mini.dataset.v53Bound='1';
    mini.addEventListener('click',e=>{
      if(e.target.closest('button,input'))return;
      e.preventDefault();e.stopImmediatePropagation();
      expandOpen(mini);
    },true);
    return true;
  }

  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v53.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();bind();setInterval(bind,500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
