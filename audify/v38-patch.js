(function(){
  'use strict';
  var CACHE='audify_lyrics_cache_v38';
  var TIMEOUT=4400;
  var state={id:'',track:null,data:null,promise:null,open:false,button:null,panel:null,scroll:null,meta:null,lines:[],active:-2,raf:0};

  function track(){try{return (typeof S!=='undefined'&&S)?S.current:null}catch(e){return null}}
  function ptime(){try{return (typeof S!=='undefined'&&S.ready&&S.p)?(S.p.getCurrentTime()||0):0}catch(e){return 0}}
  function pdur(){try{return (typeof S!=='undefined'&&S.ready&&S.p)?(S.p.getDuration()||0):0}catch(e){return 0}}
  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function cleanArtist(v){return text(v).replace(/\s*-\s*Topic$/i,'').replace(/\s*VEVO$/i,'').replace(/\s+Officiel$/i,'').replace(/\s+Official$/i,'').trim()}
  function cleanTitle(v){return text(v).replace(/\s*[\[(](?:clip\s*)?(?:officiel|official|visualizer|lyrics?|paroles|audio|video)[^\])]*[\])]/ig,'').replace(/\s*[|•]\s*(?:official|officiel|visualizer|lyrics?|audio|video).*$/ig,'').trim()}
  function meta(t){
    var ti=cleanTitle(t&&t.title||''), ar=cleanArtist(t&&t.artist||'');
    var parts=ti.split(/\s+[-–—]\s+/);
    if(parts.length>1 && parts[0].length<50){var guess=parts.shift();ti=cleanTitle(parts.join(' - '));if(guess)ar=cleanArtist(guess)}
    return {title:ti,artist:ar};
  }
  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')||{}}catch(e){return {}}}
  function getCache(id){var c=readCache(),x=c[id];if(!x)return null;if(Date.now()-(x.at||0)>1000*60*60*24*30)return null;return x}
  function putCache(id,x){try{var c=readCache();c[id]=Object.assign({},x,{at:Date.now()});localStorage.setItem(CACHE,JSON.stringify(c))}catch(e){}}

  function ensure(){
    var player=document.querySelector('.player');
    var actions=player&&player.querySelector('.actions');
    var video=document.getElementById('videoBtn');
    var view=document.getElementById('playerView');
    if(!player||!actions||!view)return false;

    var btn=document.getElementById('v38LyricsBtn');
    if(!btn){
      btn=document.createElement('button');btn.id='v38LyricsBtn';btn.className='v38-lyrics-btn';btn.type='button';btn.setAttribute('aria-label','Afficher les paroles');
      var mic=document.createElement('span');mic.className='v38-mic';mic.textContent='🎤';
      var lab=document.createElement('span');lab.textContent='Paroles';btn.appendChild(mic);btn.appendChild(lab);
      btn.addEventListener('click',toggle);
    }
    if(btn.parentNode!==actions)actions.insertBefore(btn,video&&video.parentNode===actions?video:actions.firstChild);
    state.button=btn;

    var panel=document.getElementById('v38Karaoke');
    if(!panel){
      panel=document.createElement('section');panel.id='v38Karaoke';panel.className='v38-karaoke';
      var head=document.createElement('div');head.className='v38-head';
      var left=document.createElement('div');var b=document.createElement('b');b.textContent='Paroles';var m=document.createElement('span');m.id='v38Meta';m.textContent='Audify Karaoke';left.appendChild(b);left.appendChild(m);
      var close=document.createElement('button');close.className='v38-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Fermer');close.addEventListener('click',closePanel);
      head.appendChild(left);head.appendChild(close);
      var scroll=document.createElement('div');scroll.id='v38Scroll';scroll.className='v38-scroll';
      panel.appendChild(head);panel.appendChild(scroll);view.appendChild(panel);
    }
    state.panel=panel;state.scroll=document.getElementById('v38Scroll');state.meta=document.getElementById('v38Meta');
    return true;
  }

  function setButton(mode){if(!state.button)return;state.button.classList.toggle('loading',mode==='loading');state.button.classList.toggle('ready',mode==='ready');state.button.classList.toggle('open',state.open)}
  function status(title,msg){if(!state.scroll)return;state.scroll.innerHTML='';var wrap=document.createElement('div');wrap.className='v38-state';var inr=document.createElement('div');var b=document.createElement('b');b.textContent=title;var p=document.createElement('p');p.textContent=msg;inr.appendChild(b);inr.appendChild(p);wrap.appendChild(inr);state.scroll.appendChild(wrap);state.lines=[];state.active=-2}

  function parseLrc(src,duration){
    var out=[], rows=String(src||'').split(/\r?\n/);
    for(var r=0;r<rows.length;r++){
      var raw=rows[r], re=/\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g, times=[], mm;
      while((mm=re.exec(raw)))times.push(Number(mm[1])*60+Number(mm[2]));
      if(!times.length)continue;var tx=text(raw.replace(re,''));if(!tx)continue;
      for(var j=0;j<times.length;j++)out.push({start:times[j],text:tx});
    }
    out.sort(function(a,b){return a.start-b.start});
    for(var i=0;i<out.length;i++){
      var line=out[i], next=out[i+1];line.end=next?next.start:(duration||line.start+5);if(line.end<=line.start)line.end=line.start+2.5;
      var words=line.text.split(/\s+/), weights=[], total=0;
      for(var k=0;k<words.length;k++){var n=Math.max(1,words[k].replace(/[^A-Za-zÀ-ÿ0-9]/g,'').length);var w=Math.max(.8,Math.sqrt(n));weights.push(w);total+=w}
      var active=Math.min(Math.max(1.2,line.end-line.start),Math.max(1.8,words.length*.48)),cur=line.start;line.words=[];
      for(var z=0;z<words.length;z++){var d=active*(weights[z]/(total||1));line.words.push({text:words[z],start:cur,end:cur+d});cur+=d}
    }
    return out;
  }

  function render(data){
    if(!ensure())return;state.scroll.innerHTML='';state.lines=[];state.active=-2;
    state.meta.textContent=text((data.trackName||state.track.title||'')+' • '+(data.artistName||state.track.artist||''));
    if(data.syncedLyrics){
      var lines=parseLrc(data.syncedLyrics,data.duration||pdur());if(!lines.length){status('Synchronisation indisponible','Les paroles ont été trouvées mais sans repères temporels utilisables.');return}
      var frag=document.createDocumentFragment();
      for(var i=0;i<lines.length;i++)(function(line){
        var el=document.createElement('div');el.className='v38-line';var wordEls=[];
        for(var j=0;j<line.words.length;j++){var sp=document.createElement('span');sp.className='v38-word';sp.textContent=line.words[j].text;el.appendChild(sp);wordEls.push(sp)}
        el.addEventListener('click',function(){try{if(typeof S!=='undefined'&&S.ready&&S.p)S.p.seekTo(line.start,true)}catch(e){}});
        frag.appendChild(el);state.lines.push({el:el,line:line,words:wordEls});
      })(lines[i]);
      state.scroll.appendChild(frag);startTicker();
    }else if(data.plainLyrics){
      var rows=String(data.plainLyrics).split(/\r?\n/);for(var x=0;x<rows.length;x++){var t=text(rows[x]);if(!t)continue;var el=document.createElement('div');el.className='v38-plain';el.textContent=t;state.scroll.appendChild(el)}
      stopTicker();
    }else status('Paroles indisponibles','Aucune parole n’a été trouvée pour ce titre.');
  }

  function request(t){
    var cached=getCache(t.id);if(cached)return Promise.resolve(cached.notFound?null:cached);
    var md=meta(t);if(!md.title)return Promise.resolve(null);
    var controller=new AbortController(), timer=setTimeout(function(){controller.abort()},TIMEOUT), started=Date.now();
    function call(params){var u=new URL('https://lrclib.net/api/search');for(var k in params)if(params[k])u.searchParams.set(k,params[k]);return fetch(u.toString(),{signal:controller.signal,mode:'cors',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
    return call({track_name:md.title,artist_name:md.artist}).then(function(list){if((!list||!list.length)&&Date.now()-started<3000)return call({q:text(md.title+' '+md.artist)});return list||[]}).then(function(list){
      var best=null,bestScore=-999,dur=pdur();
      for(var i=0;i<list.length;i++){var r=list[i];if(!r||r.instrumental||(!r.syncedLyrics&&!r.plainLyrics))continue;var sc=(r.syncedLyrics?20:4);if(dur&&r.duration){var diff=Math.abs(Number(r.duration)-dur);if(diff<3)sc+=8;else if(diff<8)sc+=4;else if(diff>25)sc-=5}if(sc>bestScore){bestScore=sc;best=r}}
      if(!best){putCache(t.id,{notFound:true});return null}
      var out={trackName:best.trackName||best.name||md.title,artistName:best.artistName||md.artist,duration:Number(best.duration)||0,syncedLyrics:best.syncedLyrics||null,plainLyrics:best.plainLyrics||null};putCache(t.id,out);return out;
    }).catch(function(){return null}).finally(function(){clearTimeout(timer)})
  }

  function prepare(t){
    if(!t||!t.id)return Promise.resolve(null);if(state.id===t.id&&state.promise)return state.promise;
    state.id=t.id;state.track=t;state.data=null;setButton('loading');
    state.promise=request(t).then(function(data){if(state.id!==t.id)return data;state.data=data;setButton(data?'ready':'none');if(state.open){if(data)render(data);else status('Paroles indisponibles','Aucune parole n’a été trouvée en moins de 5 secondes.')}return data});return state.promise;
  }

  function openPanel(){if(!ensure())return;var t=track();if(!t)return;state.open=true;state.panel.classList.add('show');document.body.classList.add('v38-open');setButton(state.data?'ready':'loading');var video=document.getElementById('video');if(video)video.classList.remove('show');if(state.data)render(state.data);else{status('Recherche des paroles…','Audify cherche une version synchronisée.');prepare(t)}}
  function closePanel(){state.open=false;if(state.panel)state.panel.classList.remove('show');document.body.classList.remove('v38-open');setButton(state.data?'ready':'none');stopTicker()}
  function toggle(){if(state.open)closePanel();else openPanel()}
  function stopTicker(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0}
  function startTicker(){stopTicker();function tick(){if(!state.open||!state.lines.length){state.raf=0;return}update(ptime());state.raf=requestAnimationFrame(tick)}state.raf=requestAnimationFrame(tick)}
  function update(t){
    var idx=-1;for(var i=0;i<state.lines.length;i++){if(t>=state.lines[i].line.start)idx=i;else break}
    if(idx!==state.active){state.active=idx;for(var j=0;j<state.lines.length;j++){state.lines[j].el.classList.toggle('active',j===idx);state.lines[j].el.classList.toggle('past',j<idx)}if(idx>=0)try{state.lines[idx].el.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}}
    if(idx<0)return;var x=state.lines[idx];for(var k=0;k<x.line.words.length;k++){var w=x.line.words[k],p=Math.max(0,Math.min(1,(t-w.start)/Math.max(.06,w.end-w.start)));x.words[k].style.setProperty('--fill',(p*100).toFixed(1)+'%')}
  }

  function boot(){
    ensure();var last='';setInterval(function(){ensure();var t=track();if(t&&t.id&&t.id!==last){last=t.id;prepare(t)}if(document.getElementById('playerView')&&document.getElementById('playerView').hidden&&state.open)closePanel()},400);
    if(window.MutationObserver){var mo=new MutationObserver(function(){ensure()});mo.observe(document.body,{childList:true,subtree:true})}
    setTimeout(ensure,100);setTimeout(ensure,700);setTimeout(ensure,1600);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
