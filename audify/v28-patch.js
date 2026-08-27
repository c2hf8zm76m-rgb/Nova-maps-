(()=>{
  function bindContextNav(){
    const row=document.querySelector('.v27-stage-row');
    const stage=row?.querySelector('.stage');
    if(!row||!stage||row.dataset.v28Bound==='1')return false;
    row.dataset.v28Bound='1';
    let timer=0;
    const hide=()=>{row.classList.remove('v28-left','v28-right')};
    const reveal=side=>{
      row.classList.toggle('v28-left',side==='left');
      row.classList.toggle('v28-right',side==='right');
    };
    const sideFromX=x=>{
      const rr=row.getBoundingClientRect();
      const sr=stage.getBoundingClientRect();
      if(x<sr.left&&x>=rr.left)return 'left';
      if(x>sr.right&&x<=rr.right)return 'right';
      return null;
    };
    row.addEventListener('mousemove',e=>reveal(sideFromX(e.clientX)));
    row.addEventListener('mouseleave',hide);
    row.addEventListener('touchstart',e=>{
      const t=e.touches&&e.touches[0]; if(!t)return;
      const side=sideFromX(t.clientX); if(!side)return;
      reveal(side); clearTimeout(timer); timer=setTimeout(hide,1200);
    },{passive:true});
    row.addEventListener('touchmove',e=>{
      const t=e.touches&&e.touches[0]; if(!t)return;
      const side=sideFromX(t.clientX); if(!side)return;
      reveal(side); clearTimeout(timer); timer=setTimeout(hide,900);
    },{passive:true});
    return true;
  }
  function bind(){
    let tries=0;
    const timer=setInterval(()=>{if(bindContextNav()||++tries>40)clearInterval(timer)},150);
    setTimeout(bindContextNav,650);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
