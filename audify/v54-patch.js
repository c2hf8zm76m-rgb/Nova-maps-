(()=>{
  'use strict';
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v54.js',{scope:'./'}).catch(()=>{})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',registerSW,{once:true});else registerSW();
})();
