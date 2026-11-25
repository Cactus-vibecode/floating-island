import puppeteer from 'puppeteer-core';
import path from 'node:path';
const season = process.argv[2] || '1';
const cx = Number(process.argv[3] || 320), cy = Number(process.argv[4] || 400);
const size = Number(process.argv[5] || 240), out = process.argv[6] || '/tmp/z.png';
const hour = process.argv[7] || '13';
let b;
for (let i = 0; i < 3; i++) {
  try {
    b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
    const p = await b.newPage();
    await p.setViewport({ width: 700, height: 700, deviceScaleFactor: 1.6 });
    await new Promise(r => setTimeout(r, 200));
    await p.goto('file://' + path.resolve('dist/index.html') + `?widget&clean&season=${season}&hour=${hour}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 2400));
    await p.screenshot({ path: out, clip: { x: cx, y: cy, width: size, height: size } });
    console.log('->', out);
    break;
  } catch (e) {
    console.log('retry', String(e).slice(0, 60));
  } finally { if (b) await b.close().catch(()=>{}); }
}
