import puppeteer from 'puppeteer-core';
import path from 'node:path';

const pts = [
  [-0.75, -0.55], [-0.65, -0.55], [-0.55, -0.55], [-0.45, -0.55], [-0.35, -0.55],
  [-0.75, -0.35], [-0.65, -0.35], [-0.55, -0.35], [-0.45, -0.35], [-0.35, -0.35],
  [-0.75, -0.15], [-0.65, -0.15], [-0.55, -0.15], [-0.45, -0.15], [-0.35, -0.15],
  [-0.95, -0.75], [-0.85, -0.45], [-0.70, -0.20], [-0.60, 0.00], [-0.85, -0.10],
];

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
  const out = await p.evaluate((pts) => {
    const T = window.__terrain;
    const st = window.__isl.streamList || [];
    const slope = (x, z) =>
      Math.hypot((T(x + .12, z) - T(x - .12, z)) / .24, (T(x, z + .12) - T(x, z - .12)) / .24);
    const sd = (x, z) => {
      let best = 9, hw = .2;
      for (const q of st) {
        const d = Math.hypot(x - q.x, z - q.z);
        if (d < best) { best = d; hw = q.hw; }
      }
      return { d: +best.toFixed(2), hw: +hw.toFixed(2) };
    };
    return pts.map(([x, z]) => ({
      x, z, y: +T(x, z).toFixed(2), sl: +slope(x, z).toFixed(2), ...sd(x, z),
    }));
  }, pts);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
}
let done = false;
for (let i = 0; i < 4 && !done; i++) { try { await run(); done = true; } catch (e) { console.log('retry', String(e).slice(0, 50)); } }
