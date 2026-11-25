import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function run() {
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  try {
    const p = await b.newPage();
    p.on('pageerror', (e) => console.log('[pageerror]', e.stack || String(e)));
    p.on('console', (m) => console.log('[console]', m.text().slice(0, 200)));
    await new Promise((r) => setTimeout(r, 250));
    await p.goto('file://' + path.resolve('dist/index.html') + '?widget&season=1', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 2600));
  } finally {
    await b.close();
  }
}

let ok = false;
for (let i = 0; i < 5 && !ok; i++) {
  try { await run(); ok = true; } catch (e) { console.log('retry', String(e).slice(0, 40)); }
}
