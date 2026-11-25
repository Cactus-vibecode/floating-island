import puppeteer from 'puppeteer-core';
import path from 'node:path';
const hour = process.argv[2] || '21';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('[err]', String(e).slice(0,200)));
p.on('console', m => { if (m.type()==='error') console.log('[console]', m.text().slice(0,200)); });
await p.setViewport({ width: 620, height: 620 });
await new Promise(r=>setTimeout(r,200));
await p.goto('file://' + path.resolve('dist/index.html') + `?widget&clean&season=1&hour=${hour}&debug`, { waitUntil:'domcontentloaded', timeout: 25000 });
await new Promise(r=>setTimeout(r,2600));
const info = await p.evaluate(() => {
  const l = window.__light ? window.__light() : 'no light';
  const lan = window.__lanterns;
  let groupVisible = null, lampsCount = 0, lampMat = null;
  if (lan) {
    groupVisible = lan.group.visible;
    lampsCount = lan.count;
    lan.group.traverse(o => { if (o.isInstancedMesh && !lampMat) lampMat = { count: o.count, opacity: o.material.opacity, emissiveIntensity: o.material.emissiveIntensity }; });
  }
  return { light: l, groupVisible, lampsCount, lampMat, childCount: lan ? lan.group.children.length : -1 };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
