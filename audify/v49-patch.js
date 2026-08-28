(()=>{
  'use strict';
  let expanded=false,query='',boundPanel=null;

  function favPanel(){return document.querySelector('.favorites-panel')}
  function resultsVisible(){const rv=document.querySelector('#resultsView'),pv=document.querySelector('#playerView');return !!(rv&&!rv.hidden&&pv&&pv.hidden)}
  function cards(panel){return Array.from(panel?.querySelectorAll('.favorite-grid .fav-card')||[])}
  function textOf(card){const b=card.querySelector('.fav-meta b')?.textContent||'',s=card.querySelector('.fav-meta span')?.textContent||'';return (b+' '+s).toLowerCase()}

  function closeLibrary(){expanded=false;query='';document.body.classList.remove('v49-library-open');const p=favPanel();if(p){p.classList.remove('v49-expanded');const input=p.querySelector('#v49FavSearch');if(input)input.value=''}apply(p)}

  function toggleLibrary(){expanded=!expanded;document.body.classList.toggle('v49-library-open',expanded);const p=favPanel();if(!p)return;p.classList.toggle('v49-expanded',expanded);if(expanded)setTimeout(()=>p.querySelector('#v49FavSearch')?.focus(),80);else query='';apply(p)}

  function ensure(panel){
    if(!panel)return false;
    if(panel===boundPanel&&panel.dataset.v49Bound==='1')return true;
    boundPanel=panel;panel.dataset.v49Bound='1';panel.classList.add('v49-ready');
    const head=panel.querySelector('.favorites-head');
    if(head&&!panel.querySelector('#v49MoreBtn')){
      const tools=document.createElement('div');tools.className='v49-fav-tools';
      const more=document.createElement('button');more.id='v49MoreBtn';more.className='v49-more-btn';more.type='button';more.addEventListener('click',toggleLibrary);tools.appendChild(more);head.appendChild(tools);
    }
    if(!panel.querySelector('#v49SearchWrap')){
      const wrap=document.createElement('div');wrap.id='v49SearchWrap';wrap.className='v49-search-wrap';
      wrap.innerHTML='<label class="v49-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="v49FavSearch" type="search" autocomplete="off" placeholder="Rechercher un titre ou un artiste…"></label><span id="v49ResultCount" class="v49-result-count"></span>';
      const grid=panel.querySelector('.favorite-grid');panel.insertBefore(wrap,grid||null);
      wrap.querySelector('#v49FavSearch').addEventListener('input',e=>{query=String(e.target.value||'').trim().toLowerCase();apply(panel)});
    }
    if(!panel.querySelector('#v49NoResult')){
      const empty=document.createElement('div');empty.id='v49NoResult';empty.className='v49-no-result';empty.textContent='Aucun favori ne correspond à cette recherche.';panel.appendChild(empty);
    }
    cards(panel).forEach(card=>{
      if(card.dataset.v49Card==='1')return;card.dataset.v49Card='1';
      card.addEventListener('click',e=>{if(e.target.closest('button,input'))return;const play=card.querySelector('[data-fav-play]');if(play)play.click()});
    });
    if(expanded)panel.classList.add('v49-expanded');
    return true;
  }

  function apply(panel){
    if(!panel||!panel.isConnected)return;
    const all=cards(panel),more=panel.querySelector('#v49MoreBtn'),count=panel.querySelector('#v49ResultCount'),empty=panel.querySelector('#v49NoResult');
    panel.classList.toggle('v49-expanded',expanded);
    document.body.classList.toggle('v49-library-open',expanded);
    let shown=0;
    all.forEach((card,i)=>{
      const match=!query||textOf(card).includes(query);
      const visible=expanded?match:i<6;
      card.hidden=!visible;if(visible)shown++;
    });
    if(more){
      more.hidden=all.length<=6&&!expanded;
      more.textContent=expanded?'Fermer':'Voir tous les favoris';
      more.setAttribute('aria-expanded',expanded?'true':'false');
    }
    if(count)count.textContent=expanded?(query?shown+' résultat'+(shown>1?'s':''):all.length+' favori'+(all.length>1?'s':'')):'';
    if(empty)empty.style.display=expanded&&query&&shown===0?'block':'none';
  }

  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v49.js',{scope:'./'}).catch(()=>{})}

  function sync(){
    if(!resultsVisible()&&expanded){closeLibrary();return}
    const p=favPanel();if(!p)return;
    ensure(p);apply(p);
  }

  function boot(){registerSW();sync();setInterval(sync,420)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();