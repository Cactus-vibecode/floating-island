import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function run() {
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 620, height: 620 });
  await p.goto('file://' + path.resolve('dist/index.html') + '?widget&season=1&hour=11&debug', {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  await new Promise((r) => setTimeout(r, 2800));
  const out = await p.evaluate(() => {
    const T = window.__three;
    const g = window.__life.groups.folkGroup;
    const res = [];
    g.children.forEach((c) => {
      if (c.type === 'Group' && c.children.length > 1) {
        const pos = new T.Vector3();
        c.getWorldPosition(pos);
        const kid = c.children.find((x) => x.type === 'Group');
        let rodInfo = null;
        if (kid) {
          kid.children.forEach((k) => {
            if (k.type === 'Group' && k.children.some((x) => x.isMesh)) {
              const wp = new T.Vector3();
              k.getWorldPosition(wp);
              rodInfo = { rodPos: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)] };
            }
          });
        }
        res.push({ pos: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], rodInfo });
      }
    });
    return res;
  });
  console.log(JSON.stringify(out));
  await b.close();
}
let done = false;
for (let i = 0; i < 4 && !done; i++) {
  try { await run(); done = true; } catch (e) { console.log('retry', String(e).slice(0, 40)); }
}
