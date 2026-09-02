package com.nova.audify;

import java.util.HashSet;
import java.util.Set;

/** Event-driven readiness, independent of Android and of animation duration. */
public final class AudifyStartupState {
    public enum Stage { LIBRARY, ACCOUNT, HOME, READY, ERROR, CANCELLED }
    private boolean local, signedIn, cloud, offline, home, drawn, cancelled, degraded;
    private String problem="";
    private int nextAsset=0;
    private final Set<Integer> assets=new HashSet<>();
    private final Set<Integer> failures=new HashSet<>();

    public void libraryLoaded(boolean needsAccount) { if(cancelled)return;local=true;signedIn=needsAccount; }
    public void accountConfirmed(boolean serverConfirmed,int pending,int inFlight) {
        if(cancelled||!local||offline)return;
        cloud=serverConfirmed&&pending==0&&inFlight==0;
    }
    public void fail(String message) { if(!cancelled)problem=message; }
    public void clearProblem() { if(!cancelled)problem=""; }
    public String problem() { return problem; }
    public boolean canContinueOffline() { return local&&!cloud&&signedIn&&!cancelled; }
    public void continueOffline() {
        if(!canContinueOffline())throw new IllegalStateException("No usable local library");
        offline=true;degraded=true;problem="";
    }
    public boolean canBuildHome() { return local&&(!signedIn||cloud||offline)&&problem.isEmpty()&&!cancelled; }
    public void homeMounted() { if(!canBuildHome())throw new IllegalStateException("Data not ready");home=true; }
    public void homeDrawn() { if(home&&!cancelled)drawn=true; }
    public int assetStarted() { if(cancelled)return -1;int id=++nextAsset;assets.add(id);return id; }
    public void assetFinished(int id,boolean ok) {
        if(cancelled||!assets.remove(id))return;
        if(!ok)failures.add(id);
    }
    public int pendingAssets() { return assets.size(); }
    public int failedAssets() { return failures.size(); }
    public boolean homeMountedAlready() { return home; }
    public void continueWithPlaceholders() { if(!home||cancelled)throw new IllegalStateException();degraded=true;problem=""; }
    public boolean isOffline() { return offline; }
    public boolean isDegraded() { return degraded; }
    public boolean isReady() {
        return canBuildHome()&&home&&drawn&&(degraded||(assets.isEmpty()&&failures.isEmpty()));
    }
    public void cancel() { cancelled=true;assets.clear();failures.clear(); }
    public Stage stage() {
        if(cancelled)return Stage.CANCELLED;
        if(!problem.isEmpty())return Stage.ERROR;
        if(!local)return Stage.LIBRARY;
        if(signedIn&&!cloud&&!offline)return Stage.ACCOUNT;
        return isReady()?Stage.READY:Stage.HOME;
    }
    public String status() {
        switch(stage()) {
            case LIBRARY:return "Audify prépare votre bibliothèque";
            case ACCOUNT:return "Audify synchronise votre compte";
            case HOME:return "Audify prépare votre accueil";
            case READY:return offline?"Audify est prêt hors connexion":degraded?"Audify est prêt · visuels différés":"Audify est prêt";
            case ERROR:return problem;
            default:return "";
        }
    }
}
