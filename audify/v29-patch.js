(()=>{
  function bindSwipe(){
    const row=document.querySelector('.v27-stage-row');
    const stage=row?.querySelector('.stage');
    const prev=document.querySelector('#prev');
    const next=document.querySelector('#next');
    if(!row||!stage||!prev||!next||stage.dataset.v29Bound==='1')return false;
    stage.dataset.v29Bound='1';

    let startX=0,startY=0,lastX=0,dragging=false,pointerId=null,locked=false;
    const threshold=58;
    const maxDrag=92;

    const reset=()=>{
      dragging=false;locked=false;pointerId=null;
      stage.classList.remove('v29-dragging','v29-swipe-left','v29-swipe-right');
      row.classList.remove('v29-hint-left','v29-hint-right');
      stage.style.transform='';stage.style.opacity='';
    };

    const finish=dx=>{
      if(Math.abs(dx)<threshold){reset();return;}
      const left=dx<0;
      stage.classList.remove('v29-dragging');
      row.classList.remove('v29-hint-left','v29-hint-right');
      stage.style.transform='';
      stage.classList.add(left?'v29-swipe-left':'v29-swipe-right');
      if(navigator.vibrate)try{navigator.vibrate(18)}catch{}
      setTimeout(()=>{
        // Identité Audify demandée : gauche = précédent, droite = suivant.
        (left?prev:next).click();
        setTimeout(reset,110);
      },150);
    };

    stage.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      startX=lastX=e.clientX;startY=e.clientY;dragging=true;locked=false;pointerId=e.pointerId;
      stage.classList.add('v29-dragging');
      try{stage.setPointerCapture(pointerId)}catch{}
    });

    stage.addEventListener('pointermove',e=>{
      if(!dragging||e.pointerId!==pointerId)return;
      const dx=e.clientX-startX,dy=e.clientY-startY;lastX=e.clientX;
      if(!locked){
        if(Math.abs(dy)>Math.abs(dx)+8){reset();return;}
        if(Math.abs(dx)>8)locked=true;
      }
      if(!locked)return;
      e.preventDefault();
      const clamped=Math.max(-maxDrag,Math.min(maxDrag,dx));
      const rot=clamped/maxDrag*2.2;
      stage.style.transform=`translate3d(${clamped}px,0,0) rotate(${rot}deg)`;
      stage.style.opacity=String(1-Math.min(.18,Math.abs(clamped)/500));
      row.classList.toggle('v29-hint-left',clamped<-28);
      row.classList.toggle('v29-hint-right',clamped>28);
    });

    stage.addEventListener('pointerup',e=>{
      if(!dragging||e.pointerId!==pointerId)return;
      finish(e.clientX-startX);
    });
    stage.addEventListener('pointercancel',reset);
    stage.addEventListener('lostpointercapture',()=>{if(dragging)finish(lastX-startX)});
    return true;
  }

  function bind(){
    let tries=0;
    const timer=setInterval(()=>{if(bindSwipe()||++tries>50)clearInterval(timer)},150);
    setTimeout(bindSwipe,700);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
