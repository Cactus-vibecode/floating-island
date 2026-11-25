import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 800, height: 800 });
await p.goto('file://' + path.resolve('dist/index.html') + '?capture&debug', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));
await p.evaluate(() => {
  window.__step(0);
  window.__scene.traverse((o) => {
    if (o.name === 'water') { o.material.color.set(0xff0000); o.material.map = null; o.material.emissive = new window.__three.Color(0x660000); o.material.needsUpdate = true; }
    if (o.name === 'tufts') o.visible = false;
  });
});
await new Promise(r => setTimeout(r, 200));
await p.screenshot({ path: 'shots/probe_red.png' });
await b.close();
