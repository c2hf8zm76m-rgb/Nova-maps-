package com.nova.audify;
import android.app.Activity;
public final class AudifyAlbumIdentifier {
    private AudifyAlbumIdentifier() {}
    public static void attach(Activity activity) { AudifyInstantAlbums.attach(activity); }
}
