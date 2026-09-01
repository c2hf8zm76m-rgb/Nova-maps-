package com.nova.audify;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class AudifyPremiumActivity extends AppCompatActivity {
    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null)getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(6,10,14));
        getWindow().setNavigationBarColor(Color.rgb(4,7,10));

        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20),dp(24),dp(20),dp(30));
        page.setBackgroundColor(Color.rgb(7,11,17));

        Button back=button("‹ Retour",false);
        back.setOnClickListener(v->finish());
        page.addView(back,new LinearLayout.LayoutParams(dp(112),dp(50)));

        TextView title=text("Audify Premium",34f,true,Color.WHITE);
        LinearLayout.LayoutParams tl=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66));
        tl.topMargin=dp(24);
        page.addView(title,tl);

        TextView sub=text("Un achat unique pour profiter d’Audify sans les publicités Audify et sans déblocage publicitaire pour le Karaoké ou la création de playlists.",16f,false,Color.rgb(183,193,207));
        sub.setLineSpacing(dp(3),1.08f);
        page.addView(sub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(130)));

        TextView status=text(
            AudifyMonetizationManager.get(this).isPremium()?"PREMIUM ACTIF":"ACHAT UNIQUE",
            12f,true,Color.rgb(168,255,63)
        );
        status.setLetterSpacing(0.12f);
        page.addView(status,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(40)));

        Button buy=button(
            AudifyMonetizationManager.get(this).isPremium()
                ?"Premium déjà actif"
                :"Acheter Premium · "+AudifyMonetizationManager.get(this).premiumPriceLabel(),
            true
        );
        buy.setEnabled(!AudifyMonetizationManager.get(this).isPremium());
        buy.setOnClickListener(v->AudifyMonetizationManager.get(this).launchPremiumPurchase(this));
        LinearLayout.LayoutParams bl=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62));
        bl.topMargin=dp(14);
        page.addView(buy,bl);

        setContentView(page);
    }

    private Button button(String label,boolean accent){
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(15.5f);
        b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setTextColor(accent?Color.rgb(8,18,7):Color.WHITE);
        GradientDrawable g=new GradientDrawable();
        g.setColor(accent?Color.rgb(168,255,63):Color.rgb(23,30,39));
        g.setCornerRadius(dp(22));
        g.setStroke(dp(1),accent?Color.rgb(211,255,168):Color.rgb(65,76,90));
        b.setBackground(g);
        return b;
    }

    private TextView text(String v,float sp,boolean bold,int color){
        TextView t=new TextView(this);
        t.setText(v);
        t.setTextSize(sp);
        t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        t.setGravity(Gravity.CENTER_VERTICAL);
        return t;
    }

    private int dp(int v){
        return Math.round(v*getResources().getDisplayMetrics().density);
    }
}
