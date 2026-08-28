(()=>{
  'use strict';
  let running=false,boundMini=null;
  const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const hasTrack=()=>{try{return !!(typeof S!=='undefined'&&S&&S.current)}catch{return false}};
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

  async function animatedOpen(mini){
    if(running||!hasTrack())return;
    const source=mini?.querySelector('#v46MiniCover');
    if(!source||reduceMotion()){directOpen(mini);return}
    const from=source.getBoundingClientRect();
    if(from.width<2||from.height<2){directOpen(mini);return}
    running=true;
    const body=document.body;
    const shade=document.createElement('div');shade.id='v52TransitionShade';
    const flight=document.createElement('div');flight.className='v52-flight-cover';
    const cs=getComputedStyle(source);
    flight.style.backgroundImage=cs.backgroundImage;
    flight.style.left=from.left+'px';flight.style.top=from.top+'px';flight.style.width=from.width+'px';flight.style.height=from.height+'px';flight.style.borderRadius=cs.borderRadius||'14px';
    body.appendChild(shade);body.appendChild(flight);body.classList.add('v52-transitioning');
    requestAnimationFrame(()=>shade.classList.add('v52-show'));
    if(!switchToFull(mini)){flight.remove();shade.remove();body.classList.remove('v52-transitioning');running=false;return}
    await nextFrame();
    const dest=document.querySelector('#cover')||document.querySelector('#playerView .cover');
    if(!dest){flight.remove();shade.remove();body.classList.remove('v52-transitioning');running=false;return}
    const to=dest.getBoundingClientRect();
    if(to.width<2||to.height<2){flight.remove();shade.remove();body.classList.remove('v52-transitioning');running=false;return}
    const destRadius=getComputedStyle(dest).borderRadius||'26px';
    setTimeout(()=>body.classList.add('v52-reveal'),90);
    let anim;
    try{
      anim=flight.animate([
        {left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',borderRadius:cs.borderRadius||'14px',boxShadow:'0 16px 38px rgba(0,0,0,.32)'},
        {offset:.58,left:(from.left+(to.left-from.left)*.62)+'px',top:(from.top+(to.top-from.top)*.62)+'px',width:(from.width+(to.width-from.width)*.62)+'px',height:(from.height+(to.height-from.height)*.62)+'px',borderRadius:'20px',boxShadow:'0 26px 70px rgba(0,0,0,.46)'},
        {left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',borderRadius:destRadius,boxShadow:'0 36px 96px rgba(0,0,0,.58)'}
      ],{duration:520,easing:'cubic-bezier(.2,.86,.22,1)',fill:'forwards'});
      await anim.finished;
    }catch{}
    body.classList.remove('v52-transitioning','v52-reveal');
    body.classList.add('v52-arrived');
    flight.remove();shade.classList.add('v52-out');
    setTimeout(()=>{shade.remove();body.classList.remove('v52-arrived')},360);
    running=false;
  }

  function bind(){
    const mini=document.querySelector('#v45MiniPlayer');
    if(!mini)return false;
    if(mini===boundMini&&mini.dataset.v52Bound==='1')return true;
    boundMini=mini;mini.dataset.v52Bound='1';
    mini.addEventListener('click',e=>{
      if(e.target.closest('button,input'))return;
      e.preventDefault();e.stopImmediatePropagation();
      animatedOpen(mini);
    },true);
    return true;
  }

  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v52.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();bind();setInterval(bind,500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
