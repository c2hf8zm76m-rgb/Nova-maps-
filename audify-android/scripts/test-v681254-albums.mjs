import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const java=path.join(root,'android/app/src/main/java/com/nova/audify');
const read=name=>readFile(path.join(java,`${name}.java`),'utf8');
const baseline=JSON.parse(await readFile(path.join(root,'android/album-playlists-input-hashes.json'),'utf8'));
assert.equal(Object.keys(baseline).length,10,'all protected V53 inputs captured before the album patch');
for(const [name,hash] of Object.entries(baseline))
    assert.equal(createHash('sha256').update(await read(name)).digest('hex'),hash,`${name} MUST remain byte-identical to V68.12.53`);
const identifier=await read('AudifyAlbumIdentifier');
const begin=identifier.indexOf('    private static void prepareAlbumSave(');
const save=identifier.slice(begin,identifier.indexOf('    private static void prepareAlbumQueue(',begin));
assert.ok(begin>=0);
assert.ok(!/launchQueue\(|startService\(|startForegroundService\(|ACTION_SET_QUEUE|ACTION_LOAD/.test(save),'saving an album never starts playback');
assert.ok(save.includes('resolveYoutube(engine,search,album.tracks.get(i),album.title)'),'reuse unchanged resolver');
assert.ok(save.includes('i<album.tracks.size()'),'save full album, no silent 40-track limit');
assert.ok(save.includes('Album partiellement retrouvé'),'partial import requires confirmation');
assert.ok(save.includes('if(found.isEmpty())'),'no empty playlist');
assert.ok(save.includes('cancelled.get()'),'dismiss cancels operation');
for(const screen of ['NativeHomeActivity','NativeLibraryActivity','NativePlaylistActivity'])
    assert.ok((await read(screen)).includes('AudifyAlbumPlaylistCard.create'),`${screen} displays album cards`);
const store=await read('AudifyLibraryStore');
assert.ok(store.includes('sync.editFor(owner,(s,c)->{\n            List<JSONObject> rows='),'atomic owner-bound save');
assert.ok(store.includes('AudifyAlbumPlaylistModel.orderedTracks(s,name)'),'explicit order');
const card=await read('AudifyAlbumPlaylistCard');
assert.ok(card.includes('DANS TES PLAYLISTS'));
assert.ok(card.includes('Import partiel'));
assert.ok(!/AudifyPlaybackService|MediaPlayer|ExoPlayer/.test(card),'visual card owns no audio player');
const manifest=await readFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
assert.equal((manifest.match(/android.intent.category.LAUNCHER/g)||[]).length,1);
assert.ok(!manifest.includes('AlbumActivity'),'no new Albums section/activity');
const gradle=await readFile(path.join(root,'android/app/build.gradle'),'utf8');
assert.match(gradle,/versionCode 681254/);assert.match(gradle,/versionName "68.12.54"/);
console.log('V68.12.54: album integration checks passed; 10 protected sources are byte-identical before/after the album patch.');

// CI also executes this same Java suite through Gradle/JUnit. Local runs can use JSON-java sources.
if(process.env.AUDIFY_JSON_SOURCE){
    const output=await mkdtemp(path.join(tmpdir(),'audify-album-tests-'));
    const jsonDir=path.join(process.env.AUDIFY_JSON_SOURCE,'src/main/java/org/json');
    const sources=(await readdir(jsonDir)).filter(n=>n.endsWith('.java')).map(n=>path.join(jsonDir,n));
    const bin=process.env.AUDIFY_JAVA_BIN||'';
    execFileSync(bin?path.join(bin,'javac'):'javac',['-encoding','UTF-8','-d',output,...sources,
        path.join(java,'AudifySyncState.java'),path.join(java,'AudifyLibraryModel.java'),path.join(java,'AudifyAlbumPlaylistModel.java'),
        path.join(root,'album-playlists/tests/AudifyAlbumPlaylistModelTest.java')],{stdio:'inherit'});
    execFileSync(bin?path.join(bin,'java'):'java',['-cp',output,'com.nova.audify.AudifyAlbumPlaylistModelTest'],{stdio:'inherit'});
}
