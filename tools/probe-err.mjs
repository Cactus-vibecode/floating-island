import puppeteer from 'puppeteer-core';
import path from 'node:path';
let b;
for (let i=0;i<3;i++){
  try {
    b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
    break;
  } catch(e){ console.log('retry launch'); }
}
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0,180)));
p.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,160)); });
await p.setViewport({ width: 520, height: 520 });
for (const s of [0,1,2,3]) {
  for (const h of [8,13,21]) {
    await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${s}&hour=${h}`, { waitUntil:'domcontentloaded', timeout: 25000 });
    await new Promise(r=>setTimeout(r,1200));
  }
}
console.log('errors:', errs.length ? errs : 'none');
await b.close();
