// 原地更新已打包的 Cactus.app：只替换 Resources/app 里的文件，不删除整个 app
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve('.');
const APP = path.join(ROOT, 'dist', 'Cactus.app');
const appDir = path.join(APP, 'Contents', 'Resources', 'app');

if (!fs.existsSync(appDir)) {
  console.log('没有现成的 app，改用完整打包：node build-widget.mjs');
  process.exit(1);
}

const copies = [
  ['dist/index.html', 'dist/index.html'],
  ['widget/main.cjs', 'widget/main.js'],
  ['widget/preload.cjs', 'widget/preload.cjs'],
  ['widget/tray.png', 'widget/tray.png'],
];

for (const [from, to] of copies) {
  const src = path.join(ROOT, from);
  const dst = path.join(appDir, to);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('updated', to);
}

if (fs.existsSync(path.join(ROOT, 'build', 'Cactus.icns'))) {
  fs.copyFileSync(path.join(ROOT, 'build', 'Cactus.icns'), path.join(APP, 'Contents', 'Resources', 'Cactus.icns'));
}

try {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP], { stdio: 'ignore' });
  console.log('codesign: ad-hoc ok');
} catch (e) {
  console.log('codesign skipped:', e.message);
}
console.log('done');
