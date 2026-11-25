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
  const cands = [[-1.10, 1.00], [-1.02, 1.10], [-1.18, 1.06], [-0.95, 1.22], [-1.30, 1.10], [-0.264, 1.069]];
  const out = cands.map(([x, z]) => {
    const y = terr(x, z);
    const gx = (terr(x + 0.12, z) - terr(x - 0.12, z)) / 0.24;
    const gz = (terr(x, z + 0.12) - terr(x, z - 0.12)) / 0.24;
    const pos = new T.Vector3(x, y + 0.06, z);
    const dir = pos.clone().sub(cam.position); const dist = dir.length();
    rc.set(cam.position, dir.normalize()); rc.far = dist + 1;
    const hits = rc.intersectObjects(scene.children, true).filter(h => h.object.isMesh && h.distance > 0.01);
    const first = hits[0];
    // 最近树
    let nt = 99, ni = -1;
    (isl?.trees || []).forEach((t, i) => { const d = Math.hypot(t.x - x, t.z - z); if (d < nt) { nt = d; ni = i; } });
    return {
      x, z, y: +y.toFixed(3), slope: +Math.hypot(gx, gz).toFixed(2), ...toLocal(x, z),
      px: P(x, y, z), nearTree: +nt.toFixed(2), nearTreeId: ni,
      blockedBy: first ? (first.object.name || first.object.type) : 'none',
      blockDist: first ? +first.distance.toFixed(2) : null, camDist: +dist.toFixed(2),
    };
  });
  return { torii: P(sx0, 0.95, sz0), stairsFoot: P(sx0, 0.35, sz0 + 0.75), cands: out };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
