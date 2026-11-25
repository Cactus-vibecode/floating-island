import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 600, height: 600 });
await p.goto('file://' + path.resolve('dist/index.html') + '?capture&debug', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));
const out = await p.evaluate(() => {
  window.__step(10);
  const isl = window.__isl;
  const wl = window.__wl;
  const res = { hasWildlife: !!wl, palB: window.__pal && window.__pal.butterflies };
  if (wl) {
    res.flies = wl.flies.length;
    res.visible = wl.flies.filter(f => f.g.visible).length;
    res.opacity = wl.flies[0] && wl.flies[0].mat.opacity;
    res.pos = wl.flies.slice(0, 3).map(f => f.g.position.toArray().map(v => +v.toFixed(2)));
    res.birds = wl.birds.length;
  }
  return res;
});
console.log(JSON.stringify(out));
await b.close();
