import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 700, height: 700 });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('file://' + path.resolve('dist/index.html') + '?capture&debug', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 900));
const info = await p.evaluate(() => {
  window.__step(0);
  const out = {};
  window.__scene.traverse((o) => {
    if (o.isMesh && o.name) {
      const a = o.geometry.attributes.position;
      let minY = 1e9, maxY = -1e9;
      for (let i = 1; i < a.array.length; i += 3) { minY = Math.min(minY, a.array[i]); maxY = Math.max(maxY, a.array[i]); }
      out[o.name] = { vis: o.visible, n: a.count, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2) };
    }
  });
  // 隐藏地表看水
  window.__scene.traverse((o) => { if (o.name === 'ground' || o.name === 'peak' || o.name === 'snowcap' || o.name === 'rock') o.visible = false; });
  return out;
});
console.log(JSON.stringify(info, null, 1));
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: 'shots/probe_water.png' });
await b.close();
