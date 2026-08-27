(()=>{
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  let raf=0;
  function applyAdaptiveUI(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const vv=window.visualViewport;
      const w=Math.round(Math.min(window.innerWidth,vv?.width||window.innerWidth));
      const h=Math.round(Math.min(window.innerHeight,vv?.height||window.innerHeight));
      const root=document.documentElement;
      const body=document.body;
      root.style.setProperty('--audify-vw',w+'px');
      root.style.setProperty('--audify-vh',h+'px');
      if(w>760){
        root.style.setProperty('--audify-scale','1');
        body.classList.remove('audify-phone','audify-short','audify-very-short','audify-tall','audify-narrow','audify-wide');
        return;
      }
      const sw=w/390;
      const sh=h/844;
      const aspect=h/Math.max(w,1);
      let scale=Math.min(sw*1.02,sh*1.04);
      if(aspect<1.72)scale*=.94;
      scale=clamp(scale,.80,1.08);
      const cover=clamp(Math.min(w*.56,h*.285),202,252);
      const stageW=clamp(cover*1.40,282,356);
      const stageH=clamp(cover*1.17,232,300);
      const playerW=clamp(Math.min(w-28,390*scale),310,398);
      root.style.setProperty('--audify-scale',scale.toFixed(3));
      root.style.setProperty('--audify-cover',Math.round(cover)+'px');
      root.style.setProperty('--audify-stage-w',Math.round(stageW)+'px');
      root.style.setProperty('--audify-stage-h',Math.round(stageH)+'px');
      root.style.setProperty('--audify-player-w',Math.round(playerW)+'px');
      body.classList.add('audify-phone');
      body.classList.toggle('audify-short',h<760);
      body.classList.toggle('audify-very-short',h<690);
      body.classList.toggle('audify-tall',h>900);
      body.classList.toggle('audify-narrow',w<370);
      body.classList.toggle('audify-wide',w>420);
    });
  }
  function bind(){
    applyAdaptiveUI();
    window.addEventListener('resize',applyAdaptiveUI,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(applyAdaptiveUI,120),{passive:true});
    if(window.visualViewport){
      visualViewport.addEventListener('resize',applyAdaptiveUI,{passive:true});
      visualViewport.addEventListener('scroll',applyAdaptiveUI,{passive:true});
    }
    if('ResizeObserver' in window){
      try{new ResizeObserver(applyAdaptiveUI).observe(document.documentElement)}catch{}
    }
    setTimeout(applyAdaptiveUI,350);
    setTimeout(applyAdaptiveUI,900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
