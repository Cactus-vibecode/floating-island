import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 800, height: 800 });
await p.goto('file://' + path.resolve('dist/index.html') + '?capture&debug', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));
await p.evaluate(() => {
  window.__step(10);
  const T = window.__three;
  window.__wl.flies.forEach(f => {
    f.mat.color.set(0xff0044);
    f.mat.emissive = new T.Color(0xffffff);
    f.mat.emissiveIntensity = 1;
    f.g.scale.multiplyScalar(2.4);
  });
});
await new Promise(r => setTimeout(r, 150));
await p.screenshot({ path: 'shots/probe_fly.png' });
await b.close();
