import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const appDelegate = path.join(root, 'ios', 'App', 'App', 'AppDelegate.swift');

let swift = await readFile(appDelegate, 'utf8');
if (!swift.includes('import AVFoundation')) {
  swift = swift.replace('import UIKit', 'import UIKit\nimport AVFoundation');
}

const marker = '        return true';
const audioSetup = `        // Audify: native playback audio session.\n        do {\n            let session = AVAudioSession.sharedInstance()\n            try session.setCategory(.playback, mode: .default, options: [.allowAirPlay])\n            try session.setActive(true)\n        } catch {\n            print("Audify audio session error: \\(error)")\n        }\n\n`;

if (!swift.includes('Audify: native playback audio session.')) {
  const pos = swift.indexOf(marker);
  if (pos === -1) throw new Error('Impossible de trouver return true dans AppDelegate.swift');
  swift = swift.slice(0, pos) + audioSetup + swift.slice(pos);
}

await writeFile(appDelegate, swift, 'utf8');
console.log('AppDelegate.swift configuré pour AVAudioSession.playback');
