(()=>{
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  let raf=0;
  function applyV33(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const vv=window.visualViewport;
      const w=Math.round(Math.min(window.innerWidth,vv?.width||window.innerWidth));
      const h=Math.round(Math.min(window.innerHeight,vv?.height||window.innerHeight));
      const root=document.documentElement,body=document.body;
      root.style.setProperty('--a33-vw',w+'px');
      root.style.setProperty('--a33-vh',h+'px');
      if(w>760){
        root.style.setProperty('--a33-fit','1');
        body.classList.remove('a33-short','a33-very-short','a33-narrow','a33-tall');
        return;
      }

      const fit=clamp(Math.min(w/390,h/844),.62,1.03);
      const minCover=h<650?132:h<720?142:154;
      const maxCover=h<650?154:h<720?174:h<820?194:218;
      const cover=clamp(Math.min(w*.54,h*.225),minCover,maxCover);
      const stageW=clamp(cover*1.34,190,300);
      const stageH=clamp(cover*1.13,160,246);
      const playerW=clamp(w-14,286,382);

      let titleBase=36*fit;
      if(h<720)titleBase*=.92;
      if(h<650)titleBase*=.88;
      const title=clamp(titleBase,21,38);
      const tool=clamp(40*fit,34,42);

      root.style.setProperty('--a33-fit',fit.toFixed(3));
      root.style.setProperty('--a33-cover',Math.round(cover)+'px');
      root.style.setProperty('--a33-stage-w',Math.round(stageW)+'px');
      root.style.setProperty('--a33-stage-h',Math.round(stageH)+'px');
      root.style.setProperty('--a33-player-w',Math.round(playerW)+'px');
      root.style.setProperty('--a33-title',title.toFixed(1)+'px');
      root.style.setProperty('--a33-tool',Math.round(tool)+'px');

      body.classList.toggle('a33-short',h<760);
      body.classList.toggle('a33-very-short',h<670);
      body.classList.toggle('a33-narrow',w<365);
      body.classList.toggle('a33-tall',h>900);
    });
  }

  function bind(){
    applyV33();
    window.addEventListener('resize',applyV33,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(applyV33,120),{passive:true});
    if(window.visualViewport){
      visualViewport.addEventListener('resize',applyV33,{passive:true});
      visualViewport.addEventListener('scroll',applyV33,{passive:true});
    }
    const mo=new MutationObserver(applyV33);
    mo.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden','class']});
    setTimeout(applyV33,420);
    setTimeout(applyV33,980);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
