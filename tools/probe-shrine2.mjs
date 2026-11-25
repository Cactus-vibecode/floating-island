import puppeteer from 'puppeteer-core';
import path from 'node:path';

const centers = [];
for (let x = -0.9; x <= -0.1; x += 0.1) {
  for (let z = -0.5; z <= 0.4; z += 0.1) centers.push([+x.toFixed(2), +z.toFixed(2)]);
}

async function run() {
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 700, height: 700 });
  await p.goto('file://' + path.resolve('dist/index.html') + '?debug&widget&season=1', {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  const out = await p.evaluate((centers) => {
    const T = window.__terrain;
    const st = window.__isl.streamList || [];
    const trees = window.__isl.trees || [];
    const sd = (x, z) => {
      let best = 9;
      for (const q of st) { const d = Math.hypot(x - q.x, z - q.z); if (d < best) best = d; }
      return best;
    };
    const res = [];
    for (const [x, z] of centers) {
      // 神社平台 0.52 x 0.44，四角 + 中心
      const hw = 0.26, hd = 0.22;
      const hs = [
        T(x - hw, z - hd), T(x + hw, z - hd), T(x - hw, z + hd), T(x + hw, z + hd), T(x, z),
      ];
      const maxH = Math.max(...hs), minH = Math.min(...hs);
      const nearT = trees.reduce((m, t) => Math.min(m, Math.hypot(t.x - x, t.z - z)), 9);
      res.push({
        x, z, y: +T(x, z).toFixed(2),
        spread: +(maxH - minH).toFixed(2),
        stream: +sd(x, z).toFixed(2),
        tree: +nearT.toFixed(2),
        rim: +Math.hypot(x, z).toFixed(2),
      });
    }
    return res;
  }, centers);
  console.log(JSON.stringify(out));
  await b.close();
}
let done = false;
for (let i = 0; i < 4 && !done; i++) { try { await run(); done = true; } catch (e) { console.log('retry', String(e).slice(0, 50)); } }
