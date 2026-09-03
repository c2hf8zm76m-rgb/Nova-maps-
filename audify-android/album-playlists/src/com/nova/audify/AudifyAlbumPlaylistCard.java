package com.nova.audify;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;
import org.json.JSONObject;

/** A distinct album card INSIDE Playlists; never owns a player or alters playback. */
public final class AudifyAlbumPlaylistCard {
    public interface ImageLoader { void load(ImageView target, String url); }
    private static final int LIME = Color.rgb(184, 255, 66);
    private AudifyAlbumPlaylistCard() {}

    public static View create(Context c, String name, JSONObject album, int count, ImageLoader loader, Runnable open) {
        return create(c,name,album,count,loader,open,"Ouvrir l’album   ›");
    }

    public static View create(Context c, String name, JSONObject album, int count, ImageLoader loader, Runnable open, String actionText) {
        LinearLayout card = new LinearLayout(c);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(c,16), dp(c,16), dp(c,16), dp(c,16));
        card.setBackground(background(c, Color.rgb(33,29,55), Color.rgb(9,16,22), Color.rgb(98,82,143), 26));
        card.setContentDescription(name + ", album, " + count + " titres");
        card.addView(label(c, "ALBUM  ·  DANS TES PLAYLISTS", 10.5f, LIME, true), full());

        View art = artwork(c, album, loader);
        LinearLayout.LayoutParams artLp = new LinearLayout.LayoutParams(-1, dp(c,200));
        artLp.topMargin = dp(c,12); artLp.bottomMargin = dp(c,10);
        card.addView(art, artLp);

        TextView title = label(c, name, 23f, Color.WHITE, true);
        title.setPadding(0,0,0,dp(c,5));
        card.addView(title, full());
        card.addView(label(c, details(album,count), 13f, Color.rgb(191,196,211), false), full());
        TextView action = label(c, actionText, 15f, LIME, true);
        action.setGravity(Gravity.CENTER);
        action.setMinHeight(dp(c,48));
        action.setPadding(dp(c,12),dp(c,10),dp(c,12),dp(c,10));
        action.setBackground(background(c, Color.rgb(28,41,28), Color.rgb(17,28,25), Color.rgb(79,113,50), 17));
        LinearLayout.LayoutParams actionLp = full(); actionLp.topMargin=dp(c,14);
        card.addView(action,actionLp);
        card.setOnClickListener(v -> open.run());
        return card;
    }

    public static String details(JSONObject album, int count) {
        String artist=album.optString("artist", "Artiste inconnu"), date=album.optString("date");
        int total=album.optInt("totalCount", count), saved=album.optInt("savedCount",count);
        String result=artist+(date.length()>=4?" · "+date.substring(0,4):"")+" · "+count+" titre"+(count>1?"s":"");
        if (saved<total) result+="\nImport partiel : "+saved+" / "+total+" titres trouvés";
        return result;
    }

    public static View artwork(Context c, JSONObject album, ImageLoader loader) {
        Sleeve frame=new Sleeve(c);
        frame.setBackground(background(c,Color.rgb(42,27,66),Color.rgb(13,24,31),Color.TRANSPARENT,18));
        frame.setClipToOutline(true);
        TextView fallback=label(c,"A",74f,LIME,true);
        fallback.setGravity(Gravity.CENTER);
        fallback.setBackground(background(c,Color.rgb(69,45,108),Color.rgb(16,27,40),Color.rgb(90,76,126),10));
        frame.coverFallback=fallback;
        frame.addView(fallback,new FrameLayout.LayoutParams(1,1));
        ImageView cover=new ImageView(c);
        cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        cover.setContentDescription("Pochette de "+album.optString("title","l’album"));
        cover.setBackground(background(c,Color.TRANSPARENT,Color.TRANSPARENT,Color.TRANSPARENT,10));
        cover.setClipToOutline(true);
        frame.cover=cover;
        frame.addView(cover,new FrameLayout.LayoutParams(1,1));
        String url=album.optString("cover");
        if (!url.isEmpty()) loader.load(cover,url);
        return frame;
    }

    private static final class Sleeve extends FrameLayout {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        View cover,coverFallback;
        Sleeve(Context c){super(c);setWillNotDraw(false);}
        @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){
            super.onSizeChanged(w,h,oldw,oldh);
            int size=Math.min(h-dp(getContext(),20),Math.round(w*.68f));
            size=Math.max(1,size);
            for(View view:new View[]{coverFallback,cover}){
                FrameLayout.LayoutParams lp=(FrameLayout.LayoutParams)view.getLayoutParams();
                lp.width=size;lp.height=size;lp.leftMargin=dp(getContext(),12);lp.topMargin=(h-size)/2;
                view.setLayoutParams(lp);
            }
        }
        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            float r=Math.min(getHeight()*.44f,getWidth()*.34f),cx=getWidth()-r-dp(getContext(),8),cy=getHeight()*.5f;
            paint.setStyle(Paint.Style.FILL);paint.setColor(Color.rgb(6,9,15));canvas.drawCircle(cx,cy,r,paint);
            paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(dp(getContext(),1));
            for(int i=0;i<12;i++){paint.setColor(i%3==0?Color.rgb(72,53,105):Color.rgb(27,30,42));canvas.drawCircle(cx,cy,r*(.43f+i*.047f),paint);}
            paint.setColor(LIME);canvas.drawCircle(cx,cy,r*.28f,paint);
            paint.setStyle(Paint.Style.FILL);paint.setColor(Color.rgb(94,61,143));canvas.drawCircle(cx,cy,r*.23f,paint);
            paint.setColor(LIME);canvas.drawCircle(cx,cy,r*.045f,paint);
        }
    }

    private static TextView label(Context c,String value,float sp,int color,boolean bold){
        TextView t=new TextView(c);t.setText(value);t.setTextSize(sp);t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT_BOLD);return t;
    }
    private static GradientDrawable background(Context c,int start,int end,int stroke,int radius){
        GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{start,end});
        bg.setCornerRadius(dp(c,radius));if(stroke!=Color.TRANSPARENT)bg.setStroke(dp(c,1),stroke);return bg;
    }
    private static LinearLayout.LayoutParams full(){return new LinearLayout.LayoutParams(-1,-2);}
    private static int dp(Context c,int value){return Math.round(value*c.getResources().getDisplayMetrics().density);}
}
