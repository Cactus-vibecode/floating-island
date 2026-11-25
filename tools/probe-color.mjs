import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 700, height: 700 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&season=1&hour=16.3&debug', { waitUntil: 'domcontentloaded' });
await new Promise(r=>setTimeout(r,2500));
const out = await p.evaluate(() => {
  const isl = window.__isl; if (!isl) return 'no isl';
  return isl.canopies.map((m) => {
    const g = m.geometry; const c = g.attributes.color;
    if (!c) return { name: m.material.map?.name, hasColor: false, count: g.attributes.position.count };
    const a = c.array; let mn = 9, mx = -9, sum = 0;
    for (let i = 0; i < a.length; i++) { mn = Math.min(mn, a[i]); mx = Math.max(mx, a[i]); sum += a[i]; }
    return { hasColor: true, mn: +mn.toFixed(3), mx: +mx.toFixed(3), avg: +(sum/a.length).toFixed(3), vc: m.material.vertexColors };
  });
});
console.log(JSON.stringify(out, null, 1));
await b.close();
