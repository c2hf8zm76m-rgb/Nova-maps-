import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const playerPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'NativePlayerActivity.java');

let player = await readFile(playerPath, 'utf8');
const marker = 'AUDIFY_V681263_RED_SQUARE_PROOF';

if (!player.includes(marker)) {
  const callStart = player.indexOf('setContentView(');
  if (callStart < 0) throw new Error('NativePlayerActivity setContentView(...) not found');

  let i = callStart + 'setContentView('.length;
  let depth = 1;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (; i < player.length; i++) {
    const ch = player[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) { inString = false; quote = ''; }
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) throw new Error('Could not locate end of setContentView(...)');
  const semi = player.indexOf(';', i);
  if (semi < 0) throw new Error('Could not locate setContentView semicolon');

  const proof = `\n\n        // ${marker}\n        // Visual proof that this APK was rebuilt from GitHub source with Gradle.\n        android.widget.TextView audifyBuildProof = new android.widget.TextView(this);\n        audifyBuildProof.setText("V68.12.63\\nGITHUB + GRADLE");\n        audifyBuildProof.setTextColor(android.graphics.Color.WHITE);\n        audifyBuildProof.setTextSize(18f);\n        audifyBuildProof.setGravity(android.view.Gravity.CENTER);\n        audifyBuildProof.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);\n        audifyBuildProof.setBackgroundColor(android.graphics.Color.RED);\n        audifyBuildProof.setElevation(1000f);\n        float audifyProofDensity = getResources().getDisplayMetrics().density;\n        int audifyProofSize = Math.round(190f * audifyProofDensity);\n        android.widget.FrameLayout.LayoutParams audifyProofLp = new android.widget.FrameLayout.LayoutParams(audifyProofSize, audifyProofSize);\n        audifyProofLp.gravity = android.view.Gravity.TOP | android.view.Gravity.CENTER_HORIZONTAL;\n        audifyProofLp.topMargin = Math.round(72f * audifyProofDensity);\n        addContentView(audifyBuildProof, audifyProofLp);\n`;

  player = player.slice(0, semi + 1) + proof + player.slice(semi + 1);
  await writeFile(playerPath, player, 'utf8');
}

console.log('Audify V68.12.63 proof patch applied: 190dp red square injected into NativePlayerActivity after all native player patches.');
