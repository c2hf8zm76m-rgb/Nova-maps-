(()=>{
  const KEY='audify_intro_seen_session_v1';
  function buildIntro(){
    if(document.querySelector('#v32Intro'))return document.querySelector('#v32Intro');
    const el=document.createElement('div');
    el.id='v32Intro';
    el.className='v32-intro';
    el.innerHTML='<div class="v32-wrap"><div class="v32-core"><div class="v32-orb"></div><div class="v32-logo">A</div></div><div class="v32-name">AUDIFY</div><div class="v32-sub">Chargement de ton univers musical</div><div class="v32-progress"><i></i></div></div><button id="v32Skip" class="v32-skip" type="button">Passer</button>';
    document.body.appendChild(el);
    return el;
  }
  function hideIntro(){
    const el=document.querySelector('#v32Intro');
    if(!el)return;
    document.body.style.overflow='';
    el.classList.add('v32-hide');
    setTimeout(()=>el.remove(),650);
  }
  function showIntro(){
    let seen=false;
    try{seen=sessionStorage.getItem(KEY)==='1'}catch{}
    if(seen)return;
    const el=buildIntro();
    document.body.style.overflow='hidden';
    try{sessionStorage.setItem(KEY,'1')}catch{}
    el.querySelector('#v32Skip')?.addEventListener('click',hideIntro,{once:true});
    setTimeout(hideIntro,2100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showIntro,{once:true});else showIntro();
})();
