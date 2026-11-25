import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 900 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=9.9', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 1800));
const res = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, terr = window.__terrain, scene = window.__scene;
  const rc = new T.Raycaster();
  const out = [];
  for (const [X, Z] of [[-0.95, 1.0], [-0.88, 1.05], [-0.82, 1.08], [-0.78, 1.0], [-0.72, 1.05], [-0.65, 1.05]]) {
    const y = terr(X, Z);
    for (const hh of [0.03, 0.12, 0.20]) {
      const pos = new T.Vector3(X, y + hh, Z);
      const dir = pos.clone().sub(cam.position); const dist = dir.length();
      rc.set(cam.position, dir.normalize()); rc.far = dist + 1;
      const hits = rc.intersectObjects(scene.children, true).filter(o => o.object.isMesh && o.distance > 0.01);
      out.push({
        X, Z, hh, camDist: +dist.toFixed(2),
        hits: hits.slice(0, 3).map(h => `${h.object.name || h.object.type}@${h.distance.toFixed(2)}`),
      });
    }
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
