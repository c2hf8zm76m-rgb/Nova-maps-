import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');

let main=await readFile(mainPath,'utf8');

if(!main.includes('import android.widget.Button;')){
  main=main.replace('import android.widget.EditText;', 'import android.widget.EditText;\nimport android.widget.Button;');
}
if(!main.includes('import android.view.inputmethod.EditorInfo;')){
  main=main.replace('import android.view.inputmethod.InputMethodManager;', 'import android.view.inputmethod.InputMethodManager;\nimport android.view.inputmethod.EditorInfo;');
}

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker))throw new Error('Classe MainActivity introuvable pour V67.1');

const members=String.raw`
    private Button audifyNativeSearchButtonV671;

    private void submitAudifyNativeSearchV671() {
        try {
            EditText input = audifyNativeSearchV670;
            if (input == null) return;
            String query = input.getText() == null ? "" : input.getText().toString().trim();
            if (query.isEmpty()) return;

            WebView webView = getBridge().getWebView();
            String quoted = JSONObject.quote(query);
            String js = "(function(q){try{" +
                "var old=document.getElementById('q');" +
                "if(!old){old=document.createElement('input');old.id='q';old.type='hidden';old.style.display='none';document.body.appendChild(old);}" +
                "old.value=q;" +
                "if(typeof window.search==='function'){window.search();return 'ok';}" +
                "return 'missing-search';" +
                "}catch(e){return 'error:'+String((e&&e.message)||e);}})(" + quoted + ");";
            webView.evaluateJavascript(js, null);

            input.clearFocus();
            InputMethodManager imm=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);
            if(imm!=null)imm.hideSoftInputFromWindow(input.getWindowToken(),0);
        } catch (Exception ignored) {}
    }

    private void upgradeAudifyNativeSearchV671() {
        try {
            EditText input = audifyNativeSearchV670;
            if (input == null || audifyNativeSearchButtonV671 != null) return;

            input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
            input.setPadding(audifyDp(24),0,audifyDp(170),0);
            input.setOnEditorActionListener((v,actionId,event)->{
                boolean enter = event != null && event.getKeyCode() == android.view.KeyEvent.KEYCODE_ENTER && event.getAction() == android.view.KeyEvent.ACTION_UP;
                if(actionId==EditorInfo.IME_ACTION_SEARCH || actionId==EditorInfo.IME_ACTION_GO || actionId==EditorInfo.IME_ACTION_DONE || enter){
                    submitAudifyNativeSearchV671();
                    return true;
                }
                return false;
            });

            View contentView = findViewById(android.R.id.content);
            if (!(contentView instanceof FrameLayout)) return;
            FrameLayout content = (FrameLayout) contentView;

            Button button = new Button(this);
            audifyNativeSearchButtonV671 = button;
            button.setText("Rechercher");
            button.setAllCaps(false);
            button.setTextSize(15f);
            button.setTextColor(android.graphics.Color.rgb(8,16,6));
            button.setGravity(android.view.Gravity.CENTER);
            button.setPadding(audifyDp(10),0,audifyDp(10),0);
            button.setElevation(audifyDp(34));
            button.setStateListAnimator(null);

            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.RECTANGLE);
            bg.setColor(android.graphics.Color.rgb(157,255,52));
            bg.setCornerRadius(audifyDp(28));
            button.setBackground(bg);

            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                audifyDp(140),
                audifyDp(52),
                android.view.Gravity.TOP | android.view.Gravity.RIGHT
            );
            lp.setMargins(0,audifyDp(18),audifyDp(28),0);
            content.addView(button,lp);
            button.setOnClickListener(v->submitAudifyNativeSearchV671());
        } catch (Exception ignored) {}
    }
`;
main=main.replace(classMarker,classMarker+members);

const marker='installAudifyNativeSearchV670();';
if(!main.includes(marker))throw new Error('Installation native V67.0 introuvable pour V67.1');
main=main.replace(marker,`${marker}\n        // V67.1 : le champ natif pilote désormais le moteur YouTube Web existant.\n        upgradeAudifyNativeSearchV671();`);

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.1 : recherche native -> moteur YouTube branchée.');
