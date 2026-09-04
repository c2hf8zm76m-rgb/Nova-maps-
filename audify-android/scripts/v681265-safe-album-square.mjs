import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkgDir = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
const albumPath = path.join(pkgDir, 'AudifyInstantAlbums.java');
const playerPath = path.join(pkgDir, 'NativePlayerActivity.java');
const marker = 'AUDIFY_V681265_SAFE_ALBUM_SQUARE';

// V68.12.65 — deliberately tiny UI-only patch on top of the known V68.12.63 base.
// Album recognition/cache/artwork/playback remain owned by the existing album engine.
let album = await readFile(albumPath, 'utf8');

if (!album.includes(marker)) {
  const tileNeedle = 'private static final String TILE=TAG+"_TILE";';
  if (!album.includes(tileNeedle)) throw new Error('Safety stop: album TILE marker not found');
  album = album.replace(tileNeedle, tileNeedle + '\n    private static final String SAFE_SQUARE_MARKER="' + marker + '";');

  // Move only the existing album-art tile into the user-selected empty area.
  // 84dp square, centered, below the top action buttons and above the large artwork.
  const oldLayout = `FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(dp(a,84),dp(a,84),Gravity.BOTTOM|Gravity.START);\n        lp.leftMargin=dp(a,20);\n        lp.bottomMargin=dp(a,174);\n        host.addView(tile,lp);`;
  const newLayout = `FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(dp(a,84),dp(a,84),Gravity.TOP|Gravity.CENTER_HORIZONTAL);\n        lp.topMargin=dp(a,80);\n        host.addView(tile,lp);`;
  if (!album.includes(oldLayout)) throw new Error('Safety stop: expected V68.12.63 album tile layout not found');
  album = album.replace(oldLayout, newLayout);

  // A tap opens the album page only. It must not unexpectedly start/restart playback.
  const oldClick = 'if(current!=null&&key(s).equals(albumFor))showAlbum(a,current,s,true);';
  const newClick = 'if(current!=null&&key(s).equals(albumFor))showAlbum(a,current,s,false);';
  if (!album.includes(oldClick)) throw new Error('Safety stop: expected album click handler not found');
  album = album.replace(oldClick, newClick);

  await writeFile(albumPath, album, 'utf8');
}

// V68.12.63 used a temporary 190dp red build-proof overlay at this same location.
// Remove only that exact marked proof block; no player control or playback code is touched.
let player = await readFile(playerPath, 'utf8');
const proofStartNeedle = '\n\n        // AUDIFY_V681263_RED_SQUARE_PROOF\n';
const proofEndNeedle = '        addContentView(audifyBuildProof, audifyProofLp);\n';
const proofStart = player.indexOf(proofStartNeedle);
if (proofStart >= 0) {
  const proofEnd = player.indexOf(proofEndNeedle, proofStart);
  if (proofEnd < 0) throw new Error('Safety stop: V68.12.63 proof start found without expected end');
  player = player.slice(0, proofStart) + player.slice(proofEnd + proofEndNeedle.length);
  await writeFile(playerPath, player, 'utf8');
}

// Fail the build rather than silently shipping a partial/broken album feature.
const finalAlbum = await readFile(albumPath, 'utf8');
for (const required of [
  marker,
  'detect(a,n,false)',
  'AudifyInstantAlbumArtwork.load(a,album,tile,s.thumb)',
  'showAlbum(a,current,s,false)',
  'Gravity.TOP|Gravity.CENTER_HORIZONTAL',
  'lp.topMargin=dp(a,80)'
]) {
  if (!finalAlbum.includes(required)) throw new Error('Safety verification failed: missing ' + required);
}
const finalPlayer = await readFile(playerPath, 'utf8');
if (finalPlayer.includes('AUDIFY_V681263_RED_SQUARE_PROOF')) {
  throw new Error('Safety verification failed: old red proof overlay is still active');
}

console.log('Audify V68.12.65 safe album square applied: recognized artwork only, centered top, click opens album without autoplay.');
