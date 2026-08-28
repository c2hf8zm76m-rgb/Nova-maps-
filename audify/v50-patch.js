(()=>{
  'use strict';
  const HISTORY_KEY='audify_recent_v48';
  let boundRow=null,raf=0;

  const readHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}};
  const currentIndex=(row)=>{
    const cards=Array.from(row?.querySelectorAll('.v48-recent-card')||[]);if(!cards.length)return -1;
    const center=row.scrollLeft+row.clientWidth/2;let best=0,dist=Infinity;
    cards.forEach((c,i)=>{const d=Math.abs((c.offsetLeft+c.offsetWidth/2)-center);if(d<dist){dist=d;best=i}});return best;
  };
  function update(row){
    if(!row||!row.isConnected)return;
    const cards=Array.from(row.querySelectorAll('.v48-recent-card'));const i=currentIndex(row);
    cards.forEach((c,n)=>c.classList.toggle('v50-active',n===i));
    const tools=document.querySelector('#v50CarouselTools');if(!tools)return;
    const count=tools.querySelector('#v50CarouselCount'),prev=tools.querySelector('#v50Prev'),next=tools.querySelector('#v50Next');
    if(count)count.textContent=cards.length?`${i+1} / ${cards.length}`:'0 / 0';
    if(prev)prev.disabled=!cards.length||i<=0;
    if(next)next.disabled=!cards.length||i>=cards.length-1;
  }
  function schedule(row){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>update(row))}
  function go(row,delta){
    const cards=Array.from(row.querySelectorAll('.v48-recent-card'));if(!cards.length)return;
    let i=currentIndex(row);if(i<0)i=0;i=Math.max(0,Math.min(cards.length-1,i+delta));
    const c=cards[i],left=c.offsetLeft-(row.clientWidth-c.offsetWidth)/2;
    row.scrollTo({left:Math.max(0,left),behavior:'smooth'});setTimeout(()=>update(row),320);
  }
  function ensureTools(sec,row){
    const head=sec?.querySelector('.v48-recent-head');if(!head)return;
    let tools=head.querySelector('#v50CarouselTools');
    if(!tools){
      tools=document.createElement('div');tools.id='v50CarouselTools';tools.className='v50-carousel-tools';
      tools.innerHTML='<button id="v50All" class="v50-all-btn" type="button">Tout voir</button><button id="v50Prev" class="v50-carousel-btn" type="button" aria-label="Précédent">‹</button><span id="v50CarouselCount" class="v50-carousel-count">1 / 1</span><button id="v50Next" class="v50-carousel-btn" type="button" aria-label="Suivant">›</button>';
      head.appendChild(tools);
      tools.querySelector('#v50Prev').addEventListener('click',e=>{e.stopPropagation();go(row,-1)});
      tools.querySelector('#v50Next').addEventListener('click',e=>{e.stopPropagation();go(row,1)});
      tools.querySelector('#v50All').addEventListener('click',openSheet);
    }
  }
  function ensureCarousel(){
    const sec=document.querySelector('#v48Recent'),row=sec?.querySelector('.v48-recent-row');if(!sec||!row)return false;
    ensureTools(sec,row);
    if(row!==boundRow){
      boundRow=row;
      row.addEventListener('scroll',()=>schedule(row),{passive:true});
      row.addEventListener('pointerup',()=>setTimeout(()=>update(row),120));
      setTimeout(()=>{
        const cards=Array.from(row.querySelectorAll('.v48-recent-card'));if(cards[0]){cards[0].classList.add('v50-active');row.scrollLeft=0}update(row)
      },60);
    }
    schedule(row);return true;
  }
  function ensureSheet(){
    let sheet=document.querySelector('#v50RecentSheet');if(sheet)return sheet;
    sheet=document.createElement('div');sheet.id='v50RecentSheet';sheet.className='v50-recent-sheet';
    sheet.innerHTML='<div class="v50-sheet-card"><div class="v50-sheet-head"><div><h3>Écoutés récemment</h3><span id="v50SheetCount"></span></div><button class="v50-sheet-close" type="button" aria-label="Fermer">×</button></div><div id="v50SheetGrid" class="v50-sheet-grid"></div></div>';
    sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet()});sheet.querySelector('.v50-sheet-close').addEventListener('click',closeSheet);document.body.appendChild(sheet);return sheet;
  }
  function openSheet(){
    const h=readHistory(),sheet=ensureSheet(),grid=sheet.querySelector('#v50SheetGrid'),count=sheet.querySelector('#v50SheetCount');
    if(count)count.textContent=`${h.length} titre${h.length>1?'s':''}`;
    grid.innerHTML=h.length?h.map((t,i)=>`<button class="v50-sheet-item" type="button" data-v50-index="${i}"><img src="${String(t.thumbnail||'').replace(/"/g,'&quot;')}" alt=""><div><b></b><span></span></div></button>`).join(''):'<div style="color:var(--muted);padding:24px">Aucun historique pour le moment.</div>';
    Array.from(grid.querySelectorAll('.v50-sheet-item')).forEach((b,i)=>{const t=h[i];b.querySelector('b').textContent=t?.title||'Sans titre';b.querySelector('span').textContent=t?.artist||'YouTube';b.addEventListener('click',()=>{try{if(typeof S!=='undefined')S.items=h;if(typeof playTrack==='function')playTrack(t,i);else if(typeof window.playTrack==='function')window.playTrack(t,i)}catch{}closeSheet()})});
    document.body.classList.add('v50-recent-open');sheet.classList.add('show');
  }
  function closeSheet(){document.body.classList.remove('v50-recent-open');document.querySelector('#v50RecentSheet')?.classList.remove('show')}
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v50.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();ensureCarousel();setInterval(ensureCarousel,430);window.addEventListener('resize',()=>boundRow&&schedule(boundRow),{passive:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
