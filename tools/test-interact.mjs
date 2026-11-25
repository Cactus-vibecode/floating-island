// 验证：摆件路径下「拖动岛身 = 旋转」是否恢复，且手柄存在
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  defaultViewport: { width: 600, height: 600 },
  defaultViewport: { width: 600, height: 600 },
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto('file://' + path.resolve(root, 'dist/index.html') + '?widget&season=2&hour=11&debug', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));

const rot = () => p.evaluate(() => window.__isl.group.rotation.y);
const r0 = await rot();
await p.mouse.move(300, 300);
await p.mouse.down();
for (let i = 0; i < 20; i++) { await p.mouse.move(300 + i * 10, 300); await new Promise((r) => setTimeout(r, 16)); }
await p.mouse.up();
await new Promise((r) => setTimeout(r, 200));
const r1 = await rot();

const grip = await p.evaluate(() => {
  const g = document.getElementById('grip');
  const s = getComputedStyle(g);
  const r = g.getBoundingClientRect();
  return { display: s.display, opacity: s.opacity, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});

console.log('rotation before/after drag:', r0.toFixed(3), '->', r1.toFixed(3), Math.abs(r1 - r0) > 0.3 ? 'ROTATED ok' : 'NOT ROTATED');
console.log('grip:', JSON.stringify(grip));
console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
