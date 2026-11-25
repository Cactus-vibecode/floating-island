import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 500, height: 500 });
await p.goto('file://' + path.resolve('dist/index.html') + '?capture&debug', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 700));
const out = await p.evaluate(() => {
  window.__step(10);
  const wl = window.__wl;
  const T = window.__three;
  const f = wl.flies[0];
  const wp = new T.Vector3();
  f.g.getWorldPosition(wp);
  let cnt = 0;
  window.__scene.traverse(o => { if (o.isMesh && o.material === f.mat) cnt++; });
  return {
    inScene: !!f.g.parent, parentType: f.g.parent && f.g.parent.type,
    childCount: f.g.children.length,
    world: wp.toArray().map(v => +v.toFixed(2)),
    cam: window.__cam.position.toArray().map(v => +v.toFixed(2)),
    meshesWithMat: cnt,
    gVisible: f.g.visible, matVisible: f.mat.visible, opacity: f.mat.opacity,
    geoBox: f.g.children[0].geometry.boundingSphere ? 'has' : 'none',
  };
});
console.log(JSON.stringify(out));
await b.close();
