package com.nova.audify;

import android.content.Context;
import android.util.Patterns;
import com.google.firebase.auth.*;
import java.util.Locale;

/** Firebase is the authority for account identity; legacy local password records are untouched. */
public final class AudifyAccountStore {
    public interface Callback { void done(Result result); }
    public static final class Result {
        public final boolean ok;
        public final String message;
        private Result(boolean ok, String message) { this.ok=ok; this.message=message; }
        public static Result ok(String m) { return new Result(true,m); }
        public static Result error(String m) { return new Result(false,m); }
    }
    private final Context app;
    public AudifyAccountStore(Context context) { app=context.getApplicationContext(); }
    private FirebaseAuth auth() { return FirebaseAuth.getInstance(); }
    private FirebaseUser user() { try { return auth().getCurrentUser(); } catch (Exception e) { return null; } }
    public boolean isSignedIn() { return user()!=null; }
    public String getCurrentUid() { FirebaseUser u=user(); return u==null?"":u.getUid(); }
    public String getCurrentEmail() { FirebaseUser u=user(); return u==null||u.getEmail()==null?"":u.getEmail(); }
    public String getCurrentDisplayName() { FirebaseUser u=user(); return u==null||u.getDisplayName()==null?"":u.getDisplayName(); }
    public String getCurrentPhotoUrl() { FirebaseUser u=user(); return u==null||u.getPhotoUrl()==null?"":u.getPhotoUrl().toString(); }
    public long getCreatedAt() { FirebaseUser u=user(); return u==null||u.getMetadata()==null?0:u.getMetadata().getCreationTimestamp(); }
    public boolean isEmailVerified() { FirebaseUser u=user(); return u!=null&&u.isEmailVerified(); }
    public String getCurrentProvider() {
        FirebaseUser u=user();
        if(u!=null) for(UserInfo info:u.getProviderData()) if("google.com".equals(info.getProviderId())) return "google";
        return "email";
    }
    private String email(String value) { return value==null?"":value.trim().toLowerCase(Locale.ROOT); }
    public void createAccount(String raw, String password, Callback callback) {
        String address=email(raw);
        if(!Patterns.EMAIL_ADDRESS.matcher(address).matches()) { callback.done(Result.error("Entre une adresse e-mail valide."));return; }
        if(password==null||password.length()<8) { callback.done(Result.error("Le mot de passe doit contenir au moins 8 caractères."));return; }
        try { auth().createUserWithEmailAndPassword(address,password).addOnCompleteListener(task->{
            if(!task.isSuccessful()) { callback.done(Result.error(message(task.getException())));return; }
            FirebaseUser current=task.getResult().getUser();
            if(current!=null) current.sendEmailVerification().addOnCompleteListener(sent->callback.done(Result.ok(sent.isSuccessful()
                ?"Compte créé. Vérifie ton adresse grâce à l’e-mail reçu.":"Compte créé. Tu peux renvoyer l’e-mail de vérification depuis ton profil.")));
            else callback.done(Result.error("La session n’a pas pu être ouverte."));
        }); } catch(Exception e) { callback.done(Result.error(message(e))); }
    }
    public void signIn(String raw, String password, Callback callback) {
        if(email(raw).isEmpty()||password==null||password.isEmpty()) {callback.done(Result.error("Entre ton e-mail et ton mot de passe."));return;}
        try { auth().signInWithEmailAndPassword(email(raw),password).addOnCompleteListener(task->callback.done(task.isSuccessful()
            ?Result.ok("Connexion réussie."):Result.error(message(task.getException())))); }
        catch(Exception e) {callback.done(Result.error(message(e)));}
    }
    public void signInWithGoogleToken(String token, Callback callback) {
        if(token==null||token.isEmpty()) { callback.done(Result.error("Google n’a pas fourni d’identité vérifiable."));return; }
        try {auth().signInWithCredential(GoogleAuthProvider.getCredential(token,null)).addOnCompleteListener(task->callback.done(task.isSuccessful()
            ?Result.ok("Compte Google connecté."):Result.error(message(task.getException()))));}
        catch(Exception e){callback.done(Result.error(message(e)));}
    }
    public void resetPassword(String raw, Callback callback) {
        String address=email(raw);
        if(!Patterns.EMAIL_ADDRESS.matcher(address).matches()) {callback.done(Result.error("Renseigne d’abord ton adresse e-mail."));return;}
        try {auth().sendPasswordResetEmail(address).addOnCompleteListener(task->callback.done(task.isSuccessful()
            ?Result.ok("Si un compte correspond à cette adresse, tu recevras un e-mail de réinitialisation.")
            :Result.error(message(task.getException()))));}catch(Exception e){callback.done(Result.error(message(e)));}
    }
    public void verifyEmail(Callback callback) {
        FirebaseUser u=user(); if(u==null)return;
        try{u.sendEmailVerification().addOnCompleteListener(task->callback.done(task.isSuccessful()?Result.ok("E-mail de vérification envoyé."):Result.error(message(task.getException()))));}catch(Exception e){callback.done(Result.error(message(e)));}
    }
    public void refresh(Callback callback) {
        FirebaseUser u=user(); if(u==null){callback.done(Result.error("Reconnecte-toi à ton compte."));return;}
        u.reload().addOnCompleteListener(task->{
            if(task.isSuccessful()) callback.done(Result.ok(isEmailVerified()?"Adresse vérifiée.":"L’adresse n’est pas encore vérifiée."));
            else callback.done(Result.error(message(task.getException())));
        });
    }
    public void signOut() { auth().signOut(); AudifyFirebaseSync.get(app).refreshSession(); }
    public static String message(Exception e) {
        if(e instanceof com.google.firebase.FirebaseNetworkException) return "Connexion Internet indisponible. Réessaie lorsque le réseau revient.";
        if(e instanceof com.google.firebase.FirebaseTooManyRequestsException) return "Trop de tentatives. Patiente puis réessaie.";
        String code=e instanceof FirebaseAuthException?((FirebaseAuthException)e).getErrorCode():"";
        switch(code) {
            case "ERROR_EMAIL_ALREADY_IN_USE": return "Cette adresse possède déjà un compte. Connecte-toi ou utilise Mot de passe oublié.";
            case "ERROR_OPERATION_NOT_ALLOWED": case "ERROR_CONFIG_NOT_FOUND": return "Ce mode de connexion n’est pas encore activé pour Audify.";
            case "ERROR_INVALID_EMAIL": return "L’adresse e-mail est invalide.";
            case "ERROR_WEAK_PASSWORD": return "Choisis un mot de passe plus robuste (au moins 8 caractères).";
            case "ERROR_USER_DISABLED": return "Ce compte est désactivé.";
            case "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL": return "Cette adresse utilise déjà un autre mode de connexion.";
            case "ERROR_USER_NOT_FOUND": case "ERROR_WRONG_PASSWORD": case "ERROR_INVALID_CREDENTIAL": return "E-mail ou mot de passe incorrect. Les anciens comptes locaux doivent être créés dans le cloud.";
            default:return "Connexion impossible pour le moment. Vérifie le réseau et réessaie.";
        }
    }
}
