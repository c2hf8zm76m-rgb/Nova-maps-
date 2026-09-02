package com.nova.audify;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class AudifyPremiumActivity extends Activity {
    private static final int BG = Color.rgb(4,8,12);
    private static final int CARD = Color.rgb(12,18,25);
    private static final int TEXT = Color.rgb(245,248,250);
    private static final int MUTED = Color.rgb(155,168,183);
    private static final int GREEN = Color.rgb(169,255,52);
    private static final int CYAN = Color.rgb(58,222,255);
    private static final int PURPLE = Color.rgb(132,88,255);

    @Override protected void onCreate(Bundle state) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(state);
        try { if (getActionBar()!=null) getActionBar().hide(); } catch (Throwable ignored) {}
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.rgb(3,6,9));
        getWindow().setNavigationBarColor(Color.rgb(3,6,9));

        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.setFitsSystemWindows(true);
        root.addView(new GlowBackdrop(this),new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        FrameLayout.LayoutParams slp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT);
        root.addView(scroll,slp);

        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18),dp(14),dp(18),dp(42));
        scroll.addView(page,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout top=new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        Button back=button("‹",false);
        back.setTextSize(28f);
        back.setOnClickListener(new View.OnClickListener(){ @Override public void onClick(View v){ finish(); }});
        top.addView(back,new LinearLayout.LayoutParams(dp(54),dp(48)));
        TextView brand=text("AUDIFY  PREMIUM",12f,true,GREEN);
        brand.setGravity(Gravity.CENTER);
        brand.setLetterSpacing(.16f);
        LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(0,dp(48),1f); bp.leftMargin=dp(10); bp.rightMargin=dp(10);
        brand.setBackground(round(Color.argb(80,29,48,33),Color.argb(140,169,255,52),20));
        top.addView(brand,bp);
        TextView soon=text("BÊTA",10f,true,Color.rgb(205,214,225));
        soon.setGravity(Gravity.CENTER);
        soon.setBackground(round(Color.argb(80,36,45,58),Color.argb(120,90,106,128),18));
        top.addView(soon,new LinearLayout.LayoutParams(dp(58),dp(38)));
        page.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(50)));

        FrameLayout hero=new FrameLayout(this);
        hero.setBackground(gradient(new int[]{Color.rgb(18,26,36),Color.rgb(11,18,27),Color.rgb(7,12,18)},30,Color.argb(160,83,105,128)));
        hero.setPadding(dp(20),dp(22),dp(20),dp(22));
        hero.setElevation(dp(6));
        LinearLayout.LayoutParams hlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(350)); hlp.topMargin=dp(14);
        page.addView(hero,hlp);

        LinearLayout heroText=new LinearLayout(this);
        heroText.setOrientation(LinearLayout.VERTICAL);
        hero.addView(heroText,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        TextView eyebrow=text("APERÇU PREMIUM · BIENTÔT DISPONIBLE",10.5f,true,GREEN);
        eyebrow.setLetterSpacing(.11f);
        heroText.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));
        TextView title=text("Passe à Audify\nPremium",34f,true,TEXT);
        title.setLineSpacing(dp(2),.94f);
        heroText.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(92)));
        TextView sub=text("Une expérience musicale plus libre, plus sociale et entièrement à ton image.",14.5f,false,Color.rgb(181,194,208));
        sub.setLineSpacing(dp(2),1.08f);
        heroText.addView(sub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));

        LinearLayout priceRow=new LinearLayout(this); priceRow.setGravity(Gravity.BOTTOM);
        TextView price=text("10 €",42f,true,GREEN); priceRow.addView(price,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(60)));
        TextView month=text(" / mois",15f,true,Color.rgb(176,190,204)); month.setPadding(dp(5),0,0,dp(8)); priceRow.addView(month,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(60)));
        heroText.addView(priceRow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        TextView note=text("Les avantages ci-dessous sont en préparation. Aucun paiement n’est activé dans cette version.",11.5f,false,Color.rgb(125,141,158));
        note.setLineSpacing(dp(2),1.05f);
        heroText.addView(note,new LinearLayout.LayoutParams(dp(238),dp(58)));

        VinylView vinyl=new VinylView(this);
        FrameLayout.LayoutParams vlp=new FrameLayout.LayoutParams(dp(128),dp(128),Gravity.RIGHT|Gravity.BOTTOM); vlp.rightMargin=dp(4); vlp.bottomMargin=dp(8);
        hero.addView(vinyl,vlp);
        ObjectAnimator spin=ObjectAnimator.ofFloat(vinyl,"rotation",0f,360f); spin.setDuration(10000L); spin.setRepeatCount(ValueAnimator.INFINITE); spin.setInterpolator(null); spin.start();

        Button cta=button("Premium arrive bientôt · 10 € / mois",true);
        cta.setOnClickListener(new View.OnClickListener(){ @Override public void onClick(View v){ Toast.makeText(AudifyPremiumActivity.this,"Audify Premium sera activé dans une prochaine mise à jour.",Toast.LENGTH_LONG).show(); }});
        LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)); clp.topMargin=dp(16);
        page.addView(cta,clp);
        ObjectAnimator pulseX=ObjectAnimator.ofFloat(cta,"scaleX",1f,1.018f); pulseX.setDuration(1500); pulseX.setRepeatCount(ValueAnimator.INFINITE); pulseX.setRepeatMode(ValueAnimator.REVERSE); pulseX.setInterpolator(new AccelerateDecelerateInterpolator()); pulseX.start();
        ObjectAnimator pulseY=ObjectAnimator.ofFloat(cta,"scaleY",1f,1.018f); pulseY.setDuration(1500); pulseY.setRepeatCount(ValueAnimator.INFINITE); pulseY.setRepeatMode(ValueAnimator.REVERSE); pulseY.setInterpolator(new AccelerateDecelerateInterpolator()); pulseY.start();

        TextView section=text("TES AVANTAGES PREMIUM",12f,true,Color.rgb(217,226,236)); section.setLetterSpacing(.12f);
        LinearLayout.LayoutParams secp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(50)); secp.topMargin=dp(20); page.addView(section,secp);

        addFeature(page,"01","Zéro publicité","Profite d’Audify sans interruption publicitaire.","✦",0);
        addFeature(page,"02","Karaoké sans pub","Le Karaoké reste fluide du début à la fin.","🎤",1);
        addFeature(page,"03","Bannière personnalisée","Donne à ton profil une vraie identité visuelle.","▰",2);
        addFeature(page,"04","GIF sur ta photo de profil","Ajoute du mouvement et rends ton profil unique.","GIF",3);
        addFeature(page,"05","Lecteur totalement personnalisable","Change la pochette, le disque/vinyle et le style du lecteur.","◉",4);
        addFeature(page,"06","Playlists partagées","Invite un ami par lien et construisez la même playlist ensemble.","↔",5);
        addFeature(page,"07","Réactions entre amis","Réagis aux morceaux d’une playlist partagée avec ❤️ 🔥 😂 👏.","♥",6);
        addFeature(page,"08","Audify Party","Crée une session, invite tes amis et ajoutez des titres ensemble en direct.","⚡",7);

        LinearLayout party=new LinearLayout(this); party.setOrientation(LinearLayout.VERTICAL); party.setPadding(dp(18),dp(18),dp(18),dp(18));
        party.setBackground(gradient(new int[]{Color.rgb(17,28,24),Color.rgb(11,20,24),Color.rgb(11,15,24)},26,Color.argb(180,93,186,119)));
        LinearLayout.LayoutParams plp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(180)); plp.topMargin=dp(16); page.addView(party,plp);
        TextView ptag=text("AUDIFY PARTY",11f,true,GREEN); ptag.setLetterSpacing(.13f); party.addView(ptag,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));
        TextView ptitle=text("La musique devient un moment à plusieurs.",22f,true,TEXT); party.addView(ptitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));
        TextView psub=text("Lien d’invitation · plusieurs comptes · file commune · réactions · votes plus tard.",13f,false,Color.rgb(166,182,195)); party.addView(psub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));
        LinearLayout avatars=new LinearLayout(this); avatars.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL); party.addView(avatars,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));
        addAvatar(avatars,"A",GREEN); addAvatar(avatars,"K",CYAN); addAvatar(avatars,"S",PURPLE);
        TextView plus=text("  + tes amis",12f,true,Color.rgb(202,213,223)); avatars.addView(plus,new LinearLayout.LayoutParams(dp(100),dp(36)));

        hero.setAlpha(0f); hero.setTranslationY(dp(18)); hero.animate().alpha(1f).translationY(0f).setDuration(420).start();
        cta.setAlpha(0f); cta.setTranslationY(dp(12)); cta.animate().alpha(1f).translationY(0f).setStartDelay(180).setDuration(360).start();
        setContentView(root);
    }

    private void addFeature(LinearLayout page,String n,String title,String desc,String icon,int index){
        LinearLayout card=new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(14),dp(12),dp(14),dp(12));
        card.setBackground(gradient(new int[]{Color.argb(235,14,21,29),Color.argb(235,9,15,22)},24,Color.argb(150,63,78,95))); card.setElevation(dp(2));
        TextView glyph=text(icon,18f,true,GREEN); glyph.setGravity(Gravity.CENTER); glyph.setBackground(round(Color.rgb(28,39,31),Color.argb(150,106,176,82),18)); card.addView(glyph,new LinearLayout.LayoutParams(dp(48),dp(48)));
        LinearLayout body=new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(dp(12),0,dp(6),0); card.addView(body,new LinearLayout.LayoutParams(0,dp(72),1f));
        TextView t=text(title,15.8f,true,TEXT); body.addView(t,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));
        TextView d=text(desc,12.2f,false,MUTED); d.setMaxLines(2); body.addView(d,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));
        TextView num=text(n,10.5f,true,Color.rgb(111,126,142)); num.setGravity(Gravity.CENTER); card.addView(num,new LinearLayout.LayoutParams(dp(30),dp(40)));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(92)); lp.bottomMargin=dp(10); page.addView(card,lp);
        card.setAlpha(0f); card.setTranslationY(dp(18)); card.animate().alpha(1f).translationY(0f).setStartDelay(250L+index*55L).setDuration(330L).start();
    }

    private void addAvatar(LinearLayout parent,String v,int color){ TextView a=text(v,12f,true,BG); a.setGravity(Gravity.CENTER); a.setBackground(round(color,color,18)); LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(34),dp(34)); lp.rightMargin=dp(6); parent.addView(a,lp); }
    private Button button(String label,boolean accent){ Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextSize(accent?15f:20f); b.setTextColor(accent?Color.rgb(7,15,8):Color.WHITE); b.setGravity(Gravity.CENTER); b.setBackground(accent?gradient(new int[]{Color.rgb(193,255,96),GREEN,Color.rgb(109,237,57)},22,Color.rgb(215,255,170)):round(Color.argb(90,28,37,48),Color.argb(120,73,89,107),20)); b.setPadding(dp(8),0,dp(8),0); return b; }
    private TextView text(String s,float sp,boolean bold,int color){ TextView t=new TextView(this); t.setText(s); t.setTextSize(sp); t.setTextColor(color); if(bold)t.setTypeface(android.graphics.Typeface.DEFAULT,android.graphics.Typeface.BOLD); t.setGravity(Gravity.CENTER_VERTICAL); return t; }
    private GradientDrawable round(int fill,int stroke,int radius){ GradientDrawable g=new GradientDrawable(); g.setColor(fill); g.setCornerRadius(dp(radius)); g.setStroke(dp(1),stroke); return g; }
    private GradientDrawable gradient(int[] colors,int radius,int stroke){ GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,colors); g.setCornerRadius(dp(radius)); g.setStroke(dp(1),stroke); return g; }
    private int dp(int v){ return Math.round(v*getResources().getDisplayMetrics().density); }

    private static class GlowBackdrop extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG); private long start=SystemClock.uptimeMillis();
        GlowBackdrop(Activity c){ super(c); }
        @Override protected void onDraw(Canvas c){ super.onDraw(c); float w=getWidth(),h=getHeight(); float phase=(float)((SystemClock.uptimeMillis()-start)%5000)/5000f; float r=Math.max(w,h)*.55f; p.setShader(new RadialGradient(w*.80f,h*(.12f+.03f*(float)Math.sin(phase*6.283)),r,new int[]{Color.argb(80,91,255,104),Color.argb(35,47,180,255),Color.TRANSPARENT},new float[]{0f,.38f,1f},Shader.TileMode.CLAMP)); c.drawCircle(w*.8f,h*.16f,r,p); p.setShader(new RadialGradient(w*.08f,h*.62f,r,new int[]{Color.argb(48,132,88,255),Color.argb(14,58,222,255),Color.TRANSPARENT},null,Shader.TileMode.CLAMP)); c.drawCircle(w*.1f,h*.62f,r,p); postInvalidateDelayed(48L); }
    }

    private static class VinylView extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        VinylView(Activity c){ super(c); setLayerType(View.LAYER_TYPE_SOFTWARE,null); }
        @Override protected void onDraw(Canvas c){ super.onDraw(c); float cx=getWidth()/2f,cy=getHeight()/2f,r=Math.min(cx,cy)-3; p.setStyle(Paint.Style.FILL); p.setColor(Color.argb(230,5,8,11)); p.setShadowLayer(20,0,0,Color.argb(150,126,255,73)); c.drawCircle(cx,cy,r,p); p.clearShadowLayer(); p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(1.2f); for(int i=0;i<7;i++){ p.setColor(Color.argb(80+i*10,118,136,151)); c.drawCircle(cx,cy,r-(i*8+9),p);} p.setStyle(Paint.Style.FILL); p.setColor(Color.rgb(171,255,55)); c.drawCircle(cx,cy,r*.25f,p); p.setColor(Color.rgb(8,16,10)); c.drawCircle(cx,cy,r*.07f,p); }
    }
}
