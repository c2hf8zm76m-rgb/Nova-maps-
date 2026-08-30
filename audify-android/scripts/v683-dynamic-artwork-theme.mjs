import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const activityPath=path.join(root,'android','app','src','main','java','com','nova','audify','NativePlayerActivity.java');
let src=await readFile(activityPath,'utf8');

src=src.replace(
  'private Button playPauseButton;',
  'private FrameLayout root;\n    private ValueAnimator backgroundAnimator;\n    private int themeTop = Color.rgb(18,24,34);\n    private int themeMid = Color.rgb(9,13,20);\n    private int themeBottom = Color.rgb(5,7,11);\n    private Button playPauseButton;'
);

src=src.replace(
  'FrameLayout root = new FrameLayout(this);\n        root.setBackgroundColor(Color.rgb(7,10,15));',
  'root = new FrameLayout(this);\n        applyGradient(themeTop, themeMid, themeBottom);'
);

src=src.replace(
  'coverImage.setImageBitmap(bitmap);\n                        discImage.setImageBitmap(bitmap);',
  'coverImage.setImageBitmap(bitmap);\n                        discImage.setImageBitmap(bitmap);\n                        applyArtworkTheme(bitmap);'
);

const marker='    private void showPlaylistPicker() {';
if(!src.includes(marker)) throw new Error('Point insertion thème dynamique introuvable');

const methods=String.raw`
    private void applyArtworkTheme(Bitmap bitmap) {
        if (bitmap == null || root == null) return;
        int dominant = extractDominantColor(bitmap);

        float[] hsv = new float[3];
        Color.colorToHSV(dominant, hsv);
        hsv[1] = Math.max(0.34f, Math.min(0.88f, hsv[1] * 1.12f));
        hsv[2] = Math.max(0.34f, Math.min(0.76f, hsv[2]));
        int rich = Color.HSVToColor(hsv);

        int nextTop = blendColor(rich, Color.BLACK, 0.16f);
        int nextMid = blendColor(rich, Color.rgb(5,8,13), 0.58f);
        int nextBottom = blendColor(rich, Color.rgb(3,5,9), 0.84f);
        animateGradient(nextTop, nextMid, nextBottom);
    }

    private int extractDominantColor(Bitmap source) {
        Bitmap sample = source;
        try {
            if (source.getWidth() > 52 || source.getHeight() > 52) {
                sample = Bitmap.createScaledBitmap(source, 52, 52, true);
            }
            float[] bins = new float[4096];
            int[] counts = new int[4096];
            float[] hsv = new float[3];
            int w = sample.getWidth();
            int h = sample.getHeight();

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int c = sample.getPixel(x,y);
                    if (Color.alpha(c) < 160) continue;
                    int r = Color.red(c), g = Color.green(c), b = Color.blue(c);
                    Color.RGBToHSV(r,g,b,hsv);
                    float sat = hsv[1];
                    float val = hsv[2];
                    if (val < 0.07f || val > 0.97f) continue;
                    int idx = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
                    float weight = (0.58f + sat * 1.55f) * (0.72f + val * 0.42f);
                    bins[idx] += weight;
                    counts[idx]++;
                }
            }

            int best = -1;
            float bestScore = -1f;
            for (int i = 0; i < bins.length; i++) {
                if (counts[i] == 0) continue;
                float score = bins[i] * (1f + Math.min(18, counts[i]) * 0.035f);
                if (score > bestScore) {
                    bestScore = score;
                    best = i;
                }
            }
            if (best < 0) return Color.rgb(35,55,78);
            int r = (((best >> 8) & 15) * 17);
            int g = (((best >> 4) & 15) * 17);
            int b = ((best & 15) * 17);
            return Color.rgb(r,g,b);
        } catch (Throwable ignored) {
            return Color.rgb(35,55,78);
        } finally {
            if (sample != null && sample != source) sample.recycle();
        }
    }

    private void animateGradient(int targetTop, int targetMid, int targetBottom) {
        if (root == null) return;
        final int fromTop = themeTop;
        final int fromMid = themeMid;
        final int fromBottom = themeBottom;
        if (backgroundAnimator != null) backgroundAnimator.cancel();
        backgroundAnimator = ValueAnimator.ofFloat(0f, 1f);
        backgroundAnimator.setDuration(720L);
        backgroundAnimator.addUpdateListener(animation -> {
            float t = (Float) animation.getAnimatedValue();
            int top = blendColor(fromTop, targetTop, t);
            int mid = blendColor(fromMid, targetMid, t);
            int bottom = blendColor(fromBottom, targetBottom, t);
            applyGradient(top, mid, bottom);
        });
        backgroundAnimator.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override public void onAnimationEnd(android.animation.Animator animation) {
                themeTop = targetTop;
                themeMid = targetMid;
                themeBottom = targetBottom;
            }
        });
        backgroundAnimator.start();
    }

    private void applyGradient(int top, int mid, int bottom) {
        if (root == null) return;
        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{top, mid, bottom}
        );
        root.setBackground(bg);
        getWindow().setStatusBarColor(blendColor(top, Color.BLACK, 0.38f));
        getWindow().setNavigationBarColor(bottom);
    }

    private int blendColor(int from, int to, float amount) {
        float t = Math.max(0f, Math.min(1f, amount));
        int a = Math.round(Color.alpha(from) + (Color.alpha(to)-Color.alpha(from))*t);
        int r = Math.round(Color.red(from) + (Color.red(to)-Color.red(from))*t);
        int g = Math.round(Color.green(from) + (Color.green(to)-Color.green(from))*t);
        int b = Math.round(Color.blue(from) + (Color.blue(to)-Color.blue(from))*t);
        return Color.argb(a,r,g,b);
    }

`;
src=src.replace(marker,methods+marker);

src=src.replace(
  'if (discAnimator != null) discAnimator.cancel();',
  'if (discAnimator != null) discAnimator.cancel();\n        if (backgroundAnimator != null) backgroundAnimator.cancel();'
);

await writeFile(activityPath,src,'utf8');
console.log('Audify Android V68.3 : fond dynamique en dégradé depuis la couleur dominante de la miniature appliqué.');
