import puppeteer from 'puppeteer-core';
import path from 'node:path';
const season = process.argv[2] ?? '1';
const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
p.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
await p.setViewport({ width: 620, height: 620 });
await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${season}&hour=11&debug`, {
  waitUntil: 'domcontentloaded', timeout: 25000,
});
await new Promise((r) => setTimeout(r, 4000));
const info = await p.evaluate(() => {
  if (!window.__life) return 'no life';
  const g = window.__life.groups;
  const count = (o) => { let n = 0; o.traverse((c) => { if (c.isMesh) n++; }); return n; };
  return {
    flowers: count(g.flowerGroup), folk: count(g.folkGroup),
    dogsA: count(g.dogAGroup), dogsW: count(g.dogWGroup), play: count(g.playGroup),
    vis: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.visible])),
    info: window.__life.info, stream: window.__isl.streamList.map((p,i)=>({i, u:+(i/(window.__isl.streamList.length-1)).toFixed(2), x:+p.x.toFixed(2), z:+p.z.toFixed(2), y:+p.y.toFixed(2), hw:+p.hw.toFixed(2)})), stream: window.__isl.streamList.map((p,i)=>({i, u:+(i/(window.__isl.streamList.length-1)).toFixed(2), x:+p.x.toFixed(2), z:+p.z.toFixed(2), y:+p.y.toFixed(2), hw:+p.hw.toFixed(2)})),
  };
});
console.log(JSON.stringify(info));
await p.screenshot({ path: '/tmp/dbg.png' });
await b.close();
