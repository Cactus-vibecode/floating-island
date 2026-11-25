import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 900 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=9.9', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2000));
const res = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, isl = window.__isl;
  const W = window.innerWidth, H = window.innerHeight;
  const yaw = 0.22, sx0 = -0.66, sz0 = 0.03;
  const toLocal = (x, z) => {
    const dx = x - sx0, dz = z - sz0;
    return { f: dx * Math.sin(yaw) + dz * Math.cos(yaw), l: dx * Math.cos(yaw) - dz * Math.sin(yaw) };
  };
  const out = [];
  (isl?.trees || []).forEach((t, i) => {
    const v = new T.Vector3(t.x, t.y + 0.45 * t.s, t.z).project(cam);
    const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
    if (px < 300 || px > 720 || py < 280 || py > 580) return;
    const { f, l } = toLocal(t.x, t.z);
    const hot = f > -0.4 && f < 1.7 && Math.abs(l) < 0.95;
    const d = document.createElement('div');
    d.textContent = String(i);
    d.style.cssText = `position:fixed;left:${px}px;top:${py}px;transform:translate(-50%,-50%);font:bold 13px/1 -apple-system;color:#fff;background:${hot ? '#e11' : '#2b6be6'};padding:2px 4px;border-radius:3px;z-index:99999;pointer-events:none`;
    document.body.appendChild(d);
    out.push({ i, x: +t.x.toFixed(2), z: +t.z.toFixed(2), sp: t.sp, s: +t.s.toFixed(2), f: +f.toFixed(2), l: +l.toFixed(2), px: Math.round(px), py: Math.round(py), hot });
  });
  const tor = new T.Vector3(sx0, 1.1, sz0).project(cam);
  return {
    total: (isl?.trees || []).length,
    toriiPx: [Math.round((tor.x + 1) / 2 * W), Math.round((1 - tor.y) / 2 * H)],
    list: out.sort((a, b) => b.f - a.f),
  };
});
await p.screenshot({ path: '/private/tmp/cmp/front/marks2.png' });
console.log(JSON.stringify(res, null, 1));
await b.close();
