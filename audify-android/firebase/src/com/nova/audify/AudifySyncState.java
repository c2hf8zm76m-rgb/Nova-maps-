package com.nova.audify;

import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Transport-independent per-user state. Pending mutations survive failures and restarts. */
public final class AudifySyncState {
    private final JSONObject records;
    private final JSONObject pending;

    public AudifySyncState(String saved) throws Exception {
        JSONObject root = saved == null || saved.isEmpty() ? new JSONObject() : new JSONObject(saved);
        if (root.optInt("schema", 1) != 1) throw new IllegalArgumentException("Version locale inconnue");
        records = root.has("records") ? root.getJSONObject("records") : new JSONObject();
        pending = root.has("pending") ? root.getJSONObject("pending") : new JSONObject();
    }

    public static String id(String kind, String key) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest((kind + ":" + key).getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(kind + "_");
            for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 255));
            return out.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private static JSONObject copy(JSONObject value) throws Exception { return new JSONObject(value.toString()); }

    public JSONObject change(String kind, String key, JSONObject payload, boolean deleted, boolean cloud) throws Exception {
        String docId = id(kind, key);
        JSONObject record = new JSONObject().put("schema", 1).put("kind", kind).put("key", key)
            .put("payload", copy(payload)).put("deleted", deleted).put("opId", UUID.randomUUID().toString())
            .put("clientTime", System.currentTimeMillis());
        records.put(docId, record);
        if (cloud) pending.put(docId, copy(record));
        return copy(record);
    }

    public boolean acknowledge(String docId, String opId) {
        JSONObject current = pending.optJSONObject(docId);
        if (current != null && opId.equals(current.optString("opId"))) { pending.remove(docId); return true; }
        return false; // An older completion must never clear a newer edit.
    }

    public boolean acceptRemote(String docId, JSONObject remote) throws Exception {
        if (remote.optInt("schema", 0) != 1 || !docId.equals(id(remote.getString("kind"), remote.getString("key"))))
            throw new IllegalArgumentException("Données cloud incompatibles");
        if (pending.has(docId)) return false; // Preserve the latest local intent until acknowledged.
        JSONObject old = records.optJSONObject(docId);
        if (old != null && old.optLong("serverTime") > remote.optLong("serverTime")) return false;
        if (old != null && old.toString().equals(remote.toString())) return false;
        records.put(docId, copy(remote));
        return true;
    }

    public void removeRemote(String docId) { if (!pending.has(docId)) records.remove(docId); }
    public boolean contains(String kind, String key) { return records.has(id(kind, key)); }
    public JSONObject get(String kind, String key) { JSONObject value=records.optJSONObject(id(kind,key));try{return value==null?null:copy(value);}catch(Exception e){return null;} }
    public int pendingCount() { return pending.length(); }
    public JSONObject pendingCopy() throws Exception { return copy(pending); }
    public List<JSONObject> active(String kind) {
        List<JSONObject> out = new ArrayList<>();
        Iterator<String> keys = records.keys();
        while (keys.hasNext()) {
            JSONObject value = records.optJSONObject(keys.next());
            if (value != null && kind.equals(value.optString("kind")) && !value.optBoolean("deleted")) out.add(value);
        }
        return out;
    }
    public String save() throws Exception { return new JSONObject().put("schema", 1).put("records", records).put("pending", pending).toString(); }
}
