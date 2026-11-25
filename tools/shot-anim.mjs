import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
const outDir = process.argv[2] || '/private/tmp/cmp/anim';
const season = process.argv[3] || '2';
const size = Number(process.argv[4] || 820);
fs.mkdirSync(outDir, { recursive: true });
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: size, height: size });
await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${season}&hour=13&zoom=1`, { waitUntil:'domcontentloaded' });
await new Promise(r=>setTimeout(r,2200));
for (let i = 0; i < 4; i++) {
  await p.screenshot({ path: `${outDir}/f${i}.png` });
  console.log('shot', i);
  await new Promise(r=>setTimeout(r,2100));
}
await b.close();
