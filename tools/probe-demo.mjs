import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({width:900,height:900});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=13', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,1600));
const res = await p.evaluate(() => {
  const T = window.__three, cam = window.__cam, isl = window.__isl, terr = window.__terrain;
  const P = (x,y,z) => { const v = new T.Vector3(x,y,z).project(cam); return { u:+((v.x+1)/2).toFixed(3), v:+((1-v.y)/2).toFixed(3) }; };
  const cands = [[-0.92,1.16],[-0.98,1.05],[-0.86,1.24],[-1.05,1.20]];
  const c = cands.map(([x,z]) => ({ x, z, y:+terr(x,z).toFixed(2), ...P(x, terr(x,z)+0.04, z) }));
  const trees = (isl?.trees||[]).map((t,i)=>({ i, x:+t.x.toFixed(2), z:+t.z.toFixed(2), sp:t.sp, s:+t.s.toFixed(2), ...P(t.x, t.y+0.30*t.s, t.z) }));
  const picks = [59,57,26,47,46,58,32,21,51,52,53,23,56];
  return { cands: c, all: trees.length, picks: trees.filter(t=>picks.includes(t.i)), torii: P(-0.66,1.05,0.03), stairs: P(-0.52,0.30,0.72) };
});
console.log(JSON.stringify(res,null,1));
await b.close();
