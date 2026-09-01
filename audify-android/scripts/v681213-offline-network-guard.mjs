import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');

const guardJava = String.raw`package com.nova.audify;

import android.app.Activity;
import android.app.Application;
import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Audify V68.12.13 — détection globale d'une vraie connexion Internet.
 *
 * Wi-Fi connecté != Internet disponible. On exige NET_CAPABILITY_VALIDATED,
 * donc un Wi-Fi sans accès Internet affiche bien l'écran hors ligne, tandis
 * qu'une connexion 4G/5G validée continue de fonctionner normalement.
 */
public final class AudifyNetworkGuard implements Application.ActivityLifecycleCallbacks {
    private static AudifyNetworkGuard instance;

    private final Application app;
    private final ConnectivityManager connectivity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private Activity currentActivity;
    private Dialog offlineDialog;
    private boolean callbackRegistered = false;

    private final ConnectivityManager.NetworkCallback networkCallback = new ConnectivityManager.NetworkCallback() {
        @Override public void onAvailable(Network network) { refresh(); }
        @Override public void onLost(Network network) { refresh(); }
        @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) { refresh(); }
    };

    private AudifyNetworkGuard(Application app) {
        this.app = app;
        this.connectivity = (ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    public static synchronized void install(Application app) {
        if (instance != null) return;
        instance = new AudifyNetworkGuard(app);
        app.registerActivityLifecycleCallbacks(instance);
        instance.registerNetworkCallback();
        instance.refresh();
    }

    private void registerNetworkCallback() {
        if (connectivity == null || callbackRegistered) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                connectivity.registerDefaultNetworkCallback(networkCallback);
            } else {
                NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
                connectivity.registerNetworkCallback(request, networkCallback);
            }
            callbackRegistered = true;
        } catch (Throwable ignored) {}
    }

    private boolean hasValidatedInternet() {
        if (connectivity == null) return false;
        try {
            Network active = connectivity.getActiveNetwork();
            if (active == null) return false;
            NetworkCapabilities caps = connectivity.getNetworkCapabilities(active);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Throwable ignored) {
            return false;
        }
    }

    private void refresh() {
        main.post(() -> {
            if (hasValidatedInternet()) dismissOfflinePage();
            else showOfflinePage();
        });
    }

    private boolean isAudifyActivity(Activity activity) {
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return false;
        String name = activity.getClass().getName();
        return name != null && name.startsWith("com.nova.audify.");
    }

    private void showOfflinePage() {
        Activity activity = currentActivity;
        if (!isAudifyActivity(activity)) return;
        if (offlineDialog != null && offlineDialog.isShowing()) return;

        Dialog dialog = new Dialog(activity, android.R.style.Theme_Material_NoActionBar);
        dialog.setCancelable(false);
        dialog.setCanceledOnTouchOutside(false);

        LinearLayout root = new LinearLayout(activity);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(activity, 28), dp(activity, 36), dp(activity, 28), dp(activity, 36));
        root.setBackgroundColor(Color.rgb(7, 8, 12));

        TextView icon = new TextView(activity);
        icon.setText("⌁");
        icon.setTextColor(Color.WHITE);
        icon.setTextSize(64f);
        icon.setGravity(Gravity.CENTER);
        icon.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(icon, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 96)));

        TextView title = new TextView(activity);
        title.setText("Pas de connexion Internet");
        title.setTextColor(Color.WHITE);
        title.setTextSize(27f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin = dp(activity, 8);
        root.addView(title, titleLp);

        TextView body = new TextView(activity);
        body.setText("Audify ne peut pas rechercher ni charger de nouveaux morceaux sans Internet. Vérifie ton Wi‑Fi ou tes données mobiles.");
        body.setTextColor(Color.rgb(183, 187, 198));
        body.setTextSize(16f);
        body.setGravity(Gravity.CENTER);
        body.setLineSpacing(0f, 1.18f);
        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyLp.topMargin = dp(activity, 18);
        bodyLp.leftMargin = dp(activity, 8);
        bodyLp.rightMargin = dp(activity, 8);
        root.addView(body, bodyLp);

        TextView hint = new TextView(activity);
        hint.setText("La page disparaîtra automatiquement dès que la connexion revient.");
        hint.setTextColor(Color.rgb(123, 128, 142));
        hint.setTextSize(13f);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hintLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hintLp.topMargin = dp(activity, 12);
        root.addView(hint, hintLp);

        Button retry = new Button(activity);
        retry.setText("Réessayer");
        retry.setTextColor(Color.rgb(12, 12, 16));
        retry.setTextSize(16f);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        retry.setAllCaps(false);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.WHITE);
        bg.setCornerRadius(dp(activity, 18));
        retry.setBackground(bg);
        retry.setOnClickListener(v -> refresh());
        LinearLayout.LayoutParams retryLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 56));
        retryLp.topMargin = dp(activity, 30);
        retryLp.leftMargin = dp(activity, 18);
        retryLp.rightMargin = dp(activity, 18);
        root.addView(retry, retryLp);

        dialog.setContentView(root);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.rgb(7, 8, 12));
            window.setNavigationBarColor(Color.rgb(7, 8, 12));
            window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        }

        try {
            dialog.show();
            if (window != null) {
                window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
            }
            offlineDialog = dialog;
        } catch (Throwable ignored) {}
    }

    private void dismissOfflinePage() {
        Dialog dialog = offlineDialog;
        offlineDialog = null;
        if (dialog != null) {
            try { if (dialog.isShowing()) dialog.dismiss(); } catch (Throwable ignored) {}
        }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    @Override public void onActivityCreated(Activity activity, Bundle state) {}
    @Override public void onActivityStarted(Activity activity) {}

    @Override
    public void onActivityResumed(Activity activity) {
        if (!isAudifyActivity(activity)) return;
        currentActivity = activity;
        refresh();
    }

    @Override
    public void onActivityPaused(Activity activity) {
        if (currentActivity == activity) {
            // Le dialogue appartient à cette Activity. On le ferme avant le changement
            // d'écran puis on le recréera sur la prochaine Activity si Internet manque encore.
            dismissOfflinePage();
        }
    }

    @Override public void onActivityStopped(Activity activity) {}
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}

    @Override
    public void onActivityDestroyed(Activity activity) {
        if (currentActivity == activity) {
            currentActivity = null;
            dismissOfflinePage();
        }
    }
}
`;

await writeFile(path.join(pkgDir, 'AudifyNetworkGuard.java'), guardJava, 'utf8');

// Installer le garde réseau depuis l'Application globale déjà créée par V68.12.8.
const applicationPath = path.join(pkgDir, 'AudifyApplication.java');
let application = await readFile(applicationPath, 'utf8');
const installMarker = '        registerActivityLifecycleCallbacks(this);';
if (!application.includes(installMarker)) {
  throw new Error('V68.12.13 point installation AudifyApplication introuvable');
}
if (!application.includes('AudifyNetworkGuard.install(this);')) {
  application = application.replace(
    installMarker,
    installMarker + '\n        AudifyNetworkGuard.install(this);'
  );
}
await writeFile(applicationPath, application, 'utf8');

// ACCESS_NETWORK_STATE est nécessaire pour lire les capacités VALIDATED du réseau actif.
const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('android.permission.ACCESS_NETWORK_STATE')) {
  manifest = manifest.replace(
    /<manifest([^>]*)>/,
    m => `${m}\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />`
  );
}
await writeFile(manifestPath, manifest, 'utf8');

console.log('Audify V68.12.13 : détection Internet validée + grande page hors connexion globale.');
