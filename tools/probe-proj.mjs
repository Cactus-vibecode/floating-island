import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({width:900,height:900});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=9.9', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,1800));
const out = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, isl = window.__isl;
  return (isl?.trees||[]).map(t => {
    const v = new T.Vector3(t.x, t.y + 0.55 * t.s, t.z).project(cam);
    return { x:+t.x.toFixed(2), z:+t.z.toFixed(2), sp:t.sp, s:+t.s.toFixed(2),
             u:+((v.x+1)/2).toFixed(3), v:+((1-v.y)/2).toFixed(3) };
  }).sort((a,b)=> (Math.hypot(a.u-0.42,a.v-0.62)+Math.hypot(a.u-0.54,a.v-0.62)) - (Math.hypot(b.u-0.42,b.v-0.62)+Math.hypot(b.u-0.54,b.v-0.62)));
});
console.log(JSON.stringify(out.slice(0,10),null,0));
await b.close();
