(()=>{
  if(window.__audifyV35NoZoom)return;
  window.__audifyV35NoZoom=true;

  const prevent=e=>{try{e.preventDefault()}catch{}};

  // Safari iOS specific pinch gesture events.
  ['gesturestart','gesturechange','gestureend'].forEach(type=>{
    document.addEventListener(type,prevent,{passive:false,capture:true});
  });

  // Fallback for browsers that expose pinch as multi-touch.
  const blockMultiTouch=e=>{
    if(e.touches&&e.touches.length>1)prevent(e);
  };
  document.addEventListener('touchstart',blockMultiTouch,{passive:false,capture:true});
  document.addEventListener('touchmove',blockMultiTouch,{passive:false,capture:true});

  // Reinforce the viewport lock if another layer rewrites the meta tag.
  const viewport=document.querySelector('meta[name="viewport"]');
  if(viewport){
    viewport.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
  }
})();
