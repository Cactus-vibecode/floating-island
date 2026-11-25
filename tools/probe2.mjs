import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 700, height: 700 });
await p.goto('file://' + path.resolve('dist/index.html') + '?capture&debug', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));
const out = await p.evaluate(() => {
  const T = window.__three, sc = window.__scene;
  window.__step(0);
  let water, ground;
  sc.traverse(o => { if (o.name === 'water') water = o; if (o.name === 'ground') ground = o; });
  const rc = new T.Raycaster();
  const a = water.geometry.attributes.position;
  const rows = [];
  for (let i = 0; i < a.count; i += 3) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    rc.set(new T.Vector3(x, 8, z), new T.Vector3(0, -1, 0));
    const hit = rc.intersectObject(ground, false)[0];
    rows.push({ i: i / 3, wy: +y.toFixed(3), gy: +(hit ? hit.point.y : NaN).toFixed(3), under: hit ? y < hit.point.y : null });
  }
  const hidden = rows.filter(r => r.under).length;
  return { total: rows.length, hidden, sample: rows.filter((r, k) => k % 8 === 0) };
});
console.log(JSON.stringify(out, null, 1).slice(0, 2200));
await b.close();
