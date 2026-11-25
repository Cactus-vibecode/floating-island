// 生成 App 图标：白底圆角 + 秋景小岛
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&clean&season=2&hour=10', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1800));
await p.screenshot({ path: 'shots/icon_island.png', omitBackground: true });
await b.close();

// 用 sips / 自绘合成太麻烦，这里用 python(PIL) 做圆角白底
const py = `
from PIL import Image, ImageDraw
S = 1024
base = Image.new('RGBA', (S, S), (0,0,0,0))
d = ImageDraw.Draw(base)
d.rounded_rectangle([0,0,S-1,S-1], radius=196, fill=(255,255,255,255))
# 极淡的边，避免纯白在浅色背景上糊掉
d.rounded_rectangle([0,0,S-1,S-1], radius=196, outline=(0,0,0,14), width=2)
isl = Image.open('shots/icon_island.png').convert('RGBA')
box = isl.getbbox()
isl = isl.crop(box)
w, h = isl.size
scale = min(800 / w, 740 / h)
isl = isl.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
w, h = isl.size
base.alpha_composite(isl, ((S - w) // 2, (S - h) // 2 + 22))
base.save('shots/icon_1024.png')
print('icon ok')
`;
execFileSync('python3', ['-c', py], { stdio: 'inherit' });

// 生成 iconset + icns
const set = 'build/Cactus.iconset';
fs.rmSync(set, { recursive: true, force: true });
fs.mkdirSync(set, { recursive: true });
const sizes = [16, 32, 64, 128, 256, 512];
for (const s of sizes) {
  execFileSync('sips', ['-z', String(s), String(s), 'shots/icon_1024.png', '--out', `${set}/icon_${s}x${s}.png`], { stdio: 'ignore' });
  execFileSync('sips', ['-z', String(s * 2), String(s * 2), 'shots/icon_1024.png', '--out', `${set}/icon_${s}x${s}@2x.png`], { stdio: 'ignore' });
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', 'build/Cactus.icns'], { stdio: 'inherit' });
console.log('build/Cactus.icns ok');
