import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({width:900,height:900});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=9.9', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,2000));
const list = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, isl = window.__isl;
  const W = window.innerWidth, H = window.innerHeight;
  const out = [];
  (isl?.trees||[]).forEach((t,i) => {
    const v = new T.Vector3(t.x, t.y + 0.45*t.s, t.z).project(cam);
    const sx = (v.x+1)/2*W, sy = (1-v.y)/2*H;
    if (sx<0||sx>W||sy<0||sy>H) return;
    const d = document.createElement('div');
    d.textContent = String(i);
    d.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);font:bold 12px/1 -apple-system;color:#fff;background:#e11;padding:2px 4px;border-radius:3px;z-index:99999;pointer-events:none`;
    document.body.appendChild(d);
    out.push([i, +t.x.toFixed(2), +t.z.toFixed(2), t.sp, +t.s.toFixed(2)]);
  });
  return out;
});
await p.screenshot({ path:'/private/tmp/cmp/marks.png' });
console.log(JSON.stringify(list));
await b.close();
