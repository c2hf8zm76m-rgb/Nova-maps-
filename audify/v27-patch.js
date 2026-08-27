(()=>{
  function buildLayout(){
    const view=document.querySelector('#playerView');
    const stage=document.querySelector('.stage');
    const player=document.querySelector('.player');
    const well=player?.querySelector('.well');
    const actions=player?.querySelector('.actions');
    const prev=document.querySelector('#prev');
    const next=document.querySelector('#next');
    const like=document.querySelector('#likeBtn');
    const home=document.querySelector('#homeFloating');
    const playlist=document.querySelector('#playlistFloating');
    if(!view||!stage||!player||!well||!prev||!next||!like||!home||!playlist)return false;

    let tools=document.querySelector('.v27-top-tools');
    if(!tools){
      tools=document.createElement('div');
      tools.className='v27-top-tools';
      view.appendChild(tools);
    }
    if(home.parentNode!==tools)tools.appendChild(home);
    if(playlist.parentNode!==tools)tools.appendChild(playlist);
    if(like.parentNode!==tools)tools.appendChild(like);

    let row=document.querySelector('.v27-stage-row');
    if(!row){
      row=document.createElement('div');
      row.className='v27-stage-row';
      stage.parentNode.insertBefore(row,stage);
    }
    prev.classList.add('v27-cover-nav');
    next.classList.add('v27-cover-nav');
    if(prev.parentNode!==row)row.appendChild(prev);
    if(stage.parentNode!==row)row.appendChild(stage);
    if(next.parentNode!==row)row.appendChild(next);

    player.classList.add('v27-clean-player');
    if(actions&&like.parentNode===actions)actions.removeChild(like);
    return true;
  }

  function bind(){
    buildLayout();
    if(!window.__audifyV27Observer){
      window.__audifyV27Observer=new MutationObserver(()=>buildLayout());
      window.__audifyV27Observer.observe(document.body,{childList:true,subtree:true});
    }
    let tries=0;
    const timer=setInterval(()=>{if(buildLayout()||++tries>30)clearInterval(timer)},150);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,500);
})();
