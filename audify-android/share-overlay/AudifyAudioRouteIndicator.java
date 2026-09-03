package com.nova.audify;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaRouter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.lang.ref.WeakReference;
import java.util.List;

/**
 * Small Spotify-like indicator for the local Android audio route.
 * It is visible only when Audify is routed away from the phone speaker.
 */
public final class AudifyAudioRouteIndicator {
    private static final String TAG = "AUDIFY_AUDIO_ROUTE_INDICATOR";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static WeakReference<Activity> active = new WeakReference<>(null);
    private static AudioManager audioManager;
    private static MediaRouter mediaRouter;
    private static boolean callbacksInstalled;
    private static AudioDeviceCallback deviceCallback;
    private static MediaRouter.Callback routeCallback;
    private static String lastKey = "";

    private AudifyAudioRouteIndicator() {}

    public static void attach(Activity activity) {
        if (activity == null) return;
        active = new WeakReference<>(activity);
        installPill(activity);
        ensureCallbacks(activity.getApplicationContext());
        update(activity);
        schedulePoll(activity);
    }

    private static void installPill(final Activity activity) {
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        ViewGroup root = (ViewGroup) content;
        if (root.findViewWithTag(TAG) != null) return;

        LinearLayout pill = new LinearLayout(activity);
        pill.setTag(TAG);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(activity, 11), dp(activity, 7), dp(activity, 13), dp(activity, 7));
        pill.setElevation(dp(activity, 10));
        pill.setAlpha(0f);
        pill.setVisibility(View.GONE);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(228, 11, 16, 23));
        bg.setCornerRadius(dp(activity, 22));
        bg.setStroke(dp(activity, 1), Color.argb(230, 168, 255, 63));
        pill.setBackground(bg);

        HeadphoneIcon icon = new HeadphoneIcon(activity);
        LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(dp(activity, 20), dp(activity, 20));
        pill.addView(icon, ilp);

        TextView label = new TextView(activity);
        label.setTag(TAG + "_LABEL");
        label.setTextColor(Color.rgb(220, 255, 184));
        label.setTextSize(12.5f);
        label.setSingleLine(true);
        label.setEllipsize(android.text.TextUtils.TruncateAt.END);
        label.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD));
        LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(dp(activity, 170), ViewGroup.LayoutParams.WRAP_CONTENT);
        llp.leftMargin = dp(activity, 8);
        pill.addView(label, llp);

        pill.setOnClickListener(v -> {
            TextView l = (TextView) ((ViewGroup) v).findViewWithTag(TAG + "_LABEL");
            if (l != null && !TextUtils.isEmpty(l.getText())) {
                android.widget.Toast.makeText(activity, "Sortie audio : " + l.getText(), android.widget.Toast.LENGTH_SHORT).show();
            }
        });

        if (root instanceof FrameLayout) {
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(activity, 220), dp(activity, 42), Gravity.BOTTOM | Gravity.START);
            lp.leftMargin = dp(activity, 16);
            lp.bottomMargin = dp(activity, 132);
            ((FrameLayout) root).addView(pill, lp);
        } else {
            FrameLayout overlay = new FrameLayout(activity);
            root.addView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(activity, 220), dp(activity, 42), Gravity.BOTTOM | Gravity.START);
            lp.leftMargin = dp(activity, 16);
            lp.bottomMargin = dp(activity, 132);
            overlay.addView(pill, lp);
        }
    }

    private static void ensureCallbacks(Context context) {
        if (callbacksInstalled || context == null) return;
        callbacksInstalled = true;
        try {
            audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null && Build.VERSION.SDK_INT >= 23) {
                deviceCallback = new AudioDeviceCallback() {
                    @Override public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) { refreshSoon(); }
                    @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) { refreshSoon(); }
                };
                audioManager.registerAudioDeviceCallback(deviceCallback, MAIN);
            }
        } catch (Throwable ignored) {}

        try {
            mediaRouter = (MediaRouter) context.getSystemService(Context.MEDIA_ROUTER_SERVICE);
            if (mediaRouter != null) {
                routeCallback = new MediaRouter.SimpleCallback() {
                    @Override public void onRouteSelected(MediaRouter router, int type, MediaRouter.RouteInfo info) { refreshSoon(); }
                    @Override public void onRouteUnselected(MediaRouter router, int type, MediaRouter.RouteInfo info) { refreshSoon(); }
                    @Override public void onRouteChanged(MediaRouter router, MediaRouter.RouteInfo info) { refreshSoon(); }
                };
                mediaRouter.addCallback(MediaRouter.ROUTE_TYPE_LIVE_AUDIO, routeCallback, MediaRouter.CALLBACK_FLAG_UNFILTERED_EVENTS);
            }
        } catch (Throwable ignored) {}
    }

    private static void refreshSoon() {
        MAIN.removeCallbacks(REFRESH);
        MAIN.postDelayed(REFRESH, 180);
    }

    private static final Runnable REFRESH = new Runnable() {
        @Override public void run() {
            Activity a = active.get();
            if (a != null && !a.isFinishing()) update(a);
        }
    };

    private static void schedulePoll(final Activity activity) {
        final WeakReference<Activity> ref = new WeakReference<>(activity);
        MAIN.postDelayed(new Runnable() {
            @Override public void run() {
                Activity a = ref.get();
                if (a == null || a.isFinishing() || a.isDestroyed() || active.get() != a) return;
                update(a);
                MAIN.postDelayed(this, 1200);
            }
        }, 1200);
    }

    private static void update(Activity activity) {
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        View pill = ((ViewGroup) content).findViewWithTag(TAG);
        if (pill == null) return;
        Route route = resolveRoute(activity);

        if (route == null || route.kind == Kind.PHONE) {
            lastKey = "phone";
            if (pill.getVisibility() == View.VISIBLE) {
                pill.animate().alpha(0f).setDuration(160).withEndAction(() -> pill.setVisibility(View.GONE)).start();
            }
            return;
        }

        TextView label = (TextView) ((ViewGroup) pill).findViewWithTag(TAG + "_LABEL");
        if (label != null) label.setText(route.label);
        String key = route.kind.name() + ":" + route.label;
        if (pill.getVisibility() != View.VISIBLE) {
            pill.setVisibility(View.VISIBLE);
            pill.setAlpha(0f);
            pill.animate().alpha(1f).setDuration(180).start();
        } else if (!key.equals(lastKey)) {
            pill.animate().alpha(0.55f).setDuration(90).withEndAction(() -> pill.animate().alpha(1f).setDuration(120).start()).start();
        }
        lastKey = key;
    }

    private enum Kind { PHONE, BLUETOOTH, WIRED, USB, HDMI, HEARING_AID, OTHER }

    private static final class Route {
        final Kind kind;
        final String label;
        Route(Kind k, String l) { kind = k; label = l; }
    }

    private static Route resolveRoute(Context context) {
        AudioManager am = audioManager;
        if (am == null) {
            try { am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE); } catch (Throwable ignored) {}
        }

        if (Build.VERSION.SDK_INT >= 33 && am != null) {
            Route r = Api33.routeForMedia(am);
            if (r != null) return r;
        }

        String selectedName = selectedRouteName(context);
        String lower = selectedName.toLowerCase(java.util.Locale.ROOT);

        try {
            if (am != null && am.isBluetoothA2dpOn()) {
                String name = productName(am, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP);
                if (TextUtils.isEmpty(name)) name = cleanRouteName(selectedName, "Écouteurs Bluetooth");
                return new Route(Kind.BLUETOOTH, name);
            }
        } catch (Throwable ignored) {}

        try {
            if (am != null && am.isWiredHeadsetOn()) {
                String name = productName(am, AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES);
                if (TextUtils.isEmpty(name)) name = "Casque filaire";
                return new Route(Kind.WIRED, name);
            }
        } catch (Throwable ignored) {}

        if (am != null && Build.VERSION.SDK_INT >= 23) {
            Route usb = firstConnectedSpecial(am);
            if (usb != null) return usb;
        }

        if (lower.contains("bluetooth") || lower.contains("airpod") || lower.contains("buds") || lower.contains("headset"))
            return new Route(Kind.BLUETOOTH, cleanRouteName(selectedName, "Écouteurs Bluetooth"));
        if (lower.contains("headphone") || lower.contains("casque") || lower.contains("écouteur") || lower.contains("wired"))
            return new Route(Kind.WIRED, cleanRouteName(selectedName, "Casque filaire"));
        if (lower.contains("usb")) return new Route(Kind.USB, cleanRouteName(selectedName, "Audio USB"));
        if (lower.contains("hdmi") || lower.contains("tv")) return new Route(Kind.HDMI, cleanRouteName(selectedName, "Sortie HDMI"));

        return new Route(Kind.PHONE, "Téléphone");
    }

    private static String selectedRouteName(Context context) {
        try {
            MediaRouter mr = mediaRouter;
            if (mr == null) mr = (MediaRouter) context.getSystemService(Context.MEDIA_ROUTER_SERVICE);
            if (mr != null) {
                MediaRouter.RouteInfo route = mr.getSelectedRoute(MediaRouter.ROUTE_TYPE_LIVE_AUDIO);
                CharSequence n = route == null ? null : route.getName(context);
                if (n != null) return String.valueOf(n).trim();
            }
        } catch (Throwable ignored) {}
        return "";
    }

    private static Route firstConnectedSpecial(AudioManager am) {
        try {
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                int t = d.getType();
                String n = deviceName(d);
                if (t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_USB_DEVICE || t == AudioDeviceInfo.TYPE_USB_ACCESSORY)
                    return new Route(Kind.USB, TextUtils.isEmpty(n) ? "Audio USB" : n);
                if (t == AudioDeviceInfo.TYPE_HDMI || t == AudioDeviceInfo.TYPE_HDMI_ARC)
                    return new Route(Kind.HDMI, TextUtils.isEmpty(n) ? "Sortie HDMI" : n);
                if (Build.VERSION.SDK_INT >= 28 && t == AudioDeviceInfo.TYPE_HEARING_AID)
                    return new Route(Kind.HEARING_AID, TextUtils.isEmpty(n) ? "Appareil auditif" : n);
            }
        } catch (Throwable ignored) {}
        return null;
    }

    private static String productName(AudioManager am, int... types) {
        if (Build.VERSION.SDK_INT < 23 || am == null) return "";
        try {
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                for (int t : types) if (d.getType() == t) {
                    String n = deviceName(d);
                    if (!TextUtils.isEmpty(n)) return n;
                }
            }
        } catch (Throwable ignored) {}
        return "";
    }

    private static String deviceName(AudioDeviceInfo d) {
        try {
            CharSequence p = d.getProductName();
            String s = p == null ? "" : String.valueOf(p).trim();
            if (s.equalsIgnoreCase("unknown") || s.equalsIgnoreCase("default")) return "";
            return s;
        } catch (Throwable ignored) { return ""; }
    }

    private static String cleanRouteName(String value, String fallback) {
        if (TextUtils.isEmpty(value)) return fallback;
        String s = value.trim();
        String l = s.toLowerCase(java.util.Locale.ROOT);
        if (l.equals("phone") || l.equals("this phone") || l.equals("speaker") || l.equals("device speaker")) return fallback;
        return s.length() > 28 ? s.substring(0, 27) + "…" : s;
    }

    private static int dp(Context c, int v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }

    private static final class HeadphoneIcon extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        HeadphoneIcon(Context c) { super(c); p.setStrokeCap(Paint.Cap.ROUND); p.setStrokeJoin(Paint.Join.ROUND); }
        @Override protected void onDraw(Canvas c) {
            super.onDraw(c);
            float w=getWidth(), h=getHeight();
            p.setColor(Color.rgb(168,255,63)); p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(Math.max(2f,w*.11f));
            RectF arc = new RectF(w*.18f,h*.14f,w*.82f,h*.78f);
            c.drawArc(arc, 185, 170, false, p);
            c.drawLine(w*.17f,h*.55f,w*.17f,h*.83f,p); c.drawLine(w*.83f,h*.55f,w*.83f,h*.83f,p);
            p.setStyle(Paint.Style.FILL);
            c.drawRoundRect(new RectF(w*.08f,h*.58f,w*.28f,h*.92f),w*.07f,w*.07f,p);
            c.drawRoundRect(new RectF(w*.72f,h*.58f,w*.92f,h*.92f),w*.07f,w*.07f,p);
        }
    }

    private static final class Api33 {
        static Route routeForMedia(AudioManager am) {
            try {
                android.media.AudioAttributes attrs = new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC).build();
                List<AudioDeviceInfo> devices = am.getAudioDevicesForAttributes(attrs);
                if (devices == null || devices.isEmpty()) return null;
                AudioDeviceInfo d = devices.get(0);
                int t = d.getType();
                String n = deviceName(d);
                if (t == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER || t == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE)
                    return new Route(Kind.PHONE, "Téléphone");
                if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || (Build.VERSION.SDK_INT >= 31 && (t == AudioDeviceInfo.TYPE_BLE_HEADSET || t == AudioDeviceInfo.TYPE_BLE_SPEAKER)))
                    return new Route(Kind.BLUETOOTH, TextUtils.isEmpty(n) ? "Écouteurs Bluetooth" : n);
                if (t == AudioDeviceInfo.TYPE_WIRED_HEADSET || t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES)
                    return new Route(Kind.WIRED, TextUtils.isEmpty(n) ? "Casque filaire" : n);
                if (t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_USB_DEVICE || t == AudioDeviceInfo.TYPE_USB_ACCESSORY)
                    return new Route(Kind.USB, TextUtils.isEmpty(n) ? "Audio USB" : n);
                if (t == AudioDeviceInfo.TYPE_HDMI || t == AudioDeviceInfo.TYPE_HDMI_ARC)
                    return new Route(Kind.HDMI, TextUtils.isEmpty(n) ? "Sortie HDMI" : n);
                if (Build.VERSION.SDK_INT >= 28 && t == AudioDeviceInfo.TYPE_HEARING_AID)
                    return new Route(Kind.HEARING_AID, TextUtils.isEmpty(n) ? "Appareil auditif" : n);
                return new Route(Kind.OTHER, TextUtils.isEmpty(n) ? "Sortie audio externe" : n);
            } catch (Throwable ignored) { return null; }
        }
    }
}
