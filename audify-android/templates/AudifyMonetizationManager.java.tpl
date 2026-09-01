package com.nova.audify;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public final class AudifyMonetizationManager implements PurchasesUpdatedListener {
    private static final String PREFS="audify_monetization";
    private static final String KEY_PREMIUM="premium_lifetime";
    private static final String KEY_LAST_SEARCH_AD="last_search_interstitial";
    private static final long SEARCH_COOLDOWN_MS=10L*60L*1000L;

    private static final String INTERSTITIAL_ID="__INTERSTITIAL__";
    private static final String NATIVE_ID="__NATIVE__";
    private static final String REWARDED_KARAOKE_ID="__KARAOKE__";
    private static final String REWARDED_PLAYLIST_ID="__PLAYLIST__";
    private static final String PREMIUM_PRODUCT_ID="__PREMIUM__";

    private static AudifyMonetizationManager instance;
    private final Context app;
    private final SharedPreferences prefs;
    private BillingClient billingClient;
    private ProductDetails premiumDetails;
    private boolean billingReady=false;

    // V68.12.27 — Search ne dépend plus d'un chargement réseau au moment du clic.
    // Une interstitielle est préparée en arrière-plan et consommée uniquement si
    // elle est déjà prête. Sinon la navigation continue immédiatement.
    private InterstitialAd searchInterstitial;
    private boolean searchInterstitialLoading=false;

    public static synchronized AudifyMonetizationManager get(Context c){
        if(instance==null) instance=new AudifyMonetizationManager(c.getApplicationContext());
        return instance;
    }

    public static boolean isPremiumStatic(Context c){
        return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean(KEY_PREMIUM,false);
    }

    private AudifyMonetizationManager(Context c){
        app=c;
        prefs=app.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        initBilling();
        preloadSearchInterstitial();
    }

    public boolean isPremium(){ return prefs.getBoolean(KEY_PREMIUM,false); }

    /**
     * Ouvre Search de manière fail-open : aucune panne, lenteur ou absence de
     * réponse AdMob ne peut retenir l'utilisateur sur le Home.
     */
    public void showSearchInterstitial(Activity activity,Runnable after){
        if(activity==null){ runSearchAfter(null,after); return; }
        if(isPremium()){
            runSearchAfter(activity,after);
            return;
        }

        long last=prefs.getLong(KEY_LAST_SEARCH_AD,0L);
        if(System.currentTimeMillis()-last<SEARCH_COOLDOWN_MS){
            runSearchAfter(activity,after);
            preloadSearchInterstitial();
            return;
        }

        final InterstitialAd ready;
        synchronized(this){
            ready=searchInterstitial;
            searchInterstitial=null;
        }

        // Le point essentiel de V68.12.27 : on ne lance JAMAIS un load bloquant
        // depuis le clic. Si aucune pub n'est prête, Search s'ouvre tout de suite.
        if(ready==null){
            runSearchAfter(activity,after);
            preloadSearchInterstitial();
            return;
        }

        AtomicBoolean completed=new AtomicBoolean(false);
        Runnable finish=()->{
            if(!completed.compareAndSet(false,true)) return;
            runSearchAfter(activity,after);
            preloadSearchInterstitial();
        };

        ready.setFullScreenContentCallback(new com.google.android.gms.ads.FullScreenContentCallback(){
            @Override public void onAdDismissedFullScreenContent(){ finish.run(); }
            @Override public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError e){ finish.run(); }
        });

        try{
            prefs.edit().putLong(KEY_LAST_SEARCH_AD,System.currentTimeMillis()).apply();
            ready.show(activity);
        }catch(Throwable ignored){
            finish.run();
        }
    }

    private void preloadSearchInterstitial(){
        if(isPremium()) return;
        synchronized(this){
            if(searchInterstitial!=null||searchInterstitialLoading) return;
            searchInterstitialLoading=true;
        }
        try{
            InterstitialAd.load(app,INTERSTITIAL_ID,new AdRequest.Builder().build(),new InterstitialAdLoadCallback(){
                @Override public void onAdLoaded(InterstitialAd ad){
                    synchronized(AudifyMonetizationManager.this){
                        searchInterstitial=ad;
                        searchInterstitialLoading=false;
                    }
                }
                @Override public void onAdFailedToLoad(LoadAdError e){
                    synchronized(AudifyMonetizationManager.this){
                        searchInterstitial=null;
                        searchInterstitialLoading=false;
                    }
                }
            });
        }catch(Throwable ignored){
            synchronized(this){
                searchInterstitial=null;
                searchInterstitialLoading=false;
            }
        }
    }

    private void runSearchAfter(Activity activity,Runnable after){
        if(after==null) return;
        if(activity==null){
            try{ after.run(); }catch(Throwable ignored){}
            return;
        }
        try{
            activity.runOnUiThread(()->{
                try{
                    View decor=activity.getWindow()==null?null:activity.getWindow().getDecorView();
                    if(decor!=null) decor.post(()->{ try{ after.run(); }catch(Throwable ignored){} });
                    else after.run();
                }catch(Throwable ignored){
                    try{ after.run(); }catch(Throwable ignored2){}
                }
            });
        }catch(Throwable ignored){
            try{ after.run(); }catch(Throwable ignored2){}
        }
    }

    // V68.12.33 — Karaoke est une fonctionnalité gratuite pour tous.
    // On conserve la signature historique pour compatibilité avec le Player,
    // mais aucun SDK publicitaire n'est appelé sur ce chemin.
    public void askRewardedKaraoke(Activity activity,Runnable reward){
        if(activity==null) return;
        if(reward!=null) reward.run();
    }

    public void askRewardedPlaylist(Activity activity,Runnable reward){
        askRewarded(activity,"Créer une playlist","Regarde une publicité complète pour créer cette nouvelle playlist.",REWARDED_PLAYLIST_ID,reward);
    }

    private void askRewarded(Activity activity,String title,String message,String id,Runnable reward){
        if(activity==null) return;
        if(isPremium()){ if(reward!=null) reward.run(); return; }
        new AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Regarder la publicité",(d,w)->loadRewarded(activity,id,reward))
            .setNegativeButton("Annuler",null)
            .show();
    }

    private void loadRewarded(Activity activity,String id,Runnable reward){
        Toast.makeText(activity,"Chargement de la publicité…",Toast.LENGTH_SHORT).show();
        RewardedAd.load(activity,id,new AdRequest.Builder().build(),new RewardedAdLoadCallback(){
            @Override public void onAdLoaded(RewardedAd ad){
                ad.show(activity,item->{ if(reward!=null) reward.run(); });
            }
            @Override public void onAdFailedToLoad(LoadAdError e){
                Toast.makeText(activity,"Publicité indisponible pour le moment",Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void insertNativeSearchAd(Activity activity,LinearLayout parent){
        if(activity==null||parent==null||isPremium()) return;
        new AdLoader.Builder(activity,NATIVE_ID)
            .forNativeAd(ad->activity.runOnUiThread(()->{
                if(activity.isFinishing()||activity.isDestroyed()){ ad.destroy(); return; }
                NativeAdView view=buildNativeCard(activity,ad);
                int index=Math.min(2,parent.getChildCount());
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(activity,104));
                lp.bottomMargin=dp(activity,10);
                parent.addView(view,index,lp);
            }))
            .build()
            .loadAd(new AdRequest.Builder().build());
    }

    private NativeAdView buildNativeCard(Activity a,NativeAd ad){
        NativeAdView root=new NativeAdView(a);
        root.setPadding(dp(a,11),dp(a,9),dp(a,10),dp(a,9));
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(Color.rgb(28,34,42)); bg.setCornerRadius(dp(a,22)); bg.setStroke(dp(a,1),Color.rgb(82,93,107)); root.setBackground(bg);

        LinearLayout row=new LinearLayout(a); row.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(row,new NativeAdView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        ImageView icon=new ImageView(a); icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        row.addView(icon,new LinearLayout.LayoutParams(dp(a,72),dp(a,72)));
        root.setIconView(icon);
        if(ad.getIcon()!=null) icon.setImageDrawable(ad.getIcon().getDrawable()); else icon.setVisibility(View.GONE);

        LinearLayout info=new LinearLayout(a); info.setOrientation(LinearLayout.VERTICAL); info.setPadding(dp(a,11),0,dp(a,8),0);
        TextView sponsored=text(a,"PUBLICITÉ",10.5f,true,Color.rgb(168,255,63));
        TextView headline=text(a,ad.getHeadline()==null?"Annonce":ad.getHeadline(),15f,true,Color.WHITE);
        headline.setMaxLines(2);
        TextView body=text(a,ad.getBody()==null?"":ad.getBody(),12f,false,Color.rgb(183,192,204));
        body.setMaxLines(1);
        info.addView(sponsored,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,20)));
        info.addView(headline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,40)));
        info.addView(body,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(a,22)));
        row.addView(info,new LinearLayout.LayoutParams(0,dp(a,82),1f));
        root.setHeadlineView(headline); root.setBodyView(body);

        Button cta=new Button(a); cta.setAllCaps(false); cta.setText(ad.getCallToAction()==null?"Voir":ad.getCallToAction());
        cta.setTextSize(12f); cta.setTypeface(Typeface.DEFAULT,Typeface.BOLD); cta.setTextColor(Color.rgb(8,18,7));
        GradientDrawable ctaBg=new GradientDrawable(); ctaBg.setColor(Color.rgb(168,255,63)); ctaBg.setCornerRadius(dp(a,16)); cta.setBackground(ctaBg);
        row.addView(cta,new LinearLayout.LayoutParams(dp(a,84),dp(a,42)));
        root.setCallToActionView(cta);
        root.setNativeAd(ad);
        return root;
    }

    private void initBilling(){
        billingClient=BillingClient.newBuilder(app).setListener(this).enablePendingPurchases().build();
        billingClient.startConnection(new BillingClientStateListener(){
            @Override public void onBillingSetupFinished(BillingResult result){
                billingReady=result.getResponseCode()==BillingClient.BillingResponseCode.OK;
                if(billingReady){ queryPremiumProduct(); restorePurchases(); }
            }
            @Override public void onBillingServiceDisconnected(){ billingReady=false; }
        });
    }

    private void queryPremiumProduct(){
        QueryProductDetailsParams.Product product=QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PREMIUM_PRODUCT_ID).setProductType(BillingClient.ProductType.INAPP).build();
        QueryProductDetailsParams params=QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(product)).build();
        billingClient.queryProductDetailsAsync(params,(result,list)->{
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK && list!=null && !list.isEmpty()) premiumDetails=list.get(0);
        });
    }

    private void restorePurchases(){
        QueryPurchasesParams p=QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        billingClient.queryPurchasesAsync(p,(result,list)->{
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK||list==null) return;
            for(Purchase purchase:list) handlePurchase(purchase);
        });
    }

    public void launchPremiumPurchase(Activity activity){
        if(activity==null) return;
        if(isPremium()){ Toast.makeText(activity,"Audify Premium est déjà actif",Toast.LENGTH_SHORT).show(); return; }
        if(!billingReady||premiumDetails==null){
            Toast.makeText(activity,"Premium sera disponible dès que le produit sera connecté au Play Store.",Toast.LENGTH_LONG).show();
            return;
        }
        BillingFlowParams.ProductDetailsParams pd=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(premiumDetails).build();
        BillingFlowParams flow=BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(pd)).build();
        billingClient.launchBillingFlow(activity,flow);
    }

    public String premiumPriceLabel(){
        if(premiumDetails!=null && premiumDetails.getOneTimePurchaseOfferDetails()!=null){
            return premiumDetails.getOneTimePurchaseOfferDetails().getFormattedPrice();
        }
        return "9,99 €";
    }

    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){
        if(result.getResponseCode()==BillingClient.BillingResponseCode.OK && purchases!=null){
            for(Purchase p:purchases) handlePurchase(p);
        }
    }

    private void handlePurchase(Purchase p){
        if(p==null||p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED||!p.getProducts().contains(PREMIUM_PRODUCT_ID)) return;
        prefs.edit().putBoolean(KEY_PREMIUM,true).apply();
        if(!p.isAcknowledged()){
            billingClient.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),r->{});
        }
    }

    private static TextView text(Context c,String value,float sp,boolean bold,int color){
        TextView t=new TextView(c); t.setText(value); t.setTextSize(sp); t.setTextColor(color); t.setGravity(Gravity.CENTER_VERTICAL);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD); return t;
    }
    private static int dp(Context c,int v){ return Math.round(v*c.getResources().getDisplayMetrics().density); }
}
