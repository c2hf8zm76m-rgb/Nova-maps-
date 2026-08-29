(()=>{
  'use strict';

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const protectedNode=el=>!el||el===document.body||el===document.documentElement||el.id==='resultsView'||el.id==='playerView'||el.tagName==='MAIN';

  function isBrowserInstallText(text){
    const t=norm(text);
    if(!t)return false;
    return t.includes('telecharger audify') ||
      (t.includes('audify') && t.includes("ecran d'accueil") && (t.includes('ajouter')||t.includes('navigateur')||t.includes('installer'))) ||
      (t.includes('audify') && t.includes('add to home screen'));
  }

  function chooseContainer(seed){
    let best=seed;
    for(let el=seed;el&&el.parentElement&&!protectedNode(el);el=el.parentElement){
      const key=norm((el.id||'')+' '+(el.className||''));
      const txt=norm(el.textContent||'');
      if(/install|pwa|download|homescreen|home-screen|add-home/.test(key) && txt.length<2200) return el;
      if(['SECTION','ARTICLE','ASIDE'].includes(el.tagName) && txt.length<1600) best=el;
      else if(el.tagName==='DIV' && txt.length<1000) best=el;
      if(el.parentElement && protectedNode(el.parentElement)) break;
    }
    return protectedNode(best)?seed:best;
  }

  function purge(){
    const all=[...document.querySelectorAll('body *')];
    for(const el of all){
      if(!el.isConnected)continue;
      const own=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ');
      const text=own || (el.children.length<=3 ? el.textContent : '');
      if(!isBrowserInstallText(text))continue;
      const box=chooseContainer(el);
      if(box&&box.isConnected&&!protectedNode(box)) box.remove();
    }

    // Filet de sécurité pour les composants PWA explicitement nommés.
    document.querySelectorAll('[id*="install" i],[class*="install" i],[id*="pwa" i],[class*="pwa" i],[id*="homescreen" i],[class*="homescreen" i]').forEach(el=>{
      if(isBrowserInstallText(el.textContent) && !protectedNode(el)) el.remove();
    });
  }

  function boot(){
    purge();
    const mo=new MutationObserver(purge);
    mo.observe(document.body,{subtree:true,childList:true});
    setTimeout(purge,100);
    setTimeout(purge,500);
    setTimeout(purge,1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
