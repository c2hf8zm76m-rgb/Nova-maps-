(()=>{
  function bindConfirmedSwipe(){
    const row=document.querySelector('.v27-stage-row');
    const stage=row?.querySelector('.stage');
    const prev=document.querySelector('#prev');
    const next=document.querySelector('#next');
    if(!row||!stage||!prev||!next||row.dataset.v30Bound==='1')return false;
    row.dataset.v30Bound='1';

    let startX=0,startY=0,lastX=0,pointerId=null,dragging=false,horizontal=false,busy=false,armed=false;
    let threshold=76,maxDrag=120;

    const clearHints=()=>row.classList.remove('v30-armed-left','v30-armed-right','v29-hint-left','v29-hint-right');
    const center=()=>{
      clearHints();
      stage.classList.remove('v30-dragging','v30-commit-left','v30-commit-right','v30-enter-left','v30-enter-right');
      stage.classList.add('v30-return');
      stage.style.setProperty('--v30-x','0px');
      stage.style.opacity='1';
      setTimeout(()=>stage.classList.remove('v30-return'),280);
      dragging=false;horizontal=false;armed=false;pointerId=null;
    };

    const armFor=dx=>{
      const nextArmed=Math.abs(dx)>=threshold;
      if(nextArmed&&!armed){
        armed=true;
        if(navigator.vibrate)try{navigator.vibrate(12)}catch{}
      }else if(!nextArmed){armed=false;}
      row.classList.toggle('v30-armed-left',armed&&dx<0);
      row.classList.toggle('v30-armed-right',armed&&dx>0);
    };

    const commit=dx=>{
      if(busy)return;
      busy=true;
      dragging=false;
      clearHints();
      const left=dx<0;
      stage.classList.remove('v30-dragging','v30-return');
      stage.style.removeProperty('--v30-x');
      stage.style.opacity='';
      stage.classList.add(left?'v30-commit-left':'v30-commit-right');
      if(navigator.vibrate)try{navigator.vibrate(20)}catch{}

      setTimeout(()=>{
        // Signature Audify conservée : swipe gauche = précédent, swipe droite = suivant.
        (left?prev:next).click();

        // La nouvelle pochette revient proprement au centre après le changement réel de titre.
        setTimeout(()=>{
          stage.classList.remove('v30-commit-left','v30-commit-right');
          stage.classList.add(left?'v30-enter-left':'v30-enter-right');
          stage.style.transform='';
          stage.style.opacity='';
          setTimeout(()=>{
            stage.classList.remove('v30-enter-left','v30-enter-right');
            busy=false;horizontal=false;armed=false;pointerId=null;
          },360);
        },45);
      },175);
    };

    const finish=dx=>{
      if(busy)return;
      if(armed&&Math.abs(dx)>=threshold)commit(dx);else center();
    };

    row.addEventListener('pointerdown',e=>{
      if(!stage.contains(e.target)||busy)return;
      if(e.pointerType==='mouse'&&e.button!==0)return;
      // Intercepte l'ancien swipe V29 pour que V30 soit l'unique comportement.
      e.stopPropagation();
      startX=lastX=e.clientX;startY=e.clientY;pointerId=e.pointerId;dragging=true;horizontal=false;armed=false;
      const w=Math.max(1,stage.getBoundingClientRect().width);
      threshold=Math.max(68,Math.min(112,w*.24));
      maxDrag=Math.max(threshold+18,Math.min(150,w*.34));
      stage.classList.add('v30-dragging');
      stage.classList.remove('v30-return','v30-enter-left','v30-enter-right');
      try{row.setPointerCapture(pointerId)}catch{}
    },true);

    row.addEventListener('pointermove',e=>{
      if(!dragging||e.pointerId!==pointerId||busy)return;
      e.stopPropagation();
      const dx=e.clientX-startX,dy=e.clientY-startY;lastX=e.clientX;
      if(!horizontal){
        if(Math.abs(dy)>Math.abs(dx)+10){center();return;}
        if(Math.abs(dx)>9)horizontal=true;
      }
      if(!horizontal)return;
      e.preventDefault();
      const resistance=Math.abs(dx)>maxDrag ? maxDrag+(Math.abs(dx)-maxDrag)*.12 : Math.abs(dx);
      const clamped=Math.sign(dx)*Math.min(maxDrag+20,resistance);
      stage.style.setProperty('--v30-x',clamped+'px');
      stage.style.opacity=String(1-Math.min(.14,Math.abs(clamped)/(maxDrag*7)));
      armFor(dx);
    },{capture:true,passive:false});

    row.addEventListener('pointerup',e=>{
      if(!dragging||e.pointerId!==pointerId||busy)return;
      e.stopPropagation();
      finish(e.clientX-startX);
      try{row.releasePointerCapture(pointerId)}catch{}
    },true);

    row.addEventListener('pointercancel',e=>{
      if(dragging&&!busy){e.stopPropagation();center();}
    },true);

    row.addEventListener('lostpointercapture',()=>{
      if(dragging&&!busy)finish(lastX-startX);
    },true);
    return true;
  }

  function bind(){
    let tries=0;
    const timer=setInterval(()=>{if(bindConfirmedSwipe()||++tries>50)clearInterval(timer)},150);
    setTimeout(bindConfirmedSwipe,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
