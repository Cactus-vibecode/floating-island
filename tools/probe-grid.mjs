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
  const yaw = 0.22, sx0 = -0.66, sz0 = 0.03;
  const toLocal = (x, z) => {
    const dx = x - sx0, dz = z - sz0;
    return { f: +(dx * Math.sin(yaw) + dz * Math.cos(yaw)).toFixed(2), l: +(dx * Math.cos(yaw) - dz * Math.sin(yaw)).toFixed(2) };
  };
  const P = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return [Math.round((v.x + 1) / 2 * W), Math.round((1 - v.y) / 2 * H)]; };
  const rc = new T.Raycaster();
  const rows = [];
  for (let x = -1.5; x <= 0.05; x += 0.15) {
    for (let z = 0.7; z <= 1.6; z += 0.15) {
      const X = +x.toFixed(2), Z = +z.toFixed(2);
      const y = terr(X, Z);
      const gx = (terr(X + 0.12, Z) - terr(X - 0.12, Z)) / 0.24;
      const gz = (terr(X, Z + 0.12) - terr(X, Z - 0.12)) / 0.24;
      const pos = new T.Vector3(X, y + 0.06, Z);
      const dir = pos.clone().sub(cam.position); const dist = dir.length();
      rc.set(cam.position, dir.normalize()); rc.far = dist + 1;
      const hits = rc.intersectObjects(scene.children, true).filter(h => h.object.isMesh && h.distance > 0.01);
      const first = hits[0];
      const clearView = !first || (first.distance > dist - 0.15);
      let nt = 99, ni = -1;
      (isl?.trees || []).forEach((t, i) => { const d = Math.hypot(t.x - X, t.z - Z); if (d < nt) { nt = d; ni = i; } });
      rows.push({ X, Z, y: +y.toFixed(2), s: +Math.hypot(gx, gz).toFixed(2), ...toLocal(X, Z), px: P(X, y, Z)[0], py: P(X, y, Z)[1], nt: +nt.toFixed(2), ni, clear: clearView });
    }
  }
  return { torii: P(sx0, 0.95, sz0), stairsFoot: P(sx0, 0.35, sz0 + 0.75), rows };
});
const good = res.rows.filter(r => r.clear && r.nt > 0.72 && r.s < 0.34 && r.y < 0.07 && r.f > 0.4 && r.f < 1.5 && Math.abs(r.l) < 1.0);
good.sort((a, b) => (b.nt - a.nt) * 0.5 + (a.s - b.s));
console.log('torii', JSON.stringify(res.torii), 'stairsFoot', JSON.stringify(res.stairsFoot));
console.log('good', good.length);
console.log(JSON.stringify(good.slice(0, 18), null, 1));
await b.close();
