import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const widgetPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyPlayerWidget.java');

let src=await readFile(widgetPath,'utf8');
const marker='AUDIFY_V68180_WIDGET_SERVICE_BRIDGE';
if(!src.includes('SERVICE_BRIDGE_MARKER')){
  const anchor='    public static final String ARTWORK_MARKER = "AUDIFY_V68180_WIDGET_LIVE_ARTWORK";';
  if(!src.includes(anchor))throw new Error('V68.18 widget marker fix: widget marker anchor missing');
  src=src.replace(anchor,anchor+'\n    public static final String SERVICE_BRIDGE_MARKER = "'+marker+'";');
  await writeFile(widgetPath,src,'utf8');
}
console.log('Audify V68.18: widget service bridge marker promoted to compiled DEX constant.');
