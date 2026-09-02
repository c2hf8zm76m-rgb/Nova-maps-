package com.nova.audify;
import android.content.*;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.*;
import com.google.firebase.storage.*;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.Files;
import java.util.UUID;

/** Optional Storage transport: immutable private objects; Firestore stores only their path. */
public final class AudifyFirebaseAvatar {
    private static AudifyFirebaseAvatar instance;
    public static synchronized AudifyFirebaseAvatar get(Context context){if(instance==null)instance=new AudifyFirebaseAvatar(context.getApplicationContext());return instance;}
    private final Context app;
    private final AudifyFirebaseSync sync;
    private final Handler main=new Handler(Looper.getMainLooper());
    private String owner="",uploading="",downloading="",message="";
    private boolean retryScheduled=false;
    private long retryAfter=0;
    private AudifyFirebaseAvatar(Context context){app=context;sync=AudifyFirebaseSync.get(app);sync.addListener(this::refresh);main.post(this::refresh);}
    private SharedPreferences prefs(String uid){return app.getSharedPreferences("audify_avatar_"+AudifySyncState.id("uid",uid),Context.MODE_PRIVATE);}
    private File local(String uid,String extension){return new File(app.getFilesDir(),"audify_profile_"+uid.replaceAll("[^A-Za-z0-9._-]","_")+extension);}
    public String status(){return message;}
    public void queue(File file){
        String uid=sync.uid();if(uid.isEmpty())return;
        try{
            String op=UUID.randomUUID().toString(),ext=file.getName().endsWith(".gif")?".gif":".jpg";
            File pending=new File(app.getFilesDir(),"audify_avatar_pending_"+op+ext);
            Files.copy(file.toPath(),pending.toPath());
            SharedPreferences p=prefs(uid);String old=p.getString("pendingFile","");
            if(!p.edit().putString("pending",op).putString("pendingFile",pending.getName()).putString("extension",ext).commit()){pending.delete();throw new IOException();}
            if(!old.isEmpty())new File(app.getFilesDir(),old).delete();
            message="Avatar en attente du cloud";retryAfter=0;refresh();
        }catch(Exception e){message="Avatar conservé ici ; préparation de l’envoi impossible.";}
    }
    public boolean deleted(){
        String uid=sync.uid();if(uid.isEmpty())return false;
        SharedPreferences p=prefs(uid);
        String pending=p.getString("pending",""),old=p.getString("pendingFile","");
        if(!p.edit().remove("pending").remove("pendingFile").commit())return false;
        boolean saved=sync.editFor(uid,(state,cloud)->{state.change("profile","avatar",new JSONObject().put("path","").put("extension",""),true,cloud);return true;},false);
        if(!saved){p.edit().putString("pending",pending).putString("pendingFile",old).commit();return false;}
        if(!old.isEmpty())new File(app.getFilesDir(),old).delete();
        message="Suppression de l’avatar en attente du cloud";retryAfter=0;return true;
    }
    public void retry(){message="";retryAfter=0;refresh();}
    private void retryLater(){retryAfter=android.os.SystemClock.elapsedRealtime()+60000;if(retryScheduled)return;retryScheduled=true;main.postDelayed(()->{retryScheduled=false;refresh();},60000);}
    private void refresh(){
        String uid=sync.uid();if(!uid.equals(owner)){owner=uid;uploading="";downloading="";message="";retryAfter=0;}if(uid.isEmpty())return;
        if(android.os.SystemClock.elapsedRealtime()<retryAfter)return;
        SharedPreferences p=prefs(uid);String pending=p.getString("pending","");
        if(!pending.isEmpty()){
            if(pending.equals(uploading))return;
            String ext=p.getString("extension",".jpg"),filename=p.getString("pendingFile","");File file=new File(app.getFilesDir(),filename);
            if(!filename.startsWith("audify_avatar_pending_")||!file.isFile()){message="Avatar local manquant. Sélectionne-le à nouveau.";return;}
            String path="users/"+uid+"/avatars/"+pending+ext;uploading=pending;
            StorageMetadata metadata=new StorageMetadata.Builder().setContentType(ext.equals(".gif")?"image/gif":"image/jpeg").build();
            FirebaseStorage.getInstance().getReference().child(path).putFile(Uri.fromFile(file),metadata).addOnCompleteListener(task->{
                if(!uid.equals(sync.uid())||!pending.equals(p.getString("pending","")))return;
                uploading="";
                if(!task.isSuccessful()){message="Avatar sur cet appareil uniquement : stockage cloud indisponible.";retryLater();return;}
                boolean saved=sync.editFor(uid,(state,cloud)->{state.change("profile","avatar",new JSONObject().put("path",path).put("extension",ext),false,cloud);return true;},false);
                if(saved){p.edit().remove("pending").remove("pendingFile").putString("localPath",path).commit();file.delete();message="Avatar envoyé ; synchronisation du profil en cours";}
                else{message="Avatar envoyé ; confirmation locale en attente";retryLater();}
            });return;
        }
        JSONObject record=sync.read((state,cloud)->state.get("profile","avatar"),null);if(record==null)return;
        String op=record.optString("opId");if(record.optBoolean("deleted")){
            if(!op.equals(p.getString("appliedDelete",""))){clearLocal(uid);p.edit().putString("appliedDelete",op).remove("localPath").commit();}
            message="";return;
        }
        JSONObject payload=record.optJSONObject("payload");if(payload==null)return;
        String path=payload.optString("path"),ext=payload.optString("extension");
        if(!path.startsWith("users/"+uid+"/avatars/")||!(ext.equals(".jpg")||ext.equals(".gif")))return;
        if(path.equals(p.getString("localPath",""))&&local(uid,ext).isFile()){message="Avatar disponible dans le cloud";return;}
        if(path.equals(downloading))return;downloading=path;
        try{
            File temp=File.createTempFile("audify-avatar-",".download",app.getCacheDir());
            FirebaseStorage.getInstance().getReference().child(path).getMetadata().addOnCompleteListener(metadata->{
                if(!uid.equals(sync.uid())){temp.delete();return;}
                if(!metadata.isSuccessful()||metadata.getResult().getSizeBytes()>10L*1024*1024){downloading="";message="Avatar cloud indisponible ou trop volumineux";temp.delete();retryLater();return;}
                FirebaseStorage.getInstance().getReference().child(path).getFile(temp).addOnCompleteListener(download->{
                    if(!uid.equals(sync.uid())){temp.delete();return;}downloading="";
                    JSONObject current=sync.read((state,cloud)->state.get("profile","avatar"),null);
                    if(!download.isSuccessful()||current==null||!op.equals(current.optString("opId"))||!p.getString("pending","").isEmpty()){temp.delete();retryLater();return;}
                    try{
                        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(temp.getAbsolutePath(),bounds);
                        if(temp.length()>10L*1024*1024||bounds.outWidth<=0||bounds.outHeight<=0||bounds.outWidth>2048||bounds.outHeight>2048)throw new IOException();
                        File target=local(uid,ext);if(!temp.renameTo(target))throw new IOException();
                        File other=local(uid,ext.equals(".gif")?".jpg":".gif");AudifyProfileMedia.clearSafe(other);other.delete();AudifyProfileMedia.markSafe(target);
                        p.edit().putString("localPath",path).commit();message="Avatar disponible dans le cloud";
                    }catch(Exception invalid){message="Avatar cloud illisible ; sélectionne une autre image.";}finally{temp.delete();}
                });
            });
        }catch(Exception e){downloading="";message="Téléchargement de l’avatar impossible";retryLater();}
    }
    private void clearLocal(String uid){for(String ext:new String[]{".gif",".jpg"}){File file=local(uid,ext);AudifyProfileMedia.clearSafe(file);file.delete();}}
}
