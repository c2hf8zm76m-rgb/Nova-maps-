package com.nova.audify;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.*;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.view.animation.LinearInterpolator;

/** The original A is stationary. Only the shader travels inside its alpha mask. */
public final class AudifyChromaLogoView extends View {
    public static final int GREEN=Color.rgb(157,255,50);
    private final Bitmap original,mask;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final Paint maskPaint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final RectF bounds=new RectF();
    private final Matrix matrix=new Matrix();
    private final int[] colors={0xFF399CFA,0xFF793FE4,0xFFCF35EB,0xFFFB769A,0xFFFF9B48,0xFF399CFA};
    private Shader shader;
    private ValueAnimator flow,settle;
    private float phase=0f,green=0f,flowMix=0f;
    private boolean running=false,ready=false;

    public AudifyChromaLogoView(Context context){
        super(context);
        original=BitmapFactory.decodeResource(getResources(),R.drawable.audify_mark);
        mask=original.extractAlpha();
        maskPaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_IN));
        setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    }
    public static boolean motionEnabled(Context context){
        if(Build.VERSION.SDK_INT>=26)return ValueAnimator.areAnimatorsEnabled();
        return Settings.Global.getFloat(context.getContentResolver(),Settings.Global.ANIMATOR_DURATION_SCALE,1f)>0f;
    }
    @Override protected void onSizeChanged(int w,int h,int oldW,int oldH){
        bounds.set(0,0,w,h);
        shader=new LinearGradient(0,0,0,h*1.3f,colors,null,Shader.TileMode.REPEAT);
    }
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        if(shader==null)return;
        final int layer=canvas.saveLayer(bounds,null);
        matrix.setTranslate(0,-phase*getHeight()*1.3f);
        matrix.postRotate(-12f,getWidth()/2f,getHeight()/2f);
        shader.setLocalMatrix(matrix);
        paint.setShader(shader);paint.setAlpha(255);canvas.drawRect(bounds,paint);paint.setShader(null);
        if(green>0){paint.setColor(GREEN);paint.setAlpha(Math.round(255*green));canvas.drawRect(bounds,paint);}
        canvas.drawBitmap(mask,null,bounds,maskPaint);canvas.restoreToCount(layer);
        if(flowMix<1f&&green<1f){
            paint.setAlpha(Math.round(255*(1f-flowMix)*(1f-green)));
            canvas.drawBitmap(original,null,bounds,paint);paint.setAlpha(255);
        }
    }
    public void setRunning(boolean value){
        running=value;
        if(!value){if(flow!=null)flow.pause();if(settle!=null)settle.pause();return;}
        if(settle!=null&&settle.isPaused())settle.resume();
        if(ready||!motionEnabled(getContext()))return;
        if(flow==null){
            flow=ValueAnimator.ofFloat(0,1);flow.setDuration(6200);flow.setRepeatCount(ValueAnimator.INFINITE);
            flow.setInterpolator(new LinearInterpolator());
            flow.addUpdateListener(a->{phase=(Float)a.getAnimatedValue();flowMix=Math.min(1f,flow.getCurrentPlayTime()/500f);invalidate();});
            flow.start();
        }else if(flow.isPaused())flow.resume();
    }
    public void ready(Runnable afterGreen){
        if(ready)return;ready=true;
        if(flow!=null){flow.cancel();flow=null;}
        if(!motionEnabled(getContext())){green=1f;invalidate();afterGreen.run();return;}
        settle=ValueAnimator.ofFloat(green,1f);settle.setDuration(460);
        settle.addUpdateListener(a->{green=(Float)a.getAnimatedValue();invalidate();});
        settle.addListener(new AnimatorListenerAdapter(){boolean cancelled;
            @Override public void onAnimationCancel(Animator a){cancelled=true;}
            @Override public void onAnimationEnd(Animator a){if(!cancelled)afterGreen.run();}
        });
        settle.start();if(!running)settle.pause();
    }
    public void dispose(){
        if(flow!=null){flow.removeAllUpdateListeners();flow.cancel();flow=null;}
        if(settle!=null){settle.removeAllListeners();settle.removeAllUpdateListeners();settle.cancel();settle=null;}
    }
    @Override protected void onDetachedFromWindow(){dispose();super.onDetachedFromWindow();}
}
