import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 900 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=9.9', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 1800));
const res = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, terr = window.__terrain, isl = window.__isl, scene = window.__scene;
  const W = window.innerWidth, H = window.innerHeight;
  const rc = new T.Raycaster();
  const P = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return [Math.round((v.x + 1) / 2 * W), Math.round((1 - v.y) / 2 * H)]; };
  const out = [];
  for (let x = -0.95; x <= -0.35; x += 0.1) {
    for (let z = 0.85; z <= 1.35; z += 0.1) {
      const X = +x.toFixed(2), Z = +z.toFixed(2);
      const y = terr(X, Z);
      // 检查三个高度：垫面 0.03 / 坐姿小孩中段 0.12 / 帽子 0.20
      const hs = [0.03, 0.12, 0.20];
      const vis = hs.map(hh => {
        const pos = new T.Vector3(X, y + hh, Z);
        const dir = pos.clone().sub(cam.position); const dist = dir.length();
        rc.set(cam.position, dir.normalize()); rc.far = dist + 1;
        const hits = rc.intersectObjects(scene.children, true).filter(o => o.object.isMesh && o.distance > 0.01);
        const f = hits[0];
        return !f || f.distance > dist - 0.25;
      });
      let nt = 99, ni = -1;
      (isl?.trees || []).forEach((t, i) => { const d = Math.hypot(t.x - X, t.z - Z); if (d < nt) { nt = d; ni = i; } });
      out.push({ X, Z, y: +y.toFixed(2), ok: vis.filter(Boolean).length, vis, nt: +nt.toFixed(2), ni, px: P(X, y + 0.12, Z) });
    }
  }
  return out;
});
const ok = res.filter(r => r.ok === 3);
console.log('all3 visible:', ok.length);
console.log(JSON.stringify(ok.map(r => [r.X, r.Z, r.y, r.nt, r.ni, r.px]).sort((a, b) => b[3] - a[3]).slice(0, 20)));
console.log('partial:');
console.log(JSON.stringify(res.filter(r => r.ok === 2).map(r => [r.X, r.Z, r.y, r.nt, r.ni, r.px])));
await b.close();
