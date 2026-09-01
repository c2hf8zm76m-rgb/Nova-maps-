import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const playerPath=path.join(root,'android','app','src','main','java','com','nova','audify','NativePlayerActivity.java');

let src=await readFile(playerPath,'utf8');

// V68.12.19 — Le bouton Paroles rejoint le langage glass des actions Home / Playlist / Like.
// Le vert Audify devient un accent d'interaction et non plus une bordure permanente.
const creation=/Button\s+karaokeButton\s*=\s*pillButton\(("(?:[^"\\]|\\.)*Paroles(?:[^"\\]|\\.)*")\);/;
const match=src.match(creation);
if(!match) throw new Error('V68.12.19 : bouton Paroles introuvable dans NativePlayerActivity');

src=src.replace(creation,`${match[0]}\n        applyKaraokeGlassStyle(karaokeButton);`);

const marker='    private LinearLayout.LayoutParams weighted() {';
if(!src.includes(marker)) throw new Error('V68.12.19 : point insertion helper introuvable');

const helper=String.raw`    private void applyKaraokeGlassStyle(Button button) {
        if(button==null) return;
        button.setAllCaps(false);
        button.setTextSize(15f);
        button.setTextColor(Color.WHITE);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(15),0,dp(15),0);
        button.setTypeface(button.getTypeface(),android.graphics.Typeface.BOLD);
        button.setStateListAnimator(null);
        button.setElevation(dp(2));

        GradientDrawable normal=new GradientDrawable();
        normal.setColor(Color.argb(118,18,23,31));
        normal.setStroke(dp(1),Color.argb(135,145,155,170));
        normal.setCornerRadius(dp(18));

        GradientDrawable pressed=new GradientDrawable();
        pressed.setColor(Color.argb(150,24,34,31));
        pressed.setStroke(dp(1),Color.argb(205,168,255,63));
        pressed.setCornerRadius(dp(18));

        android.graphics.drawable.StateListDrawable states=new android.graphics.drawable.StateListDrawable();
        states.addState(new int[]{android.R.attr.state_pressed},pressed);
        states.addState(new int[]{},normal);
        button.setBackground(states);

        button.setOnTouchListener((v,event)->{
            if(event.getActionMasked()==MotionEvent.ACTION_DOWN){
                v.animate().scaleX(0.965f).scaleY(0.965f).alpha(0.92f).setDuration(85L).start();
            }else if(event.getActionMasked()==MotionEvent.ACTION_UP || event.getActionMasked()==MotionEvent.ACTION_CANCEL){
                v.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(145L).start();
            }
            return false;
        });
    }

`;

src=src.replace(marker,helper+marker);
await writeFile(playerPath,src,'utf8');
console.log('Audify Android V68.12.19 : bouton Paroles glass harmonisé avec Like / Playlist.');
