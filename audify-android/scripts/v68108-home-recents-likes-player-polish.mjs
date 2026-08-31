import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const likesPath=path.join(pkgDir,'NativeLikesActivity.java');
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.10.8 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) HOME : plus de bouton "Installer Audify", récents à sélection par swipe,
//    favoris compacts + ouverture d'une vraie page Titres likés.
// =============================================================================
let home=await readFile(homePath,'utf8');

home=replaceMethod(home,['    private void addFavoritesIntro(){','    private void addFavoritesIntro() {'],String.raw`    private void addFavoritesIntro(){
        LinearLayout intro=sectionPanel();
        intro.setPadding(dp(18),dp(17),dp(18),dp(18));

        TextView badge=text("AUDIFY HOME",12f,true);
        badge.setTextColor(ACCENT);
        badge.setGravity(Gravity.CENTER);
        badge.setLetterSpacing(0.13f);
        badge.setBackground(round(Color.rgb(30,49,24),0,Color.TRANSPARENT,dp(23)));
        intro.addView(badge,new LinearLayout.LayoutParams(dp(146),dp(42)));

        TextView h=text("Mes favoris",31f,true);
        LinearLayout.LayoutParams hlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        hlp.topMargin=dp(14);
        intro.addView(h,hlp);

        TextView sub=text("Tous les titres que tu likes apparaissent ici automatiquement.",17f,false);
        sub.setTextColor(Color.rgb(180,189,202));
        sub.setLineSpacing(dp(1),1.08f);
        sub.setPadding(0,dp(8),0,dp(4));
        intro.addView(sub);

        // V68.10.8 : Audify est déjà l'application installée. Aucun bouton de téléchargement ici.
        addPanel(intro,dp(18));
    }`,'addFavoritesIntro');

home=replaceMethod(home,['    private void addRecentSection(){','    private void addRecentSection() {'],String.raw`    private void addRecentSection(){
        List<AudifyLibraryStore.Track> recents=store.getRecents();
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(16),dp(14),dp(18));

        LinearLayout head=new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Écoutés récemment",24f,true);
        head.addView(title,new LinearLayout.LayoutParams(0,dp(58),1f));
        Button all=pillButton("Tout voir");
        all.setTextSize(14f);
        all.setOnClickListener(v->showTrackPicker("Écoutés récemment",recents));
        head.addView(all,new LinearLayout.LayoutParams(dp(112),dp(50)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        if(recents.isEmpty()){
            TextView empty=text("Tes prochains morceaux écoutés apparaîtront ici.",15f,false);
            empty.setTextColor(Color.rgb(158,168,182));
            empty.setPadding(dp(2),dp(12),0,dp(18));
            panel.addView(empty);
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false);
            hsv.setFillViewport(false);
            hsv.setOverScrollMode(View.OVER_SCROLL_NEVER);

            LinearLayout rail=new LinearLayout(this);
            rail.setOrientation(LinearLayout.HORIZONTAL);
            rail.setGravity(Gravity.BOTTOM);

            int screenW=getResources().getDisplayMetrics().widthPixels;
            int activeW=Math.min(dp(330),Math.max(dp(245),(int)(screenW*0.57f)));
            int smallW=Math.max(dp(155),(int)(activeW*0.68f));
            java.util.ArrayList<LinearLayout> cards=new java.util.ArrayList<>();

            int limit=Math.min(10,recents.size());
            for(int i=0;i<limit;i++){
                AudifyLibraryStore.Track t=recents.get(i);
                boolean active=i==0;
                int cardW=active?activeW:smallW;
                int cover=active?cardW-dp(22):cardW-dp(18);

                LinearLayout card=new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(active?dp(10):dp(8),active?dp(10):dp(8),active?dp(10):dp(8),dp(10));
                card.setBackground(round(active?Color.rgb(11,17,23):Color.rgb(9,14,20),dp(active?2:1),active?Color.rgb(103,163,49):Color.rgb(44,52,63),dp(active?25:21)));
                card.setElevation(active?dp(9):dp(2));
                card.setAlpha(active?1f:0.62f);
                card.setOnClickListener(v->playTrack(t));

                ImageView art=artworkView();
                loadImage(art,t.thumbnail);
                card.addView(art,new LinearLayout.LayoutParams(cover,cover));

                TextView tt=text(t.title,active?18f:14.5f,true);
                tt.setMaxLines(active?2:1);
                tt.setEllipsize(TextUtils.TruncateAt.END);
                tt.setPadding(dp(2),dp(active?11:8),0,0);
                card.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,active?dp(58):dp(38)));

                TextView aa=text(t.artist,active?14f:12f,false);
                aa.setTextColor(Color.rgb(166,175,188));
                aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
                card.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,active?dp(28):dp(23)));

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(cardW,active?cover+dp(108):cover+dp(78));
                cp.rightMargin=dp(13);
                cp.bottomMargin=active?0:dp(18);
                rail.addView(card,cp);
                cards.add(card);
            }

            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT));
            final int[] selected={0};
            hsv.setOnTouchListener((v,event)->{
                int action=event.getActionMasked();
                if(action==android.view.MotionEvent.ACTION_UP||action==android.view.MotionEvent.ACTION_CANCEL){
                    hsv.postDelayed(()->{
                        if(cards.isEmpty()) return;
                        int viewportCenter=hsv.getScrollX()+hsv.getWidth()/2;
                        int nearest=0;
                        int nearestDistance=Integer.MAX_VALUE;
                        for(int i=0;i<cards.size();i++){
                            LinearLayout c=cards.get(i);
                            int center=c.getLeft()+c.getWidth()/2;
                            int distance=Math.abs(center-viewportCenter);
                            if(distance<nearestDistance){nearestDistance=distance;nearest=i;}
                        }
                        selected[0]=nearest;
                        applyRecentSelectionV68108(hsv,cards,nearest);
                    },220L);
                }
                return false;
            });
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        addPanel(panel,dp(18));
    }`,'addRecentSection');

if(!home.includes('private void applyRecentSelectionV68108(')){
  const marker='    private void addFavoritesIntro(){';
  if(!home.includes(marker)) throw new Error('V68.10.8 marker récents introuvable');
  const helper=String.raw`    private void applyRecentSelectionV68108(HorizontalScrollView hsv,java.util.ArrayList<LinearLayout> cards,int selected){
        if(hsv==null||cards==null||cards.isEmpty()) return;
        int screenW=getResources().getDisplayMetrics().widthPixels;
        int activeW=Math.min(dp(330),Math.max(dp(245),(int)(screenW*0.57f)));
        int smallW=Math.max(dp(155),(int)(activeW*0.68f));

        for(int i=0;i<cards.size();i++){
            LinearLayout card=cards.get(i);
            boolean active=i==selected;
            int cardW=active?activeW:smallW;
            int cover=active?cardW-dp(22):cardW-dp(18);
            ViewGroup.LayoutParams raw=card.getLayoutParams();
            if(raw instanceof LinearLayout.LayoutParams){
                LinearLayout.LayoutParams cp=(LinearLayout.LayoutParams)raw;
                cp.width=cardW;
                cp.height=active?cover+dp(108):cover+dp(78);
                cp.bottomMargin=active?0:dp(18);
                card.setLayoutParams(cp);
            }
            card.setPadding(active?dp(10):dp(8),active?dp(10):dp(8),active?dp(10):dp(8),dp(10));
            card.setBackground(round(active?Color.rgb(11,17,23):Color.rgb(9,14,20),dp(active?2:1),active?Color.rgb(103,163,49):Color.rgb(44,52,63),dp(active?25:21)));
            card.setElevation(active?dp(9):dp(2));
            card.animate().alpha(active?1f:0.60f).scaleX(active?1f:0.97f).scaleY(active?1f:0.97f).setDuration(190L).start();

            if(card.getChildCount()>0){
                View art=card.getChildAt(0);
                ViewGroup.LayoutParams alp=art.getLayoutParams();
                alp.width=cover; alp.height=cover; art.setLayoutParams(alp);
            }
            if(card.getChildCount()>1 && card.getChildAt(1) instanceof TextView){
                TextView tt=(TextView)card.getChildAt(1);
                tt.setTextSize(active?18f:14.5f);
                tt.setMaxLines(active?2:1);
                ViewGroup.LayoutParams tlp=tt.getLayoutParams(); tlp.height=active?dp(58):dp(38); tt.setLayoutParams(tlp);
            }
            if(card.getChildCount()>2 && card.getChildAt(2) instanceof TextView){
                TextView aa=(TextView)card.getChildAt(2);
                aa.setTextSize(active?14f:12f);
                ViewGroup.LayoutParams alp=aa.getLayoutParams(); alp.height=active?dp(28):dp(23); aa.setLayoutParams(alp);
            }
        }

        final int safe=Math.max(0,Math.min(selected,cards.size()-1));
        hsv.post(()->{
            LinearLayout activeCard=cards.get(safe);
            int target=activeCard.getLeft()-Math.max(0,(hsv.getWidth()-activeCard.getWidth())/2);
            hsv.smoothScrollTo(Math.max(0,target),0);
        });
    }

`;
  home=home.replace(marker,helper+marker);
}

home=replaceMethod(home,['    private void addLikesSection(){','    private void addLikesSection() {'],String.raw`    private void addLikesSection(){
        List<AudifyLibraryStore.Track> likes=store.getLikes();
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(14),dp(14),dp(16));

        LinearLayout head=new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Titres likés",24f,true);
        head.addView(title);
        TextView count=text("  "+likes.size()+" favoris",13.5f,false);
        count.setTextColor(Color.rgb(173,183,197));
        head.addView(count,new LinearLayout.LayoutParams(0,dp(54),1f));
        Button all=pillButton("Ouvrir");
        all.setTextSize(13.5f);
        all.setOnClickListener(v->startActivity(new Intent(this,NativeLikesActivity.class)));
        head.addView(all,new LinearLayout.LayoutParams(dp(104),dp(48)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        if(likes.isEmpty()){
            TextView empty=text("Aucun favori pour l’instant.",15f,false);
            empty.setTextColor(Color.rgb(155,165,178));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(64)));
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false);
            hsv.setOverScrollMode(View.OVER_SCROLL_NEVER);
            LinearLayout rail=new LinearLayout(this);
            rail.setOrientation(LinearLayout.HORIZONTAL);
            int shown=Math.min(6,likes.size());
            for(int i=0;i<shown;i++){
                View card=likePreviewCardV68108(likes.get(i));
                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(246),dp(82));
                cp.rightMargin=dp(9);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(86)));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(90)));
        }
        addPanel(panel,dp(18));
    }`,'addLikesSection');

if(!home.includes('private View likePreviewCardV68108(')){
  const marker='    private View likeCard(AudifyLibraryStore.Track t){';
  if(!home.includes(marker)) throw new Error('V68.10.8 marker likeCard introuvable');
  const helper=String.raw`    private View likePreviewCardV68108(AudifyLibraryStore.Track t){
        LinearLayout card=new LinearLayout(this);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(8),dp(8),dp(7),dp(8));
        card.setBackground(round(Color.rgb(12,18,25),dp(1),Color.rgb(43,53,64),dp(20)));
        card.setElevation(dp(3));
        card.setOnClickListener(v->playTrack(t));

        ImageView art=artworkView();
        loadImage(art,t.thumbnail);
        card.addView(art,new LinearLayout.LayoutParams(dp(60),dp(60)));

        LinearLayout info=new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setGravity(Gravity.CENTER_VERTICAL);
        info.setPadding(dp(9),0,dp(5),0);
        TextView tt=text(t.title,13.5f,true);
        tt.setMaxLines(2); tt.setEllipsize(TextUtils.TruncateAt.END);
        TextView aa=text(t.artist,11.5f,false);
        aa.setTextColor(Color.rgb(166,175,188)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38)));
        info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(20)));
        card.addView(info,new LinearLayout.LayoutParams(0,dp(62),1f));

        TextView heart=text("♥",20f,true);
        heart.setTextColor(Color.rgb(255,86,121));
        heart.setGravity(Gravity.CENTER);
        heart.setContentDescription("Retirer des favoris");
        heart.setOnClickListener(v->{store.toggleLike(t);rebuildLibrary();});
        card.addView(heart,new LinearLayout.LayoutParams(dp(38),dp(58)));
        return card;
    }

`;
  home=home.replace(marker,helper+marker);
}

await writeFile(homePath,home,'utf8');

// =============================================================================
// 2) TITRES LIKÉS : page native dédiée, courte, ordonnée et très fluide.
// =============================================================================
const likesActivity=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NativeLikesActivity extends AppCompatActivity {
    private static final int ACCENT=Color.rgb(168,255,63);
    private AudifyLibraryStore store;
    private LinearLayout content;
    private final ExecutorService images=Executors.newFixedThreadPool(4);
    private final Handler handler=new Handler(Looper.getMainLooper());

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        if(getSupportActionBar()!=null)getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(3,5,8));
        store=new AudifyLibraryStore(this);
        build();
    }

    @Override protected void onResume(){super.onResume();rebuild();}

    private void build(){
        FrameLayout root=new FrameLayout(this);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.rgb(12,18,20),Color.rgb(5,9,13),Color.rgb(3,5,8)}));
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true); scroll.setVerticalScrollBarEnabled(false);
        content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(16),dp(12),dp(16),dp(34));
        scroll.addView(content,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        rebuild();
    }

    private void rebuild(){
        if(content==null)return;
        content.removeAllViews();
        List<AudifyLibraryStore.Track> likes=store.getLikes();

        LinearLayout header=new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL);
        Button close=button("✕  Home",false); close.setOnClickListener(v->finish());
        header.addView(close,new LinearLayout.LayoutParams(dp(108),dp(46)));
        TextView brand=text("AUDIFY LIKES",11f,true,ACCENT); brand.setGravity(Gravity.END|Gravity.CENTER_VERTICAL); brand.setLetterSpacing(0.13f);
        header.addView(brand,new LinearLayout.LayoutParams(0,dp(46),1f));
        content.addView(header,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));

        LinearLayout titleRow=new LinearLayout(this); titleRow.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout titleBox=new LinearLayout(this); titleBox.setOrientation(LinearLayout.VERTICAL);
        TextView title=text("Titres likés",30f,true,Color.WHITE);
        TextView meta=text(likes.size()+" favori"+(likes.size()>1?"s":"")+" · accès rapide",13f,false,Color.rgb(176,186,199));
        titleBox.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(46)));
        titleBox.addView(meta,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(25)));
        titleRow.addView(titleBox,new LinearLayout.LayoutParams(0,dp(74),1f));
        Button playAll=button("▶  Tout lire",true); playAll.setEnabled(!likes.isEmpty()); playAll.setOnClickListener(v->playCollection(likes,0));
        titleRow.addView(playAll,new LinearLayout.LayoutParams(dp(124),dp(50)));
        LinearLayout.LayoutParams trp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(82)); trp.topMargin=dp(8); content.addView(titleRow,trp);

        if(likes.isEmpty()){
            LinearLayout empty=new LinearLayout(this); empty.setGravity(Gravity.CENTER); empty.setOrientation(LinearLayout.VERTICAL); empty.setPadding(dp(18),dp(26),dp(18),dp(26));
            empty.setBackground(round(Color.rgb(13,19,26),Color.rgb(43,53,64),24));
            empty.addView(text("Aucun titre liké",20f,true,Color.WHITE));
            TextView hint=text("Appuie sur le cœur dans le lecteur pour retrouver tes morceaux ici.",14f,false,Color.rgb(163,174,188)); hint.setGravity(Gravity.CENTER); hint.setPadding(0,dp(8),0,0); empty.addView(hint);
            LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(150)); ep.topMargin=dp(16); content.addView(empty,ep);
            return;
        }

        for(int i=0;i<likes.size();i++){
            final int index=i;
            AudifyLibraryStore.Track t=likes.get(i);
            LinearLayout row=new LinearLayout(this); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(8),dp(7),dp(8),dp(7));
            row.setBackground(round(Color.rgb(15,21,28),Color.rgb(39,49,60),20)); row.setElevation(dp(2));

            TextView number=text(String.format(java.util.Locale.ROOT,"%02d",i+1),11.5f,true,Color.rgb(119,132,147)); number.setGravity(Gravity.CENTER);
            row.addView(number,new LinearLayout.LayoutParams(dp(34),dp(60)));

            ImageView art=new ImageView(this); art.setScaleType(ImageView.ScaleType.CENTER_CROP); art.setBackgroundColor(Color.rgb(27,34,43)); art.setClipToOutline(true);
            art.setOutlineProvider(new ViewOutlineProvider(){@Override public void getOutline(View view,Outline o){o.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(13));}});
            loadImage(art,t.thumbnail); art.setOnClickListener(v->playCollection(likes,index));
            row.addView(art,new LinearLayout.LayoutParams(dp(62),dp(62)));

            LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setGravity(Gravity.CENTER_VERTICAL); info.setPadding(dp(10),0,dp(6),0); info.setOnClickListener(v->playCollection(likes,index));
            TextView tt=text(t.title,15f,true,Color.WHITE); tt.setMaxLines(1); tt.setEllipsize(TextUtils.TruncateAt.END);
            TextView aa=text(t.artist,12.5f,false,Color.rgb(174,184,198)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
            info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(29)));
            info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(24)));
            row.addView(info,new LinearLayout.LayoutParams(0,dp(62),1f));

            Button heart=button("♥",false); heart.setTextSize(19f); heart.setTextColor(Color.rgb(255,83,119)); heart.setContentDescription("Retirer des titres likés");
            heart.setOnClickListener(v->{store.toggleLike(t);rebuild();});
            row.addView(heart,new LinearLayout.LayoutParams(dp(46),dp(46)));

            LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(80)); rp.bottomMargin=dp(7); content.addView(row,rp);
        }
    }

    private void playCollection(List<AudifyLibraryStore.Track> tracks,int index){
        if(tracks==null||tracks.isEmpty()||index<0||index>=tracks.size())return;
        AudifyLibraryStore.Track t=tracks.get(index);
        try{
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SET_QUEUE).putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(tracks,index)));
            startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,t.id).putExtra(AudifyPlaybackService.EXTRA_TITLE,t.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,t.artist).putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,t.thumbnail));
            handler.postDelayed(()->startActivity(new Intent(this,NativePlayerActivity.class)
                .putExtra("videoId",t.id).putExtra("title",t.title).putExtra("artist",t.artist).putExtra("thumbnail",t.thumbnail)),120L);
        }catch(Exception e){Toast.makeText(this,"Impossible de lire ce titre",Toast.LENGTH_SHORT).show();}
    }

    private void loadImage(ImageView target,String raw){
        String url=safe(raw); if(url.isEmpty())return;
        images.execute(()->{HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(5500);c.setReadTimeout(6500);c.setUseCaches(true);try(InputStream in=c.getInputStream()){Bitmap b=BitmapFactory.decodeStream(in);if(b!=null)runOnUiThread(()->target.setImageBitmap(b));}}catch(Exception ignored){}finally{if(c!=null)c.disconnect();}});
    }

    private Button button(String label,boolean accent){
        Button b=new Button(this); b.setAllCaps(false); b.setText(label); b.setTextSize(13.5f); b.setPadding(dp(10),0,dp(10),0); b.setTypeface(b.getTypeface(),android.graphics.Typeface.BOLD); b.setStateListAnimator(null);
        GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,accent?new int[]{Color.rgb(181,255,79),Color.rgb(119,224,41)}:new int[]{Color.rgb(35,43,55),Color.rgb(22,28,38)});
        bg.setCornerRadius(dp(18)); if(!accent)bg.setStroke(dp(1),Color.rgb(65,76,90)); b.setBackground(bg); b.setTextColor(accent?Color.rgb(9,18,7):Color.WHITE); return b;
    }

    private TextView text(String value,float size,boolean bold,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER_VERTICAL);if(bold)t.setTypeface(t.getTypeface(),android.graphics.Typeface.BOLD);return t;}
    private GradientDrawable round(int fill,int stroke,int radius){GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));g.setStroke(dp(1),stroke);return g;}
    private String safe(String s){return s==null?"":s.trim();}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    @Override protected void onDestroy(){images.shutdownNow();handler.removeCallbacksAndMessages(null);super.onDestroy();}
}
`;
await writeFile(likesPath,likesActivity,'utf8');

// =============================================================================
// 3) PLAYER : panneau moins large, verre neutre sans encadré vert + disque
//    explicitement restauré après chaque transition de pochette.
// =============================================================================
let player=await readFile(playerPath,'utf8');

player=player.replace(
  '                Color.argb(205,44,58,53),\n                Color.argb(174,25,34,35),\n                Color.argb(150,13,19,25)',
  '                Color.argb(205,42,47,58),\n                Color.argb(176,24,29,38),\n                Color.argb(152,12,16,23)'
);
player=player.replace('        controlsBg.setStroke(dp(1),Color.argb(132,173,255,96));','        controlsBg.setStroke(0,Color.TRANSPARENT);');
player=player.replace(
  '        int controlsWidth=Math.min(screenW-dp(30),dp(560));\n        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(controlsWidth,dp(158),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);\n        controlsLp.bottomMargin=dp(58);',
  '        int controlsWidth=Math.min(screenW-dp(82),dp(455));\n        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(controlsWidth,dp(154),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);\n        controlsLp.bottomMargin=dp(58);'
);
player=player.replace('        scrollerLp.bottomMargin=dp(228);','        scrollerLp.bottomMargin=dp(218);');
player=player.replace('        controlTop.addView(playPauseButton,new LinearLayout.LayoutParams(dp(84),dp(84)));','        controlTop.addView(playPauseButton,new LinearLayout.LayoutParams(dp(72),dp(72)));');
player=player.replace('        controlTop.addView(karaokeButton,new LinearLayout.LayoutParams(dp(165),dp(58)));','        controlTop.addView(karaokeButton,new LinearLayout.LayoutParams(dp(148),dp(54)));');

if(!player.includes('private void restoreVinylV68108()')){
  const marker='    private LinearLayout.LayoutParams weighted() {';
  if(!player.includes(marker)) throw new Error('V68.10.8 marker player helper introuvable');
  const helper=String.raw`    private void restoreVinylV68108(){
        if(artworkSwiping||artworkTransitioning)return;
        if(disc!=null){
            disc.animate().cancel();
            disc.setVisibility(View.VISIBLE);
            disc.setAlpha(1f);
            disc.setTranslationX(0f);
            disc.setTranslationY(0f);
            disc.setScaleX(1f);
            disc.setScaleY(1f);
            disc.bringToFront();
        }
        if(discImage!=null){discImage.setVisibility(View.VISIBLE);discImage.setAlpha(1f);}
        if(coverImage!=null){coverImage.setVisibility(View.VISIBLE);coverImage.setAlpha(1f);coverImage.bringToFront();}
    }

`;
  player=player.replace(marker,helper+marker);
}

player=replaceMethod(player,['    private void loadArtwork(String rawUrl, String videoId) {','    private void loadArtwork(String rawUrl,String videoId){','    private void loadArtwork(String rawUrl, String videoId){'],String.raw`    private void loadArtwork(String rawUrl,String videoId){
        final String imageUrl=rawUrl!=null&&!rawUrl.trim().isEmpty()?rawUrl.trim():(videoId==null||videoId.isEmpty()?"":"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg");
        if(imageUrl.isEmpty())return;
        new Thread(()->{
            HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(imageUrl).openConnection();
                connection.setConnectTimeout(7000); connection.setReadTimeout(7000); connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent","AudifyAndroid/68.10.8");
                try(InputStream input=connection.getInputStream()){
                    Bitmap bitmap=BitmapFactory.decodeStream(input);
                    if(bitmap!=null)runOnUiThread(()->{
                        if(coverImage!=null)coverImage.setImageBitmap(bitmap);
                        if(discImage!=null)discImage.setImageBitmap(bitmap);
                        restoreVinylV68108();
                    });
                }
            }catch(Throwable ignored){}finally{if(connection!=null)connection.disconnect();}
        },"audify-artwork-v68108").start();
    }`,'loadArtwork');

player=player.replace('    private void refreshFromPlayer() {\n        try {','    private void refreshFromPlayer() {\n        restoreVinylV68108();\n        try {');
player=player.replace('    private void refreshFromPlayer(){\n        try {','    private void refreshFromPlayer(){\n        restoreVinylV68108();\n        try {');
player=player.split('if(disc!=null) disc.setTranslationX(0f);').join('restoreVinylV68108();');

await writeFile(playerPath,player,'utf8');

// Manifest : vraie destination Titres likés.
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".NativeLikesActivity"')){
  manifest=manifest.replace('</application>','        <activity android:name=".NativeLikesActivity" android:exported="false" />\n    </application>');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.10.8 : Home sans installation, récents sélectionnables au swipe, lecteur compact + vinyle stable et Titres likés 2.0.');
