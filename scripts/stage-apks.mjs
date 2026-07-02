import { copyFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'apk');

const apks = [
  {
    name: 'FrontDesk-VoiP.apk',
    src: join(
      root,
      'packages/front-desk/android/app/build/outputs/apk/debug/FrontDesk-VoiP.apk',
    ),
  },
  {
    name: 'Guest-VoiP.apk',
    src: join(
      root,
      'packages/guest-tablet/android/app/build/outputs/apk/debug/Guest-VoiP.apk',
    ),
  },
];

mkdirSync(outDir, { recursive: true });

for (const apk of apks) {
  try {
    statSync(apk.src);
    const dest = join(outDir, apk.name);
    copyFileSync(apk.src, dest);
    console.log(`✓ ${apk.name} → dist/apk/${apk.name}`);
  } catch {
    console.error(`✗ Missing build output: ${apk.src}`);
    console.error('  Run: npm run build:apks');
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`\nAPKs ready in: ${outDir}`);
}
