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
  const trees = (isl?.trees||[]).map((t,i)=>({ i, x:+t.x.toFixed(2), z:+t.z.toFixed(2), sp:t.sp, s:+t.s.toFixed(2), ...P(t.x, t.y+0.35*t.s, t.z) }));
  const front = trees.filter(t=>t.v>0.52).sort((a,b)=>a.v-b.v);
  const grid = [];
  for (let x=-1.6; x<=0.6; x+=0.2) for (let z=0.7; z<=1.9; z+=0.2) {
    grid.push([+x.toFixed(1), +z.toFixed(1), +terr(x,z).toFixed(2)]);
  }
  return { torii: P(-0.66, 1.1, 0.03), stairsFoot: P(-0.52, 0.35, 0.72), front, grid };
});
console.log(JSON.stringify(res,null,1));
await b.close();
