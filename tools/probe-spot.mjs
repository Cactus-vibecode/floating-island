import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({width:820,height:820});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=13', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,1800));
const res = await p.evaluate(() => {
  const T = window.__three, terr = window.__terrain, cam = window.__cam, isl = window.__isl;
  const yaw = 0.22, sx = -0.66, sz = 0.03;
  const toW = (lx, lz) => ({ x: sx + lx*Math.cos(yaw) + lz*Math.sin(yaw), z: sz - lx*Math.sin(yaw) + lz*Math.cos(yaw) });
  const rc = new T.Raycaster();
  const out = [];
  for (const [lx, lz] of [[0,0.85],[0.18,0.9],[-0.18,0.9],[0.05,1.0],[-0.05,1.05],[0.2,1.0]]) {
    const w = toW(lx, lz);
    const y = terr(w.x, w.z);
    const dx = (terr(w.x+0.1,w.z)-y)/0.1, dz = (terr(w.x,w.z+0.1)-y)/0.1;
    const pos = new T.Vector3(w.x, y+0.10, w.z);
    const dir = pos.clone().sub(cam.position); const dist = dir.length();
    rc.set(cam.position, dir.normalize()); rc.far = dist+1;
    const hits = rc.intersectObjects(window.__scene.children, true).filter(h=>h.object.isMesh && h.distance>0.01);
    const blocked = hits.length ? hits[0].object.name || hits[0].object.type : 'none';
    const nearT = (isl?.trees||[]).reduce((m,t)=>Math.min(m, Math.hypot(t.x-w.x, t.z-w.z)), 99);
    out.push({ lx, lz, x:+w.x.toFixed(2), z:+w.z.toFixed(2), y:+y.toFixed(2), slope:+Math.hypot(dx,dz).toFixed(2), nearTree:+nearT.toFixed(2), firstHit: blocked, hd: hits.length? +hits[0].distance.toFixed(2):null });
  }
  return out;
});
console.log(JSON.stringify(res,null,1));
await b.close();
