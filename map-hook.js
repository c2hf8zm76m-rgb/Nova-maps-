(()=>{
  'use strict';
  if(!window.L || typeof L.map!=='function') return;
  const originalMap=L.map;
  function wrappedMap(...args){
    const map=originalMap.apply(this,args);
    window.NOVA_MAP=map;
    return map;
  }
  Object.assign(wrappedMap,originalMap);
  L.map=wrappedMap;
})();
