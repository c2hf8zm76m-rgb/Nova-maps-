package com.nova.audify;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/** Audify Premium 68.12.53 — native neon offer screen. */
public class AudifyPremiumActivity extends AppCompatActivity {
    private static final int BG = Color.rgb(3, 5, 13);
    private static final int TEXT = Color.rgb(246, 247, 252);
    private static final int MUTED = Color.rgb(178, 181, 202);
    private static final int ACCENT = Color.rgb(190, 255, 29);
    private static final int PURPLE = Color.rgb(196, 71, 255);
    private static final int BLUE = Color.rgb(72, 82, 255);

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (getSupportActionBar() != null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.setFitsSystemWindows(true);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(14), dp(12), dp(14), dp(28));
        scroll.addView(content, new ScrollView.LayoutParams(-1, -2));
        root.addView(scroll, new FrameLayout.LayoutParams(-1, -1));

        content.addView(topBar(), new LinearLayout.LayoutParams(-1, dp(72)));
        content.addView(hero(), marginLp(-2, 0, dp(12), 0, dp(12)));

        TextView sectionTitle = text("✦  Tes avantages Premium  ✦", 21f, true, TEXT);
        sectionTitle.setGravity(Gravity.CENTER);
        sectionTitle.setPadding(0, dp(8), 0, dp(8));
        content.addView(sectionTitle, new LinearLayout.LayoutParams(-1, -2));
        TextView sectionSub = text("Supprime les publicités propres à l’interface Audify. Audify Premium ne remplace pas YouTube Premium.", 13.5f, false, MUTED);
        sectionSub.setGravity(Gravity.CENTER);
        sectionSub.setPadding(0, 0, 0, dp(12));
        content.addView(sectionSub, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout benefits = new LinearLayout(this);
        benefits.setOrientation(LinearLayout.VERTICAL);
        addBenefitRow(benefits,
            benefit("AD", "Sans publicités ajoutées par Audify", "EXCLUSIF", ACCENT, Color.rgb(49, 70, 18)),
            benefit("♫", "Karaoké sans pub", "EXCLUSIF", PURPLE, Color.rgb(40, 20, 62)));
        addBenefitRow(benefits,
            benefit("▣", "Bannière de profil\npersonnalisée", "EXCLUSIF", PURPLE, Color.rgb(36, 19, 62)),
            benefit("GIF", "Photo de profil\nen GIF", "EXCLUSIF", ACCENT, Color.rgb(35, 61, 22)));
        addBenefitRow(benefits,
            benefit("◒", "Personnalisation du\nlecteur, de la pochette\net du disque", "EXCLUSIF", BLUE, Color.rgb(18, 35, 73)),
            benefit("●●", "Playlists partagées", "SOCIAL", Color.rgb(68, 154, 255), Color.rgb(18, 27, 58)));
        addBenefitRow(benefits,
            benefit("♥", "Réactions dans\nles playlists", "SOCIAL", PURPLE, Color.rgb(49, 20, 67)),
            benefit("✦", "Audify Party", "NOUVEAU", ACCENT, Color.rgb(38, 58, 16)));
        addBenefitRow(benefits,
            benefit("▤", "Plus de widgets\nAndroid", "NOUVEAU", ACCENT, Color.rgb(26, 58, 36)),
            benefit("✧", "Widgets\npersonnalisables", "EXCLUSIF", PURPLE, Color.rgb(48, 20, 70)));
        content.addView(benefits, new LinearLayout.LayoutParams(-1, -2));
        content.addView(paymentStrip(), marginLp(-2, 0, dp(8), 0, dp(14)));
        setContentView(root);
    }

    private View topBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);

        Button back = pillButton("‹", false);
        back.setTextSize(30f);
        back.setContentDescription("Retour");
        back.setOnClickListener(v -> finish());
        bar.addView(back, new LinearLayout.LayoutParams(dp(48), dp(48)));

        LinearLayout brand = new LinearLayout(this);
        brand.setGravity(Gravity.CENTER);
        TextView mark = text("A", 23f, true, ACCENT);
        mark.setTextColor(Color.rgb(5, 12, 4));
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(round(ACCENT, 0, Color.TRANSPARENT, dp(20)));
        brand.addView(mark, new LinearLayout.LayoutParams(dp(30), dp(34)));
        TextView name = text("AUDIFY", 15f, true, TEXT);
        name.setLetterSpacing(0.10f);
        name.setPadding(dp(6), 0, 0, 0);
        brand.addView(name, new LinearLayout.LayoutParams(-2, dp(44)));
        bar.addView(brand, new LinearLayout.LayoutParams(0, dp(58), 1f));

        TextView chip = text("◆  PREMIUM", 11f, true, ACCENT);
        chip.setGravity(Gravity.CENTER);
        chip.setBackground(round(Color.TRANSPARENT, dp(1), ACCENT, dp(28)));
        chip.setElevation(dp(8));
        if (getResources().getConfiguration().fontScale <= 1.2f) {
            bar.addView(chip, new LinearLayout.LayoutParams(dp(98), dp(40)));
        }
        return bar;
    }

    private View hero() {
        FrameLayout card = new FrameLayout(this);
        card.setBackground(panelBackground(new int[]{Color.rgb(12, 12, 34), Color.rgb(7, 8, 22)}, PURPLE, dp(28)));
        card.setElevation(dp(8));

        PremiumHeroArtwork artwork = new PremiumHeroArtwork(this);
        artwork.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        artwork.setAlpha(.75f);
        if (getResources().getConfiguration().screenWidthDp >= 360
                && getResources().getConfiguration().fontScale <= 1.2f) {
            card.addView(artwork, new FrameLayout.LayoutParams(dp(130), dp(170), Gravity.END | Gravity.TOP));
        }

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(18), dp(18), dp(18), dp(16));
        TextView eyebrow = text("♛  AUDIFY PREMIUM", 12.5f, true, ACCENT);
        eyebrow.setLetterSpacing(0.08f);
        eyebrow.setPadding(0, 0, 0, dp(10));
        copy.addView(eyebrow, new LinearLayout.LayoutParams(-1, -2));
        TextView title = text("Passe à\nPremium", 32f, true, TEXT);
        SpannableString titleText = new SpannableString("Passe à\nPremium");
        titleText.setSpan(new ForegroundColorSpan(ACCENT), 8, titleText.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        title.setText(titleText);
        title.setLineSpacing(0, 0.92f);
        title.setPadding(0, 0, 0, dp(16));
        copy.addView(title, new LinearLayout.LayoutParams(-1, -2));
        TextView sub = text("Profite de l’expérience Audify ultime. Plus de musique, plus de fun, zéro limite.", 13.5f, false, MUTED);
        sub.setLineSpacing(dp(2), 1.05f);
        copy.addView(sub, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout priceRow = new LinearLayout(this);
        priceRow.setGravity(Gravity.BOTTOM);
        priceRow.setPadding(0, dp(10), 0, dp(10));
        priceRow.addView(text("10 €", 36f, true, ACCENT), new LinearLayout.LayoutParams(-2, -2));
        TextView per = text("/ mois", 15f, false, MUTED);
        per.setGravity(Gravity.BOTTOM);
        per.setPadding(dp(10), 0, 0, dp(7));
        priceRow.addView(per, new LinearLayout.LayoutParams(-2, -2));
        copy.addView(priceRow, new LinearLayout.LayoutParams(-1, -2));

        Button buy = pillButton("Bientôt disponible  ›", true);
        buy.setTextSize(13.5f);
        buy.setMinHeight(dp(52));
        buy.setOnClickListener(v -> showComingSoon());
        copy.addView(buy, new LinearLayout.LayoutParams(-1, -2));

        boolean active = getSharedPreferences("audify_monetization", MODE_PRIVATE).getBoolean("premium_lifetime", false);
        if (active) { buy.setText("Premium déjà actif"); buy.setEnabled(false); }
        TextView status = text(active ? "✓  Audify Premium est actif" : "◷  L’abonnement n’est pas encore actif.", 11.5f, false, active ? ACCENT : MUTED);
        status.setPadding(0, dp(10), 0, dp(4));
        copy.addView(status, new LinearLayout.LayoutParams(-1, -2));
        TextView preview = text("Avantages Premium en préparation. Aucun paiement dans cette version.", 11f, false, MUTED);
        copy.addView(preview, new LinearLayout.LayoutParams(-1, -2));
        card.addView(copy, new FrameLayout.LayoutParams(-1, -2));
        return card;
    }

    private View benefit(String icon, String title, String badge, int iconColor, int iconBg) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(10), dp(8), dp(8), dp(8));
        card.setBackground(panelBackground(new int[]{Color.rgb(12, 14, 32), Color.rgb(7, 9, 23)}, iconColor, dp(22)));
        card.setElevation(dp(3));

        TextView iconView = text(icon, icon.equals("GIF") ? 14f : 25f, true, iconColor);
        iconView.setGravity(Gravity.CENTER);
        iconView.setBackground(round(iconBg, 0, Color.TRANSPARENT, dp(16)));
        card.addView(iconView, new LinearLayout.LayoutParams(dp(48), dp(48)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(0, dp(8), 0, 0);
        TextView titleView = text(title, 14f, false, TEXT);
        titleView.setLineSpacing(0, 0.96f);
        titleView.setMinLines(4);
        titleView.setPadding(0, 0, 0, dp(6));
        copy.addView(titleView, new LinearLayout.LayoutParams(-1, -2));

        int badgeColor = badge.equals("SOCIAL") ? Color.rgb(66, 151, 255) : ACCENT;
        TextView tag = text(badge, 9.5f, true, badgeColor);
        tag.setGravity(Gravity.CENTER);
        tag.setPadding(dp(8), 0, dp(8), 0);
        tag.setBackground(round(Color.TRANSPARENT, dp(1), badgeColor, dp(12)));
        tag.setMinHeight(dp(22));
        copy.addView(tag, new LinearLayout.LayoutParams(-2, -2));
        card.addView(copy, new LinearLayout.LayoutParams(-1, -2));
        return card;
    }

    private void addBenefitRow(LinearLayout parent, View left, View right) {
        if (getResources().getConfiguration().screenWidthDp < 360
                || getResources().getConfiguration().fontScale > 1.2f) {
            parent.addView(left, marginLp(-2, 0, 0, 0, dp(8)));
            parent.addView(right, marginLp(-2, 0, 0, 0, dp(8)));
            return;
        }
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.addView(left, new LinearLayout.LayoutParams(0, -2, 1f));
        LinearLayout.LayoutParams rightLp = new LinearLayout.LayoutParams(0, -2, 1f);
        rightLp.leftMargin = dp(8);
        row.addView(right, rightLp);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(-1, -2);
        rowLp.bottomMargin = dp(8);
        parent.addView(row, rowLp);
    }

    private View paymentStrip() {
        LinearLayout strip = new LinearLayout(this);
        strip.setGravity(Gravity.CENTER_VERTICAL);
        strip.setPadding(dp(14), dp(8), dp(12), dp(8));
        strip.setBackground(panelBackground(new int[]{Color.rgb(14, 11, 39), Color.rgb(8, 9, 25)}, PURPLE, dp(22)));
        strip.setOnClickListener(v -> showComingSoon());
        TextView icon = text("▣", 24f, true, PURPLE);
        icon.setGravity(Gravity.CENTER);
        strip.addView(icon, new LinearLayout.LayoutParams(dp(58), dp(58)));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        copy.addView(text("Abonnement bientôt disponible", 14f, false, TEXT), new LinearLayout.LayoutParams(-1, -2));
        copy.addView(text("Tarif prévu : 10 €/mois. Aucun paiement activé.", 11.5f, false, MUTED), new LinearLayout.LayoutParams(-1, -2));
        strip.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));
        strip.addView(text("›", 30f, false, MUTED), new LinearLayout.LayoutParams(dp(30), dp(58)));
        return strip;
    }

    private Button pillButton(String label, boolean accent) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setTextColor(accent ? Color.rgb(8, 18, 5) : TEXT);
        b.setBackground(round(accent ? ACCENT : Color.rgb(20, 21, 37), dp(1), accent ? Color.rgb(222, 255, 174) : Color.rgb(47, 49, 76), dp(26)));
        b.setPadding(dp(4), 0, dp(4), 0);
        return b;
    }

    private void showComingSoon() {
        Toast.makeText(this, "Audify Premium arrive bientôt. Aucun paiement n’est effectué.", Toast.LENGTH_LONG).show();
    }

    private TextView text(String value, float size, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER_VERTICAL);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }

    private LinearLayout.LayoutParams marginLp(int height, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, height);
        lp.setMargins(left, top, right, bottom);
        return lp;
    }

    private GradientDrawable round(int fill, int strokeWidth, int stroke, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(radius);
        if (strokeWidth > 0) d.setStroke(strokeWidth, stroke);
        return d;
    }

    private GradientDrawable panelBackground(int[] colors, int stroke, int radius) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
        d.setCornerRadius(radius);
        d.setStroke(dp(1), Color.argb(210, Color.red(stroke), Color.green(stroke), Color.blue(stroke)));
        return d;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static final class PremiumHeroArtwork extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        PremiumHeroArtwork(Context context) {
            super(context);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float d = getResources().getDisplayMetrics().density;
            float cx = getWidth() * .55f;
            float cy = getHeight() * .48f;
            float r = Math.min(getWidth(), getHeight()) * .32f;

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2.2f * d);
            paint.setShader(new LinearGradient(0, 0, getWidth(), getHeight(),
                new int[]{Color.rgb(120, 47, 255), Color.rgb(251, 58, 227), Color.rgb(121, 255, 35), Color.rgb(24, 136, 255)},
                null, Shader.TileMode.CLAMP));
            paint.setShadowLayer(18 * d, 0, 0, Color.rgb(122, 48, 255));
            canvas.drawCircle(cx, cy, r * 1.33f, paint);
            canvas.drawCircle(cx, cy, r * 1.23f, paint);
            paint.clearShadowLayer();

            paint.setStyle(Paint.Style.FILL);
            paint.setShader(new LinearGradient(cx-r, cy-r, cx+r, cy+r,
                new int[]{Color.rgb(16, 17, 31), Color.rgb(4, 5, 13), Color.rgb(30, 16, 40)},
                null, Shader.TileMode.CLAMP));
            paint.setShadowLayer(23 * d, 0, 10 * d, Color.argb(210, 0, 0, 0));
            canvas.drawCircle(cx, cy, r, paint);
            paint.clearShadowLayer();
            paint.setShader(null);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(1, d));
            paint.setColor(Color.argb(110, 179, 190, 218));
            for (int i = 1; i < 15; i++) canvas.drawCircle(cx, cy, r * (i / 15f), paint);

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.rgb(178, 255, 24));
            canvas.drawCircle(cx, cy, r * .28f, paint);
            paint.setColor(Color.rgb(11, 12, 20));
            canvas.drawCircle(cx, cy, r * .19f, paint);
            paint.setColor(Color.rgb(190, 255, 29));
            path.reset();
            path.moveTo(cx-r*.10f, cy+r*.11f);
            path.lineTo(cx-r*.02f, cy-r*.15f);
            path.lineTo(cx+r*.10f, cy+r*.08f);
            path.lineTo(cx+r*.05f, cy+r*.14f);
            path.lineTo(cx-r*.02f, cy-r*.01f);
            path.lineTo(cx-r*.06f, cy+r*.14f);
            path.close();
            canvas.drawPath(path, paint);

            paint.setColor(Color.argb(230, 169, 255, 45));
            paint.setStrokeWidth(2.3f * d);
            paint.setStyle(Paint.Style.STROKE);
            RectF arm = new RectF(cx-r*.62f, cy-r*.76f, cx+r*.66f, cy+r*.53f);
            canvas.drawArc(arm, 212, 105, false, paint);
            paint.setStyle(Paint.Style.FILL);
            canvas.drawCircle(cx-r*.78f, cy-r*.38f, 3*d, paint);
            canvas.drawCircle(cx+r*.76f, cy-r*.25f, 3*d, paint);
            canvas.drawCircle(cx+r*.65f, cy+r*.67f, 2.5f*d, paint);

            paint.setColor(Color.rgb(178, 79, 255));
            paint.setTextSize(22*d);
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            canvas.drawText("♫", getWidth()*.10f, getHeight()*.18f, paint);
            paint.setColor(Color.rgb(193, 255, 27));
            paint.setTextSize(19*d);
            canvas.drawText("✦", getWidth()*.78f, getHeight()*.22f, paint);
            paint.setColor(Color.rgb(76, 155, 255));
            canvas.drawText("✧", getWidth()*.08f, getHeight()*.82f, paint);
        }
    }
}
