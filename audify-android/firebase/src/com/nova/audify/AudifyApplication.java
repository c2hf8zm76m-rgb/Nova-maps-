package com.nova.audify;
import android.app.Application;

/** Starts account-scoped services without requiring a network connection. */
public final class AudifyApplication extends Application {
    @Override public void onCreate(){
        super.onCreate();
        // The launcher paints its first frame before warming the per-user store.
        // Other entry points keep using the same lazy, application-scoped services.
    }
}
