(()=>{
  const removeIntro=()=>{
    try{document.body.style.overflow=''}catch{}
    const el=document.querySelector('#v32Intro');
    if(!el)return;
    el.classList.add('v32-hide');
    el.style.pointerEvents='none';
    setTimeout(()=>{try{el.remove()}catch{}},620);
  };

  const bindSkip=()=>{
    const skip=document.querySelector('#v32Skip');
    if(skip && !skip.__v41Bound){
      skip.__v41Bound=true;
      skip.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();removeIntro()},{capture:true});
      skip.addEventListener('touchend',e=>{e.preventDefault();removeIntro()},{passive:false,capture:true});
    }
  };

  bindSkip();
  document.addEventListener('click',e=>{if(e.target?.closest?.('#v32Skip'))removeIntro()},true);
  document.addEventListener('touchend',e=>{if(e.target?.closest?.('#v32Skip')){e.preventDefault();removeIntro()}},{capture:true,passive:false});

  const obs=new MutationObserver(()=>bindSkip());
  obs.observe(document.documentElement,{childList:true,subtree:true});

  setTimeout(removeIntro,2350);
  setTimeout(removeIntro,3200);
  setTimeout(()=>{removeIntro();try{obs.disconnect()}catch{}},5000);
})();
