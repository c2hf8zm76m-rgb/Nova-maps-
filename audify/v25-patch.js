(()=>{
  const homeSvg=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 10.2 12 4l7.5 6.2v8.3a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 20v-5.7h5.6V20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const plusSvg=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  const checkSvg=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.2 12.5 4.3 4.2 9.3-9.4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function centerIcons(){
    const h=document.querySelector('#homeFloating');
    const p=document.querySelector('#playlistFloating');
    if(h&&!h.dataset.v25Icon){h.dataset.v25Icon='1';h.innerHTML=homeSvg;h.title='Accueil'}
    if(p&&!p.dataset.v25Icon){p.dataset.v25Icon='1';p.innerHTML=plusSvg;p.title='Ajouter à une playlist'}
  }

  function pressPlaylist(){
    const p=document.querySelector('#playlistFloating'); if(!p)return;
    p.classList.remove('v25-press'); void p.offsetWidth; p.classList.add('v25-press');
    setTimeout(()=>p.classList.remove('v25-press'),360);
  }

  function successPlaylist(){
    const p=document.querySelector('#playlistFloating'); if(!p)return;
    p.classList.remove('v25-press','v25-success');
    p.innerHTML=checkSvg;
    void p.offsetWidth;
    p.classList.add('v25-success');
    setTimeout(()=>{p.classList.remove('v25-success');p.innerHTML=plusSvg},900);
  }

  function bindPlaylistButton(){
    const p=document.querySelector('#playlistFloating');
    if(!p||p.dataset.v25Bound)return;
    p.dataset.v25Bound='1';
    p.addEventListener('click',pressPlaylist,{capture:true});
  }

  function watchToast(){
    const t=document.querySelector('#toast');
    if(!t||t.dataset.v25Observed)return;
    t.dataset.v25Observed='1';
    let last='';
    const check=()=>{
      const txt=(t.textContent||'').trim();
      if(txt&&txt!==last&&/^Ajouté à\s+/i.test(txt)) successPlaylist();
      if(txt)last=txt;
    };
    new MutationObserver(check).observe(t,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
    check();
  }

  function bind(){centerIcons();bindPlaylistButton();watchToast()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,250);setTimeout(bind,700);setTimeout(bind,1400);
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
