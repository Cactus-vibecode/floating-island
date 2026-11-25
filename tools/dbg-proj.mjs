import puppeteer from 'puppeteer-core';
import path from 'node:path';
const season = process.argv[2] ?? '1';
const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
await p.setViewport({ width: 900, height: 900 });
await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${season}&hour=11&debug`, {
  waitUntil: 'domcontentloaded', timeout: 25000,
});
await new Promise((r) => setTimeout(r, 3500));
const info = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam;
  const out = [];
  const W = innerWidth, H = innerHeight;
  const v = new T.Vector3();
  window.__life.groups.folkGroup.traverse((o) => {
    if (o.isGroup && o.parent === window.__life.groups.folkGroup) {
      o.getWorldPosition(v);
      const p2 = v.clone().project(cam);
      out.push({ x: Math.round((p2.x * 0.5 + 0.5) * W), y: Math.round((-p2.y * 0.5 + 0.5) * H) });
    }
  });
  return { out, W, H };
});
console.log(JSON.stringify(info));
await p.screenshot({ path: '/tmp/big.png' });
await b.close();
