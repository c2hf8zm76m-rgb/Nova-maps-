(()=>{
  'use strict';
  function clean(){
    document.querySelector('#v50Prev')?.remove();
    document.querySelector('#v50Next')?.remove();
    document.querySelector('#v50CarouselCount')?.remove();
  }
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v51.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();clean();setInterval(clean,700)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
