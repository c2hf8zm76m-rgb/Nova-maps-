package com.nova.audify;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.widget.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Owns one overlay over the real Home, from first frame to ready/fade. */
public final class AudifyStartupController {
    private final Activity activity;
    private final Runnable buildHome,afterReveal;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AudifyStartupState state=new AudifyStartupState();
    private final FrameLayout host;
    private final Overlay overlay;
    private final Runnable syncChanged=this::checkAccount;
    private AudifyFirebaseSync sync;
    private AudifyFirebaseAvatar avatar;
    private String owner="";
    private long checkpoint;
    private boolean alive=true,active=false,building=false,finishing=false,revealed=false,greenComplete=false;
    private boolean accountPollScheduled;
    private View home;
    private ViewTreeObserver.OnDrawListener drawListener;

    public AudifyStartupController(Activity activity,Runnable buildHome,Runnable afterReveal){
        this.activity=activity;this.buildHome=buildHome;this.afterReveal=afterReveal;
        host=new FrameLayout(activity);host.setBackgroundColor(Color.rgb(5,8,12));
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(activity.getWindow(),false);
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(host,(view,insets)->{
            androidx.core.graphics.Insets bars=insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars()|androidx.core.view.WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;
        });
        overlay=new Overlay(activity);host.addView(overlay,new FrameLayout.LayoutParams(-1,-1));
        activity.setContentView(host);
        androidx.core.view.ViewCompat.requestApplyInsets(host);
        overlay.retry.setOnClickListener(v->activity.recreate());
        overlay.continueButton.setOnClickListener(v->{
            if(!alive)return;
            if(state.canContinueOffline()){state.continueOffline();check();}
            else if(state.homeMountedAlready()){state.continueWithPlaceholders();check();}
        });
        overlay.status.setText(state.status());
        // Scheduling only yields a frame. No timer is used to claim work completed.
        overlay.postOnAnimation(()->overlay.post(this::prepareLibrary));
    }
    private boolean valid(){return alive&&!activity.isFinishing()&&!activity.isDestroyed();}
    public boolean isRevealed(){return revealed;}
    public boolean isPreparing(){return alive&&!revealed;}
    public boolean isOffline(){return state.isOffline();}
    public boolean isDegraded(){return state.isDegraded();}
    private void prepareLibrary(){
        if(!valid())return;
        worker.execute(()->{
            try{
                AudifyFirebaseSync service=AudifyFirebaseSync.get(activity.getApplicationContext());
                String uid=service.uid();
                AudifyLibraryStore library=new AudifyLibraryStore(activity.getApplicationContext());
                library.getLikes();library.getRecents();library.getPlaylistNames();
                AudifyFirebaseSync.StartupSnapshot local=service.startupSnapshot(0);
                main.post(()->{
                    if(!valid())return;
                    sync=service;owner=uid;
                    if(!uid.equals(local.uid)||!uid.equals(sync.uid())){activity.recreate();return;}
                    if(!local.localHealthy||!local.error.isEmpty()&&uid.isEmpty()){
                        showError("Audify ne peut pas lire votre bibliothèque. Vos données sont conservées.");return;
                    }
                    state.libraryLoaded(!uid.isEmpty());
                    sync.addListener(syncChanged);
                    if(!uid.isEmpty()){
                        avatar=AudifyFirebaseAvatar.get(activity.getApplicationContext());
                        checkpoint=sync.requestStartupCheckpoint();
                        main.postDelayed(()->{
                            if(valid()&&!finishing&&state.stage()==AudifyStartupState.Stage.ACCOUNT)
                                showError("La synchronisation prend du temps. Votre bibliothèque locale reste disponible.");
                        },15000);
                    }
                    checkAccount();
                });
            }catch(Exception|LinkageError error){main.post(()->{if(valid())showError("Audify n’a pas pu préparer votre bibliothèque. Vos données sont conservées.");});}
        });
    }
    private void checkAccount(){
        if(!valid()||sync==null||revealed)return;
        AudifyFirebaseSync.StartupSnapshot snap=sync.startupSnapshot(checkpoint);
        if(!owner.equals(snap.uid)){activity.recreate();return;}
        if(finishing)return;
        if(!state.isOffline()&&!owner.isEmpty()){
            boolean avatarReady=avatar==null||avatar.readyForStartup();
            state.accountConfirmed(snap.serverConfirmed&&avatarReady,snap.pending,snap.inFlight);
            if(!snap.error.isEmpty()){showError(snap.error);return;}
            // A later real server confirmation may recover a slow-connection error.
            if(snap.serverConfirmed&&avatarReady&&snap.pending==0&&snap.inFlight==0)state.clearProblem();
            if(!state.canBuildHome()&&!accountPollScheduled){
                accountPollScheduled=true;
                main.postDelayed(()->{accountPollScheduled=false;if(valid())checkAccount();},400);
            }
        }
        check();
    }
    private void check(){
        if(!valid()||revealed||finishing)return;
        updateText();
        if(state.canBuildHome()&&!state.homeMountedAlready()&&!building){
            building=true;
            // Let the real HOME state be drawn before inflating and binding the UI.
            overlay.postOnAnimation(()->overlay.post(()->{
                if(!valid())return;
                try{
                    buildHome.run();
                    if(home==null)throw new IllegalStateException("Home was not mounted");
                    state.homeMounted();observeHomeDraw();
                    main.postDelayed(()->{
                        if(valid()&&!finishing&&!state.isReady())
                            showError(state.stage()==AudifyStartupState.Stage.ACCOUNT?"Le compte attend encore le cloud. Votre bibliothèque locale reste disponible.":"Certains visuels ne sont pas disponibles. Vous pouvez ouvrir l’accueil avec des visuels de remplacement.");
                    },18000);
                    check();
                }catch(Exception|LinkageError failure){showError("Audify n’a pas pu préparer l’accueil. Vos données sont conservées.");}
                finally{building=false;}
            }));
            return;
        }
        if(state.homeMountedAlready()&&state.pendingAssets()==0&&state.failedAssets()>0&&state.problem().isEmpty()&&!state.isDegraded()){
            showError("Certains visuels n’ont pas pu être chargés. Votre bibliothèque est disponible.");return;
        }
        if(state.isReady()&&active)finish();
    }
    public void mountHome(View root){
        home=root;
        root.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        host.addView(root,0,new FrameLayout.LayoutParams(-1,-1));
        overlay.bringToFront();
    }
    private void observeHomeDraw(){
        drawListener=()->{
            if(!valid()||home.getWidth()==0||home.getHeight()==0)return;
            home.post(()->{
                if(!valid())return;
                removeDrawListener();state.homeDrawn();check();
            });
        };
        home.getViewTreeObserver().addOnDrawListener(drawListener);home.invalidate();
    }
    private void removeDrawListener(){
        if(home!=null&&drawListener!=null&&home.getViewTreeObserver().isAlive())home.getViewTreeObserver().removeOnDrawListener(drawListener);
        drawListener=null;
    }
    public int assetStarted(){return isPreparing()&&!finishing?state.assetStarted():-1;}
    public void assetFinished(int ticket,boolean ok){
        if(ticket<0)return;
        if(Looper.myLooper()!=Looper.getMainLooper()){main.post(()->assetFinished(ticket,ok));return;}
        if(!valid()||revealed)return;
        state.assetFinished(ticket,ok);check();
    }
    public boolean deferOptionalRefresh(){return isPreparing();}
    public void homeFailure(Throwable ignored){showError("Audify n’a pas pu préparer l’accueil. Vos données sont conservées.");}
    private void showError(String message){if(!valid()||finishing)return;state.fail(message);updateText();}
    private void updateText(){
        String text=state.status();
        if(!text.contentEquals(overlay.status.getText()))overlay.status.setText(text);
        boolean error=state.stage()==AudifyStartupState.Stage.ERROR;
        overlay.retry.setVisibility(error?View.VISIBLE:View.GONE);
        boolean offline=state.canContinueOffline(),partial=state.homeMountedAlready();
        overlay.continueButton.setText(offline?"Continuer hors connexion":"Ouvrir avec les visuels disponibles");
        overlay.continueButton.setVisibility(error&&(offline||partial)?View.VISIBLE:View.GONE);
        overlay.detail.setText(state.isOffline()?"Compte non synchronisé · données de cet appareil":state.isDegraded()?"Les visuels manquants pourront se charger ensuite":"");
        overlay.detail.setVisibility(overlay.detail.getText().length()>0?View.VISIBLE:View.GONE);
        overlay.logo.setRunning(active&&!error);
    }
    private void finish(){
        if(finishing||!state.isReady())return;
        finishing=true;main.removeCallbacksAndMessages(null);removeDrawListener();
        updateText();
        overlay.logo.ready(()->{
            if(!valid())return;
            greenComplete=true;fade();
        });
    }
    private void fade(){
        if(!valid()||!active||!greenComplete)return;
        if(!AudifyChromaLogoView.motionEnabled(activity)){reveal();return;}
        overlay.animate().alpha(0f).setDuration(300).withEndAction(this::reveal).start();
    }
    private void reveal(){
        if(!valid())return;
        if(!active){overlay.setAlpha(1f);return;}
        if(!owner.equals(sync.uid())){activity.recreate();return;}
        revealed=true;overlay.logo.dispose();host.removeView(overlay);
        home.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
        sync.removeListener(syncChanged);afterReveal.run();
        if(state.isOffline()||state.isDegraded())Toast.makeText(activity,state.status(),Toast.LENGTH_LONG).show();
    }
    public void onStart(){
        active=true;if(!revealed){overlay.logo.setRunning(state.stage()!=AudifyStartupState.Stage.ERROR);
            if(finishing&&greenComplete)fade();
            else check();}
    }
    public void onStop(){active=false;overlay.logo.setRunning(false);overlay.animate().cancel();overlay.setAlpha(1f);}
    public void dispose(){
        alive=false;state.cancel();main.removeCallbacksAndMessages(null);removeDrawListener();
        if(sync!=null)sync.removeListener(syncChanged);worker.shutdownNow();
        overlay.animate().cancel();overlay.logo.dispose();
    }

    private static final class Overlay extends FrameLayout {
        final AudifyChromaLogoView logo;
        final LinearLayout messages;
        final TextView status,detail;
        final Button retry,continueButton;
        Overlay(Context context){
            super(context);setBackgroundColor(Color.rgb(5,8,12));setClickable(true);setFocusable(true);
            setElevation(dp(100));
            logo=new AudifyChromaLogoView(context);addView(logo,new FrameLayout.LayoutParams(dp(192),dp(192),Gravity.CENTER));
            messages=new LinearLayout(context);messages.setOrientation(LinearLayout.VERTICAL);messages.setGravity(Gravity.CENTER);
            messages.setPadding(dp(24),0,dp(24),dp(16));
            status=new TextView(context);status.setTextColor(0xFFDCE5EC);status.setTextSize(16);status.setGravity(Gravity.CENTER);
            status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
            status.setLineSpacing(dp(3),1f);messages.addView(status,new LinearLayout.LayoutParams(-1,-2));
            detail=new TextView(context);detail.setTextSize(13);detail.setTextColor(0xFFAAB8C4);detail.setGravity(Gravity.CENTER);detail.setPadding(0,dp(12),0,0);detail.setVisibility(GONE);messages.addView(detail,new LinearLayout.LayoutParams(-1,-2));
            retry=button(context,"Réessayer",true);continueButton=button(context,"Continuer hors connexion",false);
            LinearLayout.LayoutParams buttonLp=new LinearLayout.LayoutParams(-1,-2);buttonLp.topMargin=dp(18);
            messages.addView(retry,buttonLp);
            LinearLayout.LayoutParams otherLp=new LinearLayout.LayoutParams(-1,-2);otherLp.topMargin=dp(8);messages.addView(continueButton,otherLp);
            ScrollView scroll=new ScrollView(context);scroll.setFillViewport(false);scroll.setVerticalScrollBarEnabled(false);scroll.addView(messages);scroll.setTag("status");addView(scroll,new FrameLayout.LayoutParams(-1,-2));
        }
        private Button button(Context context,String label,boolean primary){
            Button b=new Button(context);b.setText(label);b.setAllCaps(false);b.setTextSize(14);b.setMinHeight(dp(48));b.setPadding(dp(16),dp(8),dp(16),dp(8));
            b.setTextColor(primary?0xFF081005:0xFFDCE5EC);
            GradientDrawable bg=new GradientDrawable();bg.setColor(primary?AudifyChromaLogoView.GREEN:0xFF18212A);bg.setCornerRadius(dp(24));b.setBackground(bg);b.setVisibility(GONE);return b;
        }
        @Override protected void onMeasure(int ws,int hs){
            int h=MeasureSpec.getSize(hs),w=MeasureSpec.getSize(ws);
            int size=Math.min(dp(192),Math.min(w-dp(48),Math.max(dp(96),(int)(h*.34f))));
            ViewGroup.LayoutParams lp=logo.getLayoutParams();lp.width=size;lp.height=size;
            FrameLayout.LayoutParams messageLp=(FrameLayout.LayoutParams)getChildAt(1).getLayoutParams();
            // Keep the brand centered on normal phones, reserve space on landscape/font-scale layouts.
            int center=h>=dp(560)?h/2:(int)(h*.34f);
            ((FrameLayout.LayoutParams)lp).gravity=Gravity.TOP|Gravity.CENTER_HORIZONTAL;
            ((FrameLayout.LayoutParams)lp).topMargin=Math.max(dp(8),center-size/2);
            messageLp.topMargin=center+size/2+dp(16);messageLp.height=Math.max(dp(48),h-messageLp.topMargin);
            messageLp.width=Math.min(w,dp(420));messageLp.gravity=Gravity.TOP|Gravity.CENTER_HORIZONTAL;
            super.onMeasure(ws,hs);
        }
        private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    }
}
