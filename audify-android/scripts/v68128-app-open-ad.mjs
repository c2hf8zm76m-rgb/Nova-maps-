import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
await mkdir(pkgDir, { recursive: true });

const configPath = path.join(root, 'ads-config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const mode = String(config.mode || 'test').trim().toLowerCase();
const admobAppId = String(config.admobAppId || '').trim();
const appOpenAdUnitId = String(config.appOpenAdUnitId || '').trim();

if (!/^ca-app-pub-\d+~\d+$/.test(admobAppId)) {
  throw new Error('V68.12.8 AdMob App ID invalide dans ads-config.json');
}
if (!/^ca-app-pub-\d+\/\d+$/.test(appOpenAdUnitId)) {
  throw new Error('V68.12.8 App Open Ad Unit ID invalide dans ads-config.json');
}
if (mode !== 'test' && mode !== 'production') {
  throw new Error('V68.12.8 mode publicitaire invalide: test ou production attendu');
}

// =============================================================================
// 1) Google Mobile Ads SDK.
// =============================================================================
const gradlePath = path.join(android, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
if (!gradle.includes('com.google.android.gms:play-services-ads:25.4.0')) {
  const marker = /dependencies\s*\{/;
  if (!marker.test(gradle)) throw new Error('V68.12.8 bloc dependencies Gradle introuvable');
  gradle = gradle.replace(marker, `dependencies {\n    implementation 'com.google.android.gms:play-services-ads:25.4.0'`);
}
await writeFile(gradlePath, gradle, 'utf8');

// =============================================================================
// 2) Application Android dédiée à la pub d'ouverture.
//    - une seule tentative par processus / vrai démarrage de l'app ;
//    - jamais de boucle quand l'utilisateur revient depuis la pub ;
//    - fenêtre de lancement limitée pour éviter une pub tardive au-dessus du contenu ;
//    - l'ID de test officiel Google est utilisé tant que ads-config.json reste en mode test.
// =============================================================================
const applicationJava = `package com.nova.audify;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.SystemClock;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;

/**
 * Audify V68.12.8 — premier moyen de rémunération : App Open Ad.
 *
 * Cette version est configurée en mode ${mode.toUpperCase()} via ads-config.json.
 * Le mode test emploie exclusivement les identifiants de test officiels Google.
 */
public final class AudifyApplication extends Application implements Application.ActivityLifecycleCallbacks {
    private static final String APP_OPEN_AD_UNIT_ID = "${appOpenAdUnitId}";
    private static final long MAX_LAUNCH_WINDOW_MS = 4000L;

    private Activity currentActivity;
    private AppOpenAd appOpenAd;
    private boolean isLoadingAd = false;
    private boolean isShowingAd = false;
    private boolean launchOpportunityConsumed = false;
    private long processStartedAt = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        processStartedAt = SystemClock.elapsedRealtime();
        registerActivityLifecycleCallbacks(this);

        // Initialisation unique du SDK. Le chargement ne démarre qu'une fois le SDK prêt.
        MobileAds.initialize(this, initializationStatus -> loadAppOpenAd());
    }

    private void loadAppOpenAd() {
        if (launchOpportunityConsumed || isLoadingAd || appOpenAd != null) return;
        isLoadingAd = true;

        AppOpenAd.load(
            this,
            APP_OPEN_AD_UNIT_ID,
            new AdRequest.Builder().build(),
            new AppOpenAd.AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(AppOpenAd ad) {
                    isLoadingAd = false;
                    appOpenAd = ad;
                    showIfLaunchIsStillActive();
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    isLoadingAd = false;
                    // Une pub indisponible ne bloque jamais Audify et n'est pas relancée tardivement.
                    launchOpportunityConsumed = true;
                    appOpenAd = null;
                }
            }
        );
    }

    private void showIfLaunchIsStillActive() {
        if (launchOpportunityConsumed || isShowingAd || appOpenAd == null) return;
        Activity activity = currentActivity;
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

        long age = SystemClock.elapsedRealtime() - processStartedAt;
        if (age > MAX_LAUNCH_WINDOW_MS) {
            // Si l'annonce arrive trop tard, on privilégie l'expérience utilisateur.
            launchOpportunityConsumed = true;
            appOpenAd = null;
            return;
        }

        launchOpportunityConsumed = true;
        isShowingAd = true;
        AppOpenAd ad = appOpenAd;
        appOpenAd = null;

        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                isShowingAd = false;
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError adError) {
                isShowingAd = false;
            }

            @Override
            public void onAdShowedFullScreenContent() {
                isShowingAd = true;
            }
        });

        try {
            ad.show(activity);
        } catch (Throwable ignored) {
            isShowingAd = false;
        }
    }

    @Override public void onActivityCreated(Activity activity, Bundle savedInstanceState) {}

    @Override
    public void onActivityStarted(Activity activity) {
        if (!isShowingAd) currentActivity = activity;
        showIfLaunchIsStillActive();
    }

    @Override
    public void onActivityResumed(Activity activity) {
        if (!isShowingAd) currentActivity = activity;
        showIfLaunchIsStillActive();
    }

    @Override public void onActivityPaused(Activity activity) {}

    @Override
    public void onActivityStopped(Activity activity) {
        if (currentActivity == activity && !isShowingAd) currentActivity = null;
    }

    @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}

    @Override
    public void onActivityDestroyed(Activity activity) {
        if (currentActivity == activity) currentActivity = null;
    }
}
`;

await writeFile(path.join(pkgDir, 'AudifyApplication.java'), applicationJava, 'utf8');

// =============================================================================
// 3) Manifest : Application Audify + App ID AdMob.
// =============================================================================
const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');

if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace(/<manifest([^>]*)>/, m => `${m}\n    <uses-permission android:name="android.permission.INTERNET" />`);
}

const applicationMatch = manifest.match(/<application\b[^>]*>/);
if (!applicationMatch) throw new Error('V68.12.8 balise <application> introuvable');
let applicationTag = applicationMatch[0];

if (/android:name\s*=/.test(applicationTag)) {
  if (!applicationTag.includes('android:name=".AudifyApplication"') && !applicationTag.includes('android:name="com.nova.audify.AudifyApplication"')) {
    throw new Error('V68.12.8 une autre classe Application est déjà configurée; fusion manuelle requise');
  }
} else {
  applicationTag = applicationTag.replace('<application', '<application\n        android:name=".AudifyApplication"');
  manifest = manifest.replace(applicationMatch[0], applicationTag);
}

if (!manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
  const meta = `\n        <!-- Audify V68.12.8 · Google Mobile Ads (${mode}) -->\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="${admobAppId}" />`;
  manifest = manifest.replace(applicationTag, applicationTag + meta);
}

await writeFile(manifestPath, manifest, 'utf8');

console.log(`Audify V68.12.8 : App Open Ad intégré en mode ${mode}.`);
