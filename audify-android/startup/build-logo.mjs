// Mechanical extraction of the existing brand's chromatic silhouette. No redraw.
// Run only when the original branding asset changes; generated PNGs are committed.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let sharp;
try { sharp=require('sharp'); }
catch { sharp=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp')); }
const {data,info}=await sharp(path.join(root,'branding/audify_launcher.webp')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=info.width,top=info.height,right=0,bottom=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const i=(y*info.width+x)*4;
  const chroma=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);
  const t=Math.max(0,Math.min(1,(chroma-30)/85));
  const alpha=t*t*(3-2*t);
  // Remove white-matte contamination around the antialiased silhouette.
  if(alpha>0)for(let c=0;c<3;c++)data[i+c]=Math.round(Math.max(0,Math.min(255,(data[i+c]-255*(1-alpha))/alpha)));
  data[i+3]=Math.round(255*alpha);
  if(data[i+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
}
const extracted=await sharp(data,{raw:info}).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
const mark=await sharp(extracted).resize(384,352,{fit:'inside'}).png().toBuffer();
const dimensions=await sharp(mark).metadata();
await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}})
 .composite([{input:mark,left:Math.round((512-dimensions.width)/2),top:Math.round((512-dimensions.height)/2)}])
 .png().toFile(path.join(root,'branding/audify_mark.png'));
const system=await sharp(mark).resize(216,198,{fit:'inside'}).png().toBuffer();
const sys=await sharp(system).metadata();
await sharp({create:{width:432,height:432,channels:4,background:'#00000000'}})
 .composite([{input:system,left:Math.round((432-sys.width)/2),top:Math.round((432-sys.height)/2)}])
 .png().toFile(path.join(root,'branding/audify_startup_icon.png'));
console.log('Brand mask extracted from audify_launcher.webp:',{left,top,right,bottom});
