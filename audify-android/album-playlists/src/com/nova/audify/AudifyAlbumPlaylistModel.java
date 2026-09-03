package com.nova.audify;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;

/** Album playlists use the existing cloud schema. Album presentation/order is local, per account. */
public final class AudifyAlbumPlaylistModel {
    private static final String LOCAL_KIND = "albumPlaylistLocal";
    private AudifyAlbumPlaylistModel() {}

    public static JSONObject metadata(AudifySyncState state, String name) throws Exception {
        String id = AudifyLibraryModel.playlists(state).get(name);
        JSONObject record = id == null ? null : state.get(LOCAL_KIND, id);
        return AudifyLibraryModel.active(record) ? record.getJSONObject("payload") : null;
    }

    public static String find(AudifySyncState state, String albumKey) throws Exception {
        if (albumKey == null || albumKey.isEmpty()) return "";
        for (Map.Entry<String,String> entry : AudifyLibraryModel.playlists(state).entrySet()) {
            JSONObject record = state.get(LOCAL_KIND, entry.getValue());
            if (AudifyLibraryModel.active(record) && albumKey.equals(record.getJSONObject("payload").optString("albumKey")))
                return entry.getKey();
        }
        return "";
    }

    /** Called inside ONE owner-bound sync transaction: no empty/partially committed playlist. */
    public static String save(AudifySyncState state, JSONObject album, List<JSONObject> tracks, boolean cloud) throws Exception {
        if (album == null || tracks == null || tracks.isEmpty()) throw new IllegalArgumentException("Album vide");
        String key = album.optString("albumKey").trim();
        String title = album.optString("title").trim();
        if (key.isEmpty() || title.isEmpty()) throw new IllegalArgumentException("Album incomplet");
        String existing = find(state, key);
        if (!existing.isEmpty()) return existing; // Keep subsequent user edits; never overwrite on repeat saves.

        LinkedHashMap<String,JSONObject> unique = new LinkedHashMap<>();
        for (JSONObject track : tracks) {
            if (track == null) continue;
            String video = track.optString("id").trim();
            if (video.isEmpty() || video.length() > 256) continue;
            JSONObject clean = new JSONObject().put("id", video)
                .put("title", bounded(track.optString("title", "Sans titre"), 500))
                .put("artist", bounded(track.optString("artist", "Artiste inconnu"), 500))
                .put("thumbnail", bounded(track.optString("thumbnail"), 2048));
            if (!unique.containsKey(video)) unique.put(video, clean);
        }
        if (unique.isEmpty()) throw new IllegalArgumentException("Aucun titre trouvé");

        Set<String> names = new HashSet<>(AudifyLibraryModel.playlists(state).keySet());
        // Cloud merges can disambiguate equal names with [UUID] in the visible map.
        // Reserve their raw names too, so the newly returned name always resolves.
        for (JSONObject record : state.active("playlist")) names.add(record.getJSONObject("payload").getString("name"));
        String base = bounded("Album — " + title, 120), name = base;
        for (int n = 2; names.contains(name); n++) name = base + " (" + n + ")";
        String playlist = AudifyLibraryModel.create(state, name, cloud);
        JSONArray order = new JSONArray();
        for (Map.Entry<String,JSONObject> entry : unique.entrySet()) {
            JSONObject payload = entry.getValue().put("playlistId", playlist);
            state.change("playlistItem", playlist + ":" + entry.getKey(), payload, false, cloud);
            order.put(entry.getKey());
        }
        JSONObject local = new JSONObject(album.toString()).put("order", order).put("savedCount", unique.size());
        // Deliberately NOT queued for Firebase: no rule changes or new remote entity kinds.
        state.change(LOCAL_KIND, playlist, local, false, false);
        return name;
    }

    public static List<JSONObject> orderedTracks(AudifySyncState state, String name) throws Exception {
        List<JSONObject> tracks = AudifyLibraryModel.playlistTracks(state, name);
        JSONObject meta = metadata(state, name);
        if (meta == null) return tracks; // Ordinary playlists remain unchanged.
        JSONArray order = meta.optJSONArray("order");
        if (order == null) return tracks;
        Map<String,Integer> position = new HashMap<>();
        for (int i = 0; i < order.length(); i++) position.put(order.optString(i), i);
        // Stable sort: manually added tracks retain their existing order after the album tracks.
        tracks.sort((a,b) -> Integer.compare(position.getOrDefault(a.optString("id"), Integer.MAX_VALUE),
            position.getOrDefault(b.optString("id"), Integer.MAX_VALUE)));
        return tracks;
    }

    private static String bounded(String value, int max) {
        if (value.length() <= max) return value;
        int end = Character.isHighSurrogate(value.charAt(max - 1)) ? max - 1 : max;
        return value.substring(0, end);
    }
}
