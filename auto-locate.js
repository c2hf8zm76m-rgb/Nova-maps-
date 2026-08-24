(()=>{
  'use strict';
  let done=false;
  function autoLocate(){
    if(done) return;
    const button=document.getElementById('loc');
    if(!button){ setTimeout(autoLocate,120); return; }
    done=true;
    setTimeout(()=>button.click(),180);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',autoLocate,{once:true});
  else autoLocate();
})();
