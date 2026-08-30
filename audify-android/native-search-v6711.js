(()=>{
  'use strict';

  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  window.AudifyNativeSearch = async function(rawQuery){
    const query=String(rawQuery||'').trim();
    if(!query)return 'empty';

    const results=document.getElementById('results');
    const resultsView=document.getElementById('resultsView');
    const playerView=document.getElementById('playerView');
    if(!results)return 'missing-results';

    if(resultsView)resultsView.hidden=false;
    if(playerView)playerView.hidden=true;
    results.className='empty';
    results.textContent='Recherche…';

    try{
      if(typeof directId==='function'){
        const id=directId(query);
        if(id){
          if(typeof renderResults!=='function')throw new Error('Moteur de résultats indisponible');
          renderResults([{
            id,
            title:'Vidéo YouTube',
            artist:'YouTube',
            thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`
          }]);
          return 'ok-direct';
        }
      }

      if(typeof KEY==='undefined'||!KEY)throw new Error('Clé YouTube indisponible');
      const u=new URL('https://www.googleapis.com/youtube/v3/search');
      const params={
        part:'snippet',
        type:'video',
        videoEmbeddable:'true',
        maxResults:'20',
        q:query,
        key:KEY
      };
      for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);

      const response=await fetch(u.toString(),{headers:{accept:'application/json'}});
      const data=await response.json();
      if(!response.ok)throw new Error((data&&data.error&&data.error.message)||`YouTube API HTTP ${response.status}`);

      const items=(data.items||[]).map(x=>({
        id:x&&x.id&&x.id.videoId,
        title:(x&&x.snippet&&x.snippet.title)||'Sans titre',
        artist:(x&&x.snippet&&x.snippet.channelTitle)||'YouTube',
        thumbnail:(x&&x.snippet&&x.snippet.thumbnails&&((x.snippet.thumbnails.high&&x.snippet.thumbnails.high.url)||(x.snippet.thumbnails.medium&&x.snippet.thumbnails.medium.url)||(x.snippet.thumbnails.default&&x.snippet.thumbnails.default.url)))||''
      })).filter(x=>x.id);

      if(typeof renderResults!=='function')throw new Error('Moteur de résultats indisponible');
      renderResults(items);
      return `ok:${items.length}`;
    }catch(error){
      results.className='empty';
      const message=error&&error.message?error.message:String(error);
      results.innerHTML='<b>Erreur de recherche YouTube</b><br><br>'+escapeHtml(message);
      return 'error:'+message;
    }
  };

  let searchBusy=false;
  async function pullNativeSearch(){
    try{
      if(searchBusy)return;
      const bridge=window.AudifyNative;
      if(!bridge||typeof bridge.takeNativeSearchQuery!=='function')return;
      const query=String(bridge.takeNativeSearchQuery()||'').trim();
      if(!query)return;
      searchBusy=true;
      await window.AudifyNativeSearch(query);
    }catch(error){
      const results=document.getElementById('results');
      if(results){
        results.className='empty';
        results.innerHTML='<b>Erreur pont recherche</b><br><br>'+escapeHtml(error&&error.message?error.message:String(error));
      }
    }finally{
      searchBusy=false;
    }
  }

  // Le WebView vient lui-même lire la requête native. Aucun Java -> JS n'est nécessaire.
  setInterval(pullNativeSearch,120);
  setTimeout(pullNativeSearch,250);
})();
