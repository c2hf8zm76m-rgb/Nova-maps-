import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const guardPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'AudifyNetworkGuard.java');

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error('V68.12.14 introuvable: ' + label);
  return source.replace(from, to);
}

let java = await readFile(guardPath, 'utf8');

// Vraie icône vectorielle native : arcs Wi-Fi + point + barre diagonale.
if (!java.includes('import android.graphics.Canvas;')) {
  java = java.replace('import android.graphics.Color;\n', 'import android.graphics.Canvas;\nimport android.graphics.Color;\nimport android.graphics.Paint;\nimport android.graphics.RectF;\n');
}

const oldIcon = `        TextView icon = new TextView(activity);\n        icon.setText("⌁");\n        icon.setTextColor(Color.WHITE);\n        icon.setTextSize(64f);\n        icon.setGravity(Gravity.CENTER);\n        icon.setTypeface(Typeface.DEFAULT_BOLD);\n        root.addView(icon, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 96)));`;

const newIcon = `        OfflineWifiIcon icon = new OfflineWifiIcon(activity);\n        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(activity, 148), dp(activity, 148));\n        iconLp.gravity = Gravity.CENTER_HORIZONTAL;\n        iconLp.bottomMargin = dp(activity, 8);\n        root.addView(icon, iconLp);`;

java = replaceRequired(java, oldIcon, newIcon, 'ancien symbole hors-ligne');

const classMarker = '    private static int dp(Context context, int value) {';
if (!java.includes('private static final class OfflineWifiIcon extends View')) {
  const iconClass = `    private static final class OfflineWifiIcon extends View {\n        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);\n        private final Paint slash = new Paint(Paint.ANTI_ALIAS_FLAG);\n\n        OfflineWifiIcon(Context context) {\n            super(context);\n            paint.setStyle(Paint.Style.STROKE);\n            paint.setStrokeCap(Paint.Cap.ROUND);\n            paint.setStrokeJoin(Paint.Join.ROUND);\n            slash.setStyle(Paint.Style.STROKE);\n            slash.setStrokeCap(Paint.Cap.ROUND);\n        }\n\n        @Override\n        protected void onDraw(Canvas canvas) {\n            super.onDraw(canvas);\n            float w = getWidth();\n            float h = getHeight();\n            float cx = w * 0.5f;\n            float cy = h * 0.5f;\n            float unit = Math.min(w, h);\n\n            // Médaillon sombre pour que l'état hors-ligne soit immédiatement lisible.\n            paint.setStyle(Paint.Style.FILL);\n            paint.setColor(Color.rgb(18, 20, 28));\n            canvas.drawCircle(cx, cy, unit * 0.46f, paint);\n\n            paint.setStyle(Paint.Style.STROKE);\n            paint.setColor(Color.WHITE);\n            paint.setStrokeWidth(unit * 0.055f);\n\n            RectF large = new RectF(cx - unit * 0.32f, cy - unit * 0.19f, cx + unit * 0.32f, cy + unit * 0.45f);\n            RectF medium = new RectF(cx - unit * 0.23f, cy - unit * 0.04f, cx + unit * 0.23f, cy + unit * 0.42f);\n            RectF small = new RectF(cx - unit * 0.135f, cy + unit * 0.11f, cx + unit * 0.135f, cy + unit * 0.38f);\n            canvas.drawArc(large, 210f, 120f, false, paint);\n            canvas.drawArc(medium, 210f, 120f, false, paint);\n            canvas.drawArc(small, 210f, 120f, false, paint);\n\n            paint.setStyle(Paint.Style.FILL);\n            canvas.drawCircle(cx, cy + unit * 0.305f, unit * 0.042f, paint);\n\n            // Barre rouge = aucune connexion Internet.\n            slash.setColor(Color.rgb(255, 87, 102));\n            slash.setStrokeWidth(unit * 0.07f);\n            canvas.drawLine(cx - unit * 0.30f, cy - unit * 0.31f, cx + unit * 0.30f, cy + unit * 0.31f, slash);\n        }\n    }\n\n`;
  java = replaceRequired(java, classMarker, iconClass + classMarker, 'point insertion icône Wi-Fi');
}

// Un badge visuel court complète l'explication textuelle sans la remplacer.
const titleMarker = `        TextView title = new TextView(activity);`;
if (!java.includes('CONNEXION INDISPONIBLE')) {
  const badge = `        TextView offlineBadge = new TextView(activity);\n        offlineBadge.setText("CONNEXION INDISPONIBLE");\n        offlineBadge.setTextColor(Color.rgb(255, 126, 136));\n        offlineBadge.setTextSize(11f);\n        offlineBadge.setTypeface(Typeface.DEFAULT_BOLD);\n        offlineBadge.setGravity(Gravity.CENTER);\n        offlineBadge.setLetterSpacing(0.10f);\n        GradientDrawable badgeBg = new GradientDrawable();\n        badgeBg.setColor(Color.rgb(35, 20, 27));\n        badgeBg.setCornerRadius(dp(activity, 20));\n        badgeBg.setStroke(dp(activity, 1), Color.rgb(88, 38, 48));\n        offlineBadge.setBackground(badgeBg);\n        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(dp(activity, 196), dp(activity, 34));\n        badgeLp.gravity = Gravity.CENTER_HORIZONTAL;\n        badgeLp.bottomMargin = dp(activity, 8);\n        root.addView(offlineBadge, badgeLp);\n\n`;
  java = replaceRequired(java, titleMarker, badge + titleMarker, 'badge hors ligne');
}

await writeFile(guardPath, java, 'utf8');
console.log('Audify V68.12.14 : page hors connexion visuelle avec vraie icône Wi-Fi barrée.');
