package com.nova.audify;
import android.app.Activity;
import androidx.core.content.ContextCompat;
import androidx.credentials.*;
import androidx.credentials.exceptions.*;
import com.google.android.libraries.identity.googleid.*;

public final class AudifyGoogleSignIn {
    public static void start(Activity activity,AudifyAccountStore.Callback callback){
        int resource=activity.getResources().getIdentifier("default_web_client_id","string",activity.getPackageName());
        String client=resource==0?"":activity.getString(resource);
        if(client.isEmpty()){callback.done(AudifyAccountStore.Result.error("La connexion Google doit encore être configurée pour Audify. Tu peux utiliser l’e-mail."));return;}
        try{
            GetGoogleIdOption option=new GetGoogleIdOption.Builder().setFilterByAuthorizedAccounts(false).setServerClientId(client).setAutoSelectEnabled(false).build();
            GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
            CredentialManager.create(activity).getCredentialAsync(activity,request,null,ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
                    @Override public void onResult(GetCredentialResponse response){
                        Credential credential=response.getCredential();
                        if(!(credential instanceof CustomCredential)||!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())){
                            callback.done(AudifyAccountStore.Result.error("Identité Google indisponible."));return;
                        }
                        try{GoogleIdTokenCredential google=GoogleIdTokenCredential.createFrom(credential.getData());
                            new AudifyAccountStore(activity).signInWithGoogleToken(google.getIdToken(),callback);
                        }catch(Exception e){callback.done(AudifyAccountStore.Result.error("Impossible de vérifier la réponse Google."));}
                    }
                    @Override public void onError(GetCredentialException error){callback.done(AudifyAccountStore.Result.error(error instanceof GetCredentialCancellationException?"Connexion Google annulée.":"Connexion Google indisponible. Vérifie le réseau et la configuration de l’application."));}
                });
        }catch(Exception e){callback.done(AudifyAccountStore.Result.error("Connexion Google indisponible sur cet appareil."));}
    }
    public static void clear(Activity activity){
        try{CredentialManager.create(activity).clearCredentialStateAsync(new ClearCredentialStateRequest(),null,ContextCompat.getMainExecutor(activity),new CredentialManagerCallback<Void,ClearCredentialException>(){
            @Override public void onResult(Void result){}
            @Override public void onError(ClearCredentialException error){}
        });}catch(Exception ignored){}
    }
}
