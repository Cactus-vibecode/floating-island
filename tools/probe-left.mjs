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
    await new Promise((r) => setTimeout(r, 250));
    await p.setViewport({ width: 700, height: 700 });
    await p.goto('file://' + path.resolve('dist/index.html') + '?debug&widget&season=1', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 2600));
    const out = await p.evaluate(() => {
      const T = window.__terrain;
      const isl = window.__isl;
      const trees = isl.trees || [];
      const rim = (a) => isl.rimRad[Math.floor((((a / (Math.PI * 2)) * 128) + 128) % 128)];
      const rows = [];
      for (let x = -2.6; x <= 0; x += 0.2) {
        for (let z = 0; z <= 2.4; z += 0.2) {
          const r = Math.hypot(x, z);
          const rr = rim(Math.atan2(z, x));
          const y = T(x, z);
          const drop = Math.max(
            y - T(x + 0.26, z), y - T(x - 0.26, z), y - T(x, z + 0.26), y - T(x, z - 0.26)
          );
          const nearest = trees.reduce((m, t) => Math.min(m, Math.hypot(t.x - x, t.z - z)), 9);
          rows.push({
            x: +x.toFixed(1), z: +z.toFixed(1), r: +r.toFixed(2), rim: +rr.toFixed(2),
            y: +y.toFixed(2), drop: +drop.toFixed(2), near: +nearest.toFixed(2),
          });
        }
      }
      return { rows, count: trees.length };
    });
    console.log(JSON.stringify(out));
  } finally {
    await b.close();
  }
}
let ok = false;
for (let i = 0; i < 4 && !ok; i++) { try { await run(); ok = true; } catch (e) { console.log('retry', String(e).slice(0, 40)); } }
