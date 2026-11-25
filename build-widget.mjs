// 把 Electron 运行时 + 我们的场景打成一个可双击的 .app（不依赖打包器下载）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve('.');
const APP = path.join(ROOT, 'dist', 'Cactus.app');
const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist', 'Electron.app');

if (!fs.existsSync(SRC)) throw new Error('找不到 Electron 运行时：' + SRC);
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('先跑 npm run build');

fs.rmSync(APP, { recursive: true, force: true });
fs.cpSync(SRC, APP, { recursive: true, verbatimSymlinks: true });

const plist = path.join(APP, 'Contents', 'Info.plist');
const pb = (cmd) => execFileSync('/usr/libexec/PlistBuddy', ['-c', cmd, plist], { stdio: 'ignore' });
pb('Set :CFBundleName Cactus');
pb('Set :CFBundleDisplayName Cactus');
pb('Set :CFBundleIdentifier com.cactus.desktop');
pb('Set :CFBundleExecutable Cactus');
pb('Set :CFBundleIconFile Cactus');
try { pb('Delete :CFBundleIconName'); } catch {}

const res = path.join(APP, 'Contents', 'Resources');
const exec = path.join(APP, 'Contents', 'MacOS', 'Cactus');
fs.renameSync(path.join(APP, 'Contents', 'MacOS', 'Electron'), exec);

// 放进 app 目录：main / preload / 托盘图标 / 构建好的页面
const appDir = path.join(res, 'app');
fs.mkdirSync(path.join(appDir, 'widget'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'dist'), { recursive: true });
// Electron 找不到 .cjs 作为入口，打包时改名为 .js
fs.copyFileSync(path.join(ROOT, 'widget', 'main.cjs'), path.join(appDir, 'widget', 'main.js'));
fs.copyFileSync(path.join(ROOT, 'widget', 'preload.cjs'), path.join(appDir, 'widget', 'preload.cjs'));
fs.copyFileSync(path.join(ROOT, 'widget', 'tray.png'), path.join(appDir, 'widget', 'tray.png'));
fs.copyFileSync(path.join(ROOT, 'dist', 'index.html'), path.join(appDir, 'dist', 'index.html'));
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    { name: 'cactus-desktop', productName: 'Cactus', version: '1.0.0', main: 'widget/main.js' },
    null,
    2
  )
);

// 图标 & 默认的 Electron 图标替换
if (fs.existsSync(path.join(ROOT, 'build', 'Cactus.icns'))) {
  fs.copyFileSync(path.join(ROOT, 'build', 'Cactus.icns'), path.join(res, 'Cactus.icns'));
}

// 去掉签名后重签成 ad-hoc，避免首次打开被拦
if (!process.env.SKIP_SIGN) try {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP], { stdio: 'ignore' });
  console.log('codesign: ad-hoc ok');
} catch (e) {
  console.log('codesign skipped:', e.message);
}

const size = execFileSync('du', ['-sh', APP]).toString().split('\t')[0];
console.log('dist/Cactus.app', size);
