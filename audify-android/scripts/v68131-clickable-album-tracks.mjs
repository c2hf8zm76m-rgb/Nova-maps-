import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const albumPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'AudifyInstantAlbums.java');

let album = await readFile(albumPath, 'utf8');
const marker = 'AUDIFY_V68131_CLICKABLE_ALBUM_TRACKS';

if (!album.includes(marker)) {
  const loopNeedle = 'for(int i=0;i<album.tracks.size();i++){\n            AudifyInstantAlbumMetadata.Track t=album.tracks.get(i);';
  if (!album.includes(loopNeedle)) throw new Error('V68.13.1 album track loop not found');
  album = album.replace(
    loopNeedle,
    'for(int i=0;i<album.tracks.size();i++){\n            final int index=i;\n            AudifyInstantAlbumMetadata.Track t=album.tracks.get(i);'
  );

  album = album.replace(
    'String initialState=displayState.get(i)!=null?"Prêt":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));',
    'String initialState=displayState.get(i)!=null?"▶  Lire":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));'
  );
  album = album.replace(
    'TextView rowState=text(a,initialState,11.5f,"Prêt".equals(initialState)?Color.rgb(194,255,126):Color.rgb(148,159,175),false);',
    'TextView rowState=text(a,initialState,11.5f,initialState.startsWith("▶")?Color.rgb(194,255,126):Color.rgb(148,159,175),false);'
  );

  const rowStateNeedle = 'row.addView(rowState,new LinearLayout.LayoutParams(dp(a,wide?92:72),-2));';
  if (!album.includes(rowStateNeedle)) throw new Error('V68.13.1 row state anchor not found');
  album = album.replace(
    rowStateNeedle,
    rowStateNeedle + '\n            row.setClickable(true);\n            row.setFocusable(true);\n            row.setContentDescription("Lire "+t.title);\n            row.setOnClickListener(v->playTrack(a,album,s,index,rowState,d));\n            row.setOnTouchListener((v,e)->{\n                if(e.getAction()==MotionEvent.ACTION_DOWN)v.animate().scaleX(.992f).scaleY(.992f).setDuration(70).start();\n                else if(e.getAction()==MotionEvent.ACTION_UP||e.getAction()==MotionEvent.ACTION_CANCEL)v.animate().scaleX(1f).scaleY(1f).setDuration(95).start();\n                return false;\n            });'
  );

  const tickerOld = 'boolean ready=displayState.get(i)!=null;\\\n                String label=ready?"Prêt":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));\\\n                stateView.setText(label);\\\n                stateView.setTextColor(ready?Color.rgb(194,255,126):Color.rgb(148,159,175));';
  const tickerNew = 'boolean ready=displayState.get(i)!=null;\\\n                if("audify-track-pending".equals(String.valueOf(stateView.getTag()))&&!ready){stateView.setText("Préparation…");stateView.setTextColor(Color.rgb(194,255,126));continue;}\\\n                if(ready)stateView.setTag(null);\\\n                String label=ready?"▶  Lire":(displayState.complete?"Indisponible":(i<5?"Préparation…":"En attente"));\\\n                stateView.setText(label);\\\n                stateView.setTextColor(ready?Color.rgb(194,255,126):Color.rgb(148,159,175));';
  if (album.includes(tickerOld)) album = album.replace(tickerOld, tickerNew);

  const playAnchor = '    private static void play(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s,TextView b,TextView status,Dialog d){';
  if (!album.includes(playAnchor)) throw new Error('V68.13.1 play method anchor not found');
  const playTrackMethod = `    // ${marker}\n    private static void playTrack(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s,int index,TextView rowState,Dialog d){\n        if(index<0||index>=album.tracks.size())return;\n        final AudifyInstantAlbumResolver.State st=AudifyInstantAlbumResolver.ensure(a,album,s.id,s.title,s.artist,s.thumb);\n        rowState.setTag("audify-track-pending");\n        rowState.setText("Préparation…");\n        rowState.setTextColor(Color.rgb(194,255,126));\n        final long started=android.os.SystemClock.elapsedRealtime();\n        MAIN.post(new Runnable(){public void run(){\n            if(a.isFinishing()||!d.isShowing())return;\n            AudifyInstantAlbumResolver.Playable selected=st.get(index);\n            if(selected!=null){\n                try{\n                    ArrayList<AudifyInstantAlbumResolver.Playable> q=new ArrayList<>();\n                    for(int off=0;off<album.tracks.size();off++){\n                        int pos=(index+off)%album.tracks.size();\n                        AudifyInstantAlbumResolver.Playable p=st.get(pos);\n                        if(p!=null)q.add(p);\n                    }\n                    if(q.isEmpty())throw new IllegalStateException("selected queue empty");\n                    AudifyInstantAlbumResolver.launch(a,q);\n                    rowState.setTag(null);\n                    rowState.setText("▶  Lecture");\n                    rowState.setTextColor(Color.rgb(194,255,126));\n                    d.dismiss();\n                }catch(Throwable e){\n                    rowState.setTag(null);\n                    rowState.setText("Réessayer");\n                    rowState.setTextColor(Color.rgb(255,188,122));\n                    Toast.makeText(a,"Impossible de lancer ce titre",Toast.LENGTH_SHORT).show();\n                }\n                return;\n            }\n            if(st.complete||android.os.SystemClock.elapsedRealtime()-started>18000L){\n                rowState.setTag(null);\n                rowState.setText("Indisponible");\n                rowState.setTextColor(Color.rgb(148,159,175));\n                Toast.makeText(a,"Ce titre n'est pas encore disponible",Toast.LENGTH_SHORT).show();\n                return;\n            }\n            MAIN.postDelayed(this,160L);\n        }});\n    }\n\n`;
  album = album.replace(playAnchor, playTrackMethod + playAnchor);

  await writeFile(albumPath, album, 'utf8');
}

console.log('Audify V68.13.1: every album track card is clickable and starts the selected song.');
