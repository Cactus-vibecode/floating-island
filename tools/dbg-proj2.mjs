import puppeteer from 'puppeteer-core';
import path from 'node:path';
const season = process.argv[2] ?? '3';

async function run() {
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  await p.setViewport({ width: 700, height: 700 });
  await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${season}&hour=11&debug`, {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  await new Promise((r) => setTimeout(r, 3200));
  const info = await p.evaluate(() => {
    const T = window.__three, cam = window.__cam, W = innerWidth, H = innerHeight;
    const proj = (o) => {
      const v = new T.Vector3();
      o.getWorldPosition(v);
      const q = v.clone().project(cam);
      return { x: Math.round((q.x * 0.5 + 0.5) * W), y: Math.round((-q.y * 0.5 + 0.5) * H), y3: +v.y.toFixed(2) };
    };
    const g = window.__life.groups;
    const out = {};
    for (const [k, grp] of Object.entries(g)) {
      out[k] = { vis: grp.visible, kids: grp.children.slice(0, 6).map((c) => ({ p: proj(c), type: c.type })) };
    }
    return out;
  });
  await b.close();
  return info;
}

let done = false;
for (let i = 0; i < 4 && !done; i++) {
  try {
    const info = await run();
    console.log(JSON.stringify(info));
    done = true;
  } catch (e) {
    console.log('retry', String(e).slice(0, 50));
  }
}
