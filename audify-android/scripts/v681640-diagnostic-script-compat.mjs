import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const target=path.join(here,'v68164-album-diagnostic-trace.mjs');
let src=await readFile(target,'utf8');
const start='// ---------------- visible diagnostic on real runtime failure ----------------';
const log="console.log('Audify V68.16.4: runtime album diagnostic trace enabled — exact input, YouTube evidence, normalized identity, Apple graph reject reasons, Deezer discography reject reasons, and visible copyable failure dialog.');";
const a=src.indexOf(start);
const b=src.lastIndexOf(log);
if(a<0||b<a)throw new Error('V68.16.4 compat: diagnostic UI section not found');
const replacement=`// ---------------- visible diagnostic handled by v681641 ----------------\n// The current production Album UI has evolved beyond the historical Toast anchor.\n// Keep this script focused on engine traces; the companion UI patch observes final\n// resolution state without depending on a fragile old line.\n${log}`;
src=src.slice(0,a)+replacement+'\n';
await writeFile(target,src,'utf8');
console.log('Audify V68.16.4 compat: removed fragile historical UI anchor from diagnostic engine patch.');
