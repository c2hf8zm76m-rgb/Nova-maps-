(()=>{
  'use strict';

  const parse=value=>{
    if(value==null)return null;
    if(typeof value==='object')return value;
    try{return JSON.parse(String(value));}catch{return null;}
  };
  const getState=()=>{try{return typeof S!=='undefined'?S:null;}catch{return null;}};
  const normalize=t=>t&&t.id?{
    id:String(t.id),
    title:String(t.title||'Sans titre'),
    artist:String(t.artist||'YouTube'),
    thumbnail:String(t.thumbnail||'')
  }:null;

  function paintTrack(track,index,items){
    const s=getState();
    const normalizedItems=Array.isArray(items)?items.map(normalize).filter(Boolean):[];
    let current=normalize(track);

    if(s){
      if(normalizedItems.length)s.items=normalizedItems;
      let i=Number(index);
      if(!Number.isInteger(i)||i<0||i>=normalizedItems.length){
        i=current?normalizedItems.findIndex(x=>x.id===current.id):-1;
      }
      if(i>=0&&normalizedItems[i])current=normalizedItems[i];
      if(i>=0)s.i=i;
      if(current)s.current=current;
    }
    if(!current)return false;

    const resultsView=document.getElementById('resultsView');
    const playerView=document.getElementById('playerView');
    if(resultsView)resultsView.hidden=true;
    if(playerView){
      playerView.hidden=false;
      playerView.removeAttribute('hidden');
    }

    const title=document.getElementById('title');
    if(title){
      title.textContent=current.title;
      try{if(typeof applyTitleSize==='function')applyTitleSize(current.title);}catch{}
    }
    const artist=document.getElementById('artist');
    if(artist)artist.textContent=current.artist;

    const safeThumb=current.thumbnail.replace(/["')]/g,'');
    const cover=document.getElementById('cover');
    if(cover)cover.style.backgroundImage=`url("${safeThumb}")`;
    const label=document.getElementById('vlabel');
    if(label)label.style.backgroundImage=`url("${safeThumb}")`;

    try{if(typeof setAmbient==='function')setAmbient(current.thumbnail,current.id||current.title);}catch{}
    try{if(typeof syncLike==='function')syncLike();}catch{}
    try{document.getElementById('video')?.classList.remove('show');}catch{}

    // The native service already started playback. Make the transition to the
    // player immediate; native-android-bridge will reconcile the exact state
    // (playing, duration, position) on its next 200/280 ms tick.
    document.body.classList.add('playing');
    playerView?.classList.add('playing');

    try{
      window.dispatchEvent(new CustomEvent('audify:native-player-opened',{
        detail:{track:current,index:Number(index)||0,items:normalizedItems}
      }));
    }catch{}

    requestAnimationFrame(()=>{
      try{window.scrollTo({top:0,left:0,behavior:'instant'});}catch{try{window.scrollTo(0,0);}catch{}}
    });
    return true;
  }

  window.AudifyAndroidOpenTrack=function(trackPayload,queuePayload){
    const track=parse(trackPayload);
    const queue=parse(queuePayload)||{};
    const items=Array.isArray(queue.items)?queue.items:[];
    const index=Number.isInteger(Number(queue.index))?Number(queue.index):-1;
    return paintTrack(track,index,items)?'ok':'invalid-track';
  };
})();
