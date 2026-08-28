(()=>{
  'use strict';
  const KEY='audify_audius_api_key_v61';
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    try{
      const raw=typeof input==='string'?input:input?.url;
      if(raw&&raw.startsWith('https://api.audius.co/')){
        const k=localStorage.getItem(KEY)||'';
        if(k){const u=new URL(raw);if(!u.searchParams.has('api_key'))u.searchParams.set('api_key',k);input=typeof input==='string'?u.toString():new Request(u.toString(),input)}
      }
    }catch{}
    return nativeFetch(input,init);
  };
  function bind(){
    const b=document.querySelector('#v61SourceBadge');if(!b||b.dataset.authBound==='1')return;
    b.dataset.authBound='1';b.style.cursor='pointer';
    b.title='Toucher pour configurer la source audio de fond Audius';
    b.addEventListener('click',()=>{
      let old='';try{old=localStorage.getItem(KEY)||''}catch{}
      const k=prompt('Clé API Audius gratuite (API Key, jamais le Bearer Token) :',old);
      if(k===null)return;
      const v=String(k).trim();
      if(v){try{localStorage.setItem(KEY,v)}catch{};try{window.AudifyV61?.setAudiusApiKey(v)}catch{};}
      else{try{localStorage.removeItem(KEY)}catch{};try{window.AudifyV61?.clearAudiusApiKey()}catch{};}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  setInterval(bind,600);
})();
