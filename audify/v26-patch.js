(()=>{
  const LOOP_KEY='audify_loop_v1';
  const getLoop=()=>sessionStorage.getItem(LOOP_KEY)==='1';
  const setLoop=v=>sessionStorage.setItem(LOOP_KEY,v?'1':'0');
  const repeatSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9.2l-2.1-2.1L15.5 3.5 20 8l-4.5 4.5-1.4-1.4L16.2 9H7a4 4 0 0 0-4 4v1H1v-1a6 6 0 0 1 6-6Zm10 10H7.8l2.1 2.1-1.4 1.4L4 16l4.5-4.5 1.4 1.4L7.8 15H17a4 4 0 0 0 4-4v-1h2v1a6 6 0 0 1-6 6Z" fill="currentColor"/></svg>';

  function ensureRepeatButton(){
    const timeline=document.querySelector('.timeline');
    const dur=document.querySelector('#dur');
    if(!timeline||!dur||document.querySelector('#repeatBtn'))return;
    const b=document.createElement('button');
    b.id='repeatBtn'; b.className='repeat-btn'; b.type='button'; b.title='Lecture en boucle'; b.setAttribute('aria-label','Activer la lecture en boucle'); b.innerHTML=repeatSvg;
    timeline.insertBefore(b,dur);
    syncButton();
    b.addEventListener('click',()=>{
      const next=!getLoop(); setLoop(next); syncButton();
      b.classList.remove('loop-pop'); void b.offsetWidth; b.classList.add('loop-pop'); setTimeout(()=>b.classList.remove('loop-pop'),650);
      try{toast(next?'Boucle activée':'Boucle désactivée')}catch{}
    });
  }

  function syncButton(){
    const b=document.querySelector('#repeatBtn'); if(!b)return;
    const on=getLoop(); b.classList.toggle('active',on); b.setAttribute('aria-pressed',on?'true':'false'); b.title=on?'Boucle activée':'Lecture en boucle';
  }

  function patchNextTrack(){
    if(window.__audifyV26LoopPatched)return;
    const original=window.nextTrack;
    if(typeof original!=='function'){setTimeout(patchNextTrack,150);return}
    window.__audifyV26LoopPatched=true;
    window.nextTrack=function(){
      if(getLoop()){
        try{
          if(S?.ready&&S?.p){S.p.seekTo(0,true);S.p.playVideo();return}
        }catch{}
      }
      return original.apply(this,arguments);
    };
  }

  function bind(){ensureRepeatButton();patchNextTrack();syncButton()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,500);
})();
