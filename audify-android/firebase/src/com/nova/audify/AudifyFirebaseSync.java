package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import com.google.firebase.FirebaseApp;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.*;
import org.json.*;
import java.util.*;

/** One durable outbox and cache per Firebase UID, including a separate guest scope. */
public final class AudifyFirebaseSync {
    public interface Operation<T> { T run(AudifySyncState state, boolean cloud) throws Exception; }
    private static AudifyFirebaseSync instance;
    public static synchronized AudifyFirebaseSync get(Context context) {
        if(instance==null) instance=new AudifyFirebaseSync(context.getApplicationContext());
        return instance;
    }
    private final Context app;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final Set<Runnable> listeners=new HashSet<>();
    private final Set<String> inFlight=new HashSet<>();
    private SharedPreferences prefs;
    private AudifySyncState state;
    private String uid=null, error="";
    private int generation=0;
    private boolean serverSeen=false, writable=true, retryScheduled=false;
    private long retryDelay=2000;
    private ListenerRegistration registration;

    private AudifyFirebaseSync(Context context) {
        app=context;
        FirebaseApp.initializeApp(app);
        refreshSession();
        FirebaseAuth.getInstance().addAuthStateListener(auth->refreshSession());
    }
    public synchronized String uid() { refreshSession(); return uid; }
    public synchronized String scope() { String current=uid();return current.isEmpty()?"guest":"user_"+AudifySyncState.id("uid",current); }
    public String deviceId() {
        SharedPreferences p=app.getSharedPreferences("audify_firebase_device",Context.MODE_PRIVATE);
        synchronized(AudifyFirebaseSync.class) {
            String id=p.getString("id","");
            if(id.isEmpty()) {id=UUID.randomUUID().toString();if(!p.edit().putString("id",id).commit())throw new IllegalStateException("Stockage indisponible");}
            return id;
        }
    }
    public synchronized void refreshSession() {
        FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();
        String next=user==null?"":user.getUid();
        if(next.equals(uid))return;
        boolean switched=uid!=null;
        if(registration!=null) {registration.remove();registration=null;}
        generation++; inFlight.clear(); serverSeen=false; error=""; writable=true; retryDelay=2000;
        uid=next;
        prefs=app.getSharedPreferences("audify_firebase_"+(uid.isEmpty()?"guest":AudifySyncState.id("uid",uid)),Context.MODE_PRIVATE);
        try { state=new AudifySyncState(prefs.getString("state","")); }
        catch(Exception broken) {
            // Never overwrite a corrupt store with an empty one or silently lose its pending edits.
            writable=false; error="Stockage local illisible. Les données originales sont conservées.";
            try {state=new AudifySyncState(prefs.getString("backup",""));}
            catch(Exception alsoBroken) {try {state=new AudifySyncState("");}catch(Exception impossible){throw new IllegalStateException(impossible);}}
        }
        if(switched) AudifyPlaybackService.resetForAccountChange();
        if(!uid.isEmpty()&&writable) connect();
        changed();
    }
    private void connect() {
        final String owner=uid; final int epoch=generation;
        if(registration!=null)registration.remove();
        registration=FirebaseFirestore.getInstance().collection("users").document(owner).collection("entries")
            .addSnapshotListener(MetadataChanges.INCLUDE,(snapshot,failure)->{
                synchronized(this) {
                    if(epoch!=generation||!owner.equals(uid))return;
                    if(failure!=null) {error=cloudError(failure);registration=null;retryLater();changed();return;}
                    if(snapshot==null||snapshot.getMetadata().isFromCache())return;
                    serverSeen=true;
                    String before=saved();
                    try {
                        for(DocumentChange change:snapshot.getDocumentChanges(MetadataChanges.INCLUDE)) {
                            DocumentSnapshot doc=change.getDocument();
                            if(doc.getMetadata().hasPendingWrites())continue;
                            if(change.getType()==DocumentChange.Type.REMOVED) {state.removeRemote(doc.getId());continue;}
                            JSONObject record=new JSONObject(doc.getData());
                            Timestamp timestamp=doc.getTimestamp("updatedAt");
                            record.remove("updatedAt");
                            record.put("serverTime",timestamp==null?0:timestamp.toDate().getTime());
                            // A server-confirmed echo can acknowledge this operation, never a newer one.
                            state.acknowledge(doc.getId(),record.optString("opId"));
                            state.acceptRemote(doc.getId(),record);
                        }
                        persist(before); error="";retryDelay=2000;
                    } catch(Exception invalid) {rollback(before);error="Données cloud ou stockage local invalides. Synchronisation suspendue.";}
                    changed(); drain();
                }
            });
        drain();
    }
    public synchronized <T> T readFor(String expected,Operation<T> operation,T fallback) {
        refreshSession();return expected.equals(uid)?read(operation,fallback):fallback;
    }
    public synchronized <T> T editFor(String expected,Operation<T> operation,T fallback) {
        refreshSession();return expected.equals(uid)?edit(operation,fallback):fallback;
    }
    public synchronized <T> T read(Operation<T> operation,T fallback) {
        refreshSession();
        try {return operation.run(state,!uid.isEmpty());}catch(Exception e){error="Lecture locale impossible.";return fallback;}
    }
    public synchronized <T> T edit(Operation<T> operation,T fallback) {
        refreshSession(); if(!writable)return fallback;
        String before=saved();
        try {T result=operation.run(state,!uid.isEmpty());persist(before);changed();drain();return result;}
        catch(Exception e) {rollback(before);error="Enregistrement impossible. Vérifie l’espace disponible.";changed();return fallback;}
    }
    private String saved() {try{return state.save();}catch(Exception e){throw new IllegalStateException(e);}}
    private void rollback(String before) {try{state=new AudifySyncState(before);}catch(Exception e){writable=false;}}
    private void persist(String before) throws Exception {
        String after=state.save();
        if(!after.equals(before)&&!prefs.edit().putString("state",after).putString("backup",before).commit())
            throw new java.io.IOException("Local commit failed");
    }
    private void drain() {
        if(uid.isEmpty()||!writable)return;
        final String owner=uid;final int epoch=generation;
        try {
            JSONObject queue=state.pendingCopy();Iterator<String> ids=queue.keys();
            while(ids.hasNext()&&inFlight.size()<8) {
                String id=ids.next();if(inFlight.contains(id))continue;
                JSONObject record=queue.getJSONObject(id);String op=record.getString("opId");
                Map<String,Object> data=map(record);data.remove("serverTime");data.put("updatedAt",FieldValue.serverTimestamp());
                inFlight.add(id);
                FirebaseFirestore.getInstance().collection("users").document(owner).collection("entries").document(id).set(data)
                    .addOnCompleteListener(task->{synchronized(this){
                        if(epoch!=generation||!owner.equals(uid))return;
                        inFlight.remove(id);
                        if(task.isSuccessful()) {
                            String before=saved();state.acknowledge(id,op);
                            try {persist(before);error="";retryDelay=2000;}
                            catch(Exception e){rollback(before);error="Confirmation locale impossible.";retryLater();changed();return;}
                            drain();
                        } else {error=cloudError(task.getException());retryLater();}
                        changed();
                    }});
            }
        } catch(Exception e) {error="Synchronisation indisponible. Les changements restent sur cet appareil.";retryLater();}
    }
    private void retryLater() {
        if(retryScheduled)return; retryScheduled=true;
        main.postDelayed(()->{synchronized(this){retryScheduled=false;if(uid.isEmpty())return;if(registration==null)connect();else drain();}},retryDelay);
        retryDelay=Math.min(60000,retryDelay*2);
    }
    public synchronized void retry() {refreshSession();if(!uid.isEmpty()){if(registration==null)connect();else drain();}changed();}
    public synchronized boolean readyForImport() {return !uid().isEmpty()&&writable&&serverSeen&&error.isEmpty();}
    public synchronized String status() {
        if(!error.isEmpty())return error;
        if(uid.isEmpty())return "Mode invité · données sur cet appareil";
        if(state.pendingCount()>0)return state.pendingCount()+" changement(s) en attente du cloud";
        if(!serverSeen)return "Connexion au cloud… données locales disponibles";
        return "Bibliothèque synchronisée";
    }
    public synchronized void addListener(Runnable listener) {listeners.add(listener);}
    public synchronized void removeListener(Runnable listener) {listeners.remove(listener);}
    private void changed() {main.post(()->{List<Runnable> copy;synchronized(this){copy=new ArrayList<>(listeners);}for(Runnable listener:copy)listener.run();});}
    private static String cloudError(Exception e) {
        if(e instanceof FirebaseFirestoreException) {
            FirebaseFirestoreException.Code code=((FirebaseFirestoreException)e).getCode();
            if(code==FirebaseFirestoreException.Code.PERMISSION_DENIED)return "Accès au cloud refusé. Vérifie la connexion et les règles Firebase.";
            if(code==FirebaseFirestoreException.Code.RESOURCE_EXHAUSTED)return "Quota cloud atteint. Changements conservés sur cet appareil.";
            if(code==FirebaseFirestoreException.Code.UNAUTHENTICATED)return "Session expirée. Reconnecte-toi pour synchroniser.";
        }
        return "Cloud indisponible. Changements conservés sur cet appareil.";
    }
    private static Map<String,Object> map(JSONObject object) throws JSONException {
        Map<String,Object> result=new HashMap<>();Iterator<String> keys=object.keys();
        while(keys.hasNext()){String key=keys.next();Object value=object.get(key);result.put(key,value instanceof JSONObject?map((JSONObject)value):value==JSONObject.NULL?null:value);}
        return result;
    }
}
