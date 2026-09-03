# Audify 68.12.54 — Albums in Playlists

- In the existing album identifier, **Enregistrer dans mes playlists** resolves all tracks with the existing search resolver, then saves a normal playlist named `Album — <title>`.
- Saving does not start playback or change the current queue. Closing the album sheet cancels the pending save; the current in-flight search can finish but cannot save afterwards.
- Missing/unresolved/duplicate matches require explicit confirmation before saving a partial album. Zero matches create nothing.
- Repeated saves open the same locally identified album playlist. Same-named ordinary playlists are never overwritten. Deleting/re-saving creates a fresh playlist identity.
- Album cards appear in the existing Home Playlists section and native Library, with an album badge, cover sleeve/vinyl artwork and metadata. The existing playlist screen opens them and uses the existing playback methods.
- The card fetches the cover thumbnail from the [documented Cover Art Archive endpoint](https://musicbrainz.org/doc/Cover_Art_Archive/API). A drawn sleeve remains visible if no cover is available.

## Storage boundary

Tracks and playlist names use the **unchanged** Firebase entity schema. Album presentation metadata and explicit track order are stored **locally per account**, atomically in that account's durable cache, using `cloud=false`. They are never queued for upload. On another device the synced entry is currently a conventional playlist; enhanced presentation and original ordering are not guaranteed there. A future cross-device extension needs a separately approved cloud schema rollout.

The album patch captures ten source hashes immediately before making changes, then asserts that the extractor, search engine, playback service, player, karaoke, discovery, network guard and core sync/model files remain byte-identical afterwards. The generated reference is checked again by the integration suite. Existing V53 generation scripts are unchanged.

## Verification

After the normal patch chain, run `node scripts/test-v681254-albums.mjs`. Gradle's `testDebugUnitTest` runs `AlbumPlaylistTest` and the existing suites. For local standalone model tests set `AUDIFY_JSON_SOURCE` to a JSON-java source checkout and optionally `AUDIFY_JAVA_BIN` to the Java tools directory.

Manual Android checks still required: save/open/restart an album, cancel an import, confirm/decline a partial import, switch accounts during import, delete/re-save, verify ongoing playback is uninterrupted, inspect long album titles/large fonts, and open an ordinary playlist. This version does not change signing configuration.
