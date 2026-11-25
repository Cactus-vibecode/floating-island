import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 700, height: 700 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=2&hour=10', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));
await p.screenshot({ path: 'shots/r_base.png' });
await p.evaluate(() => {
  window.__scene.traverse((o) => { if (o.name === 'tufts') o.visible = false; });
});
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: 'shots/r_notufts.png' });
await b.close();
