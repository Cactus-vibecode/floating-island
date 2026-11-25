import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const file = 'file://' + path.resolve('dist/index.html');

const W = Number(process.argv[2] || 700);
const H = Number(process.argv[3] || 760);
const OUT = process.argv[4] || 'shots/shot.png';
const STEPS = Number(process.argv[5] || 0);
const SEASON = process.argv[6];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-device-scale-factor=1'],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(file + (STEPS ? '?capture' : ''), { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));

if (SEASON !== undefined && !STEPS) {
  await page.evaluate((s) => document.querySelectorAll('#seasons button')[s].click(), Number(SEASON));
  await new Promise((r) => setTimeout(r, 2200));
}

if (STEPS) {
  await page.evaluate(() => window.__warm(180));
  await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__step(i); }, STEPS);
}

await new Promise((r) => setTimeout(r, 250));
console.log('dbg', JSON.stringify(await page.evaluate(() => (window.__dbg ? window.__dbg() : null))));
console.log('dbg', JSON.stringify(await page.evaluate(() => (window.__dbg ? window.__dbg() : null))));
await page.screenshot({ path: OUT });
console.log(logs.length ? logs.slice(0, 12).join('\n') : '(no console output)');
await browser.close();
