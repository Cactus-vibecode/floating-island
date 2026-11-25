// 校验不同 zoom 下的配色是否一致
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
const out = '/tmp/cmp/zoomchk';
fs.mkdirSync(out, { recursive: true });
for (const zoom of ['0.6', '1', '1.4']) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let b;
    try {
      b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
      const p = await b.newPage();
      await p.setViewport({ width: 640, height: 640 });
      await new Promise(r=>setTimeout(r,200));
      await p.goto('file://' + path.resolve('dist/index.html') + `?widget&clean&season=1&hour=13&zoom=${zoom}`, { waitUntil:'domcontentloaded', timeout: 25000 });
      await new Promise(r=>setTimeout(r,2300));
      await p.screenshot({ path: `${out}/z${zoom}.png` });
      console.log('->', `${out}/z${zoom}.png`);
      break;
    } catch (e) {
      console.log('retry', zoom, String(e).slice(0,40));
    } finally { if (b) await b.close().catch(()=>{}); }
  }
}
