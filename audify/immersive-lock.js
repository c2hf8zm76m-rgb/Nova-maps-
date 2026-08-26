(()=>{
  const player=document.querySelector('#nowPlaying');
  if(!player)return;
  let savedScrollY=0;
  let locked=false;

  const isLocked=()=>document.body.classList.contains('player-mode');

  function lock(){
    if(locked)return;
    savedScrollY=window.scrollY||0;
    locked=true;
    document.documentElement.classList.add('player-mode');
    document.body.classList.add('player-mode');
    window.scrollTo(0,0);
  }

  function unlock(){
    if(!locked)return;
    locked=false;
    document.documentElement.classList.remove('player-mode');
    document.body.classList.remove('player-mode');
    requestAnimationFrame(()=>window.scrollTo(0,savedScrollY));
  }

  function sync(){
    player.hidden?unlock():lock();
  }

  const observer=new MutationObserver(sync);
  observer.observe(player,{attributes:true,attributeFilter:['hidden']});
  sync();

  document.addEventListener('touchmove',e=>{
    if(!isLocked())return;
    if(e.target.closest?.('input[type="range"]'))return;
    e.preventDefault();
  },{passive:false,capture:true});

  document.addEventListener('wheel',e=>{
    if(!isLocked())return;
    e.preventDefault();
  },{passive:false,capture:true});

  document.addEventListener('dragstart',e=>{
    if(isLocked())e.preventDefault();
  },true);

  window.addEventListener('scroll',()=>{
    if(isLocked()&&(window.scrollX!==0||window.scrollY!==0))window.scrollTo(0,0);
  },{passive:true});
})();