(()=>{
  'use strict';

  const STORE_KEY='audify_manual_queue_v67';
  const PENDING_KEY='audify_queue_pending_v56';
  const SESSION_KEY='audify_queue_sequence_v67';
  const ANCHOR_KEY='audify_queue_anchor_v67';
  let touch=null;

  const clean=t=>t&&t.id?{id:String(t.id),title:t.title||'Sans titre',artist:t.artist||'YouTube',thumbnail:t.thumbnail||''}:null;
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const readList=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.id):[]}catch{return []}};
  const writeList=(k,v)=>{try{localStorage.setItem(k,JSON.stringify((v||[]).filter(x=>x&&x.id).slice(0,100)))}catch{}};
  const readObj=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&v.id?v:null}catch{return null}};
  const writeObj=(k,v)=>{try{v?localStorage.setItem(k,JSON.stringify(v)):localStorage.removeItem(k)}catch{}};
  const pending=()=>[...readList(STORE_KEY),...readList(PENDING_KEY)];
  const session=()=>readList(SESSION_KEY);
  const anchor=()=>readObj(ANCHOR_KEY);

  function clearSession(){writeList(SESSION_KEY,[]);writeObj(ANCHOR_KEY,null)}

  function syncSession(){
    const p=pending();
    let seq=session();
    if(p.length){
      if(!seq.length&&!anchor())writeObj(ANCHOR_KEY,clean(current()));
      for(const t of p){const c=clean(t);if(c&&!seq.some(x=>String(x.id)===c.id))seq.push(c)}
      writeList(SESSION_KEY,seq);
      return;
    }
    if(!seq.length)return;
    const id=String(current()?.id||''),a=anchor();
    if(id&&id!==String(a?.id||'')&&!seq.some(x=>String(x.id)===id))clearSession();
  }

  function orderedTracks(){
    const seq=session(),a=anchor();
    if(!seq.length)return [];
    const out=[];
    if(a)out.push(a);
    for(const t of seq)if(!out.some(x=>String(x.id)===String(t.id)))out.push(t);
    return out;
  }

  function applyQueueOrder(){
    const s=state(),cur=current(),order=orderedTracks();
    if(!s||!cur||!order.length)return null;
    const idx=order.findIndex(x=>String(x.id)===String(cur.id));
    if(idx<0)return null;
    const old=Array.isArray(s.items)?s.items.filter(Boolean):[];
    s.items=order.map(t=>{
      const existing=old.find(x=>String(x?.id)===String(t.id));
      return existing||{...t};
    });
    s.i=idx;
    return {order,index:idx};
  }

  function queueNavigate(dir){
    syncSession();
    const info=applyQueueOrder();
    if(!info)return false;
    const nextIndex=dir==='next'?info.index+1:info.index-1;
    if(nextIndex<0||nextIndex>=info.order.length)return false;
    const btn=document.querySelector(dir==='next'?'#next':'#prev');
    if(!btn)return false;
    btn.click();
    return true;
  }

  function isQueueActive(){syncSession();return session().length>0}

  window.addEventListener('audify:queue-added',()=>setTimeout(syncSession,0));

  window.addEventListener('click',e=>{
    const t=e.target;
    if(t.closest('.v56-add-queue,.v57-add-queue')){setTimeout(syncSession,60);return}
    if(t.closest('#v67ManualQueue,#prev,#next'))return;
    if(t.closest('[data-p],[data-play],[data-fav-play],.v48-recent-card,.v50-sheet-item'))clearSession();
  },true);

  window.addEventListener('touchstart',e=>{
    const zone=e.target.closest('#playerView .stage');
    if(!zone||!isQueueActive()){touch=null;return}
    const p=e.touches?.[0];touch=p?{x:p.clientX,y:p.clientY}:null;
  },{capture:true,passive:true});

  window.addEventListener('touchend',e=>{
    if(!touch)return;
    const p=e.changedTouches?.[0],start=touch;touch=null;
    if(!p)return;
    const dx=p.clientX-start.x,dy=p.clientY-start.y;
    if(Math.abs(dx)<=48||Math.abs(dx)<=Math.abs(dy)*1.25)return;
    const dir=dx>0?'next':'prev';
    if(queueNavigate(dir)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  },{capture:true,passive:false});

  setInterval(syncSession,300);
  window.AudifyQueueSwipeOrderV67={
    sequence:session,
    anchor,
    position:()=>{const seq=session(),id=String(current()?.id||'');const i=seq.findIndex(x=>String(x.id)===id);return i>=0?{index:i+1,total:seq.length}:null},
    next:()=>queueNavigate('next'),
    prev:()=>queueNavigate('prev'),
    clear:clearSession
  };
})();