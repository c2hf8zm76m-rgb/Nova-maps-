(()=>{
  const title=document.querySelector('#title');
  if(!title)return;

  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function applySmartTitle(){
    const text=(title.textContent||'').trim();
    const len=[...text].length;
    const mobile=window.innerWidth<=760;

    // Taille continue : plus le titre est long, plus il rétrécit.
    // Les titres courts restent très présents, les très longs restent contenus.
    const size=mobile
      ? clamp(43-Math.max(0,len-14)*0.40,21,43)
      : clamp(62-Math.max(0,len-16)*0.46,28,62);

    title.style.setProperty('--smart-title-size',`${size.toFixed(1)}px`);
    title.dataset.titleLength=String(len);
  }

  const observer=new MutationObserver(applySmartTitle);
  observer.observe(title,{childList:true,characterData:true,subtree:true});
  window.addEventListener('resize',applySmartTitle,{passive:true});
  applySmartTitle();
})();
