package com.nova.audify;

/** Runs as both a plain Java check and a JUnit wrapper in the Android build. */
public final class AudifyStartupStateTest {
    private static int checks;
    private static void expect(boolean ok,String name){checks++;if(!ok)throw new AssertionError(name);}
    private static AudifyStartupState guest(){AudifyStartupState s=new AudifyStartupState();s.libraryLoaded(false);return s;}
    public static void main(String[] args){
        AudifyStartupState s=new AudifyStartupState();
        expect(s.stage()==AudifyStartupState.Stage.LIBRARY,"starts with real local work");
        expect(!s.canBuildHome(),"not ready because time passed");
        expect(!s.canContinueOffline(),"no offline bypass before local load");
        s.libraryLoaded(true);
        expect(s.stage()==AudifyStartupState.Stage.ACCOUNT,"signed-in account requires server");
        s.accountConfirmed(false,0,0);expect(!s.canBuildHome(),"cache alone is not cloud success");
        s.accountConfirmed(true,9,0);expect(!s.canBuildHome(),"unsent outbox blocks success");
        s.accountConfirmed(true,0,1);expect(!s.canBuildHome(),"in-flight write blocks success");
        s.accountConfirmed(true,0,0);expect(s.canBuildHome(),"confirmed and drained");
        s.homeMounted();expect(!s.isReady(),"needs first rendered frame");
        int a=s.assetStarted();s.homeDrawn();expect(!s.isReady(),"needs actual artwork result");
        s.assetFinished(a,true);expect(s.isReady(),"all barriers completed");
        s.assetFinished(a,false);expect(s.isReady(),"duplicate callbacks cannot corrupt state");
        s=guest();expect(s.canBuildHome(),"guest skips cloud");s.homeMounted();s.homeDrawn();
        expect(s.isReady(),"empty home is a valid ready screen");
        s=new AudifyStartupState();s.libraryLoaded(true);s.fail("Cloud indisponible");
        expect(!s.isReady(),"timeout is not success");expect(s.canContinueOffline(),"explicit offline available");
        s.continueOffline();s.homeMounted();s.homeDrawn();expect(s.isReady()&&s.isOffline(),"offline is honest and explicit");
        expect(s.status().contains("hors connexion"),"no false synchronization message");
        s=new AudifyStartupState();s.libraryLoaded(true);s.accountConfirmed(true,0,0);s.homeMounted();s.homeDrawn();
        s.accountConfirmed(true,1,1);expect(!s.isReady(),"new write during Home preparation is not ignored");
        expect(s.canContinueOffline(),"offline recovery also works after Home was mounted");s.continueOffline();
        expect(s.isReady(),"explicit offline fallback is not blocked by deferred artwork");
        s=guest();s.homeMounted();a=s.assetStarted();s.homeDrawn();s.assetFinished(a,false);
        expect(!s.isReady(),"failed artwork is not silently ready");
        s.continueWithPlaceholders();expect(s.isReady()&&s.isDegraded(),"user accepts missing visual");
        s=guest();s.homeMounted();a=s.assetStarted();s.homeDrawn();s.continueWithPlaceholders();
        expect(s.isReady(),"explicit fallback can stop waiting on a stuck image");
        s.cancel();s.assetFinished(a,true);s.libraryLoaded(true);s.accountConfirmed(true,0,0);
        expect(!s.isReady()&&s.stage()==AudifyStartupState.Stage.CANCELLED,"stale callbacks cannot finish a destroyed screen");
        System.out.println("Audify startup: "+checks+" readiness checks passed");
    }
}
