// 探测地形：打印河道采样与候选平地（用于摆放神社）
import puppeteer from 'puppeteer-core';
import path from 'node:path';

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
  await new Promise((r) => setTimeout(r, 2600));
  const out = await p.evaluate(() => {
    const T = window.__terrain;
    const st = window.__isl.streamList || [];
    const slope = (x, z) =>
      Math.hypot((T(x + .08, z) - T(x - .08, z)) / .16, (T(x, z + .08) - T(x, z - .08)) / .16);

    const stream = st.map((q, i) => ({
      u: +(i / (st.length - 1)).toFixed(2),
      x: +q.x.toFixed(2), z: +q.z.toFixed(2), y: +q.y.toFixed(2), hw: +q.hw.toFixed(2),
    }));

    // 在河道旁找平整、坡度小、离水有点距离的位置
    const cands = [];
    for (let i = 4; i < st.length - 4; i += 1) {
      const q = st[i];
      for (const side of [-1, 1]) {
        for (const off of [0.34, 0.44, 0.54, 0.66, 0.78]) {
          const x = q.x + q.nx * off * side;
          const z = q.z + q.nz * off * side;
          const y = T(x, z);
          const sl = slope(x, z);
          if (y > 1.35 || y < -0.1) continue;
          if (sl > 0.55) continue;
          cands.push({
            u: +(i / (st.length - 1)).toFixed(2), side, off,
            x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(2), sl: +sl.toFixed(2),
          });
        }
      }
    }
    cands.sort((a, b) => a.sl - b.sl);
    const grid = [];
    for (let x = -2.4; x <= 2.4; x += 0.4) {
      const row = [];
      for (let z = -2.4; z <= 2.4; z += 0.4) row.push(+T(x, z).toFixed(1));
      grid.push({ x: +x.toFixed(1), row });
    }
    return { stream, best: cands.slice(0, 26), grid, rad: window.__isl.rimRad };
  });
  console.log(JSON.stringify(out));
  await b.close();
}

let done = false;
for (let i = 0; i < 4 && !done; i++) {
  try { await run(); done = true; } catch (e) { console.log('retry', String(e).slice(0, 60)); }
}
