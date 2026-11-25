import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 760, height: 760, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve(root, 'dist/index.html'), { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1200));

const state = async () => p.$$eval('.seasons button', (els) => els.map((e) => (e.classList.contains('on') ? 'ON' : '-')).join(','));

// 1) 先拖拽一次画布
await p.mouse.move(380, 400);
await p.mouse.down();
for (let i = 0; i < 16; i++) { await p.mouse.move(380 + i * 8, 400 + i * 1.2); await new Promise((r) => setTimeout(r, 16)); }
await p.mouse.up();
await new Promise((r) => setTimeout(r, 400));
console.log('after drag buttons:', await state());

// 2) 点“冬”
const winter = await p.$('.seasons button[data-season="3"]');
const box = await winter.boundingBox();
console.log('winter button box:', box);
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await new Promise((r) => setTimeout(r, 2600));
console.log('after click winter:', await state());
await p.screenshot({ path: '/tmp/h5_winter.png' });

// 3) 再拖一次，确认还能转（截图对比可选）
await p.mouse.move(380, 420);
await p.mouse.down();
for (let i = 0; i < 12; i++) { await p.mouse.move(380 - i * 8, 420); await new Promise((r) => setTimeout(r, 16)); }
await p.mouse.up();
console.log('errors:', errs.length ? errs.slice(0, 4) : 'none');
await b.close();
