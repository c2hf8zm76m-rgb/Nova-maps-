(()=>{
  let timer=0;
  function repair(){
    const player=document.querySelector('.player');
    const actions=player?.querySelector('.actions');
    const video=actions?.querySelector('#videoBtn')||document.querySelector('#videoBtn');
    const lyrics=document.querySelector('#v36LyricsBtn');
    if(!player||!actions||!lyrics)return false;
    if(lyrics.parentNode!==actions)actions.insertBefore(lyrics,video||actions.firstChild);
    lyrics.style.display='inline-flex';
    lyrics.style.visibility='visible';
    lyrics.style.opacity='1';
    lyrics.style.pointerEvents='auto';
    return true;
  }
  function bind(){
    repair();
    clearInterval(timer);
    let tries=0;
    timer=setInterval(()=>{if(repair()||++tries>80)clearInterval(timer)},150);
    if(!window.__audifyV37Observer){
      window.__audifyV37Observer=new MutationObserver(()=>repair());
      window.__audifyV37Observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
    }
    setTimeout(repair,600);
    setTimeout(repair,1400);
    setTimeout(repair,2600);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
