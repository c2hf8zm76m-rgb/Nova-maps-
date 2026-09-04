import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
const resDir = path.join(android, 'app', 'src', 'main', 'res');
const splashPath = path.join(pkgDir, 'AudifySplashActivity.java');
const marker = 'AUDIFY_V6812651_RESTORE_INTRO_MORPH';

let splash = await readFile(splashPath, 'utf8');
if (!splash.includes('Audify V68.12.18')) {
  throw new Error('V68.12.65.1: Pulse Splash source not found');
}

const logoStart = splash.indexOf('        FrameLayout logoShell=new FrameLayout(this);');
const logoEndNeedle = '        logoShell.addView(logo,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));';
const logoEnd = splash.indexOf(logoEndNeedle, logoStart);
if (logoStart < 0 || logoEnd < 0) {
  throw new Error('V68.12.65.1: legacy raster logo block not found');
}

const modernLogo = String.raw`        // ${marker}: restore the validated Audify Intro Morph instead of the old raster launcher logo.
        MorphLogoView logo=new MorphLogoView();
        logo.setContentDescription("Logo Audify animé");
        logo.setTag("${marker}");
        logo.setAlpha(0f);
        logo.setScaleX(0.76f);
        logo.setScaleY(0.76f);
        stage.addView(logo,new FrameLayout.LayoutParams(dp(154),dp(154),Gravity.CENTER));`;

splash = splash.slice(0, logoStart) + modernLogo + splash.slice(logoEnd + logoEndNeedle.length);
splash = splash.replace(
  '    private void startLogoBreathing(ImageView logo){',
  '    private void startLogoBreathing(View logo){'
);

const equalizerMarker = '    private final class EqualizerView extends View {';
if (!splash.includes(equalizerMarker)) {
  throw new Error('V68.12.65.1: EqualizerView insertion point not found');
}

const morphView = String.raw`    /** Native match of the validated V64.3 web Intro Morph: glass orb, white A and lime glow. */
    private final class MorphLogoView extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        private ValueAnimator morph;
        private float phase=0f;

        MorphLogoView(){
            super(AudifySplashActivity.this);
            setLayerType(View.LAYER_TYPE_SOFTWARE,null);
        }

        @Override protected void onAttachedToWindow(){
            super.onAttachedToWindow();
            morph=ValueAnimator.ofFloat(0f,1f);
            morph.setDuration(2300L);
            morph.setRepeatCount(ValueAnimator.INFINITE);
            morph.setRepeatMode(ValueAnimator.REVERSE);
            morph.setInterpolator(new DecelerateInterpolator());
            morph.addUpdateListener(a->{phase=(Float)a.getAnimatedValue();invalidate();});
            morph.start();
        }

        @Override protected void onDetachedFromWindow(){
            if(morph!=null){morph.cancel();morph=null;}
            super.onDetachedFromWindow();
        }

        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            float w=getWidth();
            float h=getHeight();
            float cx=w*0.5f;
            float cy=h*0.5f;
            float pulse=0.5f+0.5f*(float)Math.sin(phase*Math.PI*2.0);
            float inset=dp(8)+(1f-pulse)*dp(3);
            float radius=dp(38)+pulse*dp(10);

            canvas.save();
            canvas.rotate(-7f+phase*14f,cx,cy);
            paint.setStyle(Paint.Style.FILL);
            paint.setShader(new LinearGradient(inset,inset,w-inset,h-inset,
                new int[]{Color.argb(70,255,255,255),Color.argb(25,255,255,255),Color.argb(66,137,255,48)},
                new float[]{0f,0.52f,1f},Shader.TileMode.CLAMP));
            paint.setShadowLayer(dp(24),0,dp(12),Color.argb(88,0,0,0));
            canvas.drawRoundRect(inset,inset,w-inset,h-inset,radius,radius,paint);
            paint.clearShadowLayer();
            paint.setShader(null);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1));
            paint.setColor(Color.argb(78,255,255,255));
            canvas.drawRoundRect(inset,inset,w-inset,h-inset,radius,radius,paint);
            canvas.restore();

            paint.setStyle(Paint.Style.FILL);
            paint.setShader(null);
            paint.setColor(Color.rgb(248,251,255));
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));
            paint.setTextSize(h*0.61f);
            paint.setShadowLayer(dp(16),0,dp(8),Color.argb(92,0,0,0));
            Paint.FontMetrics fm=paint.getFontMetrics();
            float baseline=cy-(fm.ascent+fm.descent)*0.5f-dp(2);
            canvas.drawText("A",cx,baseline,paint);
            paint.clearShadowLayer();

            paint.setColor(Color.argb(150+(int)(90*pulse),137,255,48));
            paint.setStrokeWidth(dp(5));
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setShadowLayer(dp(9),0,0,Color.argb(190,137,255,48));
            float glowWidth=w*(0.22f+0.07f*pulse);
            canvas.drawLine(cx-glowWidth,cy+h*0.17f,cx+glowWidth,cy+h*0.17f,paint);
            paint.clearShadowLayer();
        }
    }

`;

splash = splash.replace(equalizerMarker, morphView + equalizerMarker);
await writeFile(splashPath, splash, 'utf8');

const drawableDir = path.join(resDir, 'drawable');
await mkdir(drawableDir, { recursive: true });
await writeFile(path.join(drawableDir, 'audify_modern_mark.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#00000000"
        android:strokeColor="#F8FBFF"
        android:strokeWidth="11"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M24,82 L54,22 L84,82" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#89FF30"
        android:strokeWidth="7"
        android:strokeLineCap="round"
        android:pathData="M39,63 L69,63" />
</vector>
`, 'utf8');

const themePath = path.join(resDir, 'values-v31', 'audify_splash_theme.xml');
let theme = await readFile(themePath, 'utf8');
if (!theme.includes('@drawable/audify_launcher')) {
  throw new Error('V68.12.65.1: Android 12 legacy pre-splash icon not found');
}
theme = theme.replace('@drawable/audify_launcher', '@drawable/audify_modern_mark');
await writeFile(themePath, theme, 'utf8');

console.log('Audify V68.12.65.1: validated Intro Morph animation restored; legacy raster splash logo removed.');
