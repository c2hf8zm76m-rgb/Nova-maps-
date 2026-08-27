(function(){
  'use strict';
  var CACHE='audify_lyrics_cache_v38', SYNC_KEY='audify_lyrics_sync_v40', TIMEOUT=4400;
  var st={id:'',track:null,data:null,promise:null,open:false,button:null,panel:null,scroll:null,meta:null,lines:[],active:-2,timer:0,autoOffset:0,manualOffset:0,syncValue:null};
  function cur(){try{return (typeof S!=='undefined'&&S)?S.current:null}catch(e){return null}}
  function ptime(){try{return (typeof S!=='undefined'&&S.ready&&S.p)?(S.p.getCurrentTime()||0):0}catch(e){return 0}}
  function pdur(){try{return (typeof S!=='undefined'&&S.ready&&S.p)?(S.p.getDuration()||0):0}catch(e){return 0}}
  function txt(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function cleanArtist(v){return txt(v).replace(/\s*-\s*Topic$/i,'').replace(/\s*VEVO$/i,'').replace(/\s+Officiel$/i,'').replace(/\s+Official$/i,'').trim()}
  function cleanTitle(v){return txt(v).replace(/\s*[\[(](?:clip\s*)?(?:officiel|official|visualizer|lyrics?|paroles|audio|video)[^\])]*[\])]/ig,'').replace(/\s*[|•]\s*(?:official|officiel|visualizer|lyrics?|audio|video).*$/ig,'').trim()}
  function metadata(t){var ti=cleanTitle(t&&t.title||''), ar=cleanArtist(t&&t.artist||''), p=ti.split(/\s+[-–—]\s+/);if(p.length>1&&p[0].length<50){var g=p.shift();ti=cleanTitle(p.join(' - '));if(g)ar=cleanArtist(g)}return {title:ti,artist:ar}}
  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')||{}}catch(e){return {}}}
  function getCache(id){var c=readCache(),x=c[id];if(!x)return null;if(Date.now()-(x.at||0)>1000*60*60*24*30)return null;return x}
  function putCache(id,x){try{var c=readCache();c[id]=Object.assign({},x,{at:Date.now()});localStorage.setItem(CACHE,JSON.stringify(c))}catch(e){}}
  function readSync(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'{}')||{}}catch(e){return {}}}
  function savedManual(id){var c=readSync();return Number(c[id])||0}
  function saveManual(id,v){try{var c=readSync();if(Math.abs(v)<.05)delete c[id];else c[id]=Math.round(v*10)/10;localStorage.setItem(SYNC_KEY,JSON.stringify(c))}catch(e){}}
  function totalOffset(){return st.autoOffset+st.manualOffset}
  function updateSyncLabel(){if(!st.syncValue)return;var v=totalOffset(),s=(v>0?'+':'')+v.toFixed(1)+' s';st.syncValue.textContent=s;st.syncValue.classList.toggle('auto',Math.abs(st.manualOffset)<.05)}
  function calcAutoOffset(data){var vd=pdur(),ld=Number(data&&data.duration)||0;if(!vd||!ld)return 0;var delta=vd-ld;if(Math.abs(delta)<1.2||Math.abs(delta)>22)return 0;var v=delta*.65;if(v>12)v=12;if(v<-12)v=-12;return Math.round(v*10)/10}
  function adjustManual(d){if(!st.id)return;st.manualOffset=Math.max(-15,Math.min(15,Math.round((st.manualOffset+d)*10)/10));saveManual(st.id,st.manualOffset);updateSyncLabel();update(ptime(),true)}
  function resetManual(){if(!st.id)return;st.manualOffset=0;saveManual(st.id,0);updateSyncLabel();update(ptime(),true)}
  function ensure(){
    var player=document.querySelector('.player'), actions=player&&player.querySelector('.actions'), video=document.getElementById('videoBtn'), view=document.getElementById('playerView');
    if(!player||!actions||!view)return false;
    var btn=document.getElementById('v38LyricsBtn');
    if(!btn){btn=document.createElement('button');btn.id='v38LyricsBtn';btn.className='v38-lyrics-btn';btn.type='button';btn.innerHTML='<span class="v38-mic">🎤</span><span>Paroles</span>';btn.addEventListener('click',toggle)}
    if(btn.parentNode!==actions)actions.insertBefore(btn,video&&video.parentNode===actions?video:actions.firstChild);st.button=btn;
    var panel=document.getElementById('v38Karaoke');
    if(!panel){panel=document.createElement('section');panel.id='v38Karaoke';panel.className='v38-karaoke';panel.innerHTML='<div class="v38-head"><div><b>Paroles</b><span id="v38Meta">Audify Karaoke</span></div><div class="v40-sync"><button type="button" id="v40Earlier" aria-label="Paroles plus tôt">−</button><span id="v40SyncValue" class="v40-sync-value auto">0.0 s</span><button type="button" id="v40Later" aria-label="Paroles plus tard">+</button><button type="button" id="v40Reset" class="v40-reset" aria-label="Réinitialiser la synchronisation">↺</button></div><button class="v38-close" type="button" aria-label="Fermer">×</button></div><div id="v38Scroll" class="v38-scroll"></div>';view.appendChild(panel);panel.querySelector('.v38-close').addEventListener('click',closePanel);panel.querySelector('#v40Earlier').addEventListener('click',function(){adjustManual(-1)});panel.querySelector('#v40Later').addEventListener('click',function(){adjustManual(1)});panel.querySelector('#v40Reset').addEventListener('click',resetManual)}
    st.panel=panel;st.scroll=document.getElementById('v38Scroll');st.meta=document.getElementById('v38Meta');st.syncValue=document.getElementById('v40SyncValue');updateSyncLabel();return true;
  }
  function setBtn(mode){if(!st.button)return;st.button.classList.toggle('loading',mode==='loading');st.button.classList.toggle('ready',mode==='ready');st.button.classList.toggle('open',st.open)}
  function status(title,msg){if(!st.scroll)return;st.scroll.innerHTML='';var w=document.createElement('div');w.className='v38-state';w.innerHTML='<div><b></b><p></p></div>';w.querySelector('b').textContent=title;w.querySelector('p').textContent=msg;st.scroll.appendChild(w);st.lines=[];st.active=-2}
  function parseLrc(src,duration){var out=[],rows=String(src||'').split(/\r?\n/),lrcOffset=0;for(var z=0;z<rows.length;z++){var om=rows[z].match(/^\[offset:([+-]?\d+)\]/i);if(om){lrcOffset=Number(om[1])/1000;break}}for(var r=0;r<rows.length;r++){var raw=rows[r],re=/\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g,times=[],m;while((m=re.exec(raw)))times.push(Number(m[1])*60+Number(m[2])+lrcOffset);if(!times.length)continue;var t=txt(raw.replace(re,''));if(!t)continue;for(var j=0;j<times.length;j++)out.push({start:times[j],text:t})}out.sort(function(a,b){return a.start-b.start});for(var i=0;i<out.length;i++){out[i].end=out[i+1]?out[i+1].start:(duration||out[i].start+5);if(out[i].end<=out[i].start)out[i].end=out[i].start+2.5}return out}
  function render(data){
    if(!ensure())return;st.scroll.innerHTML='';st.lines=[];st.active=-2;st.autoOffset=calcAutoOffset(data);st.manualOffset=savedManual(st.id);updateSyncLabel();st.meta.textContent=txt((data.trackName||st.track.title||'')+' • '+(data.artistName||st.track.artist||''));
    if(data.syncedLyrics){var lines=parseLrc(data.syncedLyrics,data.duration||pdur());if(!lines.length){status('Synchronisation indisponible','Les paroles ont été trouvées mais sans repères temporels utilisables.');return}var f=document.createDocumentFragment();for(var i=0;i<lines.length;i++)(function(line){var el=document.createElement('div');el.className='v38-line';el.textContent=line.text;el.addEventListener('click',function(){try{if(typeof S!=='undefined'&&S.ready&&S.p)S.p.seekTo(Math.max(0,line.start+totalOffset()),true)}catch(e){}});f.appendChild(el);st.lines.push({el:el,line:line})})(lines[i]);st.scroll.appendChild(f);startTimer()}
    else if(data.plainLyrics){String(data.plainLyrics).split(/\r?\n/).forEach(function(row){var t=txt(row);if(!t)return;var el=document.createElement('div');el.className='v38-plain';el.textContent=t;st.scroll.appendChild(el)});stopTimer()}
    else status('Paroles indisponibles','Aucune parole n’a été trouvée pour ce titre.');
  }
  function request(t){
    var c=getCache(t.id);if(c)return Promise.resolve(c.notFound?null:c);var md=metadata(t);if(!md.title)return Promise.resolve(null);var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},TIMEOUT),started=Date.now();
    function call(params){var u=new URL('https://lrclib.net/api/search');for(var k in params)if(params[k])u.searchParams.set(k,params[k]);return fetch(u.toString(),{signal:controller.signal,mode:'cors',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
    return call({track_name:md.title,artist_name:md.artist}).then(function(list){if((!list||!list.length)&&Date.now()-started<3000)return call({q:txt(md.title+' '+md.artist)});return list||[]}).then(function(list){var best=null,score=-999,d=pdur();for(var i=0;i<list.length;i++){var r=list[i];if(!r||r.instrumental||(!r.syncedLyrics&&!r.plainLyrics))continue;var s=r.syncedLyrics?20:4;if(d&&r.duration){var diff=Math.abs(Number(r.duration)-d);if(diff<3)s+=8;else if(diff<8)s+=4;else if(diff>25)s-=5}if(s>score){score=s;best=r}}if(!best){putCache(t.id,{notFound:true});return null}var out={trackName:best.trackName||best.name||md.title,artistName:best.artistName||md.artist,duration:Number(best.duration)||0,syncedLyrics:best.syncedLyrics||null,plainLyrics:best.plainLyrics||null};putCache(t.id,out);return out}).catch(function(){return null}).finally(function(){clearTimeout(timer)})
  }
  function prepare(t){if(!t||!t.id)return Promise.resolve(null);if(st.id===t.id&&st.promise)return st.promise;st.id=t.id;st.track=t;st.data=null;st.autoOffset=0;st.manualOffset=savedManual(t.id);setBtn('loading');st.promise=request(t).then(function(data){if(st.id!==t.id)return data;st.data=data;setBtn(data?'ready':'none');if(st.open){if(data)render(data);else status('Paroles indisponibles','Aucune parole n’a été trouvée en moins de 5 secondes.')}return data});return st.promise}
  function openPanel(){if(!ensure())return;var t=cur();if(!t)return;st.open=true;st.panel.classList.add('show');document.body.classList.add('v38-open');setBtn(st.data?'ready':'loading');var v=document.getElementById('video');if(v)v.classList.remove('show');if(st.data)render(st.data);else{status('Recherche des paroles…','Audify cherche une version synchronisée.');prepare(t)}}
  function closePanel(){st.open=false;if(st.panel)st.panel.classList.remove('show');document.body.classList.remove('v38-open');setBtn(st.data?'ready':'none');stopTimer()}
  function toggle(){st.open?closePanel():openPanel()}
  function stopTimer(){if(st.timer){clearInterval(st.timer);st.timer=0}}
  function startTimer(){stopTimer();st.timer=setInterval(function(){if(!st.open||!st.lines.length)return;update(ptime())},100);update(ptime())}
  function update(t,force){var effective=t-totalOffset(),idx=-1;for(var i=0;i<st.lines.length;i++){if(effective>=st.lines[i].line.start)idx=i;else break}if(idx===st.active&&!force)return;st.active=idx;for(var j=0;j<st.lines.length;j++){st.lines[j].el.classList.toggle('active',j===idx);st.lines[j].el.classList.toggle('past',j<idx);st.lines[j].el.classList.toggle('next',j===idx+1)}if(idx>=0)try{st.lines[idx].el.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}}
  function boot(){ensure();var last='';setInterval(function(){ensure();var t=cur();if(t&&t.id&&t.id!==last){last=t.id;prepare(t)}if(document.getElementById('playerView')&&document.getElementById('playerView').hidden&&st.open)closePanel()},400);if(window.MutationObserver){var mo=new MutationObserver(function(){ensure()});mo.observe(document.body,{childList:true,subtree:true})}setTimeout(ensure,100);setTimeout(ensure,700);setTimeout(ensure,1600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
