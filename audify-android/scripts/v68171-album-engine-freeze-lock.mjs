import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * AUDIFY_ALBUM_ENGINE_FROZEN_V6817
 *
 * Album detection is considered finished as of Audify V68.17.
 * This guard deliberately has NO environment-variable bypass.
 * A detector change must be explicitly approved, then this baseline must be
 * deliberately updated together with the CI checksum of this lock script.
 *
 * UI/player/widget work remains allowed as long as it does not rewrite the
 * protected album detector Java targets below.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const protectedScripts = new Map([
  ['scripts/v681258-multisource-album-intelligence.mjs','714ac4f03f8de6f8cd79220e7c39017d77e60d15'],
  ['scripts/v6812581-full-package-restore.mjs','e80f6775880433bd0814e7874aed70ffb739e974'],
  ['scripts/v68140-album-intelligence2.mjs','500c7e68b088d7f36712edecae9015ede646142e'],
  ['scripts/v68141-album-intelligence-recall-fix.mjs','13b4c165b1886313f80f216010139715b7f52273'],
  ['scripts/v68150-youtube-music-album-resolver.mjs','49a4ad608b2865b1f58ac9a9ed4782effc487307'],
  ['scripts/v68151-ytmusic-coherence-guard.mjs','c5202ea192cee21d61036c903992c19064866bb0'],
  ['scripts/v68152-ytmusic-session-stability.mjs','bdc01efd7d2ab61de965fcde8d416db832884e57'],
  ['scripts/v68153-canonical-artist-album-guard.mjs','c587ab1a57dce62d7e3c8d4494da87426f3ff7dd'],
  ['scripts/v681531-canonical-guard-compile-fix.mjs','3f7077fd2384b2b5dbdf0db85b5c2613773d482c'],
  ['scripts/v68155-deezer-canonical-album-crosscheck.mjs','0af068014bcf51bdde3256425b40be59cd6893bc'],
  ['scripts/v68156-official-metadata-identity.mjs','803dda4a5394a7ef7d26e4fc79b59c195bd628c3'],
  ['scripts/v68157-artist-identity-normalization.mjs','b89676c8fc07e4dc634538f260ca9268e4e0e147'],
  ['scripts/v68158-localized-official-metadata.mjs','6e1703d49d40dc0a97a08e9a8a337bac2792f91e'],
  ['scripts/v68159-artist-identity-fusion.mjs','64f8dbe79c75c12192c4597607f05d17d592c291'],
  ['scripts/v68160-release-preference-intelligence.mjs','d7a571b0dac8e395b03daa0811e13a1798d5b501'],
  ['scripts/v68161-apple-release-graph.mjs','8a871ad1c9c84cd52857d212acbbe82d7829f298'],
  ['scripts/v68162-official-album-mention-intelligence.mjs','d1836a177db838faf842889b267adc735f4460f1'],
  ['scripts/v68163-innertube-video-evidence-bridge.mjs','85c340111defae4df570a4a9996922a097d4780b'],
  ['scripts/v681640-diagnostic-script-compat.mjs','dff2f0af09d38639d4dbd018e1ad9de3858e3c18'],
  ['scripts/v68164-album-diagnostic-trace.mjs','6802dc37dea41b8eb7c68581c7baf5b205bb24e2'],
  ['scripts/v68165-hint-first-release-lookup.mjs','7734e9600f7dda7b6da6ed37ba0f2c7a3be74ecf'],
  ['scripts/v68166-fast-proof-pipeline.mjs','a6d31747bce9dfadb4bfe0e9aa6d47b7a08cf2f4'],
]);

const protectedLateOrder = [
  'scripts/v68140-album-intelligence2.mjs',
  'scripts/v68141-album-intelligence-recall-fix.mjs',
  'scripts/v68150-youtube-music-album-resolver.mjs',
  'scripts/v68151-ytmusic-coherence-guard.mjs',
  'scripts/v68152-ytmusic-session-stability.mjs',
  'scripts/v68153-canonical-artist-album-guard.mjs',
  'scripts/v681531-canonical-guard-compile-fix.mjs',
  'scripts/v68155-deezer-canonical-album-crosscheck.mjs',
  'scripts/v68156-official-metadata-identity.mjs',
  'scripts/v68157-artist-identity-normalization.mjs',
  'scripts/v68158-localized-official-metadata.mjs',
  'scripts/v68159-artist-identity-fusion.mjs',
  'scripts/v68160-release-preference-intelligence.mjs',
  'scripts/v68161-apple-release-graph.mjs',
  'scripts/v68162-official-album-mention-intelligence.mjs',
  'scripts/v68163-innertube-video-evidence-bridge.mjs',
  'scripts/v681640-diagnostic-script-compat.mjs',
  'scripts/v68164-album-diagnostic-trace.mjs',
  'scripts/v68165-hint-first-release-lookup.mjs',
  'scripts/v68166-fast-proof-pipeline.mjs',
];

const detectorJavaTargets = [
  'AudifyInstantAlbumMetadata.java',
  'AudifyYoutubeMusicAlbumResolver.java',
  'AudifyReleasePreferenceResolver.java',
  'AudifyAppleReleaseGraphResolver.java',
];

function gitBlobSha(data) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${data.length}\0`))
    .update(data)
    .digest('hex');
}

function fail(message) {
  throw new Error(`AUDIFY ALBUM ENGINE FREEZE LOCK: ${message}`);
}

// 1) Exact source integrity for every protected detector patch.
for (const [rel, expected] of protectedScripts) {
  const abs = path.join(root, rel);
  let data;
  try { data = await readFile(abs); }
  catch { fail(`protected detector file missing: ${rel}`); }
  const actual = gitBlobSha(data);
  if (actual !== expected) {
    fail(`protected detector changed: ${rel}\nexpected=${expected}\nactual=${actual}`);
  }
}

// 2) Historical detector foundation must still be present in package android:patch.
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const androidPatch = String(pkg?.scripts?.['android:patch'] || '');
const baseDetector = 'scripts/v681258-multisource-album-intelligence.mjs';
if (!androidPatch.includes(baseDetector)) {
  fail(`historical detector foundation removed from package android:patch: ${baseDetector}`);
}
if ((androidPatch.match(/v681258-multisource-album-intelligence\.mjs/g) || []).length !== 1) {
  fail('historical detector foundation must appear exactly once in package android:patch');
}

// 3) Protected late detector patches must remain present, unique, and ordered.
const safePath = path.join(root, 'scripts', 'v68132-safe-patch-chain.mjs');
const safe = await readFile(safePath, 'utf8');
let cursor = -1;
for (const rel of protectedLateOrder) {
  const count = safe.split(rel).length - 1;
  if (count !== 1) fail(`safe patch chain must reference ${rel} exactly once; found ${count}`);
  const pos = safe.indexOf(rel);
  if (pos <= cursor) fail(`protected detector patch order changed around ${rel}`);
  cursor = pos;
}

// 4) Any unprotected late patch may evolve UI/player/widgets, but it may not
//    start rewriting one of the detector Java source files behind the lock.
const listStart = safe.indexOf('for(const script of [');
const listEnd = safe.indexOf(']){', listStart);
if (listStart < 0 || listEnd < 0) fail('safe patch chain script list could not be parsed');
const listSource = safe.slice(listStart, listEnd);
const refs = [...listSource.matchAll(/'((?:scripts\/)[^']+\.mjs)'/g)].map(m => m[1]);
for (const rel of refs) {
  if (protectedScripts.has(rel)) continue;
  const abs = path.join(root, rel);
  let source = '';
  try { source = await readFile(abs, 'utf8'); }
  catch { fail(`safe-chain patch missing: ${rel}`); }
  for (const target of detectorJavaTargets) {
    if (source.includes(target)) {
      fail(`unprotected patch ${rel} attempts to touch frozen detector target ${target}`);
    }
  }
}

console.log(`AUDIFY ALBUM ENGINE LOCKED ✅ — ${protectedScripts.size} detector sources verified; protected order intact; UI/player/widget patches remain allowed.`);
