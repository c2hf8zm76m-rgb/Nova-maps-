import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkgDir = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
const albumPath = path.join(pkgDir, 'AudifyInstantAlbums.java');
const playerPath = path.join(pkgDir, 'NativePlayerActivity.java');

// V68.12.64 — restore the album trigger that used to be present while a song plays.
// The red square is only a temporary/action state. Once the album is identified,
// the existing real album artwork takes over and the existing album playback UI is kept.
let album = await readFile(albumPath, 'utf8');
const marker = 'AUDIFY_V681264_RESTORE_ALBUM_TRIGGER';

if (!album.includes(marker)) {
  const tileNeedle = 'private static final String TILE=TAG+"_TILE";';
  if (!album.includes(tileNeedle)) throw new Error('AudifyInstantAlbums TILE marker not found');
  album = album.replace(
    tileNeedle,
    tileNeedle + '\n    private static final String RESTORE_MARKER="' + marker + '";'
  );

  const newTrackNeedle = 'observed=k;albumFor="";current=null;hide(a);';
  if (!album.includes(newTrackNeedle)) throw new Error('AudifyInstantAlbums new-track hide logic not found');
  album = album.replace(newTrackNeedle, 'observed=k;albumFor="";current=null;showTrigger(a);');

  const steadyNeedle = '}else if(current!=null&&k.equals(albumFor))showCard(a,current,s);';
  if (!album.includes(steadyNeedle)) throw new Error('AudifyInstantAlbums steady poll logic not found');
  album = album.replace(
    steadyNeedle,
    '}else if(current!=null&&k.equals(albumFor))showCard(a,current,s);else showTrigger(a);'
  );

  const showCardNeedle = '    private static void showCard(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s){';
  if (!album.includes(showCardNeedle)) throw new Error('AudifyInstantAlbums showCard method not found');

  const helper = `    private static void showTrigger(Activity a){
        View c=a.findViewById(android.R.id.content);if(!(c instanceof ViewGroup))return;
        View v=((ViewGroup)c).findViewWithTag(TILE);if(!(v instanceof ImageView))return;
        ImageView tile=(ImageView)v;
        tile.setImageDrawable(null);
        GradientDrawable red=new GradientDrawable();
        red.setColor(Color.rgb(220,24,35));
        red.setCornerRadius(dp(a,15));
        red.setStroke(dp(a,1),Color.argb(150,255,255,255));
        tile.setBackground(red);
        if(Build.VERSION.SDK_INT>=21){tile.setClipToOutline(true);tile.setElevation(dp(a,12));}
        if(tile.getVisibility()!=View.VISIBLE){
            tile.setVisibility(View.VISIBLE);tile.setAlpha(0f);tile.setScaleX(.90f);tile.setScaleY(.90f);
            tile.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(180).start();
        }else if(tile.getAlpha()<1f){
            tile.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(120).start();
        }
    }

`;
  album = album.replace(showCardNeedle, helper + showCardNeedle);
  await writeFile(albumPath, album, 'utf8');
}

// Make the album engine attachment robust even if an older patch left the call in
// a stale lifecycle location. onPostResume runs after the player UI is attached.
let player = await readFile(playerPath, 'utf8');
const attachMarker = 'AUDIFY_V681264_ALBUM_ATTACH';
if (!player.includes(attachMarker)) {
  const resume = /protected\s+void\s+onPostResume\s*\(\s*\)\s*\{/m.exec(player);
  const attach = `\n        // ${attachMarker}\n        try { AudifyAlbumIdentifier.attach(this); } catch (Throwable ignored) {}\n`;
  if (resume) {
    const at = resume.index + resume[0].length;
    player = player.slice(0, at) + attach + player.slice(at);
  } else {
    const last = player.lastIndexOf('\n}');
    if (last < 0) throw new Error('NativePlayerActivity closing brace not found');
    const method = `\n    @Override\n    protected void onPostResume() {\n        super.onPostResume();${attach}    }\n`;
    player = player.slice(0, last) + method + player.slice(last);
  }
  await writeFile(playerPath, player, 'utf8');
}

console.log('Audify V68.12.64: red album trigger restored, clickable album flow preserved, lifecycle attach reinforced.');
