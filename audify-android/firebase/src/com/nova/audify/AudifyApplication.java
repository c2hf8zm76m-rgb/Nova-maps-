package com.nova.audify;
import android.app.Application;

/** Starts account-scoped services without requiring a network connection. */
public final class AudifyApplication extends Application {
    @Override public void onCreate(){
        super.onCreate();
        AudifyFirebaseSync.get(this);
        AudifyFirebaseAvatar.get(this);
    }
}
