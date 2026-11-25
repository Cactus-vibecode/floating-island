import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({width:820,height:820});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=13', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,1600));
const res = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, isl = window.__isl;
  const PIC = { x:-0.344, z:0.984 };
  const out = [];
  (isl?.trees||[]).forEach((t,i)=>{
    const d = Math.hypot(t.x-PIC.x, t.z-PIC.z);
    if (d > 1.6) return;
    const v = new T.Vector3(t.x, t.y+0.5*t.s, t.z).project(cam);
    out.push({ i, x:+t.x.toFixed(2), z:+t.z.toFixed(2), sp:t.sp, s:+t.s.toFixed(2), d:+d.toFixed(2),
      u:+((v.x+1)/2).toFixed(3), v:+((1-v.y)/2).toFixed(3) });
  });
  const vp = new T.Vector3(PIC.x, 0.05, PIC.z).project(cam);
  return { picnic: { u:+((vp.x+1)/2).toFixed(3), v:+((1-vp.y)/2).toFixed(3) }, near: out.sort((a,b)=>a.d-b.d) };
});
console.log(JSON.stringify(res,null,1));
await b.close();
