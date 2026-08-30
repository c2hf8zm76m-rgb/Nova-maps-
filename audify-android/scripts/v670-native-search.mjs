import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');

let main=await readFile(mainPath,'utf8');

const imports=`import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;`;
if(!main.includes('import android.widget.EditText;')){
  main=main.replace('import android.webkit.WebView;',`import android.webkit.WebView;\n${imports}`);
}

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker))throw new Error('Classe MainActivity introuvable pour V67.0');

const members=String.raw`
    private EditText audifyNativeSearchV670;

    private int audifyDp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void installAudifyNativeSearchV670() {
        if (audifyNativeSearchV670 != null) return;
        try {
            View contentView = findViewById(android.R.id.content);
            if (!(contentView instanceof FrameLayout)) return;
            FrameLayout content = (FrameLayout) contentView;

            EditText input = new EditText(this);
            audifyNativeSearchV670 = input;
            input.setSingleLine(true);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_AUTO_CORRECT);
            input.setTextColor(android.graphics.Color.rgb(245,247,250));
            input.setHintTextColor(android.graphics.Color.rgb(145,153,166));
            input.setHint("Rechercher un artiste ou un titre...");
            input.setTextSize(18f);
            input.setGravity(android.view.Gravity.CENTER_VERTICAL);
            input.setPadding(audifyDp(24),0,audifyDp(24),0);
            input.setSelectAllOnFocus(false);
            input.setFocusable(true);
            input.setFocusableInTouchMode(true);
            input.setClickable(true);
            input.setLongClickable(true);
            input.setElevation(audifyDp(28));

            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.RECTANGLE);
            bg.setColor(android.graphics.Color.rgb(20,26,35));
            bg.setCornerRadius(audifyDp(34));
            bg.setStroke(audifyDp(1), android.graphics.Color.rgb(62,72,83));
            input.setBackground(bg);

            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                audifyDp(68),
                android.view.Gravity.TOP
            );
            lp.setMargins(audifyDp(20),audifyDp(10),audifyDp(20),0);
            content.addView(input,lp);

            input.setOnFocusChangeListener((v,hasFocus)->{
                if(hasFocus){
                    input.postDelayed(()->{
                        try{
                            InputMethodManager imm=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);
                            if(imm!=null)imm.showSoftInput(input,InputMethodManager.SHOW_IMPLICIT);
                        }catch(Exception ignored){}
                    },80);
                }
            });
            input.setOnClickListener(v->{
                try{
                    input.requestFocus();
                    InputMethodManager imm=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);
                    if(imm!=null)imm.showSoftInput(input,InputMethodManager.SHOW_IMPLICIT);
                }catch(Exception ignored){}
            });
        } catch (Exception ignored) {}
    }
`;
main=main.replace(classMarker,classMarker+members);

const marker='ViewCompat.requestApplyInsets(webView);';
if(!main.includes(marker))throw new Error('Point installation V67.0 introuvable');
main=main.replace(marker,`${marker}\n\n        // V67.0 Search Reboot — étape 1 : champ 100 % natif, aucun lien avec #q/DOM.\n        installAudifyNativeSearchV670();`);

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.0 : nouvelle barre native Android installée (saisie uniquement).');
