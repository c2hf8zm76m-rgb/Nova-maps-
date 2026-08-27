(()=>{
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  let raf=0;
  function applyV34(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const vv=window.visualViewport;
      const w=Math.round(Math.min(window.innerWidth,vv?.width||window.innerWidth));
      const h=Math.round(Math.min(window.innerHeight,vv?.height||window.innerHeight));
      const root=document.documentElement,body=document.body;
      root.style.setProperty('--a34-vw',w+'px');
      root.style.setProperty('--a34-vh',h+'px');
      if(w>760){
        body.classList.remove('a34-short','a34-very-short','a34-narrow','a34-tall');
        return;
      }

      // V34 donne la priorité à la pochette : largeur d'abord, hauteur seulement comme garde-fou.
      const widthTarget=w*.59;
      const heightRatio=h<620?.29:h<700?.31:.325;
      const heightCap=h*heightRatio;
      const minCover=h<620?168:h<700?184:204;
      const maxCover=w<370?218:w<420?238:252;
      const cover=clamp(Math.min(widthTarget,heightCap),minCover,maxCover);
      const stageW=clamp(cover*1.36,cover+58,Math.min(w*.94,350));
      const stageH=clamp(cover*1.17,cover+34,292);
      let title=clamp(w*.078,25,32);
      if(h<650)title=Math.min(title,27);

      root.style.setProperty('--a34-cover',Math.round(cover)+'px');
      root.style.setProperty('--a34-stage-w',Math.round(stageW)+'px');
      root.style.setProperty('--a34-stage-h',Math.round(stageH)+'px');
      root.style.setProperty('--a34-title',title.toFixed(1)+'px');

      body.classList.toggle('a34-short',h<760);
      body.classList.toggle('a34-very-short',h<650);
      body.classList.toggle('a34-narrow',w<365);
      body.classList.toggle('a34-tall',h>900);
    });
  }
  function bind(){
    applyV34();
    window.addEventListener('resize',applyV34,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(applyV34,120),{passive:true});
    if(window.visualViewport){
      visualViewport.addEventListener('resize',applyV34,{passive:true});
      visualViewport.addEventListener('scroll',applyV34,{passive:true});
    }
    setTimeout(applyV34,350);
    setTimeout(applyV34,900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
